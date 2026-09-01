import { readFile, mkdir, writeFile, readdir } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(projectRoot, "apple-news-build");
const outputRoot = join(projectRoot, "apple-news-preview");
const publicRoot = join(projectRoot, "public");
const projectAssetBaseURL = "https://projects.montanafreepress.org/election-guide-2026/";
const checkOnly = process.argv.includes("--check");

const voidElements = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

function splitTopLevelElements(html, sourceName) {
  const elements = [];
  const tagPattern = /<!--[\s\S]*?-->|<![^>]*>|<\/?([A-Za-z][\w:-]*)\b[^>]*>/g;
  const stack = [];
  let elementStart = null;
  let match;

  while ((match = tagPattern.exec(html))) {
    const token = match[0];
    if (token.startsWith("<!--") || token.startsWith("<!")) continue;

    const tagName = match[1].toLowerCase();
    const isClosing = token.startsWith("</");
    const isSelfClosing = token.endsWith("/>") || voidElements.has(tagName);

    if (!isClosing) {
      if (stack.length === 0) elementStart = match.index;
      if (!isSelfClosing) stack.push(tagName);

      if (isSelfClosing && stack.length === 0 && elementStart !== null) {
        elements.push(html.slice(elementStart, tagPattern.lastIndex).trim());
        elementStart = null;
      }
      continue;
    }

    const expected = stack.pop();
    if (expected !== tagName) {
      throw new Error(
        `${sourceName}: malformed HTML; found </${tagName}> while expecting </${expected ?? "nothing"}>`,
      );
    }

    if (stack.length === 0 && elementStart !== null) {
      elements.push(html.slice(elementStart, tagPattern.lastIndex).trim());
      elementStart = null;
    }
  }

  if (stack.length > 0) {
    throw new Error(`${sourceName}: unclosed <${stack.at(-1)}> element`);
  }

  const meaningfulRemainder = html
    .replace(tagPattern, "")
    .replace(/\s+/g, "")
    .trim();
  if (meaningfulRemainder && elements.length === 0) {
    throw new Error(`${sourceName}: contains text outside a top-level HTML element`);
  }

  return elements;
}

function elementName(html) {
  return html.match(/^<([A-Za-z][\w:-]*)\b/)?.[1].toLowerCase();
}

function innerHtml(html, tagName) {
  const openEnd = html.indexOf(">");
  const closeStart = html.toLowerCase().lastIndexOf(`</${tagName}>`);
  return html.slice(openEnd + 1, closeStart).trim();
}

