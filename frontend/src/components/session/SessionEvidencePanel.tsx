import React, {useCallback, useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {
  Alert,
  Box,
  Chip,
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

interface TerminalGroup {
  readonly id: string;
  readonly label: string;
  readonly audits: readonly RemoteCommandAudit[];
  readonly hasError: boolean;
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

function terminalKey(audit: RemoteCommandAudit): string {
  return audit.terminal_id || audit.runner_session_id || audit.binding_id || "session";
}

function formatTimestamp(value?: string | null): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function formatAuditTranscript(audit: RemoteCommandAudit): string {
  const lines: string[] = [];
  const commandLine = audit.command ? `$ ${audit.command}` : `$ ${audit.action}`;
  lines.push(commandLine);
  if (audit.action && audit.command && audit.action !== "session_exec") {
    lines.push(`# action: ${audit.action}`);
  }
  if (audit.cwd) {
    lines.push(`# cwd: ${audit.cwd}`);
  }
  if (audit.stdout_excerpt) {
    lines.push(audit.stdout_excerpt.trimEnd());
  }
  if (audit.stderr_excerpt) {
    lines.push(`[stderr]\n${audit.stderr_excerpt.trimEnd()}`);
  }
  if (audit.error) {
    lines.push(`[error]\n${audit.error.trimEnd()}`);
  }
  const timestamp = formatTimestamp(audit.create_at);
  lines.push(`# ${statusLabel(audit)}${timestamp ? ` · ${timestamp}` : ""}`);
  return lines.join("\n");
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
  const [selectedTerminalId, setSelectedTerminalId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canLoad = Boolean(open && sessionId && remoteBinding);
  const machineLabel = remoteBinding?.display_name || remoteBinding?.runner_machine_name || "";

  const terminalGroups = useMemo<readonly TerminalGroup[]>(() => {
    const grouped = new Map<string, RemoteCommandAudit[]>();
    audits.forEach((audit) => {
      const key = terminalKey(audit);
      const existing = grouped.get(key);
      if (existing) {
        existing.push(audit);
      } else {
        grouped.set(key, [audit]);
      }
    });
    return Array.from(grouped.entries()).map(([id, groupAudits], index) => ({
      id,
      label: `${t("evidence.terminal")} ${index + 1}`,
      audits: groupAudits,
      hasError: groupAudits.some((audit) => Boolean(audit.error) || (audit.exit_code ?? 0) !== 0),
    }));
  }, [audits, t]);

  const selectedTerminal = useMemo(() => {
    if (terminalGroups.length === 0) {
      return null;
    }
    return (
      terminalGroups.find((group) => group.id === selectedTerminalId) ||
      terminalGroups[0]
    );
  }, [selectedTerminalId, terminalGroups]);

  const selectedTranscript = useMemo(() => {
    if (!selectedTerminal) {
      return "";
    }
    return selectedTerminal.audits.map(formatAuditTranscript).join("\n\n");
  }, [selectedTerminal]);

  const refreshAudits = useCallback(async () => {
    if (!sessionId || !remoteBinding) {
      setAudits([]);
      setSelectedTerminalId(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const nextAudits = await getSessionRemoteAudits(sessionId);
      setAudits(nextAudits);
      setSelectedTerminalId((previous) => {
        const nextKeys = nextAudits.map(terminalKey);
        if (nextKeys.length === 0) {
          return null;
        }
        return previous && nextKeys.includes(previous) ? previous : nextKeys[0];
      });
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
            value={selectedTerminal?.id || false}
            onChange={(_, value: string) => setSelectedTerminalId(value)}
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
            {terminalGroups.map((group) => (
              <Tab
                key={group.id}
                value={group.id}
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
                      {group.label}
                    </Typography>
                    <Chip
                      size='small'
                      label={`${group.audits.length} ${t("evidence.records")}`}
                      color={group.hasError ? "warning" : "success"}
                      sx={{height: 18, "& .MuiChip-label": {px: 0.75, fontSize: 10}}}
                    />
                  </Stack>
                }
              />
            ))}
          </Tabs>

          {selectedTerminal && (
            <Stack spacing={1.25} sx={{p: 2, overflow: "hidden", flex: 1, minHeight: 0}}>
              <Stack spacing={0.5}>
                <Typography variant='caption' color='text.secondary'>
                  {selectedTerminal.id === remoteBinding?.runner_session_id
                    ? remoteBinding.runner_session_id
                    : selectedTerminal.id}
                </Typography>
                <Typography variant='body2' sx={{fontWeight: 700}}>
                  {selectedTerminal.label}
                </Typography>
              </Stack>
              <Box
                component='pre'
                sx={{
                  m: 0,
                  p: 1.5,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  bgcolor: "var(--color-surface-muted)",
                  color: "text.primary",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  overflow: "auto",
                  flex: 1,
                  minHeight: 0,
                }}
              >
                {selectedTranscript}
              </Box>
            </Stack>
          )}
        </>
      )}
    </Box>
  );
}
