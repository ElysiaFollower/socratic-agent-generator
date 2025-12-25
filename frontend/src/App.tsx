/**
 * Main application component.
 *
 * This component orchestrates the entire application, managing state
 * and coordinating between different modules.
 */

import React, {useState, useCallback, useMemo} from 'react';
import {Profile, SessionSummary, ChatMessage} from './types';
import {
  useProfiles,
  useSessions,
  useChat,
  useSessionState,
  useAuth,
} from './hooks';
import {
  Sidebar,
  MessageList,
  ChatInput,
  Header,
  ProfileSelector,
  ProtectedRoute,
  PermissionGuard,
  Login,
  Register,
  InvitationCodeGenerator,
} from './components';
import {
  createSession,
  getSession,
  getWelcomeMessage,
  renameSession,
  deleteSession,
} from './api';

/**
 * Main App component.
 *
 * @returns React component
 */
export default function App(): JSX.Element {
  const {isAuthenticated, isLoading: authLoading, user, logout} = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showProfileSelector, setShowProfileSelector] = useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>('');
  const [showRegister, setShowRegister] = useState<boolean>(false);
  const [showInvitationGenerator, setShowInvitationGenerator] =
    useState<boolean>(false);

  const {profiles, isLoading: profilesLoading, refresh: refreshProfiles} =
    useProfiles();
  const {sessions: allSessions, refresh: refreshSessions} = useSessions();
  const sessionState = useSessionState(sessionId);

  // Filter sessions based on user role
  // Note: This requires backend support to include creator/owner information in SessionSummary
  // For now, all users see all sessions until backend adds user_id/creator_id field
  const sessions = React.useMemo(() => {
    if (!user) {
      return [];
    }
    // TODO: Filter sessions based on user role when backend supports it:
    // - Admin: all sessions
    // - Teacher: only sessions created by teacher (need creator_id in SessionSummary)
    // - Student: only sessions created by student (need creator_id in SessionSummary)
    return allSessions;
  }, [allSessions, user]);

  const handleStateUpdate = useCallback(() => {
    void sessionState.refresh();
  }, [sessionState]);

  const {messages, isLoading: chatLoading, sendMessage, setMessages} =
    useChat(sessionId, handleStateUpdate);

  const currentSession = sessions.find((s) => s.session_id === sessionId) || null;

  const handleNewSession = useCallback(() => {
    setShowProfileSelector(true);
  }, []);

  const handleStartNewSession = useCallback(
    async (profile: Profile) => {
      try {
        const res = await createSession({
          profile_id: profile.profile_id,
          session_name: `${profile.profile_name || profile.topic_name} - ${new Date().toLocaleString()}`,
          output_language: 'zh-CN',
        });

        await refreshSessions();
        setSessionId(res.session_id);
        setMessages([]);
        setShowProfileSelector(false);

        sessionState.setProfile(profile);

        try {
          const stateResponse = await sessionState.refresh();
          // State will be updated by the hook
        } catch (stateError) {
          console.error('Failed to get new session state:', stateError);
        }

        const welcome = await getWelcomeMessage(res.session_id);
        setMessages([
          {role: 'assistant', content: welcome.welcome, isThinking: false},
        ]);
      } catch (error) {
        console.error('Failed to create session:', error);
      }
    },
    [refreshSessions, sessionState, setMessages],
  );

  const handleSwitchToSession = useCallback(
    async (session: SessionSummary) => {
      setSessionId(session.session_id);
      setMessages([]);

      try {
        const sessionDetail = await getSession(session.session_id);

        if (sessionDetail.profile) {
          sessionState.setProfile(sessionDetail.profile);
        } else {
          sessionState.setProfile(null);
        }

        await sessionState.refresh();

        if (sessionDetail.history && sessionDetail.history.length > 0) {
          const chatHistory: ChatMessage[] = sessionDetail.history.map(
            (msg) => ({
              role: msg.type === 'human' ? 'user' : 'assistant',
              content: msg.content,
              isThinking: false,
            }),
          );
          setMessages(chatHistory);
        } else {
          const welcome = await getWelcomeMessage(session.session_id);
          if (welcome.welcome) {
            setMessages([
              {
                role: 'assistant',
                content: welcome.welcome,
                isThinking: false,
              },
            ]);
          }
        }
      } catch (error) {
        console.error('Failed to switch session:', error);
        try {
          const welcome = await getWelcomeMessage(session.session_id);
          if (welcome.welcome) {
            setMessages([
              {
                role: 'assistant',
                content: welcome.welcome,
                isThinking: false,
              },
            ]);
          }
        } catch (welcomeError) {
          console.error('Failed to get welcome message:', welcomeError);
        }
      }
    },
    [sessionState, setMessages],
  );

  const handleRenameSession = useCallback(
    async (sessionIdToRename: string, newName: string) => {
      try {
        await renameSession(sessionIdToRename, {session_name: newName});
        await refreshSessions();
      } catch (error) {
        console.error('Failed to rename session:', error);
      }
    },
    [refreshSessions],
  );

  const handleDeleteSession = useCallback(
    async (sessionIdToDelete: string) => {
      try {
        await deleteSession(sessionIdToDelete);
        await refreshSessions();

        if (sessionIdToDelete === sessionId) {
          setSessionId(null);
          setMessages([]);
        }
      } catch (error) {
        console.error('Failed to delete session:', error);
      }
    },
    [sessionId, refreshSessions, setMessages],
  );

  const handleMaximizeToggle = useCallback(() => {
    const newMaximizedState = !isMaximized;
    setIsMaximized(newMaximizedState);

    if (newMaximizedState) {
      setIsHeaderCollapsed(true);
    } else {
      setIsHeaderCollapsed(false);
    }
  }, [isMaximized]);

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  const handleSend = useCallback(async () => {
    if (!inputValue.trim()) {
      return;
    }
    await sendMessage(inputValue.trim());
    setInputValue('');
  }, [inputValue, sendMessage]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, [logout]);

  // Listen for invitation generator open event
  React.useEffect(() => {
    const handleOpenInvitationGenerator = () => {
      setShowInvitationGenerator(true);
    };
    window.addEventListener('openInvitationGenerator', handleOpenInvitationGenerator);
    return () => {
      window.removeEventListener(
        'openInvitationGenerator',
        handleOpenInvitationGenerator,
      );
    };
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">加载中...</div>
      </div>
    );
  }

  // Show login/register if not authenticated
  if (!authLoading && !isAuthenticated) {
    if (showRegister) {
      return (
        <Register
          onRegisterSuccess={() => setShowRegister(false)}
          onSwitchToLogin={() => setShowRegister(false)}
        />
      );
    }
    return (
      <Login
        onLoginSuccess={() => setShowRegister(false)}
        onSwitchToRegister={() => setShowRegister(true)}
      />
    );
  }

  return (
    <ProtectedRoute>
      <div className="h-screen flex bg-gray-50">
      {/* Sidebar */}
      {!isMaximized && (
        <Sidebar
          sessions={sessions}
          currentSessionId={sessionId}
          isLoading={profilesLoading || chatLoading}
          onNewSession={handleNewSession}
          onSelectSession={handleSwitchToSession}
          onRenameSession={handleRenameSession}
          onDeleteSession={handleDeleteSession}
          user={user}
          onLogout={handleLogout}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        <Header
          currentSession={currentSession}
          isMaximized={isMaximized}
          isCollapsed={isHeaderCollapsed}
          currentStep={sessionState.currentStep}
          curriculum={sessionState.curriculum}
          onToggleMaximize={handleMaximizeToggle}
          onToggleCollapse={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
          user={user}
        />

        <section
          className={`flex-1 overflow-auto p-6 w-full ${
            isMaximized ? '' : 'max-w-4xl mx-auto'
          }`}
        >
          <MessageList messages={messages} />
        </section>

        <footer className="p-4 border-t bg-white">
          <div className={`${isMaximized ? '' : 'max-w-4xl mx-auto'}`}>
            <ChatInput
              value={inputValue}
              disabled={!sessionId || chatLoading}
              placeholder={
                sessionId
                  ? '输入你的想法或问题... (Enter发送，Shift+Enter换行)'
                  : '请先选择一个会话开始学习'
              }
              onChange={handleInputChange}
              onSend={handleSend}
            />
          </div>
        </footer>
      </main>

      {/* Profile Selector Modal */}
      {showProfileSelector && (
        <ProfileSelector
          profiles={profiles}
          isLoading={profilesLoading}
          onSelect={handleStartNewSession}
          onClose={() => setShowProfileSelector(false)}
        />
      )}

      {/* Invitation Code Generator Modal */}
      {showInvitationGenerator && (
        <InvitationCodeGenerator
          onClose={() => setShowInvitationGenerator(false)}
        />
      )}
      </div>
    </ProtectedRoute>
  );
}
