/**
 * Register component.
 *
 * This component provides a registration form for new users,
 * following Google TypeScript Style Guide.
 */

import React, { useState, FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useAuth, useNotification } from "../../hooks";
import { RegisterRequest, UserRole } from "../../types";
import { register as apiRegister } from "../../api";

/**
 * Props for Register component.
 */
interface RegisterProps {
  readonly onRegisterSuccess?: () => void;
  readonly onSwitchToLogin?: () => void;
}

/**
 * Register form component.
 *
 * @param props - Component props
 * @returns React component
 */
export function Register(props: RegisterProps): JSX.Element {
  const { onRegisterSuccess, onSwitchToLogin } = props;
  const { t } = useTranslation();
  const { login } = useAuth();
  const { notifyError, notifyInfo, notifyWarning } = useNotification();
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [role, setRole] = useState<UserRole>("student");
  const [displayName, setDisplayName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [adminToken, setAdminToken] = useState<string>("");
  const [invitationCode, setInvitationCode] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  /**
   * Handles form submission.
   *
   * @param event - Form submit event
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Validation
    if (!username.trim()) {
      notifyWarning(t("register.usernameRequired"));
      return;
    }
    if (!password.trim()) {
      notifyWarning(t("register.passwordRequired"));
      return;
    }
    if (password !== confirmPassword) {
      notifyWarning(t("register.passwordMismatch"));
      return;
    }
    if (password.length < 6) {
      notifyWarning(t("register.passwordTooShort"));
      return;
    }
    if (role === "admin" && !adminToken.trim()) {
      notifyWarning(t("register.adminTokenRequired"));
      return;
    }
    if ((role === "teacher" || role === "student") && !invitationCode.trim()) {
      notifyWarning(t("register.invitationCodeRequired"));
      return;
    }
    setIsLoading(true);
    try {
      const request: RegisterRequest = {
        username: username.trim(),
        password,
        role,
        display_name: displayName.trim() || undefined,
        email: email.trim() || undefined,
        admin_token: role === "admin" ? adminToken.trim() : undefined,
        invitation_code:
          role === "teacher" || role === "student"
            ? invitationCode.trim()
            : undefined,
      };

      await apiRegister(request);

      // Auto login after successful registration
      try {
        await login({
          username: username.trim(),
          password,
        });
        if (onRegisterSuccess) {
          onRegisterSuccess();
        }
      } catch (loginError) {
        // Registration succeeded but login failed
        const loginErrorMessage =
          loginError instanceof Error
            ? loginError.message
            : t("register.successButLoginFailed");
        notifyInfo(loginErrorMessage);
        // Still switch to login page after a delay
        setTimeout(() => {
          if (onSwitchToLogin) {
            onSwitchToLogin();
          }
        }, 2000);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("register.failed");
      notifyError(errorMessage);
    } finally {
      setIsLoading(false);
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
        py: 4,
      }}
    >
      <Paper variant='outlined' sx={{ p: 4, width: "100%", maxWidth: 520 }}>
        <Stack spacing={3}>
          <Box textAlign='center'>
            <Typography variant='h5' sx={{ fontWeight: 700 }}>
              {t("register.title")}
            </Typography>
            <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
              {t("register.subtitle")}
            </Typography>
          </Box>

          <Stack component='form' spacing={2} onSubmit={handleSubmit}>
            <TextField
              id='username'
              label={t("register.username")}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              fullWidth
              required
            />
            <TextField
              id='password'
              label={t("register.password")}
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              fullWidth
              required
              helperText={t("register.passwordHelper")}
            />
            <TextField
              id='confirmPassword'
              label={t("register.confirmPassword")}
              type='password'
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              fullWidth
              required
            />

            <FormControl fullWidth required disabled={isLoading}>
              <InputLabel id='role-label'>{t("register.role")}</InputLabel>
              <Select
                labelId='role-label'
                id='role'
                value={role}
                label={t("register.role")}
                onChange={(e) => {
                  setRole(e.target.value as UserRole);
                  setAdminToken("");
                  setInvitationCode("");
                }}
              >
                <MenuItem value='student'>{t("register.roleStudent")}</MenuItem>
                <MenuItem value='teacher'>{t("register.roleTeacher")}</MenuItem>
                <MenuItem value='admin'>{t("register.roleAdmin")}</MenuItem>
              </Select>
            </FormControl>

            <TextField
              id='displayName'
              label={t("register.displayName")}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={isLoading}
              fullWidth
            />
            <TextField
              id='email'
              label={t("register.email")}
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              fullWidth
            />

            {role === "admin" && (
              <TextField
                id='adminToken'
                label={t("register.adminToken")}
                type='password'
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
                disabled={isLoading}
                fullWidth
                required
                helperText={t("register.adminTokenHelper")}
              />
            )}

            {(role === "teacher" || role === "student") && (
              <TextField
                id='invitationCode'
                label={t("register.invitationCode")}
                value={invitationCode}
                onChange={(e) => setInvitationCode(e.target.value)}
                disabled={isLoading}
                fullWidth
                required
                helperText={
                  role === "teacher"
                    ? t("register.teacherCodeHelper")
                    : t("register.studentCodeHelper")
                }
              />
            )}

            <Button type='submit' variant='contained' disabled={isLoading}>
              {isLoading ? t("register.registering") : t("register.submit")}
            </Button>
          </Stack>

          {onSwitchToLogin && (
            <Button
              variant='text'
              onClick={onSwitchToLogin}
              disabled={isLoading}
            >
              {t("register.hasAccount")}
            </Button>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
