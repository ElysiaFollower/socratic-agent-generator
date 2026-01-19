/**
 * MessageList component for displaying chat messages.
 *
 * This component renders the list of chat messages with proper
 * styling and formatting.
 */

import React from "react";
import {
  Avatar,
  Box,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { PersonOutline, SmartToy, WavingHand } from "@mui/icons-material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatMessage } from "../types";

/**
 * Props for MessageList component.
 */
export interface MessageListProps {
  readonly messages: readonly ChatMessage[];
  readonly onScrollToBottom?: () => void;
}

/**
 * MessageList component for displaying chat messages.
 *
 * @param props - Component props
 * @returns React component
 */
export function MessageList(props: MessageListProps): JSX.Element {
  const { messages, onScrollToBottom } = props;
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

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
          <WavingHand sx={{ fontSize: 32, color: "text.secondary" }} />
          <Typography variant='h6'>欢迎来到苏格拉底式学习</Typography>
          <Typography variant='body2'>
            选择一个会话开始你的学习之旅，或者创建一个新会话。
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Stack spacing={2} sx={{ width: "100%", px: 0 }}>
      {messages.map((message, index) => {
        const isUser = message.role === "user";
        const markdownStyles = {
          "& p": { m: 0, mb: 1, lineHeight: 1.7 },
          "& p:last-child": { mb: 0 },
          "& ul, & ol": { pl: 2, my: 1, listStylePosition: "outside" },
          "& ul": { listStyleType: "disc" },
          "& ol": { listStyleType: "decimal" },
          "& li": { mb: 0.5 },
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
            sx={{
              display: "flex",
              justifyContent: isUser ? "flex-end" : "flex-start",
              width: "100%",
            }}
          >
            <Stack
              direction={isUser ? "row-reverse" : "row"}
              spacing={1}
              alignItems='flex-start'
              sx={{ maxWidth: "100%" }}
            >
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: isUser
                    ? "var(--color-surface-muted)"
                    : "var(--color-surface-muted)",
                  color: "var(--text-secondary)",
                }}
              >
                {isUser ? (
                  <PersonOutline fontSize='small' />
                ) : (
                  <SmartToy fontSize='small' />
                )}
              </Avatar>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isUser ? "flex-end" : "flex-start",
                }}
              >
                <Paper
                  variant='outlined'
                  sx={{
                    px: 1.5,
                    py: 1,
                    borderRadius: isUser ? 1.5 : 2,
                    bgcolor: isUser
                      ? "var(--color-primary)"
                      : "var(--color-surface-muted)",
                    color: isUser ? "#ffffff" : "var(--text-primary)",
                    maxWidth: "min(860px, 100%)",
                    borderColor: "transparent",
                  }}
                >
                  {message.role === "assistant" && message.isThinking ? (
                    <Stack direction='row' spacing={1} alignItems='center'>
                      <CircularProgress size={14} />
                      <Typography variant='body2' color='text.secondary'>
                        {message.thinkingMessage || "导师正在思考..."}
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
              </Box>
            </Stack>
          </Box>
        );
      })}
      <div ref={messagesEndRef} />
    </Stack>
  );
}
