import React, { useEffect, useState } from 'react'
import { listProfiles, createSession, getWelcomeMessage, sendMessage, getState } from './api/tutor'
import './App.css'

export default function App() {
  const [profiles, setProfiles] = useState<string[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<{role: string; content: string}[]>([])
  const [input, setInput] = useState('')
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    listProfiles().then(setProfiles).catch(()=>setProfiles([]))
  }, [])

  async function startSession(profile?: string) {
    const p = profile || profiles[0]
    if (!p) return
    
    setIsLoading(true)
    try {
      setSelectedProfile(p)
      const res = await createSession(p)
      setSessionId(res.session_id)
      
      // 获取AI导师的欢迎消息
      const welcomeRes = await getWelcomeMessage(res.session_id)
      setMessages([
        {role: 'assistant', content: welcomeRes.welcome}
      ])
    } catch (error) {
      console.error('创建会话失败:', error)
      setMessages([
        {role: 'assistant', content: `欢迎来到苏格拉底式学习！我是你的AI导师，今天我们将探索新的知识领域。准备好了吗？`}
      ])
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSend() {
    if (!sessionId || !input.trim()) return
    const userMsg = input.trim()
    setMessages(prev => [...prev, {role: 'user', content: userMsg}])
    setInput('')
    
    setIsLoading(true)
    try {
      const res = await sendMessage(sessionId, userMsg)
      setMessages(prev => [...prev, {role: 'assistant', content: res.reply}])
    } catch (error) {
      console.error('发送消息失败:', error)
      setMessages(prev => [...prev, {role: 'assistant', content: '抱歉，我遇到了一些问题。请稍后再试。'}])
    } finally {
      setIsLoading(false)
    }
  }

  // 处理回车发送
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="h-screen flex bg-gray-50">
      <aside className="w-72 bg-white border-r p-4">
        <h2 className="text-lg font-semibold mb-4">SEED Labs</h2>
        <div className="space-y-2">
          {profiles.map(p => (
            <button 
              key={p} 
              onClick={() => startSession(p)} 
              className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-sm"
              disabled={isLoading}
            >
              {p.replace('.json', '').replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="mt-6">
          <button 
            onClick={() => startSession()} 
            className="w-full bg-blue-600 text-white px-3 py-2 rounded disabled:opacity-50"
            disabled={isLoading || !profiles.length}
          >
            {isLoading ? '启动中...' : '开始学习'}
          </button>
        </div>
        
        {selectedProfile && (
          <div className="mt-4 p-3 bg-gray-50 rounded text-xs">
            <strong>当前课程:</strong> {selectedProfile.replace('.json', '').replace('_', ' ')}
          </div>
        )}
      </aside>

      <main className="flex-1 flex flex-col">
        <header className="p-4 border-b bg-white">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-xl font-semibold">苏格拉底式AI导师</h1>
            <p className="text-sm text-gray-600">通过提问启发思考，引导深度学习</p>
          </div>
        </header>

        <section className="flex-1 overflow-auto p-6 max-w-4xl mx-auto w-full">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <h3 className="text-lg mb-2">👋 欢迎来到苏格拉底式学习</h3>
                <p>选择一个课程开始你的学习之旅</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                  <div className={`inline-block max-w-3xl p-4 rounded-lg ${
                    m.role === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-900'
                  }`}>
                    <div className="whitespace-pre-wrap">{m.content}</div>
                    {m.role === 'assistant' && (
                      <div className="text-xs mt-2 opacity-70">
                        🤖 苏格拉底式导师
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="text-left">
                  <div className="inline-block p-3 bg-gray-100 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                      <span className="text-sm text-gray-600">导师正在思考...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <footer className="p-4 border-t bg-white">
          <div className="max-w-4xl mx-auto flex gap-2">
            <textarea 
              value={input} 
              onChange={e => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              rows={2} 
              className="flex-1 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" 
              placeholder={sessionId ? "输入你的想法或问题... (Enter发送，Shift+Enter换行)" : "请先选择一个课程开始学习"}
              disabled={!sessionId || isLoading}
            />
            <button 
              onClick={handleSend} 
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
              disabled={!sessionId || !input.trim() || isLoading}
            >
              发送
            </button>
          </div>
        </footer>
      </main>
    </div>
  )
}
