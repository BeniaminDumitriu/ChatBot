import 'dotenv/config'
import { getSupabase } from './supabase.js'
import { parse } from 'node-html-parser'
import { pipeline } from '@xenova/transformers'

// Usage:
// node server/ingest.js --site acme --url https://acme.ro --max 50

function getArg(name, def = undefined) {
  const idx = process.argv.indexOf(`--${name}`)
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1]
  return def
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'ChatBot-Ingest/1.0' } })
  if (!res.ok) throw new Error(`Fetch failed ${res.status} ${url}`)
  return await res.text()
}

function extractText(html, baseUrl) {
  const root = parse(html)
  root.querySelectorAll('script,style,noscript').forEach((el) => el.remove())
  const text = root.text.replace(/\s+/g, ' ').trim()
  return text
}

function chunkText(text, maxChars = 2000, overlap = 200) {
  const chunks = []
  let i = 0
  while (i < text.length) {
    const end = Math.min(i + maxChars, text.length)
    const chunk = text.slice(i, end).trim()
    if (chunk.length > 0) chunks.push(chunk)
    i = end - overlap
    if (i < 0) i = 0
    if (i >= text.length) break
  }
  return chunks
}

async function* iterateUrls(startUrl, maxPages = 30) {
  const seen = new Set()
  const queue = [startUrl]
  const origin = new URL(startUrl).origin
  while (queue.length && seen.size < maxPages) {
    const url = queue.shift()
    if (!url || seen.has(url)) continue
    seen.add(url)
    let html = ''
    try {
      html = await fetchText(url)
    } catch (e) {
      console.warn('Skip URL (fetch failed):', url)
      continue
    }
    yield { url, html }
    // Extract internal links
    try {
      const root = parse(html)
      root.querySelectorAll('a[href]').forEach((a) => {
        const href = a.getAttribute('href') || ''
        if (!href || href.startsWith('#') || href.startsWith('mailto:')) return
        let next
        try {
          next = new URL(href, url).href
        } catch { return }
        if (next.startsWith(origin) && !seen.has(next) && queue.length < maxPages * 2) {
          queue.push(next)
        }
      })
    } catch {}
  }
}

async function main() {
  const siteId = getArg('site') || process.env.SITE_ID
  const startUrl = getArg('url') || process.env.SITE_START_URL
  const maxPages = parseInt(getArg('max', '30'), 10)
  if (!siteId || !startUrl) {
    console.error('Usage: node server/ingest.js --site <siteId> --url <startUrl> [--max 50]')
    process.exit(1)
  }

  console.log('Ingest start', { siteId, startUrl, maxPages })
  const supabase = getSupabase()
  const embedder = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small')

  for await (const { url, html } of iterateUrls(startUrl, maxPages)) {
    try {
      const text = extractText(html, url)
      const chunks = chunkText(text)
      for (const content of chunks) {
        const output = await embedder(content, { pooling: 'mean', normalize: true })
        const embedding = Array.from(output.data)
        const { error } = await supabase.from('documents').insert({
          site_id: siteId,
          url,
          content,
          embedding,
        })
        if (error) console.error('Insert error:', error)
        await sleep(50) // gentle pacing
      }
      console.log('Indexed:', url, 'chunks:', chunks.length)
    } catch (e) {
      console.warn('Skip URL (process failed):', url, e?.message)
    }
  }
  console.log('Ingest done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})





