import React, { useState, useRef, useEffect, useMemo } from 'react'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const sessionId = useMemo(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, [])
  const siteId = useMemo(() => 'demo', [])

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages])

  const generateId = () => Math.random().toString(36).substr(2, 9)

  const resetSession = async () => {
    try {
      const apiBase = (globalThis as any)?.ChatBotConfig?.apiBase || (import.meta as any)?.env?.VITE_API_BASE || ''
      const endpoint = `${apiBase ? String(apiBase).replace(/\/$/, '') : ''}/api/session/reset`
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
    } catch {}
    setMessages([])
  }

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || isSending) return

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: trimmed,
      createdAt: Date.now(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')

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

  const title = useMemo(() => 'AI Assistant', [])

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Buton plutitor cu gradient și animații */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? 'Închide chat' : 'Deschide chat'}
        className="group relative rounded-full bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 text-white shadow-2xl hover:shadow-purple-500/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-500/50 focus-visible:ring-offset-2 w-16 h-16 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:rotate-3 transform"
      >
        {/* Efect de glow */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 blur-xl opacity-75 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Icon */}
        <div className="relative z-10">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 transition-transform duration-300 group-hover:scale-110">
            <path d="M4.5 5.25a.75.75 0 0 1 .75-.75h13.5a.75.75 0 0 1 .75.75v9a.75.75 0 0 1-.75.75H7.06a.75.75 0 0 0-.53.22l-1.5 1.5a.75.75 0 0 1-1.28-.53V5.25Z" />
          </svg>
        </div>

        {/* Indicator de notificare */}
        {messages.length > 0 && !isOpen && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold animate-pulse">
            {messages.length > 9 ? '9+' : messages.length}
          </div>
        )}
      </button>

      {/* Fereastră chat cu design modern */}
      {isOpen && (
        <div className="mt-4 w-[95vw] max-w-md h-[50vh] bg-white/95 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-4 duration-300">
          {/* Header cu gradient */}
          <div className="px-6 py-4 bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse shadow-lg" />
              <h2 className="font-bold text-white text-lg">{title}</h2>
            </div>
            <button
              onClick={() => { resetSession(); setIsOpen(false) }}
              className="text-white/80 hover:text-white transition-colors duration-200 p-1 rounded-full hover:bg-white/20"
              aria-label="Închide"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path fillRule="evenodd" d="M16.24 7.76a.75.75 0 0 1 0 1.06L13.06 12l3.18 3.18a.75.75 0 1 1-1.06 1.06L12 13.06l-3.18 3.18a.75.75 0 0 1-1.06-1.06L10.94 12 7.76 8.82a.75.75 0 0 1 1.06-1.06L12 10.94l3.18-3.18a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Mesaje cu design îmbunătățit */}
          <div 
            ref={containerRef} 
            className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gradient-to-b from-gray-50 to-white scrollbar-thin scrollbar-thumb-purple-300 scrollbar-track-transparent hover:scrollbar-thumb-purple-400"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#c4b5fd transparent'
            }}
          >
            {messages.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-purple-100 to-blue-100 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-purple-500">
                    <path d="M4.5 5.25a.75.75 0 0 1 .75-.75h13.5a.75.75 0 0 1 .75.75v9a.75.75 0 0 1-.75.75H7.06a.75.75 0 0 0-.53.22l-1.5 1.5a.75.75 0 0 1-1.28-.53V5.25Z" />
                  </svg>
                </div>
                <p className="font-medium">Bună! Sunt aici să te ajut</p>
                <p className="text-sm">Începe să scrii un mesaj...</p>
              </div>
            )}
            
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap break-words shadow-lg ${
                    m.role === 'user'
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-br-md'
                      : 'bg-white text-gray-800 border border-gray-100 rounded-bl-md shadow-sm'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {/* Indicator de typing */}
            {isSending && (
              <div className="flex justify-start animate-in slide-in-from-bottom-2 duration-300">
                <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input cu design modern */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="p-4 border-t border-gray-100 bg-white/80 backdrop-blur-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Scrie un mesaj..."
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50 transition-all duration-200 placeholder:text-gray-400"
                  disabled={isSending}
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path d="M4.5 5.25a.75.75 0 0 1 .75-.75h13.5a.75.75 0 0 1 .75.75v9a.75.75 0 0 1-.75.75H7.06a.75.75 0 0 0-.53.22l-1.5 1.5a.75.75 0 0 1-1.28-.53V5.25Z" />
                  </svg>
                </div>
              </div>
              <button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 text-sm font-medium hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
                disabled={!input.trim() || isSending}
              >
                {isSending ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Se trimite...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                      <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                    </svg>
                    Trimite
                  </div>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}


