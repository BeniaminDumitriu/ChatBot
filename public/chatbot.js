;(function () {
  const GLOBAL_KEY = '__ChatBotWidgetInjected__'
  if (window[GLOBAL_KEY]) return
  window[GLOBAL_KEY] = true

  function getCurrentScript() {
    // document.currentScript may be null in some loaders; fallback by finding the last script whose src ends with chatbot.js
    const cs = document.currentScript
    if (cs) return cs
    const scripts = Array.from(document.getElementsByTagName('script'))
    return scripts.reverse().find((s) => (s.getAttribute('src') || '').includes('chatbot.js')) || null
  }

  const scriptEl = getCurrentScript()
  const cfg = window.ChatBotConfig || {}
  const apiBaseFromAttr = scriptEl && scriptEl.getAttribute('data-api')
  const apiBase = (cfg.apiBase || apiBaseFromAttr || '').replace(/\/$/, '') || ''
  const apiUrl = (apiBase ? apiBase : '') + '/api/chat'
  const siteId = cfg.siteId || (scriptEl && scriptEl.getAttribute('data-site-id')) || ''

  // Create host and shadow root
  const host = document.createElement('div')
  host.setAttribute('id', 'cb-root-host')
  host.style.all = 'initial'
  host.style.position = 'fixed'
  host.style.right = '16px'
  host.style.bottom = '16px'
  host.style.zIndex = '2147483647'
  document.body.appendChild(host)

  const shadow = host.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = `
    :host { all: initial; }
    .cb-btn {
      width: 56px; height: 56px; border-radius: 9999px; border: 0;
      background: #2563eb; color: #fff; cursor: pointer;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -4px rgba(0,0,0,.1);
      display: flex; align-items: center; justify-content: center;
    }
    .cb-btn:hover { background: #1d4ed8; }
    .cb-panel {
      width: min(92vw, 380px); height: min(70vh, 560px);
      background: #fff; color: #0f172a; border: 1px solid #e5e7eb;
      border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,.12);
      display: none; flex-direction: column; overflow: hidden; margin-bottom: 8px;
    }
    .cb-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-bottom: 1px solid #e5e7eb; }
    .cb-title { font: 500 14px/1.4 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial; display: flex; align-items: center; gap: 8px; }
    .cb-dot { width: 8px; height: 8px; border-radius: 9999px; background: #22c55e; }
    .cb-close { background: none; border: 0; color: #6b7280; cursor: pointer; }
    .cb-close:hover { color: #374151; }
    .cb-messages { flex: 1; overflow: auto; padding: 12px; background: #f8fafc; display: flex; flex-direction: column; gap: 8px; }
    .cb-row { display: flex; }
    .cb-row.user { justify-content: flex-end; }
    .cb-row.assistant { justify-content: flex-start; }
    .cb-bubble { max-width: 80%; padding: 8px 10px; border-radius: 16px; font: 400 13px/1.5 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial; white-space: pre-wrap; word-wrap: break-word; }
    .cb-bubble.user { background: #2563eb; color: #fff; border-bottom-right-radius: 4px; }
    .cb-bubble.assistant { background: #fff; color: #0f172a; border: 1px solid #e5e7eb; border-bottom-left-radius: 4px; }
    .cb-inputrow { display: flex; gap: 8px; padding: 10px; border-top: 1px solid #e5e7eb; }
    .cb-input { flex: 1; padding: 8px 10px; border-radius: 6px; border: 1px solid #d1d5db; font: 400 13px/1.4 ui-sans-serif, system-ui; }
    .cb-input:focus { outline: 2px solid #3b82f6; border-color: #3b82f6; }
    .cb-send { padding: 8px 12px; border-radius: 6px; border: 0; background: #2563eb; color: #fff; font: 500 13px/1 ui-sans-serif, system-ui; cursor: pointer; }
    .cb-send[disabled] { opacity: .6; cursor: default; }
    .cb-panel.open { display: flex; }
  `

  const wrapper = document.createElement('div')
  wrapper.innerHTML = `
    <div class="cb-panel" id="cb-panel">
      <div class="cb-header">
        <div class="cb-title"><span class="cb-dot"></span><span>Chat</span></div>
        <button class="cb-close" id="cb-close" aria-label="Închide">✕</button>
      </div>
      <div class="cb-messages" id="cb-messages"></div>
      <form class="cb-inputrow" id="cb-form">
        <input class="cb-input" id="cb-input" type="text" placeholder="Scrie un mesaj..." />
        <button class="cb-send" id="cb-send" type="submit">Trimite</button>
      </form>
    </div>
    <button class="cb-btn" id="cb-toggle" aria-label="Deschide chat" title="Deschide chat">💬</button>
  `

  shadow.appendChild(style)
  shadow.appendChild(wrapper)

  const panel = shadow.getElementById('cb-panel')
  const toggle = shadow.getElementById('cb-toggle')
  const closeBtn = shadow.getElementById('cb-close')
  const messagesEl = shadow.getElementById('cb-messages')
  const form = shadow.getElementById('cb-form')
  const input = shadow.getElementById('cb-input')
  const sendBtn = shadow.getElementById('cb-send')

  // Session id persistent în localStorage (în domeniul host-ului client)
  const sessionKey = 'cb_session_id'
  let sessionId = null
  try {
    sessionId = localStorage.getItem(sessionKey)
    if (!sessionId) {
      sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36)
      localStorage.setItem(sessionKey, sessionId)
    }
  } catch (e) {
    sessionId = Math.random().toString(36).slice(2) + Date.now().toString(36)
  }

  // Initial assistant message
  addBubble('assistant', 'Salut! Cu ce te pot ajuta astăzi?')

  toggle.addEventListener('click', () => {
    panel.classList.toggle('open')
    toggle.setAttribute('aria-label', panel.classList.contains('open') ? 'Închide chat' : 'Deschide chat')
    if (panel.classList.contains('open')) {
      input.focus()
      scrollToBottom()
    }
  })
  closeBtn.addEventListener('click', () => {
    panel.classList.remove('open')
    toggle.setAttribute('aria-label', 'Deschide chat')
  })

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const text = (input.value || '').trim()
    if (!text) return
    addBubble('user', text)
    input.value = ''
    setSending(true)
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId, siteId }),
      })
      if (!response.ok) {
        if (response.status === 429) {
          addBubble('assistant', 'Ai atins limita lunară de mesaje, încearcă luna viitoare.')
          return
        }
        throw new Error(await response.text().catch(() => 'Request failed'))
      }
      const data = await response.json()
      const reply = (data && data.reply) ? String(data.reply) : ''
      addBubble('assistant', reply || 'Ne pare rău, răspunsul nu a fost disponibil.')
    } catch (err) {
      addBubble('assistant', 'Ne pare rău, a apărut o eroare. Încearcă din nou.')
    } finally {
      setSending(false)
    }
  })

  function setSending(sending) {
    if (sending) {
      sendBtn.setAttribute('disabled', 'true')
      input.setAttribute('disabled', 'true')
      sendBtn.textContent = 'Se trimite...'
    } else {
      sendBtn.removeAttribute('disabled')
      input.removeAttribute('disabled')
      sendBtn.textContent = 'Trimite'
    }
  }

  function addBubble(role, text) {
    const row = document.createElement('div')
    row.className = 'cb-row ' + (role === 'user' ? 'user' : 'assistant')
    const bubble = document.createElement('div')
    bubble.className = 'cb-bubble ' + (role === 'user' ? 'user' : 'assistant')
    bubble.textContent = text
    row.appendChild(bubble)
    messagesEl.appendChild(row)
    scrollToBottom()
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight
  }
})()


