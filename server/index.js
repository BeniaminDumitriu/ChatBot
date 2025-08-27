import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { getSupabase } from './supabase.js'

const app = express()

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const SITE_URL = process.env.SITE_URL || 'http://localhost:5173'
const OPENROUTER_MODEL_DEFAULT = process.env.OPENROUTER_MODEL || 'meta-llama/Meta-Llama-3-8B-Instruct'
const OPENROUTER_ALLOWED_MODELS = (process.env.OPENROUTER_ALLOWED_MODELS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const RATE_LIMIT_DISABLED = String(process.env.RATE_LIMIT_DISABLED || '').toLowerCase() === 'true'
const RATE_LIMIT_MAX_PER_MONTH = Number(process.env.RATE_LIMIT_MAX_PER_MONTH || '10')
const MODEL_FALLBACK = String(process.env.MODEL_FALLBACK || 'false').toLowerCase() === 'true'
const SESSION_MEMORY_MAX_MESSAGES = Number(process.env.SESSION_MEMORY_MAX_MESSAGES || '10')
const SESSION_MEMORY_TTL_MS = Number(process.env.SESSION_MEMORY_TTL_MS || String(30 * 60 * 1000))

app.use(cors({ origin: true }))
app.use(express.json({ limit: '1mb' }))

// Memorie volatilă per sesiune (în RAM), ștearsă automat după TTL
const sessionMemory = new Map()
function getSessionHistory(sessionId) {
  if (!sessionId) return []
  const entry = sessionMemory.get(sessionId)
  if (!entry) return []
  entry.lastSeen = Date.now()
  return Array.isArray(entry.messages) ? entry.messages : []
}
function appendSessionHistory(sessionId, userText, aiText) {
  if (!sessionId) return
  const prev = getSessionHistory(sessionId)
  const next = [...prev, { role: 'user', content: userText }, { role: 'assistant', content: aiText }]
  const trimmed = next.slice(-SESSION_MEMORY_MAX_MESSAGES * 2)
  sessionMemory.set(sessionId, { messages: trimmed, lastSeen: Date.now() })
}
function resetSession(sessionId) {
  if (!sessionId) return
  sessionMemory.delete(sessionId)
}
setInterval(() => {
  const now = Date.now()
  for (const [sid, entry] of sessionMemory.entries()) {
    if ((entry?.lastSeen || 0) + SESSION_MEMORY_TTL_MS < now) {
      sessionMemory.delete(sid)
    }
  }
}, 5 * 60 * 1000)

function logInteraction(question, answer, meta = {}) {
  const timestamp = new Date().toISOString()
  const ip = meta.ip ? ` ip=${meta.ip}` : ''
  console.log(`[chat][${timestamp}]${ip} Q: ${question}`)
  console.log(`[chat][${timestamp}]${ip} A: ${answer}`)
}

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for']
  let ip = ''
  if (typeof xf === 'string' && xf.length > 0) {
    ip = xf.split(',')[0].trim()
  } else if (Array.isArray(xf) && xf.length > 0) {
    ip = String(xf[0]).trim()
  } else {
    ip = req.socket?.remoteAddress || ''
  }
  // Normalize IPv6 prefix
  if (ip.startsWith('::ffff:')) ip = ip.substring(7)
  return ip
}

function getMonthStartUtc() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
}

function looksLikeCode(text) {
  if (!text) return false
  const lower = text.toLowerCase()
  if (text.includes('```')) return true
  if (/[{}();=<>]/.test(text) && /\b(function|const|let|var|class|return|if|else|for|while|async|await|import|export)\b/.test(lower)) return true
  if (/(<[^>]+>)/.test(text)) return true // possible JSX/HTML
  if (/\b(cod|funcție|functie|clasă|clasa|snippet)\b/.test(lower)) return true
  return false
}

function normalizeImages(images) {
  if (!images) return []
  if (!Array.isArray(images)) return []
  return images
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean)
}