function attribute(html, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`\\b${escapedName}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"));
  return match?.[2];
}

function decodeHtmlText(html) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return html
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)))
    .replace(/&#x([\da-f]+);/gi, (_, value) => String.fromCodePoint(Number.parseInt(value, 16)))
    .replace(/&([a-z]+);/gi, (entity, name) => named[name.toLowerCase()] ?? entity)
    .replace(/\s+/g, " ")
    .trim();
}

function figureComponent(html, article) {
  const imageTag = html.match(/<img\b[^>]*>/i)?.[0];
  if (!imageTag) throw new Error(`${article.slug}: <figure> does not contain an <img>`);

  const URL = attribute(imageTag, "src");
  if (!URL) throw new Error(`${article.slug}: figure image does not have a src attribute`);

  const altText = decodeHtmlText(attribute(imageTag, "alt") ?? article.featuredImage?.altText ?? "");
  const captionHtml = html.match(/<caption\b[^>]*>([\s\S]*?)<\/caption>/i)?.[1];
  const caption = captionHtml ? decodeHtmlText(captionHtml) : undefined;
  const isPortrait = article.type === "candidate" && URL === article.featuredImage?.publicUrl;

  return {
    role: isPortrait ? "portrait" : "figure",
    URL,
    ...(caption ? { caption } : {}),
    ...(altText ? { accessibilityCaption: altText } : {}),
    layout: isPortrait ? "portrait" : "wide",
  };
}

function htmlToComponents(html, article) {
  const components = [];

  for (const element of splitTopLevelElements(html, article.htmlPath)) {
    const tagName = elementName(element);

    if (tagName === "figure") {
      components.push(figureComponent(element, article));
      continue;
    }

    if (tagName === "h2" || tagName === "h3") {
      components.push({
        role: tagName === "h2" ? "heading2" : "heading3",
        text: innerHtml(element, tagName),
        format: "html",
        layout: "body",
      });
      continue;
    }

    if (tagName === "table") {
      components.push({ role: "htmltable", html: element, layout: "wide" });
      continue;
    }

    if (["p", "ul", "ol", "pre"].includes(tagName)) {
      components.push({ role: "body", text: element, format: "html", layout: "body" });
      continue;
    }

    throw new Error(`${article.htmlPath}: unsupported top-level <${tagName ?? "unknown"}> element`);
  }

  return components;
}

function makeArticleDocument(article, manifest, html) {
  const components = [
    { role: "title", text: article.title, layout: "body" },
    { role: "author", text: "Montana Free Press", layout: "body" },
    ...htmlToComponents(html, article),
  ];

  return {
    version: "1.7",
    identifier: article.slug,
    language: "en-US",
    title: article.title,
    layout: { columns: 12, width: 1024, margin: 60, gutter: 20 },
    documentStyle: { backgroundColor: "#FFFFFF" },
    metadata: {
      canonicalURL: article.sourceUrl,
      thumbnailURL: article.featuredImage.publicUrl,
      excerpt: article.excerpt,
      authors: ["Montana Free Press"],
      datePublished: manifest.generatedAt,
      dateModified: manifest.generatedAt,
    },
    components,
    componentLayouts: {
      body: { columnStart: 1, columnSpan: 10, margin: { top: 10, bottom: 10 } },
      portrait: {
        columnStart: 3,
        columnSpan: 6,
        margin: { top: 18, bottom: 18 },
      },
      wide: { columnStart: 0, columnSpan: 12, margin: { top: 18, bottom: 18 } },
    },
    componentTextStyles: {
      default: {
        fontName: "Helvetica",
        fontSize: 18,
        lineHeight: 26,
        textColor: "#222222",
        linkStyle: { textColor: "#006699" },
      },
      "default-title": {
        fontName: "Helvetica-Bold",
        fontSize: 42,
        lineHeight: 48,
        textColor: "#111111",
      },
      "default-author": {
        fontName: "Helvetica-Bold",
        fontSize: 15,
        textColor: "#555555",
      },
      "default-heading2": {
        fontName: "Helvetica-Bold",
        fontSize: 28,
        lineHeight: 34,
        textColor: "#111111",
      },
      "default-heading3": {
        fontName: "Helvetica-Bold",
        fontSize: 21,
        lineHeight: 27,
        textColor: "#222222",
      },
    },
    textStyles: {
      "default-tag-pre": {
        fontName: "Menlo-Regular",
        fontSize: 15,
        lineHeight: 22,
        textColor: "#333333",
      },
    },
  };
}

function localPathForImageURL(imageURL, article) {
  if (imageURL === article.featuredImage?.publicUrl) {
    return resolve(projectRoot, article.featuredImage.localPath);
  }

  let parsed;
  try {
    parsed = new URL(imageURL);
  } catch {
    throw new Error(`${article.slug}: image URL is not valid: ${imageURL}`);
  }

  const assetBase = new URL(projectAssetBaseURL);
  if (parsed.origin !== assetBase.origin || !parsed.pathname.startsWith(assetBase.pathname)) {
    throw new Error(`${article.slug}: no local asset mapping is available for image URL ${imageURL}`);
  }

  const relativePath = decodeURIComponent(parsed.pathname.slice(assetBase.pathname.length));
  const localPath = resolve(publicRoot, relativePath);
  if (localPath !== publicRoot && !localPath.startsWith(`${publicRoot}${sep}`)) {
    throw new Error(`${article.slug}: image URL resolves outside public/: ${imageURL}`);
  }
  return localPath;
}

async function bundleImages(document, article) {
  const assets = new Map();
  const references = [
    { owner: document.metadata, field: "thumbnailURL" },
    ...document.components
      .filter((component) => typeof component.URL === "string")
      .map((component) => ({ owner: component, field: "URL" })),
  ];

  for (const reference of references) {
    const remoteURL = reference.owner[reference.field];
    const localPath = localPathForImageURL(remoteURL, article);
    const filename = basename(localPath);
    const existingSource = assets.get(filename)?.localPath;
    if (existingSource && existingSource !== localPath) {
      throw new Error(`${article.slug}: two different images have the bundle filename ${filename}`);
    }

    let contents;
    try {
      contents = await readFile(localPath);
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(`${article.slug}: local image does not exist: ${relative(projectRoot, localPath)}`);
      }
      throw error;
    }

    assets.set(filename, { localPath, contents });
    reference.owner[reference.field] = `bundle://${encodeURIComponent(filename)}`;
  }

  return assets;
}

function validateDocument(document, article, assets) {
  for (const field of ["version", "identifier", "language", "title", "layout", "components", "componentTextStyles"]) {
    if (document[field] === undefined) throw new Error(`${article.slug}: missing required ${field}`);
  }

  if (document.identifier.length > 64 || !/^[A-Za-z0-9_-]+$/.test(document.identifier)) {
    throw new Error(`${article.slug}: identifier is not valid for Apple News Format`);
  }

  if (!document.componentTextStyles.default) {
    throw new Error(`${article.slug}: missing the required default component text style`);
  }

  if (!document.components.some(({ role }) => role === "title")) {
    throw new Error(`${article.slug}: missing title component`);
  }

  if (!document.components.some(({ role }) => role === "author" || role === "byline")) {
    throw new Error(`${article.slug}: missing author or byline component`);
  }

  for (const component of document.components) {
    if (component.format === "html" && /<(?:img|table)\b/i.test(component.text)) {
      throw new Error(`${article.slug}: ${component.role} contains HTML that needs its own Apple News component`);
    }
    if (component.text?.includes("@@ARTICLE_URL:")) {
      throw new Error(`${article.slug}: contains an unresolved article URL placeholder`);
    }
  }

  const imageReferences = [
    document.metadata.thumbnailURL,
    ...document.components.filter((component) => component.URL).map((component) => component.URL),
  ];
  for (const reference of imageReferences) {
    if (!reference.startsWith("bundle://")) {
      throw new Error(`${article.slug}: local preview image is not bundled: ${reference}`);
    }
    const filename = decodeURIComponent(reference.slice("bundle://".length));
    if (!assets.has(filename)) {
      throw new Error(`${article.slug}: ${reference} does not have a matching bundled file`);
    }
  }
}

