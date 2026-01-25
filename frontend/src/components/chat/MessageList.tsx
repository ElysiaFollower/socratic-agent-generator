/**
 * MessageList component for displaying chat messages.
 *
 * This component renders the list of chat messages with proper
 * styling and formatting.
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../hooks";
import {
  Box,
  IconButton,
  Paper,
  Stack,
  Typography,
  Tooltip,
} from "@mui/material";
import { ContentCopy, Replay, VolumeUp } from "@mui/icons-material";
import { CircularProgress } from "../common/CircularProgress";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatMessage } from "../../types";
import {
  filterAllowedVoices,
  loadTtsPreferences,
} from "../../utils/ttsPreferences";

/**
 * Props for MessageList component.
 */
export interface MessageListProps {
  readonly messages: readonly ChatMessage[];
  readonly onScrollToBottom?: () => void;
  readonly onCopyMessage?: (message: ChatMessage) => void;
  readonly onRegenerateMessage?: (messageIndex: number) => void;
  readonly actionsDisabled?: boolean;
}

/**
 * MessageList component for displaying chat messages.
 *
 * @param props - Component props
 * @returns React component
 */
export function MessageList(props: MessageListProps): JSX.Element {
  // 获取本地的用户名
  const { user } = useAuth();
  const displayName = user?.display_name || user?.username;
  const { t } = useTranslation();
  const {
    messages,
    onScrollToBottom,
    onCopyMessage,
    onRegenerateMessage,
    actionsDisabled = false,
  } = props;
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const [ttsPrefsVersion, setTtsPrefsVersion] = React.useState(0);
  const hasSpeechSupport =
    typeof window !== "undefined" && "speechSynthesis" in window;
  const ttsPreferences = React.useMemo(
    () => loadTtsPreferences(),
    [ttsPrefsVersion],
  );

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handlePrefsChange = () => {
      setTtsPrefsVersion((prev) => prev + 1);
    };
    window.addEventListener("tts-preferences-changed", handlePrefsChange);
    window.addEventListener("storage", handlePrefsChange);
    return () => {
      window.removeEventListener("tts-preferences-changed", handlePrefsChange);
      window.removeEventListener("storage", handlePrefsChange);
    };
  }, []);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    if (onScrollToBottom) {
      onScrollToBottom();
    }
  }, [messages, onScrollToBottom]);

  if (messages.length === 0) {
    return (
      <Box
        sx={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "text.secondary",
        }}
      >
        <Stack spacing={1} alignItems='center'>
          <Typography variant='h4'>
            {`Hi ${displayName}. ` + t("chat.welcomeTitle")}
          </Typography>
          <Typography variant='body1'>{t("chat.welcomeMessage")}</Typography>
        </Stack>
      </Box>
    );
  }

  const normalizeSpeechText = (content: string) =>
    content
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
      .replace(/[#>*_`~]/g, "")
      .replace(/\n{2,}/g, "\n")
      .trim();

  const splitSpeechSegments = (content: string) => {
    const segments: Array<{ lang: "zh" | "en"; text: string }> = [];
    let currentLang: "zh" | "en" | null = null;
    let buffer = "";
    let pendingNeutral = "";

    const classify = (char: string): "zh" | "en" | null => {
      if (/[A-Za-z0-9]/.test(char)) {
        return "en";
      }
      if (/[\u4E00-\u9FFF]/.test(char)) {
        return "zh";
      }
      return null;
    };

    for (const char of content) {
      const lang = classify(char);
      if (!lang) {
        if (currentLang) {
          buffer += char;
        } else {
          pendingNeutral += char;
        }
        continue;
      }

      if (!currentLang) {
        currentLang = lang;
        buffer = pendingNeutral + char;
        pendingNeutral = "";
        continue;
      }

      if (lang === currentLang) {
        buffer += char;
        continue;
      }

      segments.push({ lang: currentLang, text: buffer });
      currentLang = lang;
      buffer = char;
    }

    if (currentLang) {
      segments.push({
        lang: currentLang,
        text: buffer + pendingNeutral,
      });
    } else if (pendingNeutral.trim()) {
      segments.push({ lang: "en", text: pendingNeutral });
    }

    return segments;
  };

  const handleSpeakMessage = (message: ChatMessage) => {
    if (!hasSpeechSupport) {
      return;
    }

    const prefs = loadTtsPreferences();
    if (!prefs.enabled) {
      return;
    }

    const text = normalizeSpeechText(message.content);
    if (!text) {
      return;
    }

    const synth = window.speechSynthesis;
    const voices = filterAllowedVoices(synth.getVoices());
    if (!voices.length) {
      return;
    }

    const segments = splitSpeechSegments(text);
    if (!segments.length) {
      return;
    }

    const chooseVoice = (langPrefix: "zh" | "en") => {
      const preferredUri =
        langPrefix === "zh" ? prefs.voiceURIZh : prefs.voiceURIEn;
      const preferred =
        preferredUri &&
        voices.find(
          (voice) =>
            voice.voiceURI === preferredUri &&
            voice.lang.toLowerCase().startsWith(langPrefix),
        );
      if (preferred) {
        return preferred;
      }
      return (
        voices.find((voice) =>
          voice.lang.toLowerCase().startsWith(langPrefix),
        ) || voices[0]
      );
    };

    synth.cancel();

    const speakNext = (index: number) => {
      if (index >= segments.length) {
        return;
      }
      const segment = segments[index];
      const utterance = new SpeechSynthesisUtterance(segment.text);
      const targetLanguage = segment.lang === "zh" ? "zh-CN" : "en-US";
      utterance.lang = targetLanguage;
      utterance.rate = prefs.rate;
      utterance.pitch = prefs.pitch;
      utterance.volume = prefs.volume;
      const voice = chooseVoice(segment.lang);
      if (voice) {
        utterance.voice = voice;
      }
      utterance.onend = () => speakNext(index + 1);
      utterance.onerror = () => speakNext(index + 1);
      synth.speak(utterance);
    };

    speakNext(0);
  };

  return (
    <Stack spacing={2} sx={{ width: "100%", px: 0, flex: 1 }}>
      {messages.map((message, index) => {
        const isUser = message.role === "user";
        const canPlayVoice = message.role === "assistant";
        const showActions =
          !message.isThinking &&
          (onCopyMessage || onRegenerateMessage || canPlayVoice);
        const markdownStyles = {
          "& p": {
            m: 0,
            mb: 1,
            lineHeight: 1.7,
            wordBreak: "break-word",
            overflowWrap: "break-word",
          },
          "& p:last-child": { mb: 0 },
          "& ul, & ol": { pl: 2, my: 1, listStylePosition: "outside" },
          "& ul": { listStyleType: "disc" },
          "& ol": { listStyleType: "decimal" },
          "& li": { mb: 0.5 },
          "& hr": {
            border: "none",
            borderTop: `1px solid ${
              isUser ? "rgba(255, 255, 255, 0.2)" : "var(--color-border)"
            }`,
            my: 2,
            mx: 0,
          },
          "& code": {
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: "0.85em",
            px: 0.6,
            py: 0.2,
            borderRadius: 0.75,
            bgcolor: isUser
              ? "rgba(255, 255, 255, 0.2)"
              : "var(--color-surface)",
          },
          "& pre": {
            m: 0,
            mb: 1,
            p: 1.5,
            borderRadius: 1,
            overflowX: "auto",
            bgcolor: isUser
              ? "rgba(255, 255, 255, 0.14)"
              : "var(--color-surface)",
          },
          "& pre code": {
            bgcolor: "transparent",
            p: 0,
          },
          "& blockquote": {
            m: 0,
            mb: 1,
            pl: 1.5,
            borderLeft: "3px solid var(--color-border)",
            color: isUser ? "rgba(255, 255, 255, 0.9)" : "text.secondary",
          },
          "& a": {
            color: isUser ? "rgba(255, 255, 255, 0.95)" : "inherit",
            textDecoration: "underline",
          },
          "& table": {
            width: "100%",
            borderCollapse: "collapse",
            my: 1,
          },
          "& th, & td": {
            border: "1px solid var(--color-border)",
            px: 1,
            py: 0.5,
          },
        } as const;
        return (
          <Box
            key={index}
            data-message-id={message.messageId}
            sx={{
              display: "flex",
              justifyContent: isUser ? "flex-end" : "flex-start",
              width: "100%",
            }}
          >
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: isUser ? "flex-end" : "flex-start",
                maxWidth: isUser ? "70%" : "100%",
                "&:hover .message-actions": {
                  opacity: 1,
                  transform: "translateY(0)",
                },
              }}
            >
              <Paper
                variant='outlined'
                sx={{
                  px: 1.5,
                  py: 1,
                  borderRadius: isUser ? 1.5 : 2,
                  bgcolor: isUser
                    ? "secondary.main"
                    : "var(--color-surface-muted)",
                  color: isUser ? "#ffffff" : "var(--text-primary)",
                  borderColor: "transparent",
                  display: "inline-block",
                  maxWidth: "100%",
                }}
              >
                {message.role === "assistant" && message.isThinking ? (
                  <Stack direction='row' spacing={1} alignItems='center'>
                    <CircularProgress size={14} />
                    <Typography variant='body2' color='text.secondary'>
                      {message.thinkingMessage || t("chat.tutorThinking")}
                    </Typography>
                  </Stack>
                ) : (
                  <Box sx={markdownStyles}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </ReactMarkdown>
                  </Box>
                )}
              </Paper>
              {showActions && (
                <Box
                  className='message-actions'
                  sx={{
                    mt: 0.5,
                    display: "flex",
                    gap: 0.5,
                    opacity: 0,
                    transform: "translateY(4px)",
                    transition: "opacity 150ms ease, transform 150ms ease",
                    justifyContent: isUser ? "flex-end" : "flex-start",
                  }}
                >
                  {onCopyMessage && (
                    <Tooltip title={t("chat.copyMessage")} arrow>
                      <span>
                        <IconButton
                          size='small'
                          onClick={(event) => {
                            event.stopPropagation();
                            onCopyMessage(message);
                          }}
                          disabled={actionsDisabled}
                          aria-label={t("chat.copyMessage")}
                          sx={{
                            color: "text.secondary",
                            transition:
                              "transform 150ms ease, color 150ms ease",
                            "&:hover": {
                              transform: "scale(1.04)",
                              color: "primary.main",
                            },
                          }}
                        >
                          <ContentCopy fontSize='inherit' />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                  {onRegenerateMessage && (
                    <Tooltip title={t("chat.regenerateMessage")} arrow>
                      <span>
                        <IconButton
                          size='small'
                          onClick={(event) => {
                            event.stopPropagation();
                            onRegenerateMessage(index);
                          }}
                          disabled={actionsDisabled}
                          aria-label={t("chat.regenerateMessage")}
                          sx={{
                            color: "text.secondary",
                            transition:
                              "transform 150ms ease, color 150ms ease",
                            "&:hover": {
                              transform: "scale(1.04)",
                              color: "primary.main",
                            },
                          }}
                        >
                          <Replay fontSize='inherit' />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                  {canPlayVoice && (
                    <Tooltip
                      title={
                        !hasSpeechSupport
                          ? t("chat.voicePlaybackNotSupported")
                          : !ttsPreferences.enabled
                            ? t("chat.voicePlaybackDisabled")
                            : t("chat.playVoice")
                      }
                      arrow
                    >
                      <span>
                        <IconButton
                          size='small'
                          onClick={(event) => {
                            event.stopPropagation();
                            handleSpeakMessage(message);
                          }}
                          disabled={
                            actionsDisabled ||
                            !hasSpeechSupport ||
                            !ttsPreferences.enabled
                          }
                          aria-label={t("chat.playVoice")}
                          sx={{
                            color: "text.secondary",
                            transition:
                              "transform 150ms ease, color 150ms ease",
                            "&:hover": {
                              transform: "scale(1.04)",
                              color: "primary.main",
                            },
                          }}
                        >
                          <VolumeUp fontSize='inherit' />
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        );
      })}
      <div ref={messagesEndRef} />
    </Stack>
  );
}
