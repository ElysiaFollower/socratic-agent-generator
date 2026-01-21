/**
 * Registration invitation code generator component.
 *
 * This component provides a UI for generating registration invitation codes,
 * following Google TypeScript Style Guide.
 */

import React, { useState, FormEvent, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
import { ContentCopy, Delete, Edit, VpnKey } from "@mui/icons-material";
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
  const { t } = useTranslation();
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
      notifyWarning(t("invitation.studentNoPermission"));
      return;
    }
    if (user?.role === "teacher" && role === "teacher") {
      notifyWarning(t("invitation.teacherOnlyStudent"));
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
        role:
          role === "teacher"
            ? t("sidebar.role.teacher")
            : t("sidebar.role.student"),
        expiresAt: response.expires_at
          ? new Date(response.expires_at).toLocaleString("zh-CN")
          : "-",
      });
      await loadInvitationCodes();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("invitation.generateFailed");
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
        err instanceof Error ? err.message : t("invitation.loadFailed");
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
    if (!confirm(t("invitation.deleteConfirm"))) {
      return;
    }
    try {
      await deleteRegistrationInvitationCode(code);
      notifySuccess(t("invitation.deleted"));
      await loadInvitationCodes();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("invitation.updateFailed");
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
      notifyWarning(t("invitation.validityRange"));
      return;
    }
    setIsUpdatingInvite(true);
    try {
      const response = await updateRegistrationInvitationCode(
        editingInviteCode,
        editExpiresInDays,
      );
      notifySuccess(t("invitation.updateSuccess"));
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
        err instanceof Error ? err.message : t("invitation.updateFailed");
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
            <InputLabel id='role-select-label'>
              {t("invitation.targetRole")}
            </InputLabel>
            <Select
              labelId='role-select-label'
              id='role'
              value={role}
              label={t("invitation.targetRole")}
              onChange={(e) => setRole(e.target.value as "teacher" | "student")}
            >
              {user?.role === "admin" && (
                <MenuItem value='teacher'>{t("sidebar.role.teacher")}</MenuItem>
              )}
              <MenuItem value='student'>{t("sidebar.role.student")}</MenuItem>
            </Select>
          </FormControl>
          {user?.role === "teacher" && (
            <Typography variant='caption' color='text.secondary'>
              {t("invitation.teacherOnlyStudent")}
            </Typography>
          )}
          <TextField
            id='expires'
            label={t("invitation.expiresLabel")}
            type='number'
            inputProps={{ min: 1, max: 365 }}
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(Number(e.target.value))}
            disabled={isLoading}
            helperText={t("invitation.defaultExpiryHelper")}
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
      label={expired ? t("invitation.expiredChip") : t("invitation.validChip")}
      variant={expired ? "outlined" : "filled"}
    />
  );

  const renderInvitationCodeList = () => (
    <Stack spacing={1.5}>
      <Stack direction='row' justifyContent='space-between' alignItems='center'>
        <Typography variant='subtitle2'>{t("invitation.listTitle")}</Typography>
        <Stack direction='row' spacing={1} alignItems='center'>
          <FormControl size='small' sx={{ minWidth: 120 }}>
            <InputLabel id='filter-role-label'>
              {t("invitation.filter")}
            </InputLabel>
            <Select
              labelId='filter-role-label'
              id='filter-role'
              value={roleFilter}
              label={t("invitation.filter")}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <MenuItem value=''>{t("invitation.all")}</MenuItem>
              <MenuItem value='teacher'>{t("sidebar.role.teacher")}</MenuItem>
              <MenuItem value='student'>{t("sidebar.role.student")}</MenuItem>
            </Select>
          </FormControl>
          <Button onClick={loadInvitationCodes} size='small' color='inherit'>
            {t("invitation.refresh")}
          </Button>
        </Stack>
      </Stack>
      {isLoadingCodes ? (
        <Stack direction='row' spacing={1} alignItems='center'>
          <CircularProgress size={16} />
          <Typography variant='body2' color='text.secondary'>
            {t("invitation.loading")}
          </Typography>
        </Stack>
      ) : invitationCodes.length === 0 ? (
        <Box sx={{ py: 6, textAlign: "center", color: "text.secondary" }}>
          <VpnKey sx={{ fontSize: 48, color: "var(--color-border)", mb: 2 }} />
          <Typography variant='h6' sx={{ mt: 2 }}>
            {t("invitation.noRecords")}
          </Typography>
          <Typography variant='body2'>
            {t("invitation.generateFirst")}
          </Typography>
        </Box>
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
                      <Tooltip
                        title={
                          expired
                            ? t("invitation.expired")
                            : t("invitation.copyCode")
                        }
                      >
                        <span>
                          <IconButton
                            size='small'
                            aria-label={t("invitation.copyCode")}
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
                          <Tooltip title={t("invitation.modifyExpiryTooltip")}>
                            <span>
                              <IconButton
                                size='small'
                                aria-label={t("invitation.modifyExpiryTooltip")}
                                onClick={() => handleOpenEditInvite(code)}
                              >
                                <Edit fontSize='small' />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={t("invitation.deleteCode")}>
                            <span>
                              <IconButton
                                size='small'
                                aria-label={t("invitation.deleteCode")}
                                onClick={() =>
                                  handleDeleteCode(code.invitation_code)
                                }
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
                      {t("invitation.role")}:{" "}
                      {code.role === "teacher"
                        ? t("sidebar.role.teacher")
                        : t("sidebar.role.student")}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      {t("invitation.createdAt")}:{" "}
                      {new Date(code.created_at).toLocaleString("zh-CN")}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      {t("invitation.expiresAtLabel")}:{" "}
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
          {t("invitation.cancel")}
        </Button>
      )}
      <Button
        onClick={() => handleSubmit()}
        variant='contained'
        disabled={isLoading}
      >
        {isLoading ? t("invitation.generating") : t("invitation.generate")}
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
      <DialogTitle>{t("invitation.generateSuccess")}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant='body2' color='text.secondary'>
            {t("invitation.copyInstruction")}
          </Typography>
          <Box>
            <Typography variant='caption' color='text.secondary'>
              {t("invitation.targetRole")}
            </Typography>
            <Typography variant='body2'>{successInfo?.role}</Typography>
          </Box>
          <Box>
            <Typography variant='caption' color='text.secondary'>
              {t("invitation.expiresAt")}
            </Typography>
            <Typography variant='body2'>{successInfo?.expiresAt}</Typography>
          </Box>
          <Box>
            <Typography
              variant='caption'
              color='text.secondary'
              sx={{ mb: 1, display: "block" }}
            >
              {t("invitation.invitationCode")}
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
                {t("invitation.copy")}
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
      <DialogTitle>{t("invitation.modifyExpiry")}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 2 }}>
          <TextField
            label={t("invitation.expiresLabel")}
            type='number'
            inputProps={{ min: 1, max: 365 }}
            value={editExpiresInDays}
            onChange={(e) => setEditExpiresInDays(Number(e.target.value))}
            disabled={isUpdatingInvite}
            fullWidth
            helperText={t("invitation.expiryHelper")}
          />
          <Typography variant='body2' color='text.secondary'>
            {t("invitation.newExpiryFromNow")}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={handleCloseEditInvite}
          color='inherit'
          disabled={isUpdatingInvite}
        >
          {t("invitation.cancel")}
        </Button>
        <Button
          onClick={handleUpdateInvite}
          variant='contained'
          disabled={
            isUpdatingInvite || editExpiresInDays < 1 || editExpiresInDays > 365
          }
        >
          {isUpdatingInvite
            ? t("invitation.updating")
            : t("invitation.confirmUpdate")}
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
        <DialogTitle>{t("invitation.management")}</DialogTitle>
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
