import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {
  Alert,
  Box,
  Chip,
  IconButton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import SendIcon from "@mui/icons-material/Send";
import TerminalIcon from "@mui/icons-material/Terminal";
import {
  getSessionRemoteAudits,
  getSessionRemoteShellTranscript,
  runSessionRemoteShellCommand,
} from "../../api";
import {
  RemoteBindingSummary,
  RemoteCommandAudit,
  SessionRemoteShellReadResponse,
} from "../../types";
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

type ShellStatus = "connected" | "running" | "closed" | "error" | "idle";

interface ResizeState {
  readonly startX: number;
  readonly startWidth: number;
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

function isClosedShellError(message: string): boolean {
  return /not found|destroy|closed|pane/i.test(message);
}

function shellStatusColor(
  status: ShellStatus,
): "success" | "info" | "warning" | "error" | "default" {
  if (status === "connected") {
    return "success";
  }
  if (status === "running") {
    return "info";
  }
  if (status === "closed") {
    return "warning";
  }
  if (status === "error") {
    return "error";
  }
  return "default";
}

function groupStatus(
  group: TerminalGroup,
  selectedTerminalId: string | undefined,
  selectedStatus: ShellStatus,
): ShellStatus {
  if (group.id === selectedTerminalId) {
    return selectedStatus;
  }
  return group.hasError ? "error" : "connected";
}

function lineColor(line: string): string {
  if (line.startsWith("$ ")) {
    return "#9cdcfe";
  }
  if (line.startsWith("[stderr]") || line.startsWith("[error]")) {
    return "#f48771";
  }
  if (line.startsWith("# ")) {
    return "#6a9955";
  }
  return "#d4d4d4";
}

function TerminalTranscript({
  text,
  emptyText,
}: {
  readonly text: string;
  readonly emptyText: string;
}) {
  const lines = text ? text.split("\n") : [];
  return (
    <Box
      role='log'
      aria-live='polite'
      sx={{
        m: 0,
        p: 1.5,
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 1,
        bgcolor: "#111318",
        color: "#d4d4d4",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        lineHeight: 1.55,
        overflow: "auto",
        flex: 1,
        minHeight: 0,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {lines.length === 0 ? (
        <Box sx={{color: "#858585"}}>{emptyText}</Box>
      ) : (
        lines.map((line, index) => (
          <Box
            // Transcript lines do not have stable ids; index is stable for this render.
            key={`${index}-${line.slice(0, 16)}`}
            component='div'
            sx={{
              color: lineColor(line),
              whiteSpace: "pre",
              minHeight: "1.55em",
            }}
          >
            {line || " "}
          </Box>
        ))
      )}
    </Box>
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
  const [selectedTerminalId, setSelectedTerminalId] = useState<string | null>(null);
  const [remoteTranscript, setRemoteTranscript] = useState("");
  const [shellRead, setShellRead] =
    useState<SessionRemoteShellReadResponse | null>(null);
  const [shellError, setShellError] = useState<string | null>(null);
  const [commandInput, setCommandInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRunningCommand, setIsRunningCommand] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelWidth, setPanelWidth] = useState(480);
  const resizeState = useRef<ResizeState | null>(null);

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
    if (remoteBinding?.runner_session_id && !grouped.has(remoteBinding.runner_session_id)) {
      grouped.set(remoteBinding.runner_session_id, []);
    }
    return Array.from(grouped.entries()).map(([id, groupAudits], index) => ({
      id,
      label: `${t("evidence.terminal")} ${index + 1}`,
      audits: groupAudits,
      hasError: groupAudits.some((audit) => Boolean(audit.error) || (audit.exit_code ?? 0) !== 0),
    }));
  }, [audits, remoteBinding?.runner_session_id, t]);

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
    if (
      remoteTranscript &&
      selectedTerminal.id === remoteBinding?.runner_session_id
    ) {
      return remoteTranscript;
    }
    return selectedTerminal.audits.map(formatAuditTranscript).join("\n\n");
  }, [remoteBinding?.runner_session_id, remoteTranscript, selectedTerminal]);

  const selectedStatus = useMemo<ShellStatus>(() => {
    if (isRunningCommand) {
      return "running";
    }
    if (!remoteBinding) {
      return "idle";
    }
    if (remoteBinding.status && remoteBinding.status !== "active") {
      return "closed";
    }
    if (shellError) {
      return isClosedShellError(shellError) ? "closed" : "error";
    }
    if (selectedTerminal?.hasError) {
      return "error";
    }
    return shellRead ? "connected" : "idle";
  }, [isRunningCommand, remoteBinding, selectedTerminal?.hasError, shellError, shellRead]);

  const refreshAudits = useCallback(async () => {
    if (!sessionId || !remoteBinding) {
      setAudits([]);
      setSelectedTerminalId(null);
      setRemoteTranscript("");
      setShellRead(null);
      setShellError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    setShellError(null);
    try {
      const nextAudits = await getSessionRemoteAudits(sessionId);
      setAudits(nextAudits);
      try {
        const nextShellRead = await getSessionRemoteShellTranscript(sessionId);
        setShellRead(nextShellRead);
        setRemoteTranscript(nextShellRead.transcript || "");
      } catch (nextShellError) {
        setShellRead(null);
        setRemoteTranscript("");
        setShellError(
          nextShellError instanceof Error
            ? nextShellError.message
            : String(nextShellError),
        );
      }
      setSelectedTerminalId((previous) => {
        const nextKeys = [
          remoteBinding.runner_session_id,
          ...nextAudits.map(terminalKey),
        ].filter(Boolean);
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

  const submitCommand = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const command = commandInput.trim();
      if (!sessionId || !remoteBinding || !command) {
        return;
      }
      setIsRunningCommand(true);
      setError(null);
      try {
        await runSessionRemoteShellCommand(sessionId, {
          command,
          reason: "Shell panel command",
        });
        setCommandInput("");
        await refreshAudits();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : String(nextError));
      } finally {
        setIsRunningCommand(false);
      }
    },
    [commandInput, refreshAudits, remoteBinding, sessionId],
  );

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!resizeState.current) {
        return;
      }
      const viewportWidth = window.innerWidth || 1024;
      const minWidth = 360;
      const maxWidth = Math.max(
        minWidth,
        Math.min(Math.round(viewportWidth * 0.72), viewportWidth - 320),
      );
      const delta = resizeState.current.startX - event.clientX;
      const nextWidth = Math.min(
        maxWidth,
        Math.max(minWidth, resizeState.current.startWidth + delta),
      );
      setPanelWidth(nextWidth);
    };

    const handleMouseUp = () => {
      if (!resizeState.current) {
        return;
      }
      resizeState.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handlePanelResizeStart = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    resizeState.current = {
      startX: event.clientX,
      startWidth: panelWidth,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

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
        width: {xs: "100%", md: panelWidth},
        maxWidth: {xs: "100%", md: "72vw"},
        minWidth: {xs: "100%", md: 360},
        height: "100%",
        borderLeft: "1px solid",
        borderColor: "divider",
        bgcolor: "var(--color-surface)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        position: "relative",
      }}
    >
      <Box
        role='separator'
        aria-orientation='vertical'
        aria-label={t("evidence.resize")}
        onMouseDown={handlePanelResizeStart}
        sx={{
          display: {xs: "none", md: "block"},
          position: "absolute",
          top: 0,
          left: -4,
          width: 8,
          height: "100%",
          cursor: "col-resize",
          zIndex: 2,
          "&:hover": {
            bgcolor: "rgba(25, 118, 210, 0.12)",
          },
        }}
      />
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
          <Stack direction='row' spacing={1} alignItems='center' sx={{minWidth: 0}}>
            <Chip
              size='small'
              label={t(`evidence.status.${selectedStatus}`)}
              color={shellStatusColor(selectedStatus)}
              sx={{height: 20, "& .MuiChip-label": {px: 0.75, fontSize: 11}}}
            />
            <Typography
              variant='caption'
              sx={{
                color: "text.secondary",
                display: "block",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minWidth: 0,
              }}
            >
              {machineLabel || t("evidence.noMachine")}
            </Typography>
          </Stack>
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
      {shellError && !error && (
        <Alert severity={isClosedShellError(shellError) ? "warning" : "error"} sx={{m: 2}}>
          {isClosedShellError(shellError)
            ? t("evidence.sessionClosed")
            : shellError}
        </Alert>
      )}

      {remoteBinding && terminalGroups.length === 0 && !isLoading && !error && (
        <Stack spacing={1} alignItems='center' justifyContent='center' sx={{p: 3, flex: 1}}>
          <TerminalIcon color='disabled' />
          <Typography variant='body2' color='text.secondary' textAlign='center'>
            {t("evidence.empty")}
          </Typography>
        </Stack>
      )}

      {terminalGroups.length > 0 && (
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
            {terminalGroups.map((group) => {
              const status = groupStatus(
                group,
                selectedTerminal?.id,
                selectedStatus,
              );
              return (
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
                        label={t(`evidence.status.${status}`)}
                        color={shellStatusColor(status)}
                        sx={{height: 18, "& .MuiChip-label": {px: 0.75, fontSize: 10}}}
                      />
                    </Stack>
                  }
                />
              );
            })}
          </Tabs>

          {selectedTerminal && (
            <Stack spacing={1.25} sx={{p: 2, overflow: "hidden", flex: 1, minHeight: 0}}>
              <Stack spacing={0.5}>
                <Stack direction='row' spacing={1} alignItems='center' sx={{minWidth: 0}}>
                  <Typography variant='body2' sx={{fontWeight: 700}}>
                    {selectedTerminal.label}
                  </Typography>
                  <Chip
                    size='small'
                    label={t(`evidence.status.${selectedStatus}`)}
                    color={shellStatusColor(selectedStatus)}
                    sx={{height: 20, "& .MuiChip-label": {px: 0.75, fontSize: 11}}}
                  />
                </Stack>
                <Typography
                  variant='caption'
                  color='text.secondary'
                  sx={{
                    fontFamily: "var(--font-mono)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {selectedTerminal.id}
                </Typography>
              </Stack>
              <TerminalTranscript
                text={selectedTranscript}
                emptyText={t("evidence.noTranscript")}
              />
              <Box component='form' onSubmit={submitCommand}>
                <Stack direction='row' spacing={1} alignItems='center'>
                  <TextField
                    size='small'
                    fullWidth
                    value={commandInput}
                    onChange={(event) => setCommandInput(event.target.value)}
                    placeholder={t("evidence.commandPlaceholder")}
                    disabled={disabled || isRunningCommand}
                    inputProps={{
                      style: {fontFamily: "var(--font-mono)", fontSize: 12},
                    }}
                  />
                  <Tooltip title={t("evidence.runCommand")} arrow>
                    <span>
                      <IconButton
                        type='submit'
                        size='small'
                        color='primary'
                        disabled={disabled || isRunningCommand || !commandInput.trim()}
                        aria-label={t("evidence.runCommand")}
                      >
                        {isRunningCommand ? (
                          <CircularProgress size={18} />
                        ) : (
                          <SendIcon fontSize='small' />
                        )}
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Box>
            </Stack>
          )}
        </>
      )}
    </Box>
  );
}
