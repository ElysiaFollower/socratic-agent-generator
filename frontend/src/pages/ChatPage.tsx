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
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Stack,
  Tooltip,
  Typography,
  Dialog,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { CircularProgress } from "../components/common/CircularProgress";
import AssistantIcon from "@mui/icons-material/Assistant";
import { Profile, SessionSummary, ChatMessage, ToolPanelView } from "../types";
import {
  useProfiles,
  useSessions,
  useChat,
  useSessionState,
  useAuth,
  useNotification,
  useClipboard,
} from "../hooks";
import {
  Sidebar,
  MessageList,
  ChatInput,
  Header,
  ProfileSelector,
  RegistrationInvitationCodeGenerator,
  LabManualPanel,
  SkillManagerPanel,
  ProfileManagerPanel,
  ClassManagerPanel,
  SettingsModal,
  SidebarRail,
  ProfileDetailCard,
} from "../components";
import {
  createSession,
  getSession,
  getWelcomeMessage,
  renameSession,
  deleteSession,
  getProfile,
} from "../api";
import { SUPPORTED_LANGUAGES, SupportedLanguage } from "../i18n";

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
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { notifySuccess, notifyError } = useNotification();
  const { copyToClipboard } = useClipboard();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showProfileSelector, setShowProfileSelector] =
    useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>("");
  const [activePanel, setActivePanel] = useState<ToolPanelView>("chat");
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showProfileDetail, setShowProfileDetail] = useState<boolean>(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isCreatingSession, setIsCreatingSession] = useState<boolean>(false);
  const [currentLanguage, setCurrentLanguage] =
    useState<SupportedLanguage>("en");
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
    setMessagesIfEmpty,
    isLoading: chatLoading, // Current session message loading state (does not affect other operations)
    sendMessage,
    setMessages,
    removeSession,
  } = useChat(sessionId, handleStateUpdate);

  const currentSession =
    sessions.find((s) => s.session_id === sessionId) || null;

  const handleNewSession = useCallback(() => {
    setShowProfileSelector(true);
  }, []);

  const handleLanguageChange = useCallback((language: SupportedLanguage) => {
    setCurrentLanguage(language);
  }, []);

  const handleSwitchToSession = useCallback(
    async (session: SessionSummary) => {
      setSessionId(session.session_id);
      setActivePanel("chat");

      try {
        const sessionDetail = await getSession(session.session_id);

        if (sessionDetail.profile) {
          sessionState.setProfile(sessionDetail.profile);
        } else {
          sessionState.setProfile(null);
        }

        if (sessionDetail.history && sessionDetail.history.length > 0) {
          const chatHistory: ChatMessage[] = sessionDetail.history.map(
            (msg) => ({
              role: msg.type === "human" ? "user" : "assistant",
              content: msg.content,
              isThinking: false,
            }),
          );
          // Only seed history if we haven't already captured streaming output.
          setMessagesIfEmpty(chatHistory, session.session_id);
        } else {
          const welcome = await getWelcomeMessage(session.session_id);
          if (welcome.welcome) {
            // Only seed welcome if no local messages exist for this session yet.
            setMessagesIfEmpty(
              [
                {
                  role: "assistant",
                  content: welcome.welcome,
                  isThinking: false,
                },
              ],
              session.session_id,
            );
          }
        }
      } catch (error) {
        console.error("Failed to switch session:", error);
        try {
          const welcome = await getWelcomeMessage(session.session_id);
          if (welcome.welcome) {
            setMessagesIfEmpty(
              [
                {
                  role: "assistant",
                  content: welcome.welcome,
                  isThinking: false,
                },
              ],
              session.session_id,
            );
          }
        } catch (welcomeError) {
          console.error("Failed to get welcome message:", welcomeError);
        }
      }
    },
    [sessionState, setMessagesIfEmpty],
  );

  const handleStartNewSession = useCallback(
    async (profile: Profile) => {
      if (isCreatingSession) {
        return;
      }
      setIsCreatingSession(true);
      try {
        const sessionName = `${profile.profile_name || profile.topic_name} - ${new Date().toLocaleString()}`;
        const res = await createSession({
          profile_id: profile.profile_id,
          session_name: sessionName,
          output_language: SUPPORTED_LANGUAGES[currentLanguage].llmLanguage,
        });

        setMessages([], res.session_id);
        setShowProfileSelector(false);

        // Refresh sessions list in background
        void refreshSessions();

        // Construct a SessionSummary object from the data we have
        const newSession: SessionSummary = {
          session_id: res.session_id,
          session_name: sessionName,
          profile_id: profile.profile_id,
          profile_name: profile.profile_name || profile.topic_name,
          topic_name: profile.topic_name,
          create_at: new Date().toISOString(),
          update_at: new Date().toISOString(),
        };

        // Use the same logic as clicking a session item
        await handleSwitchToSession(newSession);

        notifySuccess(t("chat.dialogCreated"));
      } catch (error) {
        console.error("Failed to create session:", error);
        notifyError(
          error instanceof Error ? error.message : t("chat.dialogCreateFailed"),
        );
      } finally {
        setIsCreatingSession(false);
      }
    },
    [
      notifyError,
      notifySuccess,
      refreshSessions,
      handleSwitchToSession,
      setMessages,
      currentLanguage,
      t,
      isCreatingSession,
    ],
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
        }
        removeSession(sessionIdToDelete);
      } catch (error) {
        console.error("Failed to delete session:", error);
      }
    },
    [refreshSessions, removeSession, sessionId],
  );

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  const handleSend = useCallback(async () => {
    const message = inputValue.trim();
    if (!message) {
      return;
    }
    setInputValue("");
    await sendMessage(message);
  }, [inputValue, sendMessage]);

  const handleCopyMessage = useCallback(
    async (message: ChatMessage) => {
      if (!message.content.trim()) {
        return;
      }
      await copyToClipboard(
        message.content,
        t("chat.messageCopied"),
        t("chat.copyFailed"),
      );
    },
    [copyToClipboard, t],
  );

  const handleRegenerateMessage = useCallback(
    async (messageIndex: number) => {
      if (!sessionId) {
        return;
      }
      if (chatLoading) {
        notifyError(t("chat.generatingReply"));
        return;
      }
      const userIndex = (() => {
        for (let i = messageIndex; i >= 0; i -= 1) {
          if (messages[i]?.role === "user") {
            return i;
          }
        }
        return -1;
      })();
      if (userIndex < 0) {
        notifyError(t("chat.userQuestionNotFound"));
        return;
      }
      const userMessage = messages[userIndex];
      if (!userMessage.content.trim()) {
        notifyError(t("chat.userQuestionEmpty"));
        return;
      }
      setMessages(messages.slice(0, userIndex + 1), sessionId);
      await sendMessage(userMessage.content, { appendUserMessage: false });
    },
    [
      chatLoading,
      messages,
      notifyError,
      sendMessage,
      sessionId,
      setMessages,
      t,
    ],
  );

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

  const handleOpenSkillPanel = useCallback(() => {
    setActivePanel("skill");
  }, []);

  const handleOpenProfilePanel = useCallback(() => {
    setActivePanel("profile");
  }, []);

  const handleOpenClassPanel = useCallback(() => {
    setActivePanel("class");
  }, []);

  const handleProfileClick = useCallback(async () => {
    if (!currentSession?.profile_id) {
      return;
    }
    try {
      const profile = await getProfile(currentSession.profile_id);
      setSelectedProfile(profile);
      setShowProfileDetail(true);
    } catch (error) {
      console.error("Failed to fetch profile:", error);
      notifyError(
        error instanceof Error ? error.message : t("chat.fetchProfileFailed"),
      );
    }
  }, [currentSession?.profile_id, notifyError, t]);

  const handleOpenChatHome = useCallback(() => {
    setSessionId(null);
    setInputValue("");
    sessionState.setProfile(null);
    setShowProfileSelector(false);
    setActivePanel("chat");
  }, [sessionState]);

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
  const contentMaxWidth = {
    xs: "100%",
    sm: isMaximized ? "100%" : isChatView ? "80%" : "100%",
    md: isMaximized ? "100%" : isChatView ? "70%" : "100%",
    lg: isMaximized ? "100%" : isChatView ? "60%" : "100%",
  };

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
              isLoading={profilesLoading}
              activePanel={activePanel}
              onOpenChatHome={handleOpenChatHome}
              onOpenInvitationPanel={handleOpenInvitationPanel}
              onOpenLabManualPanel={handleOpenLabManualPanel}
              onOpenSkillPanel={handleOpenSkillPanel}
              onOpenProfilePanel={handleOpenProfilePanel}
              onOpenClassPanel={handleOpenClassPanel}
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
                isLoading={profilesLoading}
                onNewSession={handleNewSession}
                onSelectSession={handleSwitchToSession}
                onRenameSession={handleRenameSession}
                onDeleteSession={handleDeleteSession}
                user={user}
                activePanel={activePanel}
                onCollapse={handleToggleSidebar}
                onOpenInvitationPanel={handleOpenInvitationPanel}
                onOpenLabManualPanel={handleOpenLabManualPanel}
                onOpenSkillPanel={handleOpenSkillPanel}
                onOpenProfilePanel={handleOpenProfilePanel}
                onOpenClassPanel={handleOpenClassPanel}
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
                title={t("chat.resizeWidth")}
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
          isProgressLoading={sessionState.isLoading}
          onToggleMaximize={handleMaximizeToggle}
          onToggleCollapse={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
          activePanel={activePanel}
          user={user}
          themeMode={themeMode}
          onToggleTheme={onToggleTheme}
          onLogout={handleLogout}
          onOpenSettings={handleOpenSettings}
          onProfileClick={currentSession ? handleProfileClick : undefined}
          currentLanguage={currentLanguage}
          onLanguageChange={handleLanguageChange}
        />

        <Box
          sx={{
            flex: 1,
            overflow: "hidden",
            width: "100%",
          }}
        >
          {isChatView ? (
            <Box
              className='chat-scrollable-container'
              sx={{
                height: "100%",
                overflow: "auto",
                width: "100%",
              }}
            >
              <Box
                sx={{
                  px: 3,
                  py: 2,
                  width: "100%",
                  maxWidth: contentMaxWidth,
                  mx: isMaximized ? 0 : "auto",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <MessageList
                  messages={messages}
                  onCopyMessage={handleCopyMessage}
                  onRegenerateMessage={handleRegenerateMessage}
                  actionsDisabled={chatLoading}
                />
              </Box>
            </Box>
          ) : (
            <Box
              sx={{
                height: "100%",
                overflow: "auto",
                scrollbarWidth: "none",
                "&::-webkit-scrollbar": {
                  display: "none",
                },
              }}
            >
              {activePanel === "invitation" && (
                <RegistrationInvitationCodeGenerator variant='panel' />
              )}
              {activePanel === "lab-manual" && (
                <LabManualPanel variant='panel' />
              )}
              {activePanel === "skill" && <SkillManagerPanel />}
              {activePanel === "profile" && (
                <ProfileManagerPanel
                  variant='panel'
                  onGenerateSuccess={handleProfileGenerateSuccess}
                />
              )}
              {activePanel === "class" && <ClassManagerPanel variant='panel' />}
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
              {!sessionId && (
                <Stack spacing={1} sx={{ mb: 2 }}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "center",
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        gap: 1,
                        overflowX: "auto",
                        scrollbarWidth: "none", // Firefox
                        "&::-webkit-scrollbar": {
                          display: "none", // Chrome/Safari
                        },
                        pb: 0.5,
                        width: "100%",
                        maxWidth: "60vw",
                        alignItems: "center",
                      }}
                    >
                      {profiles.length > 0 && (
                        <Tooltip
                          title={t("chat.quickCreateHint")}
                          placement='top'
                          arrow
                        >
                          <Box
                            aria-label={t("chat.quickCreateHint")}
                            sx={{
                              flexShrink: 0,
                              width: 32,
                              height: 32,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "text.secondary",
                              transition: "color 150ms ease",
                              "&:hover": {
                                color: "text.primary",
                              },
                            }}
                          >
                            <AssistantIcon fontSize='small' />
                          </Box>
                        </Tooltip>
                      )}
                      {profiles.map((profile) => {
                        const label =
                          profile.profile_name || profile.topic_name;
                        return (
                          <Tooltip
                            key={profile.profile_id}
                            title={label}
                            placement='top'
                            arrow
                          >
                            <Button
                              variant='outlined'
                              size='small'
                              onClick={() => handleStartNewSession(profile)}
                              disabled={isCreatingSession}
                              sx={{
                                flexShrink: 0,
                                minWidth: 0,
                                maxWidth: 160,
                                px: 1.5,
                                color: "text.secondary",
                                border: "0.5px dashed",
                                borderColor: "text.secondary",
                                transition:
                                  "color 150ms ease, border-color 150ms ease, transform 150ms ease",
                                "&:hover": {
                                  color: "primary.main",
                                  border: "0.5px solid",
                                  borderColor: "primary.main",
                                  transform: "scale(1.02)",
                                },
                              }}
                              startIcon={
                                isCreatingSession ? (
                                  <CircularProgress size={14} />
                                ) : undefined
                              }
                            >
                              <Box
                                component='span'
                                sx={{
                                  display: "block",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {label}
                              </Box>
                            </Button>
                          </Tooltip>
                        );
                      })}
                    </Box>
                  </Box>
                </Stack>
              )}
              <ChatInput
                value={inputValue}
                disabled={!sessionId}
                loading={chatLoading}
                placeholder={
                  sessionId
                    ? t("chat.inputPlaceholder")
                    : t("chat.selectSessionHint")
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
          isLoading={profilesLoading || isCreatingSession}
          onSelect={handleStartNewSession}
          onClose={() => setShowProfileSelector(false)}
          onOpen={refreshProfiles}
        />
      )}

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* Profile Detail Dialog */}
      <Dialog
        open={showProfileDetail}
        onClose={() => setShowProfileDetail(false)}
        fullWidth
        maxWidth='md'
      >
        {selectedProfile && (
          <>
            <DialogContent dividers>
              <ProfileDetailCard
                profile={selectedProfile}
                mode={
                  user?.role === "admin"
                    ? "admin"
                    : user?.role === "teacher"
                      ? "teacher"
                      : "student"
                }
                onUpdate={() => {
                  refreshProfiles();
                  if (
                    currentSession?.profile_id === selectedProfile.profile_id
                  ) {
                    sessionState.setProfile(selectedProfile);
                  }
                }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowProfileDetail(false)}>
                {t("common.close")}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
