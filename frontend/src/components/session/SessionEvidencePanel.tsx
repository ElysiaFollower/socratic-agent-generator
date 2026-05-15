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
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import RefreshIcon from "@mui/icons-material/Refresh";
import SendIcon from "@mui/icons-material/Send";
import TerminalIcon from "@mui/icons-material/Terminal";
import {
  getSessionRemoteAudits,
  getSessionRemoteShells,
  getSessionRemoteShellTranscript,
  runSessionRemoteShellCommand,
} from "../../api";
import {
  RemoteBindingSummary,
  RemoteCommandAudit,
  SessionRemoteShellReadResponse,
  SessionRemoteShellSummary,
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
  readonly shellId?: string;
  readonly label: string;
  readonly audits: readonly RemoteCommandAudit[];
  readonly hasError: boolean;
  readonly isPrimary: boolean;
  readonly status?: string;
}

type ShellStatus = "connected" | "running" | "closed" | "error" | "idle";

interface ResizeState {
  readonly startX: number;
  readonly startWidth: number;
}

const MIN_PANEL_WIDTH = 360;
const MIN_CHAT_WIDTH = 320;
const MAX_PANEL_RATIO = 0.7;
const MAX_PANEL_VW = 70;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function panelWidthBounds(containerWidth: number): {min: number; max: number} {
  const usableWidth = Number.isFinite(containerWidth) && containerWidth > 0
    ? containerWidth
    : 1024;
  const maxByRatio = Math.floor(usableWidth * MAX_PANEL_RATIO);
  const maxByRemainingChat = usableWidth - MIN_CHAT_WIDTH;
  return {
    min: MIN_PANEL_WIDTH,
    max: Math.max(
      MIN_PANEL_WIDTH,
      Math.min(maxByRatio, maxByRemainingChat),
    ),
  };
}

function terminalKey(audit: RemoteCommandAudit): string {
  return audit.terminal_id || audit.runner_session_id || audit.binding_id || "session";
}

function commandPrompt(audit: RemoteCommandAudit): string {
  const cwd = audit.cwd?.trim();
  return cwd ? `${cwd} $` : "$";
}

export function formatAuditTranscript(audit: RemoteCommandAudit): string {
  const lines: string[] = [];
  const commandLine = audit.command
    ? `${commandPrompt(audit)} ${audit.command}`
    : `$ ${audit.action}`;
  lines.push(commandLine);
  if (audit.stdout_excerpt) {
    lines.push(audit.stdout_excerpt.trimEnd());
  }
  if (audit.stderr_excerpt) {
    lines.push(audit.stderr_excerpt.trimEnd());
  }
  if (audit.error) {
    lines.push(`error: ${audit.error.trimEnd()}`);
  }
  if (!audit.error && audit.exit_code && audit.exit_code !== 0) {
    lines.push(`exit ${audit.exit_code}`);
  }
  return lines.join("\n");
}

export function cleanShellTranscript(transcript: string): string {
  return transcript
    .split("\n")
    .filter((line) => {
      if (/^source .*\/\.remote-runner\/commands\/.*\/run\.sh$/.test(line)) {
        return false;
      }
      if (/^__REMOTE_RUNNER_CMD_(BEGIN|END)_/.test(line)) {
        return false;
      }
      if (/^# action:/.test(line)) {
        return false;
      }
      if (/^# cwd:/.test(line)) {
        return false;
      }
      if (/^# (recorded|error|exit \d+)( · .*)?$/.test(line)) {
        return false;
      }
      return true;
    })
    .join("\n")
    .trimEnd();
}