function readme(manifest) {
  const rows = manifest.articles
    .map((article) => `- \`${article.slug}/\` — ${article.title}`)
    .join("\n");

  return `# Apple News local preview bundles

These ${manifest.articles.length} directories are generated from \`../apple-news-build/manifest.json\`,
\`../apple-news-build/articles/*.html\`, and the image files in \`../public/\`. Each article directory
contains its own image assets, referenced with \`bundle://\` URLs, so News Preview does not need to fetch
images from the deployed website. The original upload-oriented HTML and templates are not changed.

## Use in News Preview

1. Open Apple's News Preview app and select a Mac, iPhone, or iPad target.
2. Drag one article directory below onto the News Preview drop area. You can also drag its \`article.json\` file.
3. Open **Window > Console** if Apple reports a validation or rendering problem.
4. Rebuild after changing the source HTML with \`npm run build:apple-news-preview\`.

News Preview loads one local article at a time. Links in these local bundles deliberately use the
existing public election-guide URLs, so clicking them tests link presentation but opens the website.
Native navigation between Apple News articles can only resolve after the target articles exist in an
Apple News channel. The untouched files in \`../apple-news-build/templates/\` retain the
\`@@ARTICLE_URL:key@@\` placeholders for that eventual publishing step.

## Bundles

${rows}
`;
}

async function expectedBuild() {
  const manifest = JSON.parse(await readFile(join(sourceRoot, "manifest.json"), "utf8"));
  const files = new Map();

  if (manifest.counts.articles !== manifest.articles.length) {
    throw new Error(
      `manifest counts ${manifest.counts.articles} articles but contains ${manifest.articles.length} entries`,
    );
  }

  const identifiers = new Set();
  for (const article of manifest.articles) {
    if (identifiers.has(article.slug)) throw new Error(`duplicate article slug: ${article.slug}`);
    identifiers.add(article.slug);

    const htmlPath = join(sourceRoot, article.htmlPath);
    const html = await readFile(htmlPath, "utf8");
    const document = makeArticleDocument(article, manifest, html);
    const assets = await bundleImages(document, article);
    validateDocument(document, article, assets);
    files.set(join(article.slug, "article.json"), Buffer.from(`${JSON.stringify(document, null, 2)}\n`));
    for (const [filename, asset] of assets) {
      files.set(join(article.slug, filename), asset.contents);
    }
  }

  files.set("README.md", Buffer.from(readme(manifest)));
  return { files, manifest };
}

async function checkGenerated(files) {
  const found = [];

  try {
    for (const entry of await readdir(outputRoot, { withFileTypes: true })) {
      if (entry.name === "README.md" && entry.isFile()) found.push("README.md");
      if (!entry.isDirectory()) continue;
      for (const child of await readdir(join(outputRoot, entry.name), { withFileTypes: true })) {
        if (child.isFile()) found.push(join(entry.name, child.name));
      }
    }
  } catch (error) {
    if (error.code === "ENOENT") throw new Error("apple-news-preview does not exist; run the build first");
    throw error;
  }

  const expectedPaths = [...files.keys()].sort();
  const unexpected = found.filter((path) => !files.has(path));
  const missing = expectedPaths.filter((path) => !found.includes(path));
  if (unexpected.length || missing.length) {
    throw new Error(
      `generated file set is stale (missing: ${missing.join(", ") || "none"}; unexpected: ${unexpected.join(", ") || "none"})`,
    );
  }

  for (const [path, expected] of files) {
    const actual = await readFile(join(outputRoot, path));
    if (!actual.equals(expected)) throw new Error(`${relative(projectRoot, join(outputRoot, path))} is stale`);
  }
}

async function main() {
  const { files, manifest } = await expectedBuild();

  if (checkOnly) {
    await checkGenerated(files);
    console.log(`Validated ${manifest.articles.length} current Apple News preview bundles.`);
    return;
  }

  for (const [path, contents] of files) {
    const destination = join(outputRoot, path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, contents);
  }

  console.log(`Built ${manifest.articles.length} Apple News preview bundles in ${relative(projectRoot, outputRoot)}/.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
