/**
 * Login component.
 *
 * This component provides a login form for user authentication,
 * following Google TypeScript Style Guide.
 */

import React, { useState, FormEvent } from "react";
import {
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useAuth, useNotification } from "../../hooks";
import { LoginRequest } from "../../types";

/**
 * Props for Login component.
 */
interface LoginProps {
  readonly onLoginSuccess?: () => void;
  readonly onSwitchToRegister?: () => void;
}

/**
 * Login form component.
 *
 * @param props - Component props
 * @returns React component
 */
export function Login(props: LoginProps): JSX.Element {
  const { onLoginSuccess, onSwitchToRegister } = props;
  const { login, isLoading } = useAuth();
  const { notifyError, notifyWarning } = useNotification();
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  /**
   * Handles form submission.
   *
   * @param event - Form submit event
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!username.trim() || !password.trim()) {
      notifyWarning("请输入用户名和密码");
      return;
    }

    try {
      const credentials: LoginRequest = {
        username: username.trim(),
        password,
      };
      await login(credentials);
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "登录失败，请重试";
      notifyError(errorMessage);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "var(--color-bg)",
        px: 2,
      }}
    >
      <Paper variant='outlined' sx={{ p: 4, width: "100%", maxWidth: 420 }}>
        <Stack spacing={3}>
          <Box textAlign='center'>
            <Typography variant='h5' sx={{ fontWeight: 700 }}>
              登录到苏格拉底式AI导师系统
            </Typography>
            <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
              请输入您的用户名和密码
            </Typography>
          </Box>

          <Stack component='form' spacing={2} onSubmit={handleSubmit}>
            <TextField
              id='username'
              label='用户名'
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              fullWidth
              required
            />
            <TextField
              id='password'
              label='密码'
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              fullWidth
              required
            />
            <Button type='submit' variant='contained' disabled={isLoading}>
              {isLoading ? "登录中..." : "登录"}
            </Button>
          </Stack>

          {onSwitchToRegister && (
            <Button
              variant='text'
              onClick={onSwitchToRegister}
              disabled={isLoading}
            >
              还没有账户？立即注册
            </Button>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
