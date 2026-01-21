/**
 * Login component.
 *
 * This component provides a login form for user authentication,
 * following Google TypeScript Style Guide.
 */

import React, { useState, FormEvent } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      notifyWarning(t("login.usernameRequired"));
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
        err instanceof Error ? err.message : t("login.failed");
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
              {t("login.title")}
            </Typography>
            <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
              {t("login.subtitle")}
            </Typography>
          </Box>

          <Stack component='form' spacing={2} onSubmit={handleSubmit}>
            <TextField
              id='username'
              label={t("login.username")}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              fullWidth
              required
            />
            <TextField
              id='password'
              label={t("login.password")}
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              fullWidth
              required
            />
            <Button type='submit' variant='contained' disabled={isLoading}>
              {isLoading ? t("login.logging") : t("login.submit")}
            </Button>
          </Stack>

          {onSwitchToRegister && (
            <Button
              variant='text'
              onClick={onSwitchToRegister}
              disabled={isLoading}
            >
              {t("login.noAccount")}
            </Button>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
