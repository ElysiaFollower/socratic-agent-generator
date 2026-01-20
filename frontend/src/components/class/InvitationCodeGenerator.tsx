/**
 * Invitation code generator component.
 *
 * This component provides a UI for generating invitation codes,
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
import { ContentCopy } from "@mui/icons-material";
import { useClipboard, useNotification } from "../../hooks";
import {
  ClassInfo,
  GenerateInvitationCodeRequest,
  InvitationCodeInfo,
} from "../../types";
import {
  generateClassInvitationCode,
  listClassInvitations,
  listClasses,
} from "../../api";

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
  const { notifyError, notifySuccess, notifyWarning } = useNotification();
  const { copyToClipboard } = useClipboard();
  const [classes, setClasses] = useState<readonly ClassInfo[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [expiresInDays, setExpiresInDays] = useState<number>(30);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    code: string;
    className: string;
    expiresAt: string;
  } | null>(null);
  const [invitationCodes, setInvitationCodes] = useState<
    readonly InvitationCodeInfo[]
  >([]);
  const [isLoadingCodes, setIsLoadingCodes] = useState<boolean>(false);

  useEffect(() => {
    if (!error) {
      return;
    }
    notifyError(error);
    setError(null);
  }, [error, notifyError]);

  const loadClasses = useCallback(async () => {
    try {
      const response = await listClasses();
      setClasses(response);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "加载班级失败";
      notifyError(errorMessage);
    }
  }, [notifyError]);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  useEffect(() => {
    if (!selectedClassId && classes.length > 0) {
      setSelectedClassId(classes[0].class_id);
    }
  }, [classes, selectedClassId]);

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

    if (!selectedClassId) {
      notifyWarning("请选择一个班级");
      return;
    }

    setIsLoading(true);
    try {
      const request: GenerateInvitationCodeRequest = {
        class_id: selectedClassId,
        expires_in_days: expiresInDays,
      };
      const response = await generateClassInvitationCode(request);
      const className =
        classes.find((item) => item.class_id === selectedClassId)?.name ??
        selectedClassId;
      setSuccessInfo({
        code: response.invitation_code,
        className,
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
   * Loads invitation codes for the selected class.
   */
  const loadInvitationCodes = useCallback(async () => {
    if (!selectedClassId) {
      setInvitationCodes([]);
      return;
    }
    setIsLoadingCodes(true);
    try {
      const response = await listClassInvitations(selectedClassId);
      setInvitationCodes(response.invitation_codes);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "加载邀请码失败";
      notifyError(errorMessage);
    } finally {
      setIsLoadingCodes(false);
    }
  }, [notifyError, selectedClassId]);

  useEffect(() => {
    void loadInvitationCodes();
  }, [loadInvitationCodes]);

  const content = (
    <Stack spacing={2}>
      <Box component='form' onSubmit={handleSubmit} sx={{ pt: 2 }}>
        <Stack spacing={2}>
          <FormControl fullWidth disabled={isLoading || classes.length === 0}>
            <InputLabel id='class-select-label'>选择班级</InputLabel>
            <Select
              labelId='class-select-label'
              id='class'
              value={selectedClassId}
              label='选择班级'
              onChange={(e) => setSelectedClassId(e.target.value)}
            >
              {classes.map((item) => (
                <MenuItem key={item.class_id} value={item.class_id}>
                  {item.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {classes.length === 0 && (
            <Typography variant='caption' color='text.secondary'>
              暂无班级，请先在班级管理中创建班级。
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
        <Typography variant='subtitle2'>班级邀请码</Typography>
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
          {invitationCodes.map((code) => {
            const expired = isCodeExpired(code.expires_at);
            const className =
              classes.find((item) => item.class_id === code.class_id)?.name ??
              code.class_id;
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
                      {statusChip(expired)}
                    </Stack>
                  </Stack>
                  <Stack direction='row' spacing={2} flexWrap='wrap'>
                    <Typography variant='caption' color='text.secondary'>
                      班级: {className}
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
      <DialogTitle>班级邀请码生成成功</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant='body2' color='text.secondary'>
            请复制并发送给对应角色完成注册。
          </Typography>
          <Box>
            <Typography variant='caption' color='text.secondary'>
              班级
            </Typography>
            <Typography variant='body2'>{successInfo?.className}</Typography>
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
        <DialogTitle>班级邀请码管理</DialogTitle>
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
