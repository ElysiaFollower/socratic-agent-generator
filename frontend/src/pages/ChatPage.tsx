/**
 * Chat page component.
 *
 * This component renders the main chat workspace.
 */

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { Box } from "@mui/material";
import { Profile, SessionSummary, ChatMessage, ToolPanelView } from "../types";
import {
  useProfiles,
  useSessions,
  useChat,
  useSessionState,
  useAuth,
} from "../hooks";
import {
  Sidebar,
  MessageList,
  ChatInput,
  Header,
  ProfileSelector,
  InvitationCodeGenerator,
  LabManualUploader,
  ProfileGeneratorAdvanced,
  SettingsModal,
  SidebarRail,
} from "../components";
import {
  createSession,
  getSession,
  getWelcomeMessage,
  renameSession,
  deleteSession,
} from "../api";

/**
 * Props for ChatPage component.
 */
interface ChatPageProps {
  readonly themeMode: "light" | "dark";
  readonly onToggleTheme: () => void;
}

/**
 * Chat page component.
 *
 * @param props - Component props
 * @returns React component
 */
export function ChatPage(props: ChatPageProps): JSX.Element {
  const { themeMode, onToggleTheme } = props;
  const { user, logout } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showProfileSelector, setShowProfileSelector] =
    useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>("");
  const [activePanel, setActivePanel] = useState<ToolPanelView>("chat");
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const sidebarMinRatio = 0.1;
  const sidebarMaxRatio = 0.3;
  const sidebarDefaultRatio = 0.15;
  const viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth;
  const sidebarMinWidth = Math.round(viewportWidth * sidebarMinRatio);
  const sidebarMaxWidth = Math.round(viewportWidth * sidebarMaxRatio);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window === "undefined") {
      return 0;
    }
    const targetWidth = Math.round(window.innerWidth * sidebarDefaultRatio);
    const minWidth = Math.round(window.innerWidth * sidebarMinRatio);
    const maxWidth = Math.round(window.innerWidth * sidebarMaxRatio);
    return Math.min(maxWidth, Math.max(minWidth, targetWidth));
  });
  const resizeState = useRef<{
    startX: number;
    startWidth: number;
  } | null>(null);

  const {
    profiles,
    isLoading: profilesLoading,
    refresh: refreshProfiles,
  } = useProfiles();
  const { sessions: allSessions, refresh: refreshSessions } = useSessions();
  const sessionState = useSessionState(sessionId);

  // Filter sessions based on user role
  // Note: This requires backend support to include creator/owner information in SessionSummary
  // For now, all users see all sessions until backend adds user_id/creator_id field
  const sessions = useMemo(() => {
    if (!user) {
      return [];
    }

    return allSessions;
  }, [allSessions, user]);

  const handleStateUpdate = useCallback(() => {
    void sessionState.refresh();
  }, [sessionState]);

  const {
    messages,
    isLoading: chatLoading,
    sendMessage,
    setMessages,
  } = useChat(sessionId, handleStateUpdate);

  const currentSession =
    sessions.find((s) => s.session_id === sessionId) || null;

  const handleNewSession = useCallback(() => {
    setShowProfileSelector(true);
  }, []);

  const handleStartNewSession = useCallback(
    async (profile: Profile) => {
      try {
        const res = await createSession({
          profile_id: profile.profile_id,
          session_name: `${profile.profile_name || profile.topic_name} - ${new Date().toLocaleString()}`,
          output_language: "zh-CN",
        });

        await refreshSessions();
        setSessionId(res.session_id);
        setMessages([]);
        setShowProfileSelector(false);
        setActivePanel("chat");

        sessionState.setProfile(profile);

        try {
          await sessionState.refresh();
        } catch (stateError) {
          console.error("Failed to get new session state:", stateError);
        }

        const welcome = await getWelcomeMessage(res.session_id);
        setMessages([
          { role: "assistant", content: welcome.welcome, isThinking: false },
        ]);
      } catch (error) {
        console.error("Failed to create session:", error);
      }
    },
    [refreshSessions, sessionState, setMessages],
  );

  const handleSwitchToSession = useCallback(
    async (session: SessionSummary) => {
      setSessionId(session.session_id);
      setMessages([]);
      setActivePanel("chat");

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
              role: msg.type === "human" ? "user" : "assistant",
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
                role: "assistant",
                content: welcome.welcome,
                isThinking: false,
              },
            ]);
          }
        }
      } catch (error) {
        console.error("Failed to switch session:", error);
        try {
          const welcome = await getWelcomeMessage(session.session_id);
          if (welcome.welcome) {
            setMessages([
              {
                role: "assistant",
                content: welcome.welcome,
                isThinking: false,
              },
            ]);
          }
        } catch (welcomeError) {
          console.error("Failed to get welcome message:", welcomeError);
        }
      }
    },
    [sessionState, setMessages],
  );

  const handleRenameSession = useCallback(
    async (sessionIdToRename: string, newName: string) => {
      try {
        await renameSession(sessionIdToRename, { session_name: newName });
        await refreshSessions();
      } catch (error) {
        console.error("Failed to rename session:", error);
      }
    },
    [refreshSessions],
  );

  const handleDeleteSession = useCallback(
    async (sessionIdToDelete: string) => {
      try {
        await deleteSession(sessionIdToDelete);
        await refreshSessions();
        if (sessionId === sessionIdToDelete) {
          setSessionId(null);
          setMessages([]);
        }
      } catch (error) {
        console.error("Failed to delete session:", error);
      }
    },
    [refreshSessions, sessionId, setMessages],
  );

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  const handleSend = useCallback(async () => {
    if (!inputValue.trim()) {
      return;
    }
    await sendMessage(inputValue.trim());
    setInputValue("");
  }, [inputValue, sendMessage]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }, [logout]);

  const handleOpenInvitationPanel = useCallback(() => {
    setActivePanel("invitation");
  }, []);

  const handleOpenLabManualPanel = useCallback(() => {
    setActivePanel("lab-manual");
  }, []);

  const handleOpenProfilePanel = useCallback(() => {
    setActivePanel("profile");
  }, []);

  const handleProfileGenerateSuccess = useCallback(
    async (_profile: Profile) => {
      await refreshProfiles();
    },
    [refreshProfiles],
  );

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!resizeState.current) {
        return;
      }
      const deltaX = event.clientX - resizeState.current.startX;
      const nextWidth = Math.min(
        sidebarMaxWidth,
        Math.max(sidebarMinWidth, resizeState.current.startWidth + deltaX),
      );
      setSidebarWidth(nextWidth);
    };

    const handleMouseUp = () => {
      if (!resizeState.current) {
        return;
      }
      resizeState.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [sidebarMaxWidth, sidebarMinWidth]);

  const handleResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isSidebarCollapsed) {
      return;
    }
    resizeState.current = {
      startX: event.clientX,
      startWidth: sidebarWidth,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const handleToggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

  const handleMaximizeToggle = useCallback(() => {
    setIsMaximized((prev) => !prev);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  const isChatView = activePanel === "chat";
  const contentMaxWidth = isMaximized ? "100%" : isChatView ? "80%" : "100%";

  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        bgcolor: "var(--color-bg)",
        color: "var(--text-primary)",
      }}
    >
      {/* Sidebar */}
      {!isMaximized && (
        <Box sx={{ display: "flex", height: "100%" }}>
          {isSidebarCollapsed ? (
            <SidebarRail
              isCollapsed={isSidebarCollapsed}
              onToggle={handleToggleSidebar}
              isLoading={profilesLoading || chatLoading}
              activePanel={activePanel}
              onOpenInvitationPanel={handleOpenInvitationPanel}
              onOpenLabManualPanel={handleOpenLabManualPanel}
              onOpenProfilePanel={handleOpenProfilePanel}
            />
          ) : (
            <Box
              sx={{ position: "relative", height: "100%" }}
              style={{
                width: sidebarWidth,
                minWidth: sidebarMinWidth,
                maxWidth: sidebarMaxWidth,
              }}
            >
              <Sidebar
                sessions={sessions}
                currentSessionId={sessionId}
                isLoading={profilesLoading || chatLoading}
                onNewSession={handleNewSession}
                onSelectSession={handleSwitchToSession}
                onRenameSession={handleRenameSession}
                onDeleteSession={handleDeleteSession}
                user={user}
                activePanel={activePanel}
                onCollapse={handleToggleSidebar}
                onOpenInvitationPanel={handleOpenInvitationPanel}
                onOpenLabManualPanel={handleOpenLabManualPanel}
                onOpenProfilePanel={handleOpenProfilePanel}
              />
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  height: "100%",
                  width: 6,
                  cursor: "col-resize",
                  bgcolor: "transparent",
                  "&:hover": { bgcolor: "var(--color-surface-muted)" },
                }}
                onMouseDown={handleResizeStart}
                title='拖动调整宽度'
              />
            </Box>
          )}
        </Box>
      )}

      {/* Main Content Area */}
      <Box
        component='main'
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          bgcolor: "var(--color-surface)",
        }}
      >
        <Header
          currentSession={currentSession}
          isMaximized={isMaximized}
          isCollapsed={isHeaderCollapsed}
          currentStep={sessionState.currentStep}
          curriculum={sessionState.curriculum}
          onToggleMaximize={handleMaximizeToggle}
          onToggleCollapse={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
          activePanel={activePanel}
          user={user}
          themeMode={themeMode}
          onToggleTheme={onToggleTheme}
          onLogout={handleLogout}
          onOpenSettings={handleOpenSettings}
        />

        <Box
          sx={{
            flex: 1,
            overflow: "hidden",
            px: 3,
            py: 3,
            width: "100%",
            maxWidth: contentMaxWidth,
            mx: isMaximized ? 0 : "auto",
          }}
        >
          {isChatView ? (
            <Box sx={{ height: "100%", overflow: "auto", width: "100%" }}>
              <MessageList messages={messages} />
            </Box>
          ) : (
            <Box sx={{ height: "100%", overflow: "auto" }}>
              {activePanel === "invitation" && (
                <InvitationCodeGenerator variant='panel' />
              )}
              {activePanel === "lab-manual" && (
                <LabManualUploader variant='panel' />
              )}
              {activePanel === "profile" && (
                <ProfileGeneratorAdvanced
                  variant='panel'
                  onGenerateSuccess={handleProfileGenerateSuccess}
                />
              )}
            </Box>
          )}
        </Box>

        {isChatView && (
          <Box
            sx={{
              px: 3,
              py: 2,
              bgcolor: "var(--color-surface)",
            }}
          >
            <Box
              sx={{ maxWidth: contentMaxWidth, mx: isMaximized ? 0 : "auto" }}
            >
              <ChatInput
                value={inputValue}
                disabled={!sessionId || chatLoading}
                placeholder={
                  sessionId
                    ? "输入你的想法或问题... (Enter发送，Shift+Enter换行)"
                    : "请先选择一个会话开始学习"
                }
                onChange={handleInputChange}
                onSend={handleSend}
              />
            </Box>
          </Box>
        )}
      </Box>

      {/* Profile Selector Modal */}
      {showProfileSelector && (
        <ProfileSelector
          profiles={profiles}
          isLoading={profilesLoading}
          onSelect={handleStartNewSession}
          onClose={() => setShowProfileSelector(false)}
        />
      )}

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </Box>
  );
}
