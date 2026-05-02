const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
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

const DEFAULT_OUT_PATH = path.join(__dirname, 'CandidateList.csv')

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
  console.log('Fetching CandidateList.csv')
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

async function fetchExportCsv(formState, cookies) {
  const EXPORT_TARGET = 'ctl00$ContentPlaceHolder1$grdCandidates$ctl00$ctl02$ctl00$ExportToCsvButton'

  const body = new URLSearchParams({
    '__EVENTTARGET': EXPORT_TARGET,
    '__EVENTARGUMENT': '',
    '__LASTFOCUS': '',
    '__VIEWSTATE': formState.viewState,
    '__VIEWSTATEGENERATOR': formState.viewStateGenerator,
    '__EVENTVALIDATION': formState.eventValidation,
  })

  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      ...COMMON_HEADERS,
      'Accept': 'text/csv,*/*;q=0.9',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': BASE_URL,
      ...(cookies ? { 'Cookie': cookies } : {}),
    },
    body: body.toString(),
  })

  if (!res.ok) throw new Error(`Export request failed: ${res.status} ${res.statusText}`)
  return res
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
  // fetch initial page to capture viewstate and cookies
  const { html: page1Html, cookies } = await fetchPage1()

  // extract form data required for the postback that triggers CSV export
  const formState = {
    viewState: extractHiddenField(page1Html, '__VIEWSTATE'),
    viewStateGenerator: extractHiddenField(page1Html, '__VIEWSTATEGENERATOR'),
    eventValidation: extractHiddenField(page1Html, '__EVENTVALIDATION'),
  }

  // request the CSV export and write the response body directly
  const res = await fetchExportCsv(formState, cookies)

  // prefer filename from Content-Disposition when present, otherwise default
  const cd = res.headers.get('content-disposition') || ''
  let fileName = 'CandidateList.csv'
  const m = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/) // handle filename or filename*
  if (m) fileName = decodeURIComponent(m[1])

  const outPath = path.join(__dirname, fileName)
  const arr = await res.arrayBuffer()
  const buf = Buffer.from(arr)
  const csvText = buf.toString('utf8')

  const hasExpectedHeader = csvText.includes('"Status"') && csvText.includes('"Name"')
  const looksLikeHtmlError = /<html|<!doctype html/i.test(csvText)
  if (!hasExpectedHeader || looksLikeHtmlError || buf.length < 500) {
    console.warn('Downloaded CandidateList payload looked invalid or empty; keeping existing CandidateList.csv')
    if (fs.existsSync(outPath)) return
    throw new Error('Downloaded CandidateList payload invalid and no existing fallback file found')
  }

  // compute sha256 of existing file (if present) and downloaded content
  const newHash = crypto.createHash('sha256').update(buf).digest('hex')
  if (fs.existsSync(outPath)) {
    const existing = fs.readFileSync(outPath)
    const existingHash = crypto.createHash('sha256').update(existing).digest('hex')
    if (existingHash === newHash) {
      console.log('No updates to CandidateList.csv')
      return
    }
  }

  fs.writeFileSync(outPath, buf)
  console.log('New filings — CandidateList.csv updated')
}

main().catch(err => {
  if (fs.existsSync(DEFAULT_OUT_PATH)) {
    console.warn(`Filings fetch failed (${err.message}); keeping existing CandidateList.csv`)
    process.exit(0)
  }

  console.error('Error:', err)
  process.exit(1)
})
