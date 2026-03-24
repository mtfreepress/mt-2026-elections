#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE = 'https://projects.montanafreepress.org/capitol-tracker-2025/lawmakers/';
const INPUT = path.join(__dirname, '..', 'content', 'lege-candidate-annotations.csv');
const OUTPUT = path.join(__dirname, 'lege-candidate-url.csv');

function parseCSV(text) {
  const rows = [];
  let cur = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && ch === ',') {
      row.push(cur);
      cur = '';
      continue;
    }
    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (cur !== '' || row.length > 0) {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = '';
      }
      continue;
    }
    cur += ch;
  }
  if (cur !== '' || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

function csvEscape(field) {
  if (field == null) return '';
  const s = String(field);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function titleCase(word) {
  if (!word) return '';
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function slugFromNameFirstLast(name) {
  if (!name) return '';
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  const first = tokens[0] || '';
  const last = tokens.length > 1 ? tokens[tokens.length - 1] : '';
  const parts = last ? [first, last] : [first];
  const cleaned = parts.map(p => p.replace(/[^A-Za-z'-]/g, ''));
  return cleaned.map(s => titleCase(s)).join('-');
}

function extractSuffixFromUrl(url) {
  if (!url) return null;
  try {
    const m = url.match(/lawmakers\/([^\/?#]+)\/?$/i);
    if (m) return m[1];
    const parts = url.replace(/\/?(#.*)?$/, '').split('/').filter(Boolean);
    return parts[parts.length - 1] || null;
  } catch (e) {
    return null;
  }
}

function checkUrl(url, timeout = 10000) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const options = { method: 'HEAD', timeout };
      const req = https.request(u, options, (res) => {
        const ok = res.statusCode >= 200 && res.statusCode < 400;
        resolve(ok);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    } catch (e) {
      resolve(false);
    }
  });
}

async function run() {
  if (!fs.existsSync(INPUT)) {
    console.error('Input CSV not found at', INPUT);
    process.exit(1);
  }
  const raw = fs.readFileSync(INPUT, 'utf8');
  const rows = parseCSV(raw);
  if (rows.length === 0) {
    console.error('No rows parsed from input');
    process.exit(1);
  }
  const header = rows[0].map(h => (h || '').trim());
  const nameIdx = header.findIndex(h => /name/i.test(h));
  const linkIdx = header.findIndex(h => /cap_tracker_2025_link/i.test(h));
  if (nameIdx === -1) {
    console.error('Could not find `name` column in header');
    process.exit(1);
  }
  if (linkIdx === -1) {
    console.error('Could not find `cap_tracker_2025_link` column in header');
    process.exit(1);
  }

  const outRows = [];
  let total = 0;
  let foundCount = 0;
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    if (!cols) continue;
    const name = (cols[nameIdx] || '').trim();
    const oldLink = (cols[linkIdx] || '').trim();
    if (!name) continue;
    total++;
    let slug = null;
    if (oldLink) slug = extractSuffixFromUrl(oldLink);
    if (!slug) slug = slugFromNameFirstLast(name);

    const candidateWithSlash = BASE + slug + '/';
    const candidateNoSlash = BASE + slug;

    let ok = await checkUrl(candidateWithSlash);
    if (!ok) ok = await checkUrl(candidateNoSlash);
    if (ok) foundCount++;
    if (!ok) {
      console.warn('Missing 2025 page for', name, '->', candidateWithSlash);
    }
    const outLink = ok ? candidateWithSlash : '';
    outRows.push([name, outLink]);
  }

  const outLines = ['name,cap_tracker_2025_link,display_name'];
  for (const r of outRows) {
    outLines.push(csvEscape(r[0]) + ',' + csvEscape(r[1]));
  }
  fs.writeFileSync(OUTPUT, outLines.join('\n'), 'utf8');
  console.log('\nWrote', OUTPUT);
  console.log(`${foundCount}/${total} candidate pages returned HTTP 2xx-3xx on ${BASE}`);
}

run().catch(err => { console.error(err); process.exit(1); });
