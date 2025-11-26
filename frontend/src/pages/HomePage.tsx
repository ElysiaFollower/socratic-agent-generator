import React, { useEffect, useState, useRef } from 'react'
import { listProfiles, createSession, getWelcomeMessage, sendMessage, sendMessageStream, listSessions, renameSession, deleteSession, Session, getState, Profile, SessionSummary, getSession, SocraticStep, extractCurriculumSteps } from '../services/api/tutor'
import { Maximize2, Minimize2 } from 'lucide-react'
import './HomePage.css'

export default function App() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<{role: string; content: string; isThinking?: boolean; thinkingMessage?: string}[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showProfileSelector, setShowProfileSelector] = useState(false)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [currentStep, setCurrentStep] = useState(0)
  const [curriculum, setCurriculum] = useState<SocraticStep[]>([])
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [isMaximized, setIsMaximized] = useState(false)
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false)

  // 网络安全领域的有趣思考提示语
  const thinkingMessages = [
    "正在分析你的问题，就像黑客分析目标系统一样...",
    "思考中... 顺便提醒，密码123456真的不安全哦 😄",
    "让我想想... 你知道为什么程序员喜欢用咖啡吗？因为Java需要咖啡因！",
    "正在处理你的问题... 就像防火墙过滤恶意流量一样仔细",
    "思考中... 网络安全就像洋葱，有很多层防护 🧅",
    "让我组织一下思路... 就像整理防火墙规则一样有条理",
    "正在分析... 你知道最安全的密码是什么吗？'我不知道' 😂",
    "思考中... 网络安全专家的一天：发现漏洞，修复漏洞，发现新漏洞...",
    "让我想想... 为什么黑客总是穿黑色？因为这样看起来更专业！",
    "正在处理... 就像加密算法一样，需要时间来保证质量",
    "思考中... 你知道什么是网络安全吗？就是让坏人进不来，好人出得去",
    "让我分析一下... 就像渗透测试一样，需要从多个角度思考",
    "正在思考... 网络安全就像保险，你希望永远用不到，但必须要有",
    "让我组织语言... 就像编写安全代码一样，每个细节都很重要",
    "思考中... 为什么网络安全专家总是很忙？因为坏人从不休息！",
    "正在分析... 就像漏洞扫描一样，需要全面而仔细",
    "让我想想... 你知道最好的安全策略是什么吗？就是假设你已经被攻击了",
    "思考中... 网络安全就像下棋，需要提前想好几步",
    "正在处理... 就像安全审计一样，需要耐心和细致",
    "让我思考一下... 为什么程序员喜欢用Linux？因为Windows太容易被黑了 😄"
  ]

  // 获取随机思考提示语的函数
  const getRandomThinkingMessage = () => {
    return thinkingMessages[Math.floor(Math.random() * thinkingMessages.length)]
  }

  // 处理最大化状态切换
  const handleMaximizeToggle = () => {
    const newMaximizedState = !isMaximized
    setIsMaximized(newMaximizedState)

    // 最大化时自动收起信息栏，还原时展开信息栏
    if (newMaximizedState) {
      setIsHeaderCollapsed(true)
    } else {
      setIsHeaderCollapsed(false)
    }
  }

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
    setMessages(prev => [...prev, {role: 'assistant', content: '', isThinking: true, thinkingMessage: getRandomThinkingMessage()}])

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
      {!isMaximized && (
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
      )}

      {/* 主内容区域 */}
      <main className="flex-1 flex flex-col">
        <header className="border-b bg-white">
          <div className={`${isMaximized ? '' : 'max-w-4xl mx-auto'} flex items-center justify-between p-4`}>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold">
                {getCurrentSession() ? getCurrentSession()?.session_name : '苏格拉底式AI导师'}
              </h1>

              {/* 收起/展开按钮 */}
              {getCurrentSession() && (
                <button
                  onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                  title={isHeaderCollapsed ? "展开信息" : "收起信息"}
                >
                  {isHeaderCollapsed ? (
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  )}
                </button>
              )}
            </div>

            {/* 最大化/还原按钮 */}
            {getCurrentSession() && (
              <button
                onClick={handleMaximizeToggle}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title={isMaximized ? "还原窗口" : "最大化对话"}
              >
                {isMaximized ? (
                  <Minimize2 className="w-5 h-5 text-gray-600" />
                ) : (
                  <Maximize2 className="w-5 h-5 text-gray-600" />
                )}
              </button>
            )}
          </div>

          {/* 可收起的信息区域 */}
          {!isHeaderCollapsed && (
            <div className={`${isMaximized ? '' : 'max-w-4xl mx-auto'} px-4 pb-4 transition-all duration-300 ease-in-out`}>
              <p className="text-sm text-gray-600 mb-4">
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
          )}
        </header>

        <section className={`flex-1 overflow-auto p-6 w-full ${isMaximized ? '' : 'max-w-4xl mx-auto'}`} ref={chatContainerRef}>
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
                        ? 'bg-gray-200 text-gray-700'
                        : 'bg-gray-200 text-gray-700'
                    }`}>
                      {m.role === 'user' ? '😂' : '🤖'}
                    </div>

                    {/* 消息内容 */}
                    <div className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div className={`px-4 py-3 rounded-2xl max-w-2xl ${
                        m.role === 'user'
                          ? 'bg-blue-400 text-white rounded-br-md'
                          : 'bg-gray-100 text-gray-900 rounded-bl-md'
                      }`}>
                        {m.role === 'assistant' && (m as any).isThinking ? (
                          <div className="flex items-center space-x-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                            <span className="text-sm text-gray-600">{(m as any).thinkingMessage || '导师正在思考...'}</span>
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
          <div className={`${isMaximized ? '' : 'max-w-4xl mx-auto'} flex gap-2`}>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] flex flex-col">
            <h2 className="text-xl font-semibold mb-6">选择学习课程</h2>
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {profiles.map(profile => (
                  <button
                    key={profile.profile_id}
                    onClick={() => startNewSession(profile)}
                    className="w-full text-left p-4 border rounded-lg hover:bg-gray-50 transition-colors hover:border-blue-300 hover:shadow-md"
                    disabled={isLoading}
                  >
                    <div className="font-semibold text-lg mb-2 text-gray-900">{profile.profile_name}</div>
                    <div className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">目标受众:</span> {profile.target_audience}
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">课程主题:</span> {profile.topic_name}
                    </div>
                    <div className="text-sm text-gray-500">
                      <span className="font-medium">学习步骤:</span> {extractCurriculumSteps(profile.curriculum).length} 个步骤
                    </div>
                  </button>
                ))}
              </div>

              {profiles.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <p className="text-lg">暂无可用的课程配置</p>
                  <p className="text-sm mt-1">请联系管理员添加学习课程</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <button
                onClick={() => setShowProfileSelector(false)}
                className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
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
