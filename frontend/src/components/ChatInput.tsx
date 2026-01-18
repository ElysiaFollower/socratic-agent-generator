/**
 * ChatInput component for message input.
 *
 * This component provides a textarea for user input with send functionality.
 */

import React from "react";
import { Box, IconButton, TextField } from "@mui/material";
import { SendOutlined } from "@mui/icons-material";

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
  const { value, disabled, placeholder, onChange, onSend } = props;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <Box
      sx={{
        position: "relative",
        mt: 1,
        width: "100%",
        maxWidth: { xs: "100%", md: "70%" },
        mx: "auto",
      }}
    >
      <TextField
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        multiline
        minRows={1}
        maxRows={6}
        fullWidth
        placeholder={
          placeholder || "输入你的想法或问题... (Enter发送，Shift+Enter换行)"
        }
        disabled={disabled}
        variant='outlined'
        sx={{
          "& .MuiOutlinedInput-root": {
            borderRadius: "24px",
            backgroundColor: "var(--color-surface)",
            color: "var(--text-primary)",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1)",
            "& fieldset": {
              borderColor: "transparent",
            },
            "&:hover fieldset": {
              borderColor: "transparent",
            },
            "&.Mui-focused fieldset": {
              borderColor: "transparent",
            },
          },
          "& .MuiInputBase-input": {
            paddingRight: "56px",
          },
          "& .MuiInputBase-input::placeholder": {
            color: "var(--text-muted)",
            opacity: 1,
          },
          marginBottom: "20px",
        }}
      />
      <IconButton
        onClick={onSend}
        disabled={disabled || !value.trim()}
        sx={{
          backgroundColor: "var(--color-primary)",
          color: "#ffffff",
          position: "absolute",
          right: "16px",
          bottom: "28px",
          boxShadow: "0 6px 16px rgba(37, 99, 235, 0.25)",
          "&:hover": {
            backgroundColor: "var(--color-secondary)",
          },
        }}
      >
        <SendOutlined />
      </IconButton>
    </Box>
  );
}
