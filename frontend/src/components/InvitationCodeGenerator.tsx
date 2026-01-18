/**
 * Invitation code generator component.
 *
 * This component provides a UI for generating invitation codes,
 * following Google TypeScript Style Guide.
 */

import React, { useState, FormEvent, useCallback, useEffect } from "react";
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
  Chip,
  CircularProgress,
  IconButton,
  Tooltip,
} from "@mui/material";
import { ContentCopy } from "@mui/icons-material";
import { useAuth } from "../hooks";
import { GenerateInvitationCodeRequest, InvitationCodeInfo } from "../types";
import { generateInvitationCode, listInvitationCodes } from "../api";

/**
 * Props for InvitationCodeGenerator component.
 */
interface InvitationCodeGeneratorProps {
  readonly onClose?: () => void;
  readonly variant?: "dialog" | "panel";
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
  const { onClose, variant = "dialog" } = props;
  const { user } = useAuth();
  const [role, setRole] = useState<"teacher" | "student">("student");
  const [expiresInDays, setExpiresInDays] = useState<number>(30);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    code: string;
    role: string;
    expiresAt: string;
  } | null>(null);
  const [invitationCodes, setInvitationCodes] = useState<
    readonly InvitationCodeInfo[]
  >([]);
  const [isLoadingCodes, setIsLoadingCodes] = useState<boolean>(false);

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
    setSuccessInfo(null);

    // Check permissions
    if (user?.role === "teacher" && role === "teacher") {
      setError("教师只能为学生生成邀请码");
      return;
    }

    setIsLoading(true);
    try {
      const request: GenerateInvitationCodeRequest = {
        role,
        expires_in_days: expiresInDays,
      };
      const response = await generateInvitationCode(request);
      setSuccessInfo({
        code: response.invitation_code,
        role: response.role === "teacher" ? "教师" : "学生",
        expiresAt: new Date(response.expires_at).toLocaleString("zh-CN"),
      });
      await loadInvitationCodes();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "生成邀请码失败，请重试";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Loads invitation codes created by the current user.
   */
  const loadInvitationCodes = useCallback(async () => {
    setIsLoadingCodes(true);
    try {
      const response = await listInvitationCodes();
      setInvitationCodes(response.invitation_codes);
    } catch (err) {
      console.error("Failed to load invitation codes:", err);
    } finally {
      setIsLoadingCodes(false);
    }
  }, []);

  useEffect(() => {
    void loadInvitationCodes();
  }, [loadInvitationCodes]);

  /**
   * Copies invitation code to clipboard.
   */
  const copyToClipboard = async (code: string) => {
    if (!code) {
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  const content = (
    <Stack spacing={2}>
      {error && <Alert severity='error'>{error}</Alert>}
      <Box component='form' onSubmit={handleSubmit}>
        <Stack spacing={2}>
          <FormControl fullWidth disabled={isLoading}>
            <InputLabel id='role-select-label'>邀请对象</InputLabel>
            <Select
              labelId='role-select-label'
              id='role'
              value={role}
              label='邀请对象'
              onChange={(e) => setRole(e.target.value as "teacher" | "student")}
            >
              <MenuItem value='student'>学生</MenuItem>
              {user?.role === "admin" && (
                <MenuItem value='teacher'>教师</MenuItem>
              )}
            </Select>
          </FormControl>
          <TextField
            id='expires'
            label='有效期（天）'
            type='number'
            inputProps={{ min: 1, max: 365 }}
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(Number(e.target.value))}
            disabled={isLoading}
            helperText='设置邀请码的有效期，默认 30 天'
          />
        </Stack>
      </Box>
    </Stack>
  );

  const statusChip = (used: boolean) => (
    <Chip
      size='small'
      color={used ? "default" : "success"}
      label={used ? "已使用" : "未使用"}
      variant={used ? "outlined" : "filled"}
    />
  );

  const renderInvitationCodeList = () => (
    <Stack spacing={1.5}>
      <Stack direction='row' justifyContent='space-between' alignItems='center'>
        <Typography variant='subtitle2'>我的邀请码</Typography>
        <Button onClick={loadInvitationCodes} size='small' color='inherit'>
          刷新
        </Button>
      </Stack>
      {isLoadingCodes ? (
        <Stack direction='row' spacing={1} alignItems='center'>
          <CircularProgress size={16} />
          <Typography variant='body2' color='text.secondary'>
            加载中...
          </Typography>
        </Stack>
      ) : invitationCodes.length === 0 ? (
        <Typography variant='body2' color='text.secondary'>
          暂无邀请码记录
        </Typography>
      ) : (
        <Stack spacing={1}>
          {invitationCodes.map((code) => (
            <Box
              key={code.invitation_code}
              sx={{
                border: "1px solid var(--color-border)",
                borderRadius: 1,
                p: 1.5,
                bgcolor: "var(--color-surface)",
              }}
            >
              <Stack spacing={1}>
                <Stack
                  direction='row'
                  alignItems='center'
                  justifyContent='space-between'
                >
                  <Typography
                    variant='body2'
                    color={code.used ? "text.secondary" : "text.primary"}
                    sx={{
                      fontWeight: 600,
                      textDecoration: code.used ? "line-through" : "none",
                    }}
                  >
                    {code.invitation_code}
                  </Typography>
                  <Stack direction='row' spacing={1} alignItems='center'>
                    {!code.used && (
                      <Tooltip title='复制邀请码'>
                        <IconButton
                          size='small'
                          aria-label='复制邀请码'
                          onClick={() => copyToClipboard(code.invitation_code)}
                        >
                          <ContentCopy fontSize='small' />
                        </IconButton>
                      </Tooltip>
                    )}
                    {statusChip(code.used)}
                  </Stack>
                </Stack>
                <Stack direction='row' spacing={2} flexWrap='wrap'>
                  <Typography variant='caption' color='text.secondary'>
                    角色: {code.role === "teacher" ? "教师" : "学生"}
                  </Typography>
                  <Typography variant='caption' color='text.secondary'>
                    创建时间:{" "}
                    {new Date(code.created_at).toLocaleString("zh-CN")}
                  </Typography>
                  <Typography variant='caption' color='text.secondary'>
                    到期时间:{" "}
                    {code.used
                      ? "-"
                      : code.expires_at
                        ? new Date(code.expires_at).toLocaleString("zh-CN")
                        : "-"}
                  </Typography>
                </Stack>
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );

  const actions = (
    <>
      {onClose && (
        <Button onClick={onClose} color='inherit' disabled={isLoading}>
          取消
        </Button>
      )}
      <Button
        onClick={() => handleSubmit()}
        variant='contained'
        disabled={isLoading}
      >
        {isLoading ? "生成中..." : "生成邀请码"}
      </Button>
    </>
  );

  const handleSuccessClose = () => {
    setSuccessInfo(null);
  };

  const successDialog = (
    <Dialog
      open={Boolean(successInfo)}
      onClose={handleSuccessClose}
      fullWidth
      maxWidth='sm'
    >
      <DialogTitle>邀请码生成成功</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant='body2' color='text.secondary'>
            请复制并发送给对应角色完成注册。
          </Typography>
          <Box>
            <Typography variant='caption' color='text.secondary'>
              角色
            </Typography>
            <Typography variant='body2'>{successInfo?.role}</Typography>
          </Box>
          <Box>
            <Typography variant='caption' color='text.secondary'>
              过期时间
            </Typography>
            <Typography variant='body2'>{successInfo?.expiresAt}</Typography>
          </Box>
          <Box>
            <Typography
              variant='caption'
              color='text.secondary'
              sx={{ mb: 1, display: "block" }}
            >
              邀请码
            </Typography>
            <Stack direction='row' spacing={1}>
              <TextField
                value={successInfo?.code ?? ""}
                fullWidth
                InputProps={{ readOnly: true }}
                size='small'
              />
              <Button
                variant='contained'
                onClick={() => copyToClipboard(successInfo?.code ?? "")}
              >
                复制
              </Button>
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  );

  if (variant === "panel") {
    return (
      <>
        <Stack spacing={3}>
          {content}
          <Stack
            direction='row'
            spacing={1}
            justifyContent='flex-end'
            sx={{ pt: 1 }}
          >
            {actions}
          </Stack>
          {renderInvitationCodeList()}
        </Stack>
        {successDialog}
      </>
    );
  }

  return (
    <>
      <Dialog open onClose={onClose} fullWidth maxWidth='sm'>
        <DialogTitle>邀请码管理</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            {content}
            {renderInvitationCodeList()}
          </Stack>
        </DialogContent>
        <DialogActions>{actions}</DialogActions>
      </Dialog>
      {successDialog}
    </>
  );
}
