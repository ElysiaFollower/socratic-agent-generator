/**
 * ChatInput component for message input.
 *
 * This component provides a textarea for user input with send functionality.
 */

import React, { useRef, useState } from "react";
import {
  Box,
  IconButton,
  TextField,
  MenuItem,
  Popper,
  Paper,
  Grow,
  ClickAwayListener,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { CircularProgress } from "../common/CircularProgress";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import AddIcon from "@mui/icons-material/Add";
import { color } from "../../styles/css-variables";

/**
 * Props for ChatInput component.
 */
export interface ChatInputProps {
  readonly value: string;
  readonly disabled: boolean;
  readonly loading?: boolean;
  readonly placeholder?: string;
  readonly onChange: (value: string) => void;
  readonly onSend: () => void;
  readonly llmOptions?: readonly { value: string; label: string }[];
  readonly selectedLlm?: string;
  readonly onLlmChange?: (value: string) => void;
}

/**
 * ChatInput component for message input.
 *
 * @param props - Component props
 * @returns React component
 */
export function ChatInput(props: ChatInputProps): JSX.Element {
  const { t } = useTranslation();
  const {
    value,
    disabled,
    loading = false,
    placeholder,
    onChange,
    onSend,
    llmOptions,
    selectedLlm,
    onLlmChange,
  } = props;

  // Local ref to prevent double submissions
  const isSendingRef = useRef(false);
  // State for menu popper
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnchorRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Prevent double submission by checking if we're already sending
      if (!isSendingRef.current && !disabled && !loading && value.trim()) {
        isSendingRef.current = true;
        onSend();
        // Reset the ref after a short delay to allow subsequent sends
        setTimeout(() => {
          isSendingRef.current = false;
        }, 500);
      }
    }
  };

  return (
    <ClickAwayListener onClickAway={() => setMenuOpen(false)}>
      <Box
        sx={{
          mt: "var(--spacing-4)",
          width: "100%",
          maxWidth: "100%",
          display: "flex",
          alignItems: "flex-end",
          gap: 2,
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: "100%",
          }}
        >
          <TextField
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            multiline
            minRows={1}
            maxRows={10}
            fullWidth
            placeholder={
              placeholder ||
              "输入你的想法或问题... (Enter发送，Shift+Enter换行)"
            }
            disabled={disabled}
            variant='outlined'
            InputProps={{
              startAdornment:
                llmOptions && llmOptions.length > 0 && onLlmChange ? (
                  <IconButton
                    ref={menuAnchorRef}
                    onClick={() => setMenuOpen(!menuOpen)}
                    disabled={disabled}
                    aria-label='打开菜单'
                    sx={{
                      width: "32px",
                      height: "32px",
                      p: 2,
                      color: "var(--text-muted)",
                      mr: 0.5,
                      alignSelf: "flex-end",
                      "&:hover": {
                        color: "var(--text-primary)",
                        backgroundColor: "var(--color-neutral-100)",
                      },
                      "&:disabled": {
                        color: "var(--text-muted)",
                      },
                    }}
                  >
                    <AddIcon />
                  </IconButton>
                ) : undefined,
              endAdornment: (
                <IconButton
                  onClick={onSend}
                  disabled={disabled || loading || !value.trim()}
                  aria-label='发送消息'
                  sx={{
                    backgroundColor: loading
                      ? "var(--color-neutral-300)"
                      : "var(--color-primary)",
                    color: "#ffffff",
                    boxShadow: "var(--shadow-lg)",
                    borderRadius: "var(--radius-full)",
                    width: "32px",
                    height: "32px",
                    alignSelf: "flex-end",
                    transition:
                      "all var(--transition-duration-200) var(--transition-timing-default)",
                    "&:hover": {
                      backgroundColor: loading
                        ? "var(--color-neutral-300)"
                        : "var(--color-primary-700)",
                    },
                    "&:disabled": {
                      backgroundColor: "var(--color-neutral-300)",
                      color: "var(--color-neutral-500)",
                      boxShadow: "none",
                    },
                  }}
                >
                  {loading ? (
                    <CircularProgress
                      size={20}
                      sx={{
                        color: "var(--color-neutral-500)",
                      }}
                    />
                  ) : (
                    <ArrowUpwardIcon />
                  )}
                </IconButton>
              ),
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "30px",
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

          {/* LLM Selection Menu Popper */}
          {llmOptions && llmOptions.length > 0 && onLlmChange && (
            <Popper
              open={menuOpen}
              anchorEl={menuAnchorRef.current}
              placement='top-start'
              transition
              sx={{
                zIndex: 1300,
                mb: 1,
              }}
            >
              {({ TransitionProps }) => (
                <Grow {...TransitionProps}>
                  <Paper
                    sx={{
                      boxShadow: "var(--shadow-lg)",
                      borderRadius: "var(--radius-lg)",
                      overflow: "hidden",
                      minWidth: 200,
                    }}
                  >
                    <Box
                      sx={{
                        py: 1,
                      }}
                    >
                      <Box
                        sx={{
                          px: 2,
                          py: 1,
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                        }}
                      >
                        {t("chat.llmSelectorLabel")}
                      </Box>
                      {llmOptions.map((option) => (
                        <MenuItem
                          key={option.value}
                          selected={option.value === selectedLlm}
                          onClick={() => {
                            onLlmChange(option.value);
                            setMenuOpen(false);
                          }}
                          sx={{
                            mx: 1,
                            borderRadius: "var(--radius-md)",
                            "&.Mui-selected": {
                              backgroundColor: "var(--color-primary-100)",
                              "&:hover": {
                                backgroundColor: "var(--color-primary-200)",
                              },
                            },
                          }}
                        >
                          {option.label}
                        </MenuItem>
                      ))}
                    </Box>
                  </Paper>
                </Grow>
              )}
            </Popper>
          )}
        </Box>
      </Box>
    </ClickAwayListener>
  );
}
