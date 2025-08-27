import { useMemo, useRef, useState, useEffect } from 'react'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: generateId(),
      role: 'assistant',
      content: 'Salut! Cu ce te pot ajuta astăzi?',
      createdAt: Date.now(),
    },
  ])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)

  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (isOpen && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages, isOpen])

  // Session ID persistent în localStorage pentru memorie conversație
  const [sessionId, setSessionId] = useState(() => {
    const key = 'cb_session_id'
    try {
      const existing = window.localStorage.getItem(key)
      if (existing) return existing
      const sid = generateId()
      window.localStorage.setItem(key, sid)
      return sid
    } catch {
      return generateId()
    }
  })

  async function resetSession() {
    try {
      await fetch('/api/session/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
        keepalive: true,
      })
    } catch {}
    const newId = generateId()
    try { window.localStorage.setItem('cb_session_id', newId) } catch {}
    setSessionId(newId)
    setMessages([
      {
        id: generateId(),
        role: 'assistant',
        content: 'Salut! Cu ce te pot ajuta astăzi?',
        createdAt: Date.now(),
      },
    ])
  }

  const siteId = useMemo(() => {
    const fromGlobal = (globalThis as any)?.ChatBotConfig?.siteId
    const fromEnv = (import.meta as any)?.env?.VITE_SITE_ID
    return fromGlobal || fromEnv || ''
  }, [])

  async function handleSend() {
    const trimmed = input.trim()
    if (!trimmed) return
    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: trimmed,
      createdAt: Date.now(),
    }
    setMessages((prev) => [...prev, userMessage])
    setInput('')

    // Apelează backend-ul pentru răspuns AI
    try {
      setIsSending(true)
      const apiBase =
        (globalThis as any)?.ChatBotConfig?.apiBase ||
        (import.meta as any)?.env?.VITE_API_BASE ||
        ''
      const endpoint = `${apiBase ? String(apiBase).replace(/\/$/, '') : ''}/api/chat`
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, sessionId, siteId }),
      })
      if (!res.ok) {
        if (res.status === 429) {
          setMessages((prev) => [
            ...prev,
            {
              id: generateId(),
              role: 'assistant',
              content: 'Ai atins limita lunară de mesaje, încearcă luna viitoare.',
              createdAt: Date.now(),
            },
          ])
          return
        }
        const text = await res.text().catch(() => '')
        throw new Error(text || 'Eroare la apelul /api/chat')
      }
      const data = (await res.json()) as { reply?: string }
      const reply = (data?.reply || '').trim()
      if (!reply) throw new Error('Răspuns gol de la server')

      const aiMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: reply,
        createdAt: Date.now(),
      }
      setMessages((prev) => [...prev, aiMessage])
    } catch (err) {
      const aiMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: 'Ne pare rău, a apărut o eroare. Încearcă din nou.',
        createdAt: Date.now(),
      }
      setMessages((prev) => [...prev, aiMessage])
      // opțional: console.error(err)
    } finally {
      setIsSending(false)
    }
  }

  const title = useMemo(() => 'Chat', [])

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Buton plutitor */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? 'Închide chat' : 'Deschide chat'}
        className="rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 w-14 h-14 flex items-center justify-center"
      >
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path fillRule="evenodd" d="M16.24 7.76a.75.75 0 0 1 0 1.06L13.06 12l3.18 3.18a.75.75 0 1 1-1.06 1.06L12 13.06l-3.18 3.18a.75.75 0 0 1-1.06-1.06L10.94 12 7.76 8.82a.75.75 0 1 1 1.06-1.06L12 10.94l3.18-3.18a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path d="M4.5 5.25a.75.75 0 0 1 .75-.75h13.5a.75.75 0 0 1 .75.75v9a.75.75 0 0 1-.75.75H7.06a.75.75 0 0 0-.53.22l-1.5 1.5a.75.75 0 0 1-1.28-.53V5.25Z" />
          </svg>
        )}
      </button>

      {/* Fereastră chat */}
      {isOpen && (
        <div className="mt-3 w-[92vw] max-w-sm sm:max-w-md md:max-w-md lg:max-w-md xl:max-w-md h-[65vh] sm:h-[70vh] bg-white border border-gray-200 rounded-lg shadow-xl flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <h2 className="font-medium">{title}</h2>
            </div>
            <button
              onClick={() => { resetSession(); setIsOpen(false) }}
              className="text-gray-500 hover:text-gray-700"
              aria-label="Închide"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M16.24 7.76a.75.75 0 0 1 0 1.06L13.06 12l3.18 3.18a.75.75 0 1 1-1.06 1.06L12 13.06l-3.18 3.18a.75.75 0 0 1-1.06-1.06L10.94 12 7.76 8.82a.75.75 0 1 1 1.06-1.06L12 10.94l3.18-3.18a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Mesaje */}
          <div ref={containerRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-gray-50">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-white text-gray-900 border border-gray-200 rounded-bl-sm'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="p-3 border-t border-gray-200 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Scrie un mesaj..."
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              disabled={isSending}
            />
            <button
              type="submit"
              className="rounded-md bg-blue-600 text-white px-3 py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
              disabled={!input.trim() || isSending}
            >
              {isSending ? 'Se trimite...' : 'Trimite'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}


