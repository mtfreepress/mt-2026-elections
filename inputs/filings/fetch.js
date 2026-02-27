const fs = require('fs')
const path = require('path')
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args))

// SoS website for candidate filings
const BASE_URL = 'https://candidatefiling.mt.gov/candidatefiling/CandidateList.aspx?e=450002928'

// first `next page` button control name
const NEXT_PAGE_TARGET = 'ctl00$ContentPlaceHolder1$grdCandidates$ctl00$ctl03$ctl01$ctl12'
const SCRIPT_MANAGER_FIELD = 'ctl00$ContentPlaceHolder1$RadScriptManager1'
const UPDATE_PANEL_ID = 'ctl00$ContentPlaceHolder1$ctl00$ContentPlaceHolder1$RadAjaxPanel1Panel'

const CSV_HEADERS = [
  'Status', 'District Type', 'District', 'Race', 'Term Type', 'Term Length',
  'Name', 'Mailing Address', 'Email/Web Address', 'Phone', 'Filing Date',
  'Party Preference', 'Ballot Order'
]

// html parsing

function extractHiddenField(html, fieldName) {
  const re = new RegExp(`name="${fieldName.replace(/\$/g, '\\$')}"[^>]*value="([^"]*)"`)
  const m = html.match(re)
  return m ? m[1] : ''
}

function extractTotalPages(html) {
// "X items in Y pages" in the pager rgInfoPart to get number of pages
  const m = html.match(/items in <strong>(\d+)<\/strong>\s*pages/)
  return m ? parseInt(m[1], 10) : 1
}

function parseRows(html) {
  const rows = []
  const rowRe = /<tr\s+class="rg(?:Row|AltRow)"[^>]*>([\s\S]*?)<\/tr>/g
  let rowMatch
  while ((rowMatch = rowRe.exec(html)) !== null) {
    const rowHtml = rowMatch[1]
    const cells = []
    const tdRe = /(<td[^>]*>)([\s\S]*?)<\/td>/g
    let tdMatch
    while ((tdMatch = tdRe.exec(rowHtml)) !== null) {
      const tdTag = tdMatch[1]
      const tdContent = tdMatch[2]
      // Skip the hidden status-duplicate column
      if (tdTag.includes('display:none')) continue
      const value = tdContent
        .replace(/<br\s*\/?>/gi, '<br />') // normalize to match existing CSV style
        .replace(/&nbsp;/g, '')            // blank out non-breaking spaces
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .trim()
      cells.push(value)
    }
    if (cells.length > 0) rows.push(cells)
  }
  return rows
}

/**
 * Parse an ASP.NET ScriptManager UpdatePanel delta response.
 * Format: <len>|<type>|<id>|<content>|  (repeating)
 * Returns { html, viewState, viewStateGenerator, eventValidation }
 */
// parse ASP.NET response format for UpdatePanel partial page updates
function parseDeltaResponse(text) {
  let result = { html: '', viewState: '', viewStateGenerator: '', eventValidation: '' }
  let pos = 0
  while (pos < text.length) {
    const pipeAfterLen = text.indexOf('|', pos)
    if (pipeAfterLen === -1) break
    const lengthStr = text.substring(pos, pipeAfterLen)
    const length = parseInt(lengthStr, 10)
    if (isNaN(length)) break

    const typeStart = pipeAfterLen + 1
    const pipeAfterType = text.indexOf('|', typeStart)
    if (pipeAfterType === -1) break
    const type = text.substring(typeStart, pipeAfterType)

    const idStart = pipeAfterType + 1
    const pipeAfterId = text.indexOf('|', idStart)
    if (pipeAfterId === -1) break
    const id = text.substring(idStart, pipeAfterId)

    const contentStart = pipeAfterId + 1
    const content = text.substring(contentStart, contentStart + length)

    if (type === 'updatePanel') {
      result.html = content
    } else if (type === 'hiddenField') {
      if (id === '__VIEWSTATE') result.viewState = content
      if (id === '__VIEWSTATEGENERATOR') result.viewStateGenerator = content
      if (id === '__EVENTVALIDATION') result.eventValidation = content
    }

    pos = contentStart + length + 1 // skip trailing
  }
  return result
}

