/**
 * MessageList component for displaying chat messages.
 *
 * This component renders the list of chat messages with proper
 * styling and formatting.
 */

import React from 'react';
import {
  Avatar,
  Box,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {PersonOutline, SmartToy, WavingHand} from '@mui/icons-material';
import {ChatMessage} from '../types';

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
  const {messages, onScrollToBottom} = props;
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({behavior: 'smooth'});
    if (onScrollToBottom) {
      onScrollToBottom();
    }
  }, [messages, onScrollToBottom]);

  if (messages.length === 0) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.secondary',
        }}
      >
        <Stack spacing={1} alignItems="center">
          <WavingHand sx={{fontSize: 32, color: 'var(--color-secondary)'}} />
          <Typography variant="h6">欢迎来到苏格拉底式学习</Typography>
          <Typography variant="body2">
            选择一个会话开始你的学习之旅，或者创建一个新会话。
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      {messages.map((message, index) => {
        const isUser = message.role === 'user';
        return (
          <Box
            key={index}
            sx={{display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start'}}
          >
            <Stack
              direction={isUser ? 'row-reverse' : 'row'}
              spacing={1.5}
              alignItems="flex-start"
              sx={{maxWidth: '80%'}}
            >
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: isUser ? 'var(--color-surface-muted)' : 'var(--color-surface-muted)',
                  color: 'var(--text-secondary)',
                }}
              >
                {isUser ? <PersonOutline fontSize="small" /> : <SmartToy fontSize="small" />}
              </Avatar>
              <Box sx={{display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start'}}>
                <Paper
                  variant="outlined"
                  sx={{
                    px: 2,
                    py: 1.5,
                    borderRadius: 3,
                    borderTopRightRadius: isUser ? 6 : 3,
                    borderTopLeftRadius: isUser ? 3 : 6,
                    bgcolor: isUser ? 'var(--color-primary)' : 'var(--color-surface-muted)',
                    color: isUser ? '#ffffff' : 'var(--text-primary)',
                    maxWidth: 560,
                  }}
                >
                  {message.role === 'assistant' && message.isThinking ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CircularProgress size={14} />
                      <Typography variant="body2" color="text.secondary">
                        {message.thinkingMessage || '导师正在思考...'}
                      </Typography>
                    </Stack>
                  ) : (
                    <Typography variant="body2" sx={{whiteSpace: 'pre-wrap', lineHeight: 1.7}}>
                      {message.content}
                    </Typography>
                  )}
                </Paper>
                {message.role === 'assistant' && !message.isThinking && (
                  <Typography variant="caption" color="text.secondary" sx={{mt: 0.5}}>
                    苏格拉底式导师
                  </Typography>
                )}
              </Box>
            </Stack>
          </Box>
        );
      })}
      <div ref={messagesEndRef} />
    </Stack>
  );
}



