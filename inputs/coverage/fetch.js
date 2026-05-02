const fs = require('fs')
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args))

const OUT_PATH = './inputs/coverage/articles.json'

const writeJson = (path, data) => {
  fs.writeFile(path, JSON.stringify(data, null, 2), err => {
    if (err) throw err
    console.log('JSON written to', path)
  })
}

const readExistingJson = path => {
  if (!fs.existsSync(path)) return null
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'))
  } catch (err) {
    console.warn(`Could not parse existing JSON at ${path}: ${err.message}`)
    return null
  }
}

const TAG = '2026-elections' // Replace spaces in tag as seen in CMS with hyphens here
const EXCLUDE_TAG = 'Tracker Exclude'
const QUERY_LIMIT = 100

async function getStories(cursor) {
  const response = await fetch('https://montanafreepress.org/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `
        {
          posts(after: "${cursor}", first: ${QUERY_LIMIT}, where: {tag: "${TAG}"}) {
            pageInfo {
              hasPreviousPage
              hasNextPage
              startCursor
              endCursor
            }
            nodes {
              title
              date
              link
              status
              tags(first: 100) {
                nodes {
                  name
                }
              }
              categories(first: 100) {
                nodes {
                  name
                }
              }
              featuredImage {
                node {
                  link
                }
              }
              author {
                node {
                  name
                }
              }
              excerpt
            }
          }
        }
      `,
    }),
  })

  if (!response.ok) {
    throw new Error(`MTFP GraphQL request failed (${response.status} ${response.statusText})`)
  }

  const json = await response.json()
  if (json.errors && json.errors.length > 0) {
    throw new Error(`MTFP GraphQL returned errors: ${json.errors.map(e => e.message).join('; ')}`)
  }

  if (!json.data || !json.data.posts) {
    throw new Error('MTFP GraphQL response missing data.posts')
  }

  return json.data.posts
}

function clean(raw) {
  return {
    title: raw.title,
    date: raw.date,
    link: raw.link,
    tags: (raw.tags && raw.tags.nodes ? raw.tags.nodes : []).map(d => d.name),
    categories: (raw.categories && raw.categories.nodes ? raw.categories.nodes : []).map(d => d.name),
    featuredImage: raw.featuredImage && raw.featuredImage.node ? raw.featuredImage.node.link : null,
    author: raw.author && raw.author.node ? raw.author.node.name : null,
    // leave excerpt out
  }
}

async function main() {
  const existing = readExistingJson(OUT_PATH)

  let stories = []
  let hasNextPage = true
  let cursor = ''

  try {
    while (hasNextPage) {
      const query = await getStories(cursor)
      stories = stories.concat(query.nodes)
      cursor = query.pageInfo.endCursor
      hasNextPage = query.pageInfo.hasNextPage
    }
  } catch (err) {
    console.warn(`Coverage fetch failed: ${err.message}`)
    if (Array.isArray(existing) && existing.length > 0) {
      console.warn('Keeping existing coverage/articles.json data')
      console.log('MTFP articles fetch done (fallback)\n')
      return
    }
    throw err
  }

  const filtered = stories.filter(d => !(d.tags?.nodes || []).map(t => t.name).includes(EXCLUDE_TAG))
  console.log(`Found ${stories.length} MTFP stories tagged ${TAG}`)
  console.log(`Returned ${filtered.length} excluding tag ${EXCLUDE_TAG}`)

  if (filtered.length === 0 && Array.isArray(existing) && existing.length > 0) {
    console.warn('Coverage API returned zero stories; keeping existing coverage/articles.json data')
    console.log('MTFP articles fetch done (fallback)\n')
    return
  }

  const cleaned = filtered.map(clean)
  writeJson(OUT_PATH, cleaned)
  console.log('MTFP articles fetch done\n')
}

main().catch(err => {
  console.error('Coverage fetch error:', err.message)
  process.exit(1)
})