function buildOpenRouterPayload({ model, message, images, historyMsgs }) {
  const base = {
    model,
    temperature: 0.3,
    max_tokens: 256,
  }

  const safeHistory = Array.isArray(historyMsgs)
    ? historyMsgs
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-20)
    : []

  if (Array.isArray(images) && images.length > 0) {
    return {
      ...base,
      messages: [
        { role: 'system', content: buildContextSystemPrompt(globalThis.__siteIdForPrompt, globalThis.__siteDocsForPrompt) },
        ...safeHistory,
        {
          role: 'user',
          content: [
            { type: 'text', text: message },
            ...images.map((url) => ({ type: 'image_url', image_url: { url } })),
          ],
        },
      ],
    }
  }

  return {
    ...base,
    messages: [
      { role: 'system', content: buildContextSystemPrompt(globalThis.__siteIdForPrompt, globalThis.__siteDocsForPrompt) },
      ...safeHistory,
      { role: 'user', content: message },
    ],
  }
}

// Simplificare: dezactivăm temporar embeddings locale pentru a evita dependențe native (sharp)
async function getEmbedder() {
  return {
    async call(text) {
      // Dummy embedding fix (384 dims) – nu produce ranking real, dar păstrează pipeline-ul funcțional
      const arr = new Array(384).fill(0)
      let h = 0
      for (let i = 0; i < text.length; i++) {
        h = (h * 31 + text.charCodeAt(i)) >>> 0
      }
      for (let i = 0; i < arr.length; i++) arr[i] = ((h + i * 997) % 1000) / 1000
      return { data: Float32Array.from(arr) }
    },
    async apply(text, opts) { return this.call(text, opts) },
  }
}

function buildContextSystemPrompt(siteId, docs) {
  if (!siteId || !Array.isArray(docs) || docs.length === 0) return 'You are a helpful AI assistant for Romanian websites.'
  const top = docs.slice(0, 4).map((d, i) => {
    const text = String(d.content || '').slice(0, 1200)
    const url = d.url ? `\nSursă: ${d.url}` : ''
    return `[#${i + 1}] ${text}${url}`
  }).join('\n\n')
  return `You are a helpful AI assistant for Romanian websites. Always use the prior conversation history to resolve references (names/pronouns) and stay consistent with what the user already said. When relevant, also use the following site-specific context. If the answer is not in the context, say you don't know.\n\nContext (site=${siteId}):\n${top}`
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/session/reset', (req, res) => {
  const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId.trim().slice(0, 128) : ''
  if (sessionId) resetSession(sessionId)
  res.json({ ok: true })
})