// fetch

const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
}

async function fetchPage1() {
  console.log('Fetching page 1…')
  const res = await fetch(BASE_URL, {
    headers: {
      ...COMMON_HEADERS,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Upgrade-Insecure-Requests': '1',
    }
  })
  if (!res.ok) throw new Error(`Page 1 request failed: ${res.status} ${res.statusText}`)

  const html = await res.text()

  // capture session cookies for subsequent requests
  const setCookie = res.headers.raw()['set-cookie'] || []
  const cookies = setCookie.map(c => c.split(';')[0]).join('; ')

  return { html, cookies }
}

async function fetchNextPage(formState, cookies) {
  const { viewState, viewStateGenerator, eventValidation, pageNum } = formState

  const body = new URLSearchParams({
    'RadScriptManager1_TSM': '',
    [SCRIPT_MANAGER_FIELD]: `${UPDATE_PANEL_ID}|${NEXT_PAGE_TARGET}`,
    '__EVENTTARGET': NEXT_PAGE_TARGET,
    '__EVENTARGUMENT': '',
    '__LASTFOCUS': '',
    '__VIEWSTATE': viewState,
    '__VIEWSTATEGENERATOR': viewStateGenerator,
    '__EVENTVALIDATION': eventValidation,
  })

  console.log(`Fetching page ${pageNum}…`)
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      ...COMMON_HEADERS,
      'Accept': '*/*',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-MicrosoftAjax': 'Delta=true',
      'X-Requested-With': 'XMLHttpRequest',
      'Origin': 'https://candidatefiling.mt.gov',
      'Referer': BASE_URL,
      ...(cookies ? { 'Cookie': cookies } : {}),
    },
    body: body.toString(),
  })
  if (!res.ok) throw new Error(`Page ${pageNum} request failed: ${res.status} ${res.statusText}`)

  return res.text()
}

// csv helper

function escapeCell(value) {
  // wrap in quotes and escape internal quotes by doubling them
  return `"${String(value).replace(/"/g, '""')}"`
}

function rowsToCsvLines(rows) {
  return rows.map(cells => cells.map(escapeCell).join(','))
}

function todayDateStr() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}${mm}${dd}`
}

async function main() {
  // page 1
  const { html: page1Html, cookies } = await fetchPage1()

  const totalPages = extractTotalPages(page1Html)
  console.log(`Total pages: ${totalPages}`)

  const allRows = parseRows(page1Html)
  console.log(`  → ${allRows.length} rows on page 1`)

  // extract form data for subsequent page requests
  let formState = {
    viewState: extractHiddenField(page1Html, '__VIEWSTATE'),
    viewStateGenerator: extractHiddenField(page1Html, '__VIEWSTATEGENERATOR'),
    eventValidation: extractHiddenField(page1Html, '__EVENTVALIDATION'),
  }

  // pages 2+
  for (let pageNum = 2; pageNum <= totalPages; pageNum++) {
    const deltaText = await fetchNextPage({ ...formState, pageNum }, cookies)

    const parsed = parseDeltaResponse(deltaText)

    const pageRows = parseRows(parsed.html)
    console.log(`  → ${pageRows.length} rows on page ${pageNum}`)
    allRows.push(...pageRows)

    if (parsed.viewState) formState.viewState = parsed.viewState
    if (parsed.viewStateGenerator) formState.viewStateGenerator = parsed.viewStateGenerator
    if (parsed.eventValidation) formState.eventValidation = parsed.eventValidation
  }

  console.log(`Total rows collected: ${allRows.length}`)

  const outFileName = `CandidateList_${todayDateStr()}.csv`
  const outPath = path.join(__dirname, outFileName)

  const headerLine = CSV_HEADERS.map(escapeCell).join(',')
  const dataLines = rowsToCsvLines(allRows)
  const csvContent = [headerLine, ...dataLines].join('\n') + '\n'

  fs.writeFileSync(outPath, csvContent, 'utf8')
  console.log(`\nWrote ${allRows.length} candidates to ${outPath}`)
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
