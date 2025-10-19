import React, { useEffect, useState, useRef } from 'react'
import { listProfiles, createSession, getWelcomeMessage, sendMessage, sendMessageStream, listSessions, renameSession, deleteSession, Session, getState, Profile, SessionSummary, getSession, SocraticStep, extractCurriculumSteps } from './api/tutor'
import './App.css'

export default function App() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<{role: string; content: string; isThinking?: boolean}[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showProfileSelector, setShowProfileSelector] = useState(false)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [currentStep, setCurrentStep] = useState(0)
  const [curriculum, setCurriculum] = useState<SocraticStep[]>([])
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  
  // 添加引用来访问消息容器
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLElement>(null)

  // 滚动到底部的函数
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // 当消息列表更新时自动滚动到底部
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    loadProfiles()
    loadSessions()
  }, []) //依赖数组为空，表示在组件完成首次渲染并挂载到DOM上之后自动执行一次

  async function loadProfiles() {
    try {
      const profileList = await listProfiles()
      console.log('加载的Profile列表:', profileList)
      setProfiles(profileList)
    } catch (error) {
      console.error('加载配置文件失败:', error)
      setProfiles([])
    }
  }

  async function loadSessions() {
    try {
      const sessionList = await listSessions()
      setSessions(sessionList)
    } catch (error) {
      console.error('加载会话列表失败:', error)
      setSessions([])
    }
  }

  async function startNewSession(profile: Profile) {
    console.log('开始创建新会话，Profile:', profile)
    setIsLoading(true)
    try {
      const res = await createSession({
        profile_id: profile.profile_id,
        session_name: `${profile.profile_name} - ${new Date().toLocaleString()}`,
        output_language: 'zh-CN'
      })
      console.log('创建会话成功，session_id:', res.session_id)
      
      await loadSessions() // 重新加载会话列表
      setSessionId(res.session_id)
      setMessages([])
      setShowProfileSelector(false)
      
      // 设置当前Profile和从Profile中提取curriculum
      setCurrentProfile(profile)
      const curriculumSteps = extractCurriculumSteps(profile.curriculum)
      setCurriculum(curriculumSteps)
      console.log('设置curriculum，步骤数:', curriculumSteps.length)
      
      // 获取会话状态信息以初始化进度条
      try {
        const stateResponse = await getState(res.session_id)
        setCurrentStep(stateResponse.stepIndex || 0)
        console.log('获取状态成功，当前步骤:', stateResponse.stepIndex)
      } catch (stateError) {
        console.error('获取新会话状态失败:', stateError)
        setCurrentStep(0)
      }
      
      // 获取欢迎消息
      const welcome = await getWelcomeMessage(res.session_id)
      setMessages([{role: 'assistant', content: welcome.welcome, isThinking: false}])
      console.log('获取欢迎消息成功')
    } catch (error) {
      console.error('创建会话失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function switchToSession(session: SessionSummary) {
    setSessionId(session.session_id)
    setMessages([])
    setCurrentStep(0)
    
    try {
      // 获取会话详情以获取消息历史和Profile信息
      const sessionDetail = await getSession(session.session_id)
      
      // 从Session中提取Profile和curriculum
      if (sessionDetail.profile) {
        setCurrentProfile(sessionDetail.profile)
        const curriculumSteps = extractCurriculumSteps(sessionDetail.profile.curriculum)
        setCurriculum(curriculumSteps)
      } else {
        setCurrentProfile(null)
        setCurriculum([])
      }
      
      // 获取会话状态信息
      const stateResponse = await getState(session.session_id)
      setCurrentStep(stateResponse.stepIndex || 0)
      
      if (sessionDetail.history && sessionDetail.history.length > 0) {
        // 转换消息格式：将type字段转换为role字段
        const chatHistory = sessionDetail.history.map((msg: {type: string; content: string; timestamp?: string}) => ({
          role: msg.type === 'human' ? 'user' : 'assistant',
          content: msg.content,
          isThinking: false
        }))
        setMessages(chatHistory)
        console.log(`加载了 ${chatHistory.length} 条历史消息`)
      } else {
        // 如果没有聊天历史，获取欢迎消息
        const welcome = await getWelcomeMessage(session.session_id)
        if (welcome.welcome) {
          setMessages([{role: 'assistant', content: welcome.welcome, isThinking: false}])
        }
      }
    } catch (error) {
      console.error('切换会话失败:', error)
      // 出错时尝试获取欢迎消息作为兜底
      try {
        const welcome = await getWelcomeMessage(session.session_id)
        if (welcome.welcome) {
          setMessages([{role: 'assistant', content: welcome.welcome, isThinking: false}])
        }
      } catch (welcomeError) {
        console.error('获取欢迎消息也失败:', welcomeError)
      }
    }
  }

  async function handleSend() {
    if (!sessionId || !input.trim()) return
    const userMsg = input.trim()
    setMessages(prev => [...prev, {role: 'user', content: userMsg}])
    setInput('')
    
    setIsLoading(true)
    
    // 添加一个空的助手消息用于流式更新，初始显示思考状态
    setMessages(prev => [...prev, {role: 'assistant', content: '', isThinking: true}])
    
    // 用于累积流式内容
    let streamContent = ''
    
    try {
      await sendMessageStream(
        sessionId,
        userMsg,
        // onToken: 实时更新最后一条消息
        (token: string) => {
          streamContent += token
          setMessages(prev => {
            const newMessages = [...prev]
            const lastMessage = newMessages[newMessages.length - 1]
            if (lastMessage && lastMessage.role === 'assistant') {
              lastMessage.content = streamContent
              lastMessage.isThinking = false // 开始输出时停止思考状态
            }
            return newMessages
          })
          // 第一个token到达时隐藏加载状态
          if (streamContent.length > 0 && isLoading) {
            setIsLoading(false)
          }
        },
        // onComplete: 流式完成
        (response) => {
          console.log('流式响应完成:', response)
          setIsLoading(false)
          
          // 发送消息后更新学习进度
          getState(sessionId).then(stateResponse => {
            setCurrentStep(stateResponse.stepIndex || 0)
          }).catch(stateError => {
            console.error('更新学习进度失败:', stateError)
          })
        },
        // onError: 错误处理
        (error) => {
          console.error('发送消息失败:', error)
          setMessages(prev => {
            const newMessages = [...prev]
            const lastMessage = newMessages[newMessages.length - 1]
            if (lastMessage && lastMessage.role === 'assistant') {
              lastMessage.content = '抱歉，我遇到了一些问题。请稍后再试。'
              lastMessage.isThinking = false
            }
            return newMessages
          })
          setIsLoading(false)
        }
      )
    } catch (error) {
      console.error('发送消息失败:', error)
      setMessages(prev => {
        const newMessages = [...prev]
        const lastMessage = newMessages[newMessages.length - 1]
        if (lastMessage && lastMessage.role === 'assistant') {
          lastMessage.content = '抱歉，我遇到了一些问题。请稍后再试。'
          lastMessage.isThinking = false
        }
        return newMessages
      })
      setIsLoading(false)
    }
  }

  async function handleRenameSession(sessionId: string, newName: string) {
    try {
      await renameSession(sessionId, { session_name: newName })
      await loadSessions() // 重新加载会话列表
      setEditingSessionId(null)
      setEditingName('')
    } catch (error) {
      console.error('重命名会话失败:', error)
    }
  }

  async function handleDeleteSession(sessionId: string) {
    if (!confirm('确定要删除这个会话吗？')) return
    
    try {
      await deleteSession(sessionId)
      await loadSessions() // 重新加载会话列表
      
      // 如果删除的是当前会话，清空聊天界面
      if (sessionId === sessionId) {
        setSessionId(null)
        setMessages([])
      }
    } catch (error) {
      console.error('删除会话失败:', error)
    }
  }

  // 处理回车发送
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const getCurrentSession = () => {
    return sessions.find(s => s.session_id === sessionId)
  }

  return (
    <div className="h-screen flex bg-gray-50">
      {/* 侧边栏 */}
      <aside className="w-80 bg-white border-r flex flex-col">
        {/* 新建会话按钮 */}
        <div className="p-4 border-b">
          <button 
            onClick={() => setShowProfileSelector(true)} 
            className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium"
            disabled={isLoading}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新建会话
          </button>
        </div>

        {/* 会话列表 */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-3">历史会话</h3>
            <div className="space-y-2">
              {sessions.map(session => (
                <div 
                  key={session.session_id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors group ${
                    sessionId === session.session_id 
                      ? 'bg-blue-50 border-blue-200' 
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => switchToSession(session)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      {editingSessionId === session.session_id ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={() => handleRenameSession(session.session_id, editingName)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleRenameSession(session.session_id, editingName)
                            }
                          }}
                          className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <h4 className="font-medium text-gray-900 truncate">{session.session_name}</h4>
                      )}
                      <p className="text-xs text-gray-500 mt-1">{session.topic_name}</p>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingSessionId(session.session_id)
                          setEditingName(session.session_name)
                        }}
                        className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700"
                        title="重命名"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteSession(session.session_id)
                        }}
                        className="p-1 hover:bg-red-100 rounded text-gray-500 hover:text-red-600"
                        title="删除"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              
              {sessions.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-sm">还没有任何会话</p>
                  <p className="text-xs mt-1">点击上方按钮开始新的学习之旅</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* 主内容区域 */}
      <main className="flex-1 flex flex-col">
        <header className="p-4 border-b bg-white">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-xl font-semibold">
              {getCurrentSession() ? getCurrentSession()?.session_name : '苏格拉底式AI导师'}
            </h1>
            <p className="text-sm text-gray-600">
              {getCurrentSession() 
                ? `课程: ${getCurrentSession()?.topic_name} | Profile: ${getCurrentSession()?.profile_id}` 
                : '通过提问启发思考，引导深度学习'
              }
            </p>
            
            {/* 进度条 */}
            {getCurrentSession() && curriculum.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span>学习进度</span>
                  <span>{currentStep} / {curriculum.length}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${Math.min((currentStep / curriculum.length) * 100, 100)}%` }}
                  ></div>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  {currentStep < curriculum.length ? (
                    <div>
                      <div className="font-medium">当前步骤: {curriculum[currentStep]?.step_title}</div>
                      <div className="mt-1 text-gray-400">学习目标: {curriculum[currentStep]?.learning_objective}</div>
                    </div>
                  ) : (
                    <span>🎉 恭喜！您已完成所有学习步骤</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        <section className="flex-1 overflow-auto p-6 max-w-4xl mx-auto w-full" ref={chatContainerRef}>
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <h3 className="text-lg mb-2">👋 欢迎来到苏格拉底式学习</h3>
                <p>选择一个会话开始你的学习之旅，或者创建一个新会话</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex max-w-4xl ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-start gap-3`}>
                    {/* 头像 */}
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      m.role === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700'
                    }`}>
                      {m.role === 'user' ? '👤' : '🤖'}
                    </div>
                    
                    {/* 消息内容 */}
                    <div className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`px-4 py-3 rounded-2xl max-w-2xl ${
                        m.role === 'user' 
                          ? 'bg-blue-600 text-white rounded-br-md' 
                          : 'bg-gray-100 text-gray-900 rounded-bl-md'
                      }`}>
                        {m.role === 'assistant' && (m as any).isThinking ? (
                          <div className="flex items-center space-x-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                            <span className="text-sm text-gray-600">导师正在思考...</span>
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
                        )}
                      </div>
                      {m.role === 'assistant' && !(m as any).isThinking && (
                        <div className="text-xs text-gray-500 mt-1 ml-1">
                          苏格拉底式导师
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
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
              placeholder={sessionId ? "输入你的想法或问题... (Enter发送，Shift+Enter换行)" : "请先选择一个会话开始学习"}
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

      {/* Profile选择器模态框 */}
      {showProfileSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold mb-4">选择学习课程</h2>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {profiles.map(profile => (
                <button
                  key={profile.profile_id}
                  onClick={() => startNewSession(profile)}
                  className="w-full text-left p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={isLoading}
                >
                  <div className="font-medium">{profile.profile_name}</div>
                  <div className="text-sm text-gray-500">目标受众: {profile.target_audience}</div>
                  <div className="text-xs text-gray-400 mt-1">课程: {profile.topic_name} | 步骤数: {extractCurriculumSteps(profile.curriculum).length}</div>
                </button>
              ))}
              
              {profiles.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  <p>暂无可用的课程配置</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowProfileSelector(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