app.post('/api/chat', async (req, res) => {
  try {
    if (!OPENROUTER_API_KEY) {
      return res.status(500).json({ error: 'Lipsește OPENROUTER_API_KEY' })
    }

    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : ''
    const images = normalizeImages(req.body?.images)
    const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId.trim().slice(0, 128) : ''
    const siteId = typeof req.body?.siteId === 'string' ? req.body.siteId.trim().slice(0, 64) : ''
    if (!message) {
      return res.status(400).json({ error: 'Câmpul "message" este obligatoriu.' })
    }

    // Determină lista de modele acceptate pentru request (per-request selection și fallback)
    function resolveModelsFromRequest() {
      const bodyModel = typeof req.body?.model === 'string' ? req.body.model.trim() : ''
      const bodyModels = Array.isArray(req.body?.models) ? req.body.models : []

      const requested = []
      if (bodyModel) requested.push(bodyModel)
      for (const m of bodyModels) {
        if (typeof m === 'string' && m.trim()) requested.push(m.trim())
      }

      // Filtrăm doar modelele permise, dacă există listă; altfel permitem orice
      let filtered = requested
      if (OPENROUTER_ALLOWED_MODELS.length > 0) {
        const allowedSet = new Set(OPENROUTER_ALLOWED_MODELS)
        filtered = requested.filter((m) => allowedSet.has(m))
      }

      if (filtered.length > 0) return filtered

      // Heuristică implicită: vision dacă avem imagini, altfel coder dacă pare cod, altfel general
      const qwen72 = 'qwen/Qwen2.5-72B-Instruct'
      const qwenCoder = 'qwen/Qwen2.5-Coder-32B-Instruct'
      const llamaVision = 'meta-llama/Llama-3.2-11B-Vision-Instruct'
      const defaultsVisionFirst = [llamaVision, qwen72, qwenCoder]
      const defaultsCoderFirst = [qwenCoder, qwen72]
      const defaultsGeneral = [qwen72, qwenCoder]

      let order = images.length > 0 ? defaultsVisionFirst : looksLikeCode(message) ? defaultsCoderFirst : defaultsGeneral

      if (OPENROUTER_ALLOWED_MODELS.length > 0) {
        const allowedSet = new Set(OPENROUTER_ALLOWED_MODELS)
        order = order.filter((m) => allowedSet.has(m))
      }

      if (order.length === 0) return [OPENROUTER_MODEL_DEFAULT]
      return order
    }
    const modelsToTry = resolveModelsFromRequest()

    // Istoric din memorie volatilă (RAM), pentru fluiditate
    const historyPairs = getSessionHistory(sessionId).map((m, idx, arr) => {
      // Transformăm array-ul de mesaje în perechi user/assistant pentru compatibilitate veche
      // dar mai jos folosim direct "historyMsgs", deci aici doar mapăm la schema așteptată
      return m.role === 'user'
        ? { user_message: m.content, ai_reply: arr[idx + 1]?.content || '' }
        : null
    }).filter(Boolean)

    // RAG: căutăm contexte din documents pentru site-ul curent
    let siteDocs = []
    if (siteId) {
      try {
        const embedder = await getEmbedder()
        const out = await embedder.apply(message, { pooling: 'mean', normalize: true })
        const embedding = Array.from(out.data)
        const supabase = getSupabase()
        const { data: docs, error: docsErr } = await supabase.rpc('match_documents', {
          query_embedding: embedding,
          match_count: 4,
          filter_site_id: siteId,
        })
        if (!docsErr && Array.isArray(docs)) siteDocs = docs
      } catch (e) {
        console.error('RAG retrieval error:', e?.message || e)
      }
    }

    // Rate limit dezactivat conform cerinței
    const clientIp = getClientIp(req)

    let lastErrorText = ''
    // Construim istoric minimal pentru prompt din DB + ultimul mesaj user
    globalThis.__siteIdForPrompt = siteId
    globalThis.__siteDocsForPrompt = siteDocs
    // Folosim doar ultimele 6 mesaje (3 perechi) pentru viteză și coerență
    const sliced = historyPairs.slice(-6)
    const promptHistory = []
    for (const p of sliced) {
      promptHistory.push({ role: 'user', content: p.user_message })
      if (p.ai_reply) promptHistory.push({ role: 'assistant', content: p.ai_reply })
    }

    const tryModels = MODEL_FALLBACK ? modelsToTry : [modelsToTry[0]]
    for (const model of tryModels) {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': SITE_URL,
          'X-Title': 'ChatBot Dev',
        },
        body: JSON.stringify(buildOpenRouterPayload({ model, message, images, historyMsgs: promptHistory })),
      })

      if (!response.ok) {
        lastErrorText = (await response.text().catch(() => '')) || response.statusText
        continue
      }

      const data = await response.json()
      const reply = data?.choices?.[0]?.message?.content?.trim?.() || ''
      if (!reply) {
        lastErrorText = 'Răspuns gol de la model'
        continue
      }

      // Salvează în Supabase
      try {
        // Salvează în DB (write-only) și actualizează memoria în RAM
        try {
          const supabase = getSupabase()
          const insertPayload = {
            user_message: message,
            ai_reply: reply,
            timestamp: new Date().toISOString(),
            ip: clientIp,
            session_id: sessionId || null,
            site_id: siteId || null,
          }
          const { error: dbError } = await supabase.from('conversations').insert(insertPayload)
          if (dbError) console.error('Supabase insert error:', dbError)
        } catch {}
        appendSessionHistory(sessionId, message, reply)
      } catch (dbInitError) {
        console.error('Supabase client error:', dbInitError.message)
      }

      logInteraction(message, reply, { ip: clientIp })
      return res.json({ reply })
    }

    return res.status(502).json({ error: 'Eroare de la OpenRouter', details: lastErrorText || 'Toate modelele au eșuat' })
  } catch (error) {
    console.error('Chat API error:', error)
    res.status(500).json({ error: 'Eroare internă server.' })
  }
})

app.listen(PORT, () => {
  console.log(`Chat API server ascultă pe http://localhost:${PORT}`)
})


