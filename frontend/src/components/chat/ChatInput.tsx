/**
 * ChatInput component for message input.
 *
 * This component provides a textarea for user input with send functionality.
 */

import React from "react";
import { Box, IconButton, TextField } from "@mui/material";
import { SendOutlined } from "@mui/icons-material";
import { color } from "../../styles/css-variables";

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <Box
      sx={{
        position: "relative",
        mt: "var(--spacing-4)",
        width: "100%",
        maxWidth: { xs: "100%", sm: "80%", md: "80%", lg: "75%" },
        mx: "auto",
        px: { xs: "var(--spacing-4)", sm: "var(--spacing-6)" },
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
            borderRadius: "var(--radius-3xl)",
            backgroundColor: "var(--color-surface)",
            color: "var(--text-primary)",
            boxShadow: "var(--shadow-md)",
            transition:
              "all var(--transition-duration-200) var(--transition-timing-default)",
            "& fieldset": {
              borderColor: color.background.surfaceMuted,
              borderWidth: "2px",
            },
            "&:hover fieldset": {
              borderColor: color.background.surfaceMuted,
            },
            "&.Mui-focused fieldset": {
              borderColor: color.background.surfaceMuted,
            },
          },
          "& .MuiInputBase-input": {
            paddingRight: "56px",
            fontFamily: "var(--font-body)",
            fontSize: "0.9375rem",
            lineHeight: 1.5,
          },
          "& .MuiInputBase-input::placeholder": {
            color: "var(--text-muted)",
            opacity: 1,
            fontFamily: "var(--font-body)",
            fontSize: "0.9375rem",
          },
          marginBottom: "var(--spacing-6)",
        }}
      />
      <IconButton
        onClick={onSend}
        disabled={disabled || !value.trim()}
        aria-label='发送消息'
        sx={{
          backgroundColor: "var(--color-primary)",
          color: "#ffffff",
          position: "absolute",
          right: "var(--spacing-8)",
          bottom: "var(--spacing-8)",
          boxShadow: "var(--shadow-lg)",
          borderRadius: "var(--radius-full)",
          width: "36px",
          height: "36px",
          transition:
            "all var(--transition-duration-200) var(--transition-timing-default)",
          "&:hover": {
            backgroundColor: "var(--color-primary-700)",
            transform: "translateY(-1px)",
            boxShadow: "var(--shadow-xl)",
          },
          "&:active": {
            transform: "translateY(0)",
          },
          "&:disabled": {
            backgroundColor: "var(--color-neutral-300)",
            color: "var(--color-neutral-500)",
            boxShadow: "none",
            transform: "none",
          },
        }}
      >
        <SendOutlined />
      </IconButton>
    </Box>
  );
}