function auditTranscript(audits: readonly RemoteCommandAudit[]): string {
  return cleanShellTranscript(audits.map(formatAuditTranscript).join("\n\n"));
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
  if (/(^|\s)\$ /.test(line)) {
    return "#9cdcfe";
  }
  if (line.startsWith("error:") || line.startsWith("exit ")) {
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
  const [shells, setShells] = useState<readonly SessionRemoteShellSummary[]>([]);
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
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
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
    const groups: TerminalGroup[] = [];
    const usedIds = new Set<string>();
    const shellSummaries = shells.length > 0
      ? shells
      : remoteBinding?.runner_session_id
        ? [{
          shell_id: "primary",
          label: "main",
          runner_machine_name: remoteBinding.runner_machine_name,
          runner_session_id: remoteBinding.runner_session_id,
          default_cwd: remoteBinding.default_cwd,
          status: remoteBinding.status,
          is_primary: true,
        }]
        : [];
    shellSummaries.forEach((shell) => {
      const id = shell.runner_session_id;
      const groupAudits = grouped.get(id) || [];
      usedIds.add(id);
      groups.push({
        id,
        shellId: shell.shell_id,
        label: shell.label || `${t("evidence.terminal")} ${groups.length + 1}`,
        audits: groupAudits,
        hasError: groupAudits.some((audit) => Boolean(audit.error) || (audit.exit_code ?? 0) !== 0),
        isPrimary: shell.is_primary,
        status: shell.status,
      });
    });
    Array.from(grouped.entries()).forEach(([id, groupAudits]) => {
      if (usedIds.has(id)) {
        return;
      }
      groups.push({
        id,
        label: `${t("evidence.terminal")} ${groups.length + 1}`,
        audits: groupAudits,
        hasError: groupAudits.some((audit) => Boolean(audit.error) || (audit.exit_code ?? 0) !== 0),
        isPrimary: id === remoteBinding?.runner_session_id,
      });
    });
    return groups;
  }, [audits, remoteBinding, shells, t]);

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
      selectedTerminal.id === shellRead?.runner_session_id
    ) {
      return cleanShellTranscript(remoteTranscript);
    }
    if (selectedTerminal.audits.length > 0) {
      return auditTranscript(selectedTerminal.audits);
    }
    return "";
  }, [remoteTranscript, selectedTerminal, shellRead?.runner_session_id]);

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
      setShells([]);
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
      const nextShells = await getSessionRemoteShells(sessionId);
      setAudits(nextAudits);
      setShells(nextShells);
      try {
        const selectedShell =
          nextShells.find((shell) => shell.runner_session_id === selectedTerminalId) ||
          nextShells[0];
        const nextShellRead = await getSessionRemoteShellTranscript(
          sessionId,
          0,
          12000,
          selectedShell?.shell_id,
        );
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
          ...nextShells.map((shell) => shell.runner_session_id),
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
  }, [remoteBinding, selectedTerminalId, sessionId]);

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
        }, selectedTerminal?.shellId);
        setCommandInput("");
        await refreshAudits();
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : String(nextError));
      } finally {
        setIsRunningCommand(false);
      }
    },
    [commandInput, refreshAudits, remoteBinding, selectedTerminal?.shellId, sessionId],
  );

  useEffect(() => {
    if (!sessionId || !remoteBinding || !selectedTerminal) {
      return;
    }
    let isActive = true;
    setShellError(null);
    void getSessionRemoteShellTranscript(
      sessionId,
      0,
      12000,
      selectedTerminal.shellId,
    )
      .then((nextShellRead) => {
        if (!isActive) {
          return;
        }
        setShellRead(nextShellRead);
        setRemoteTranscript(nextShellRead.transcript || "");
      })
      .catch((nextShellError) => {
        if (!isActive) {
          return;
        }
        setShellRead(null);
        setRemoteTranscript("");
        setShellError(
          nextShellError instanceof Error
            ? nextShellError.message
            : String(nextShellError),
        );
      });
    return () => {
      isActive = false;
    };
  }, [remoteBinding, selectedTerminal, sessionId]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!resizeState.current) {
        return;
      }
      const containerWidth =
        panelRef.current?.parentElement?.clientWidth || window.innerWidth || 1024;
      const {min, max} = panelWidthBounds(containerWidth);
      const delta = resizeState.current.startX - event.clientX;
      setPanelWidth(clamp(resizeState.current.startWidth + delta, min, max));
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

  useEffect(() => {
    const handleWindowResize = () => {
      const containerWidth =
        panelRef.current?.parentElement?.clientWidth || window.innerWidth || 1024;
      const {min, max} = panelWidthBounds(containerWidth);
      setPanelWidth((current) => clamp(current, min, max));
    };

    window.addEventListener("resize", handleWindowResize);
    handleWindowResize();
    return () => {
      window.removeEventListener("resize", handleWindowResize);
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
      ref={panelRef}
      sx={{
        width: {xs: "100%", md: `min(${panelWidth}px, ${MAX_PANEL_VW}vw)`},
        maxWidth: {xs: "100%", md: `${MAX_PANEL_VW}vw`},
        minWidth: {xs: "100%", md: MIN_PANEL_WIDTH},
        height: "100%",
        borderLeft: "1px solid",
        borderColor: "divider",
        bgcolor: "var(--color-surface)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        position: "relative",
        boxSizing: "border-box",
        overflow: "hidden",
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
        sx={{
          px: isHeaderCollapsed ? 1 : 2,
          py: isHeaderCollapsed ? 0.5 : 1.5,
          borderBottom: "1px solid",
          borderColor: "divider",
          minHeight: isHeaderCollapsed ? 38 : 64,
        }}
      >
        {!isHeaderCollapsed && (
          <>
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
          </>
        )}
        {isHeaderCollapsed && <Box sx={{flex: 1}} />}
        <Tooltip
          title={isHeaderCollapsed ? t("evidence.expandHeader") : t("evidence.collapseHeader")}
          arrow
        >
          <IconButton
            size='small'
            onClick={() => setIsHeaderCollapsed((current) => !current)}
            aria-label={
              isHeaderCollapsed
                ? t("evidence.expandHeader")
                : t("evidence.collapseHeader")
            }
          >
            {isHeaderCollapsed ? (
              <KeyboardArrowDownIcon fontSize='small' />
            ) : (
              <KeyboardArrowUpIcon fontSize='small' />
            )}
          </IconButton>
        </Tooltip>
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
