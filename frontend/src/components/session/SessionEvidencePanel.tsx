import React, {useCallback, useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {
  Alert,
  Box,
  Chip,
  Divider,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import TerminalIcon from "@mui/icons-material/Terminal";
import {getSessionRemoteAudits} from "../../api";
import {RemoteBindingSummary, RemoteCommandAudit} from "../../types";
import {CircularProgress} from "../common/CircularProgress";

interface SessionEvidencePanelProps {
  readonly sessionId: string | null;
  readonly remoteBinding?: RemoteBindingSummary | null;
  readonly open: boolean;
  readonly disabled?: boolean;
  readonly onClose: () => void;
}

function auditLabel(audit: RemoteCommandAudit, index: number): string {
  if (audit.command) {
    return audit.command;
  }
  return audit.action || `audit-${index + 1}`;
}

function statusColor(audit: RemoteCommandAudit): "success" | "error" | "warning" | "default" {
  if (audit.error) {
    return "error";
  }
  if (audit.exit_code === 0) {
    return "success";
  }
  if (typeof audit.exit_code === "number") {
    return "warning";
  }
  return "default";
}

function statusLabel(audit: RemoteCommandAudit): string {
  if (audit.error) {
    return "error";
  }
  if (audit.exit_code === 0) {
    return "exit 0";
  }
  if (typeof audit.exit_code === "number") {
    return `exit ${audit.exit_code}`;
  }
  return "recorded";
}

function OutputBlock({label, value}: {readonly label: string; readonly value?: string | null}) {
  if (!value) {
    return null;
  }
  return (
    <Stack spacing={0.5}>
      <Typography variant='caption' sx={{fontWeight: 700, color: "text.secondary"}}>
        {label}
      </Typography>
      <Box
        component='pre'
        sx={{
          m: 0,
          p: 1,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1,
          bgcolor: "var(--color-surface-muted)",
          color: "text.primary",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          lineHeight: 1.45,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          maxHeight: 220,
          overflow: "auto",
        }}
      >
        {value}
      </Box>
    </Stack>
  );
}

export function SessionEvidencePanel({
  sessionId,
  remoteBinding,
  open,
  disabled = false,
  onClose,
}: SessionEvidencePanelProps) {
  const {t} = useTranslation();
  const [audits, setAudits] = useState<readonly RemoteCommandAudit[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canLoad = Boolean(open && sessionId && remoteBinding);
  const selectedAudit = audits[selectedIndex] || null;
  const machineLabel = remoteBinding?.display_name || remoteBinding?.runner_machine_name || "";

  const refreshAudits = useCallback(async () => {
    if (!sessionId || !remoteBinding) {
      setAudits([]);
      setSelectedIndex(0);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const nextAudits = await getSessionRemoteAudits(sessionId);
      setAudits(nextAudits);
      setSelectedIndex((previous) =>
        nextAudits.length === 0 ? 0 : Math.min(previous, nextAudits.length - 1),
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setIsLoading(false);
    }
  }, [remoteBinding, sessionId]);

  useEffect(() => {
    if (canLoad) {
      void refreshAudits();
    }
  }, [canLoad, refreshAudits]);

  const createdAtLabel = useMemo(() => {
    if (!selectedAudit?.create_at) {
      return "";
    }
    const date = new Date(selectedAudit.create_at);
    if (Number.isNaN(date.getTime())) {
      return selectedAudit.create_at;
    }
    return date.toLocaleString();
  }, [selectedAudit?.create_at]);

  if (!open) {
    return null;
  }

  return (
    <Box
      sx={{
        width: {xs: "100%", md: 420},
        maxWidth: {xs: "100%", md: "42vw"},
        height: "100%",
        borderLeft: "1px solid",
        borderColor: "divider",
        bgcolor: "var(--color-surface)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      <Stack
        direction='row'
        spacing={1}
        alignItems='center'
        sx={{px: 2, py: 1.5, borderBottom: "1px solid", borderColor: "divider"}}
      >
        <TerminalIcon fontSize='small' color='primary' />
        <Box sx={{minWidth: 0, flex: 1}}>
          <Typography variant='subtitle2' sx={{fontWeight: 700}}>
            {t("evidence.title")}
          </Typography>
          <Typography
            variant='caption'
            sx={{
              color: "text.secondary",
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {machineLabel || t("evidence.noMachine")}
          </Typography>
        </Box>
        <Tooltip title={t("common.refresh")} arrow>
          <span>
            <IconButton size='small' onClick={refreshAudits} disabled={disabled || isLoading || !sessionId}>
              {isLoading ? <CircularProgress size={18} /> : <RefreshIcon fontSize='small' />}
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t("common.close")} arrow>
          <IconButton size='small' onClick={onClose} aria-label={t("common.close")}>
            <CloseIcon fontSize='small' />
          </IconButton>
        </Tooltip>
      </Stack>

      {!remoteBinding && (
        <Alert severity='info' sx={{m: 2}}>
          {t("evidence.selectMachineFirst")}
        </Alert>
      )}
      {error && (
        <Alert severity='error' sx={{m: 2}}>
          {error}
        </Alert>
      )}

      {remoteBinding && audits.length === 0 && !isLoading && !error && (
        <Stack spacing={1} alignItems='center' justifyContent='center' sx={{p: 3, flex: 1}}>
          <TerminalIcon color='disabled' />
          <Typography variant='body2' color='text.secondary' textAlign='center'>
            {t("evidence.empty")}
          </Typography>
        </Stack>
      )}

      {audits.length > 0 && (
        <>
          <Tabs
            value={selectedIndex}
            onChange={(_, value: number) => setSelectedIndex(value)}
            variant='scrollable'
            scrollButtons='auto'
            sx={{
              minHeight: 40,
              borderBottom: "1px solid",
              borderColor: "divider",
              "& .MuiTab-root": {
                minHeight: 40,
                maxWidth: 180,
                textTransform: "none",
                alignItems: "flex-start",
              },
            }}
          >
            {audits.map((audit, index) => (
              <Tab
                key={audit.audit_id}
                label={
                  <Stack direction='row' spacing={0.75} alignItems='center' sx={{minWidth: 0}}>
                    <Typography
                      variant='caption'
                      sx={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 120,
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {auditLabel(audit, index)}
                    </Typography>
                    <Chip
                      size='small'
                      label={statusLabel(audit)}
                      color={statusColor(audit)}
                      sx={{height: 18, "& .MuiChip-label": {px: 0.75, fontSize: 10}}}
                    />
                  </Stack>
                }
              />
            ))}
          </Tabs>

          {selectedAudit && (
            <Stack spacing={1.5} sx={{p: 2, overflow: "auto", flex: 1}}>
              <Stack spacing={0.5}>
                <Typography variant='caption' color='text.secondary'>
                  {selectedAudit.action}
                  {createdAtLabel ? ` · ${createdAtLabel}` : ""}
                </Typography>
                {selectedAudit.command && (
                  <Typography
                    variant='body2'
                    sx={{
                      fontFamily: "var(--font-mono)",
                      fontWeight: 700,
                      wordBreak: "break-word",
                    }}
                  >
                    {selectedAudit.command}
                  </Typography>
                )}
                {selectedAudit.cwd && (
                  <Typography variant='caption' color='text.secondary' sx={{wordBreak: "break-all"}}>
                    cwd: {selectedAudit.cwd}
                  </Typography>
                )}
              </Stack>
              <Divider />
              <OutputBlock label='stdout' value={selectedAudit.stdout_excerpt} />
              <OutputBlock label='stderr' value={selectedAudit.stderr_excerpt} />
              <OutputBlock label='error' value={selectedAudit.error} />
            </Stack>
          )}
        </>
      )}
    </Box>
  );
}
