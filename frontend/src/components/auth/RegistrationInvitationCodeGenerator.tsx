/**
 * Registration invitation code generator component.
 *
 * This component provides a UI for generating registration invitation codes,
 * following Google TypeScript Style Guide.
 */

import React, { useState, FormEvent, useCallback, useEffect } from "react";
import {
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
import { ContentCopy, Delete, Edit } from "@mui/icons-material";
import { useClipboard, useNotification, useAuth } from "../../hooks";
import {
  GenerateRegistrationInvitationCodeRequest,
  RegistrationInvitationCodeInfo,
} from "../../types";
import {
  generateRegistrationInvitationCode,
  listRegistrationInvitationCodes,
  deleteRegistrationInvitationCode,
  updateRegistrationInvitationCode,
} from "../../api";

/**
 * Props for RegistrationInvitationCodeGenerator component.
 */
interface RegistrationInvitationCodeGeneratorProps {
  readonly onClose?: () => void;
  readonly variant?: "dialog" | "panel";
}

/**
 * Registration invitation code generator component.
 *
 * @param props - Component props
 * @returns React component
 */
export function RegistrationInvitationCodeGenerator(
  props: RegistrationInvitationCodeGeneratorProps,
): JSX.Element {
  const { onClose, variant = "dialog" } = props;
  const { notifyError, notifySuccess, notifyWarning } = useNotification();
  const { copyToClipboard } = useClipboard();
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
    readonly RegistrationInvitationCodeInfo[]
  >([]);
  const [isLoadingCodes, setIsLoadingCodes] = useState<boolean>(false);
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [editingInviteCode, setEditingInviteCode] = useState<string | null>(
    null,
  );
  const [editExpiresInDays, setEditExpiresInDays] = useState<number>(30);
  const [isUpdatingInvite, setIsUpdatingInvite] = useState<boolean>(false);

  useEffect(() => {
    if (!error) {
      return;
    }
    notifyError(error);
    setError(null);
  }, [error, notifyError]);

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
    if (user?.role === "student") {
      notifyWarning("学生无权生成邀请码");
      return;
    }
    if (user?.role === "teacher" && role === "teacher") {
      notifyWarning("教师只能为学生生成邀请码");
      return;
    }

    setIsLoading(true);
    try {
      const request: GenerateRegistrationInvitationCodeRequest = {
        role,
        expires_in_days: expiresInDays,
      };
      const response = await generateRegistrationInvitationCode(request);
      setSuccessInfo({
        code: response.invitation_code,
        role: role === "teacher" ? "教师" : "学生",
        expiresAt: response.expires_at
          ? new Date(response.expires_at).toLocaleString("zh-CN")
          : "-",
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
   * Loads registration invitation codes.
   */
  const loadInvitationCodes = useCallback(async () => {
    setIsLoadingCodes(true);
    try {
      const response = await listRegistrationInvitationCodes(
        roleFilter || undefined,
      );
      setInvitationCodes(response.invitation_codes);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "加载邀请码失败";
      notifyError(errorMessage);
    } finally {
      setIsLoadingCodes(false);
    }
  }, [notifyError, roleFilter]);

  useEffect(() => {
    void loadInvitationCodes();
  }, [loadInvitationCodes]);

  /**
   * Handles deleting an invitation code.
   */
  const handleDeleteCode = async (code: string) => {
    if (!confirm("确定要删除此邀请码吗？")) {
      return;
    }
    try {
      await deleteRegistrationInvitationCode(code);
      notifySuccess("邀请码已删除");
      await loadInvitationCodes();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "删除邀请码失败";
      notifyError(errorMessage);
    }
  };

  /**
   * Handles opening edit dialog for an invitation code.
   */
  const handleOpenEditInvite = (code: RegistrationInvitationCodeInfo) => {
    if (!code.expires_at) {
      setEditExpiresInDays(30);
    } else {
      const expiresAt = new Date(code.expires_at);
      const now = new Date();
      const daysRemaining = Math.ceil(
        (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      setEditExpiresInDays(Math.max(1, daysRemaining));
    }
    setEditingInviteCode(code.invitation_code);
  };

  /**
   * Handles closing edit dialog.
   */
  const handleCloseEditInvite = () => {
    setEditingInviteCode(null);
    setEditExpiresInDays(30);
  };

  /**
   * Handles updating invitation code expiration date.
   */
  const handleUpdateInvite = async () => {
    if (!editingInviteCode) {
      return;
    }
    if (editExpiresInDays < 1 || editExpiresInDays > 365) {
      notifyWarning("有效期必须在1-365天之间");
      return;
    }
    setIsUpdatingInvite(true);
    try {
      const response = await updateRegistrationInvitationCode(
        editingInviteCode,
        editExpiresInDays,
      );
      notifySuccess("邀请码过期日期已更新");
      setInvitationCodes((prev) =>
        prev.map((code) =>
          code.invitation_code === editingInviteCode
            ? {
                ...code,
                expires_at: response.expires_at,
              }
            : code,
        ),
      );
      handleCloseEditInvite();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "更新邀请码失败";
      notifyError(errorMessage);
    } finally {
      setIsUpdatingInvite(false);
    }
  };

  const content = (
    <Stack spacing={2}>
      <Box component='form' onSubmit={handleSubmit} sx={{ pt: 2 }}>
        <Stack spacing={2}>
          <FormControl fullWidth disabled={isLoading}>
            <InputLabel id='role-select-label'>目标角色</InputLabel>
            <Select
              labelId='role-select-label'
              id='role'
              value={role}
              label='目标角色'
              onChange={(e) =>
                setRole(e.target.value as "teacher" | "student")
              }
            >
              {user?.role === "admin" && (
                <MenuItem value='teacher'>教师</MenuItem>
              )}
              <MenuItem value='student'>学生</MenuItem>
            </Select>
          </FormControl>
          {user?.role === "teacher" && (
            <Typography variant='caption' color='text.secondary'>
              教师只能为学生生成邀请码
            </Typography>
          )}
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

  const isCodeExpired = (expiresAt?: string | null): boolean => {
    if (!expiresAt) {
      return false;
    }
    const expiresTime = Date.parse(expiresAt);
    if (Number.isNaN(expiresTime)) {
      return false;
    }
    return Date.now() > expiresTime;
  };

  const statusChip = (expired: boolean) => (
    <Chip
      size='small'
      color={expired ? "default" : "success"}
      label={expired ? "过期" : "有效"}
      variant={expired ? "outlined" : "filled"}
    />
  );

  const renderInvitationCodeList = () => (
    <Stack spacing={1.5}>
      <Stack direction='row' justifyContent='space-between' alignItems='center'>
        <Typography variant='subtitle2'>注册邀请码列表</Typography>
        <Stack direction='row' spacing={1} alignItems='center'>
          <FormControl size='small' sx={{ minWidth: 120 }}>
            <InputLabel id='filter-role-label'>筛选</InputLabel>
            <Select
              labelId='filter-role-label'
              id='filter-role'
              value={roleFilter}
              label='筛选'
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <MenuItem value=''>全部</MenuItem>
              <MenuItem value='teacher'>教师</MenuItem>
              <MenuItem value='student'>学生</MenuItem>
            </Select>
          </FormControl>
          <Button onClick={loadInvitationCodes} size='small' color='inherit'>
            刷新
          </Button>
        </Stack>
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
          {invitationCodes.map((code) => {
            const expired = isCodeExpired(code.expires_at);
            return (
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
                      color={expired ? "text.secondary" : "text.primary"}
                      sx={{
                        fontWeight: 600,
                      }}
                    >
                      {code.invitation_code}
                    </Typography>
                    <Stack direction='row' spacing={1} alignItems='center'>
                      <Tooltip title={expired ? "邀请码已过期" : "复制邀请码"}>
                        <span>
                          <IconButton
                            size='small'
                            aria-label='复制邀请码'
                            onClick={() =>
                              copyToClipboard(code.invitation_code)
                            }
                            disabled={expired}
                          >
                            <ContentCopy fontSize='small' />
                          </IconButton>
                        </span>
                      </Tooltip>
                      {(user?.role === "admin" ||
                        code.created_by === user?.username) && (
                        <>
                          <Tooltip title='修改过期日期'>
                            <span>
                              <IconButton
                                size='small'
                                aria-label='修改过期日期'
                                onClick={() => handleOpenEditInvite(code)}
                              >
                                <Edit fontSize='small' />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title='删除邀请码'>
                            <span>
                              <IconButton
                                size='small'
                                aria-label='删除邀请码'
                                onClick={() => handleDeleteCode(code.invitation_code)}
                                color='error'
                              >
                                <Delete fontSize='small' />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </>
                      )}
                      {statusChip(expired)}
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
                      {code.expires_at
                        ? new Date(code.expires_at).toLocaleString("zh-CN")
                        : "-"}
                    </Typography>
                  </Stack>
                </Stack>
              </Box>
            );
          })}
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
      <DialogTitle>注册邀请码生成成功</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant='body2' color='text.secondary'>
            请复制并发送给对应角色完成注册。
          </Typography>
          <Box>
            <Typography variant='caption' color='text.secondary'>
              目标角色
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

  const editDialog = (
    <Dialog
      open={Boolean(editingInviteCode)}
      onClose={handleCloseEditInvite}
      fullWidth
      maxWidth='sm'
    >
      <DialogTitle>修改邀请码过期日期</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 2 }}>
          <TextField
            label='有效期（天）'
            type='number'
            inputProps={{ min: 1, max: 365 }}
            value={editExpiresInDays}
            onChange={(e) => setEditExpiresInDays(Number(e.target.value))}
            disabled={isUpdatingInvite}
            fullWidth
            helperText='设置邀请码的有效期，范围：1-365天'
          />
          <Typography variant='body2' color='text.secondary'>
            新的过期时间将从当前时间开始计算
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCloseEditInvite} color='inherit' disabled={isUpdatingInvite}>
          取消
        </Button>
        <Button
          onClick={handleUpdateInvite}
          variant='contained'
          disabled={isUpdatingInvite || editExpiresInDays < 1 || editExpiresInDays > 365}
        >
          {isUpdatingInvite ? "更新中..." : "确认更新"}
        </Button>
      </DialogActions>
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
        {editDialog}
      </>
    );
  }

  return (
    <>
      <Dialog open onClose={onClose} fullWidth maxWidth='sm'>
        <DialogTitle>注册邀请码管理</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            {content}
            {renderInvitationCodeList()}
          </Stack>
        </DialogContent>
        <DialogActions>{actions}</DialogActions>
      </Dialog>
      {successDialog}
      {editDialog}
    </>
  );
}
