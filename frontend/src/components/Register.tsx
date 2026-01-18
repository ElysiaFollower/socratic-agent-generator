/**
 * Register component.
 *
 * This component provides a registration form for new users,
 * following Google TypeScript Style Guide.
 */

import React, {useState, FormEvent} from 'react';
import {
  Alert,
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
} from '@mui/material';
import {useAuth} from '../hooks';
import {RegisterRequest, UserRole} from '../types';
import {register as apiRegister} from '../api';

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
  const {onRegisterSuccess, onSwitchToLogin} = props;
  const {login} = useAuth();
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [role, setRole] = useState<UserRole>('student');
  const [displayName, setDisplayName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [adminToken, setAdminToken] = useState<string>('');
  const [invitationCode, setInvitationCode] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  /**
   * Handles form submission.
   *
   * @param event - Form submit event
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    // Validation
    if (!username.trim()) {
      setError('请输入用户名');
      return;
    }
    if (!password.trim()) {
      setError('请输入密码');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    if (password.length < 6) {
      setError('密码长度至少为6位');
      return;
    }
    if (role === 'admin' && !adminToken.trim()) {
      setError('注册管理员需要提供管理员令牌');
      return;
    }
    if (role !== 'admin' && !invitationCode.trim()) {
      setError(`注册${role === 'teacher' ? '教师' : '学生'}需要提供邀请码`);
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
        admin_token: role === 'admin' ? adminToken.trim() : undefined,
        invitation_code: role !== 'admin' ? invitationCode.trim() : undefined,
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
            : '注册成功，但自动登录失败，请手动登录';
        setError(loginErrorMessage);
        // Still switch to login page after a delay
        setTimeout(() => {
          if (onSwitchToLogin) {
            onSwitchToLogin();
          }
        }, 2000);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '注册失败，请重试';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'var(--color-bg)',
        px: 2,
        py: 4,
      }}
    >
      <Paper variant="outlined" sx={{p: 4, width: '100%', maxWidth: 520}}>
        <Stack spacing={3}>
          <Box textAlign="center">
            <Typography variant="h5" sx={{fontWeight: 700}}>
              注册新账户
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{mt: 1}}>
              创建您的账户以开始使用
            </Typography>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}

          <Stack component="form" spacing={2} onSubmit={handleSubmit}>
            <TextField
              id="username"
              label="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              fullWidth
              required
            />
            <TextField
              id="password"
              label="密码"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              fullWidth
              required
              helperText="至少 6 位"
            />
            <TextField
              id="confirmPassword"
              label="确认密码"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              fullWidth
              required
            />

            <FormControl fullWidth required disabled={isLoading}>
              <InputLabel id="role-label">身份</InputLabel>
              <Select
                labelId="role-label"
                id="role"
                value={role}
                label="身份"
                onChange={(e) => {
                  setRole(e.target.value as UserRole);
                  setAdminToken('');
                  setInvitationCode('');
                }}
              >
                <MenuItem value="student">学生</MenuItem>
                <MenuItem value="teacher">教师</MenuItem>
                <MenuItem value="admin">管理员</MenuItem>
              </Select>
            </FormControl>

            <TextField
              id="displayName"
              label="显示名称（可选）"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={isLoading}
              fullWidth
            />
            <TextField
              id="email"
              label="邮箱（可选）"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              fullWidth
            />

            {role === 'admin' && (
              <TextField
                id="adminToken"
                label="管理员令牌"
                type="password"
                value={adminToken}
                onChange={(e) => setAdminToken(e.target.value)}
                disabled={isLoading}
                fullWidth
                required
                helperText="从 .env 文件获取"
              />
            )}

            {role !== 'admin' && (
              <TextField
                id="invitationCode"
                label={`邀请码${role === 'teacher' ? '（需要管理员提供）' : '（需要教师或管理员提供）'}`}
                value={invitationCode}
                onChange={(e) => setInvitationCode(e.target.value)}
                disabled={isLoading}
                fullWidth
                required
              />
            )}

            <Button type="submit" variant="contained" disabled={isLoading}>
              {isLoading ? '注册中...' : '注册'}
            </Button>
          </Stack>

          {onSwitchToLogin && (
            <Button variant="text" onClick={onSwitchToLogin} disabled={isLoading}>
              已有账户？立即登录
            </Button>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
