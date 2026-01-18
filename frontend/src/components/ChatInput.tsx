/**
 * ChatInput component for message input.
 *
 * This component provides a textarea for user input with send functionality.
 */

import React from 'react';
import {Box, Button, Stack, TextField} from '@mui/material';
import {Send} from '@mui/icons-material';

/**
 * Props for ChatInput component.
 */
export interface ChatInputProps {
  readonly value: string;
  readonly disabled: boolean;
  readonly placeholder?: string;
  readonly onChange: (value: string) => void;
  readonly onSend: () => void;
}

/**
 * ChatInput component for message input.
 *
 * @param props - Component props
 * @returns React component
 */
export function ChatInput(props: ChatInputProps): JSX.Element {
  const {value, disabled, placeholder, onChange, onSend} = props;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <Stack direction="row" spacing={2} alignItems="stretch">
      <TextField
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        multiline
        minRows={2}
        fullWidth
        placeholder={
          placeholder ||
          '输入你的想法或问题... (Enter发送，Shift+Enter换行)'
        }
        disabled={disabled}
      />
      <Button
        onClick={onSend}
        variant="contained"
        color="primary"
        disabled={disabled || !value.trim()}
        endIcon={<Send />}
        sx={{px: 3, minWidth: 120}}
      >
        发送
      </Button>
    </Stack>
  );
}



