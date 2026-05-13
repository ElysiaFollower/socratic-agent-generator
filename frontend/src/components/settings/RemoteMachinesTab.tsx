import React, { useState } from "react";
import {
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import TerminalIcon from "@mui/icons-material/Terminal";
import { useTranslation } from "react-i18next";
import {
  RemoteMachineAuthType,
  RemoteMachineSummary,
  SaveRemoteMachineRequest,
} from "../../types";

interface RemoteMachinesTabProps {
  readonly machines: readonly RemoteMachineSummary[];
  readonly onSave: (
    machineId: string | null,
    payload: SaveRemoteMachineRequest,
  ) => void;
  readonly onDelete: (machineId: string) => void;
  readonly onTest: (machineId: string) => void;
  readonly busyMachineId: string | null;
}

interface MachineFormState {
  readonly machineId: string | null;
  readonly displayName: string;
  readonly runnerMachineName: string;
  readonly host: string;
  readonly port: string;
  readonly username: string;
  readonly authType: RemoteMachineAuthType;
  readonly password: string;
  readonly keyPath: string;
  readonly defaultCwd: string;
  readonly startupCommands: string;
}

const emptyForm: MachineFormState = {
  machineId: null,
  displayName: "",
  runnerMachineName: "",
  host: "",
  port: "22",
  username: "",
  authType: "existing",
  password: "",
  keyPath: "",
  defaultCwd: "",
  startupCommands: "",
};

export function RemoteMachinesTab(props: RemoteMachinesTabProps): JSX.Element {
  const { machines, onSave, onDelete, onTest, busyMachineId } = props;
  const { t } = useTranslation();
  const [form, setForm] = useState<MachineFormState>(emptyForm);

  const selectMachine = (machine: RemoteMachineSummary) => {
    setForm({
      machineId: machine.machine_id,
      displayName: machine.display_name,
      runnerMachineName: machine.runner_machine_name,
      host: machine.host || "",
      port: String(machine.port || 22),
      username: machine.username || "",
      authType: machine.auth_type,
      password: "",
      keyPath: machine.key_path || "",
      defaultCwd: machine.default_cwd || "",
      startupCommands: machine.startup_commands.join("\n"),
    });
  };

  const submit = () => {
    onSave(form.machineId, {
      display_name: form.displayName.trim(),
      runner_machine_name: form.runnerMachineName.trim(),
      host: form.host.trim() || null,
      port: Number(form.port || 22),
      username: form.username.trim() || null,
      auth_type: form.authType,
      password: form.password.trim() || undefined,
      key_path: form.keyPath.trim() || null,
      default_cwd: form.defaultCwd.trim() || null,
      startup_commands: form.startupCommands
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    });
    setForm(emptyForm);
  };

  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <Paper variant='outlined' sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Stack direction='row' spacing={1} alignItems='center'>
            <TerminalIcon fontSize='small' />
            <Typography variant='subtitle2'>
              {t("settings.remote.formTitle")}
            </Typography>
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              fullWidth
              size='small'
              label={t("settings.remote.displayName")}
              value={form.displayName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, displayName: event.target.value }))
              }
            />
            <TextField
              fullWidth
              size='small'
              label={t("settings.remote.runnerMachineName")}
              value={form.runnerMachineName}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  runnerMachineName: event.target.value,
                }))
              }
            />
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <FormControl fullWidth size='small'>
              <InputLabel>{t("settings.remote.authType")}</InputLabel>
              <Select
                label={t("settings.remote.authType")}
                value={form.authType}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    authType: event.target.value as RemoteMachineAuthType,
                  }))
                }
              >
                <MenuItem value='existing'>
                  {t("settings.remote.authExisting")}
                </MenuItem>
                <MenuItem value='password'>
                  {t("settings.remote.authPassword")}
                </MenuItem>
                <MenuItem value='key'>{t("settings.remote.authKey")}</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              size='small'
              label={t("settings.remote.host")}
              value={form.host}
              disabled={form.authType === "existing"}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, host: event.target.value }))
              }
            />
            <TextField
              size='small'
              label={t("settings.remote.port")}
              value={form.port}
              disabled={form.authType === "existing"}
              sx={{ width: { xs: "100%", md: 120 } }}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, port: event.target.value }))
              }
            />
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              fullWidth
              size='small'
              label={t("settings.remote.username")}
              value={form.username}
              disabled={form.authType === "existing"}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, username: event.target.value }))
              }
            />
            {form.authType === "password" && (
              <TextField
                fullWidth
                size='small'
                type='password'
                label={t("settings.remote.password")}
                value={form.password}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, password: event.target.value }))
                }
              />
            )}
            {form.authType === "key" && (
              <TextField
                fullWidth
                size='small'
                label={t("settings.remote.keyPath")}
                value={form.keyPath}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, keyPath: event.target.value }))
                }
              />
            )}
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              fullWidth
              size='small'
              label={t("settings.remote.defaultCwd")}
              value={form.defaultCwd}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, defaultCwd: event.target.value }))
              }
            />
            <TextField
              fullWidth
              size='small'
              multiline
              minRows={1}
              label={t("settings.remote.startupCommands")}
              value={form.startupCommands}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  startupCommands: event.target.value,
                }))
              }
            />
          </Stack>
          <Stack direction='row' spacing={1} justifyContent='flex-end'>
            <Button variant='outlined' onClick={() => setForm(emptyForm)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant='contained'
              onClick={submit}
              disabled={!form.displayName.trim() || !form.runnerMachineName.trim()}
            >
              {t("common.save")}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper variant='outlined' sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Typography variant='subtitle2'>
            {t("settings.remote.machineList")}
          </Typography>
          {machines.length === 0 ? (
            <Typography variant='body2' color='text.secondary'>
              {t("settings.remote.noMachines")}
            </Typography>
          ) : (
            machines.map((machine) => (
              <Stack
                key={machine.machine_id}
                direction={{ xs: "column", md: "row" }}
                spacing={1.5}
                alignItems={{ xs: "stretch", md: "center" }}
                justifyContent='space-between'
              >
                <Stack spacing={0.5}>
                  <Stack direction='row' spacing={1} alignItems='center'>
                    <Typography variant='body1' fontWeight={600}>
                      {machine.display_name}
                    </Typography>
                    <Chip size='small' label={machine.status} />
                  </Stack>
                  <Typography variant='caption' color='text.secondary'>
                    {machine.runner_machine_name}
                    {machine.default_cwd ? ` · ${machine.default_cwd}` : ""}
                  </Typography>
                  {machine.last_error && (
                    <Typography variant='caption' color='error'>
                      {machine.last_error}
                    </Typography>
                  )}
                </Stack>
                <Stack direction='row' spacing={1}>
                  <Button
                    size='small'
                    variant='outlined'
                    onClick={() => selectMachine(machine)}
                  >
                    {t("common.edit")}
                  </Button>
                  <Button
                    size='small'
                    variant='outlined'
                    startIcon={<PlayArrowIcon />}
                    onClick={() => onTest(machine.machine_id)}
                    disabled={busyMachineId === machine.machine_id}
                  >
                    {t("settings.remote.test")}
                  </Button>
                  <Button
                    size='small'
                    color='error'
                    variant='outlined'
                    startIcon={<DeleteOutlineIcon />}
                    onClick={() => onDelete(machine.machine_id)}
                  >
                    {t("common.delete")}
                  </Button>
                </Stack>
              </Stack>
            ))
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
