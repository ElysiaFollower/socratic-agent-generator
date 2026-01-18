/**
 * Invitation code generator component.
 *
 * This component provides a UI for generating invitation codes,
 * following Google TypeScript Style Guide.
 */

import React, {useState, FormEvent} from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {useAuth} from '../hooks';
import {GenerateInvitationCodeRequest} from '../types';
import {generateInvitationCode} from '../api';

/**
 * Props for InvitationCodeGenerator component.
 */
interface InvitationCodeGeneratorProps {
  readonly onClose?: () => void;
  readonly variant?: 'dialog' | 'panel';
}

/**
 * Invitation code generator component.
 *
 * @param props - Component props
 * @returns React component
 */
export function InvitationCodeGenerator(
  props: InvitationCodeGeneratorProps,
): JSX.Element {
  const {onClose, variant = 'dialog'} = props;
  const {user} = useAuth();
  const [role, setRole] = useState<'teacher' | 'student'>('student');
  const [expiresInDays, setExpiresInDays] = useState<number>(30);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [codeDetails, setCodeDetails] = useState<{
    role: string;
    expiresAt: string;
  } | null>(null);

  /**
   * Handles form submission.
   *
   * @param event - Form submit event
   */
  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    if (event) {
      event.preventDefault();
    }
    setError(null);
    setGeneratedCode(null);
    setCodeDetails(null);

    // Check permissions
    if (user?.role === 'teacher' && role === 'teacher') {
      setError('教师只能为学生生成邀请码');
      return;
    }

    setIsLoading(true);
    try {
      const request: GenerateInvitationCodeRequest = {
        role,
        expires_in_days: expiresInDays,
      };
      const response = await generateInvitationCode(request);
      setGeneratedCode(response.invitation_code);
      setCodeDetails({
        role: response.role === 'teacher' ? '教师' : '学生',
        expiresAt: new Date(response.expires_at).toLocaleString('zh-CN'),
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '生成邀请码失败，请重试';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Copies invitation code to clipboard.
   */
  const copyToClipboard = async () => {
    if (generatedCode) {
      try {
        await navigator.clipboard.writeText(generatedCode);
      } catch (err) {
        console.error('Failed to copy to clipboard:', err);
      }
    }
  };

  const content = (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}

      {generatedCode ? (
        <Stack spacing={2}>
          <Alert severity="success">邀请码生成成功。</Alert>
          <Box>
            <Typography variant="caption" color="text.secondary">
              角色
            </Typography>
            <Typography variant="body2">{codeDetails?.role}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              过期时间
            </Typography>
            <Typography variant="body2">{codeDetails?.expiresAt}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{mb: 1, display: 'block'}}>
              邀请码
            </Typography>
            <Stack direction="row" spacing={1}>
              <TextField
                value={generatedCode}
                fullWidth
                InputProps={{readOnly: true}}
                size="small"
              />
              <Button variant="contained" onClick={copyToClipboard}>
                复制
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{mt: 1, display: 'block'}}>
              请妥善保管此邀请码，它将用于{codeDetails?.role}注册。
            </Typography>
          </Box>
        </Stack>
      ) : (
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2}>
            <FormControl fullWidth disabled={isLoading}>
              <InputLabel id="role-select-label">邀请对象</InputLabel>
              <Select
                labelId="role-select-label"
                id="role"
                value={role}
                label="邀请对象"
                onChange={(e) => setRole(e.target.value as 'teacher' | 'student')}
              >
                <MenuItem value="student">学生</MenuItem>
                {user?.role === 'admin' && (
                  <MenuItem value="teacher">教师</MenuItem>
                )}
              </Select>
            </FormControl>
            <TextField
              id="expires"
              label="有效期（天）"
              type="number"
              inputProps={{min: 1, max: 365}}
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
              disabled={isLoading}
              helperText="设置邀请码的有效期，默认 30 天"
            />
          </Stack>
        </Box>
      )}
    </Stack>
  );

  const actions = generatedCode ? (
    <>
      <Button
        onClick={() => {
          setGeneratedCode(null);
          setCodeDetails(null);
        }}
        color="inherit"
      >
        生成新的
      </Button>
      {onClose && (
        <Button onClick={onClose} variant="contained">
          完成
        </Button>
      )}
    </>
  ) : (
    <>
      {onClose && (
        <Button onClick={onClose} color="inherit" disabled={isLoading}>
          取消
        </Button>
      )}
      <Button
        onClick={() => handleSubmit()}
        variant="contained"
        disabled={isLoading}
      >
        {isLoading ? '生成中...' : '生成邀请码'}
      </Button>
    </>
  );

  if (variant === 'panel') {
    return (
      <Stack spacing={2}>
        {content}
        <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{pt: 1}}>
          {actions}
        </Stack>
      </Stack>
    );
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>生成邀请码</DialogTitle>
      <DialogContent dividers>{content}</DialogContent>
      <DialogActions>{actions}</DialogActions>
    </Dialog>
  );
}
