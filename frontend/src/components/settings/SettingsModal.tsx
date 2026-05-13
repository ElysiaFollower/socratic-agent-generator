/**
 * Settings modal.
 *
 * This component provides LLM provider configuration UI.
 */

import React, { useCallback, useEffect, useState } from "react";
import { useRef } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Typography,
  Tabs,
  Tab,
  Box,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import {
  getLLMSettings,
  createRemoteMachine,
  deleteRemoteMachine,
  listRemoteMachines,
  saveLLMProviderSettings,
  setDefaultLLMProvider,
  testLLMLatency,
  deleteLLMProviderSettings,
  testRemoteMachine,
  updateRemoteMachine,
} from "../../api/settings";
import {
  LLMProviderStatus,
  RemoteMachineSummary,
  SaveRemoteMachineRequest,
} from "../../types";
import { useNotification } from "../../hooks";
import { LLM_PROVIDERS } from "../../utils/llmProviders";
import { LlmSettingsTab } from "./LlmSettingsTab";
import { PreferencesTab } from "./PreferencesTab";
import { RemoteMachinesTab } from "./RemoteMachinesTab";

/**
 * Props for SettingsModal component.
 */
export interface SettingsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSettingsUpdated?: () => void;
}

/**
 * Settings modal component.
 *
 * @param props - Component props
 * @returns React component
 */
export function SettingsModal(props: SettingsModalProps): JSX.Element | null {
  const { isOpen, onClose, onSettingsUpdated } = props;
  const { t } = useTranslation();
  const { notifyError, notifySuccess, notifyWarning } = useNotification();
  const [tabValue, setTabValue] = useState(0);
  const [dialogWidth, setDialogWidth] = useState<number>(() => {
    if (typeof window === "undefined") {
      return 800;
    }
    const ratio = window.innerWidth < 600 ? 0.9 : 0.6;
    return Math.round(window.innerWidth * ratio);
  });
  const resizeState = useRef<{ startX: number; startWidth: number } | null>(
    null,
  );
  const [providerStatuses, setProviderStatuses] = useState<
    readonly LLMProviderStatus[]
  >([]);
  const [defaultProvider, setDefaultProvider] = useState("deepseek");
  const [isSaving, setIsSaving] = useState(false);
  const [providerInputs, setProviderInputs] = useState<
    Record<string, { apiKey: string; model: string }>
  >({});
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testMessages, setTestMessages] = useState<Record<string, string>>({});
  const [remoteMachines, setRemoteMachines] = useState<
    readonly RemoteMachineSummary[]
  >([]);
  const [busyMachineId, setBusyMachineId] = useState<string | null>(null);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!resizeState.current) {
        return;
      }
      const deltaX = event.clientX - resizeState.current.startX;
      const minWidth = 480;
      const maxWidth = Math.round(window.innerWidth * 0.9);
      const nextWidth = Math.min(
        maxWidth,
        Math.max(minWidth, resizeState.current.startWidth + deltaX),
      );
      setDialogWidth(nextWidth);
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

  // One-time cleanup: remove old localStorage API keys
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    LLM_PROVIDERS.forEach((provider) => {
      localStorage.removeItem(`llm_api_key_${provider.value}`);
      localStorage.removeItem(`llm_model_${provider.value}`);
    });
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const [data, machines] = await Promise.all([
        getLLMSettings(),
        listRemoteMachines(),
      ]);
      setProviderStatuses(data.providers);
      setRemoteMachines(machines);
      setDefaultProvider(data.default_provider);
      setProviderInputs((prev) => {
        const next = { ...prev };
        LLM_PROVIDERS.forEach((provider) => {
          const backendModel =
            data.providers.find((item) => item.provider === provider.value)
              ?.model || "";
          next[provider.value] = {
            apiKey: "",
            model: backendModel,
          };
        });
        return next;
      });
    } catch (error) {
      notifyError(
        error instanceof Error
          ? error.message
          : t("settings.messages.fetchFailed"),
      );
    }
  }, [notifyError, t]);

  const loadRemoteMachines = useCallback(async () => {
    try {
      setRemoteMachines(await listRemoteMachines());
    } catch (error) {
      notifyError(
        error instanceof Error ? error.message : t("settings.remote.fetchFailed"),
      );
    }
  }, [notifyError, t]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    void loadSettings();
  }, [isOpen, loadSettings]);

  const handleSaveProvider = useCallback(
    async (provider: string) => {
      const input = providerInputs[provider];
      if (!input?.apiKey?.trim()) {
        setSavingProvider(provider);
        try {
          await deleteLLMProviderSettings(provider);
          setProviderInputs((prev) => ({
            ...prev,
            [provider]: {
              apiKey: "",
              model: prev[provider]?.model ?? "",
            },
          }));
          await loadSettings();
          onSettingsUpdated?.();
        } catch (error) {
          notifyError(
            error instanceof Error
              ? error.message
              : t("settings.messages.saveFailed"),
          );
        } finally {
          setSavingProvider(null);
        }
        return;
      }
      setSavingProvider(provider);
      try {
        await saveLLMProviderSettings({
          provider,
          api_key: input.apiKey.trim(),
          model: input.model.trim() || undefined,
        });
        notifySuccess(t("settings.messages.saveSuccess"));
        await loadSettings();
        onSettingsUpdated?.();
      } catch (error) {
        notifyError(
          error instanceof Error
            ? error.message
            : t("settings.messages.saveFailed"),
        );
      } finally {
        setSavingProvider(null);
      }
    },
    [
      loadSettings,
      notifyError,
      notifySuccess,
      notifyWarning,
      onSettingsUpdated,
      providerInputs,
      t,
    ],
  );

  const handleTestLatency = useCallback(
    async (provider: string) => {
      const input = providerInputs[provider];
      if (!input?.apiKey?.trim()) {
        notifyWarning(t("settings.messages.apiKeyRequiredForTest"));
        return;
      }
      setTestingProvider(provider);
      setTestMessages((prev) => ({ ...prev, [provider]: "" }));
      try {
        const result = await testLLMLatency({
          provider,
          api_key: input.apiKey.trim(),
          model: input.model.trim() || undefined,
        });
        setTestMessages((prev) => ({
          ...prev,
          [provider]: result.latency_ms
            ? t("settings.llm.latencyResult", { ms: result.latency_ms })
            : t("settings.llm.testComplete"),
        }));
      } catch (error) {
        setTestMessages((prev) => ({
          ...prev,
          [provider]:
            error instanceof Error
              ? error.message
              : t("settings.messages.latencyFailed"),
        }));
      } finally {
        setTestingProvider(null);
      }
    },
    [notifyWarning, providerInputs, t],
  );

  const handleSaveDefaultProvider = useCallback(async () => {
    setIsSaving(true);
    try {
      await setDefaultLLMProvider({ provider: defaultProvider });
      notifySuccess(t("settings.messages.defaultUpdated"));
      onSettingsUpdated?.();
    } catch (error) {
      notifyError(
        error instanceof Error
          ? error.message
          : t("settings.messages.defaultFailed"),
      );
    } finally {
      setIsSaving(false);
    }
  }, [defaultProvider, notifyError, notifySuccess, onSettingsUpdated, t]);

  const handleSaveRemoteMachine = useCallback(
    async (machineId: string | null, payload: SaveRemoteMachineRequest) => {
      try {
        if (machineId) {
          await updateRemoteMachine(machineId, payload);
        } else {
          await createRemoteMachine(payload);
        }
        notifySuccess(t("settings.remote.saved"));
        await loadRemoteMachines();
      } catch (error) {
        notifyError(
          error instanceof Error ? error.message : t("settings.remote.saveFailed"),
        );
      }
    },
    [loadRemoteMachines, notifyError, notifySuccess, t],
  );

  const handleDeleteRemoteMachine = useCallback(
    async (machineId: string) => {
      try {
        await deleteRemoteMachine(machineId);
        notifySuccess(t("settings.remote.deleted"));
        await loadRemoteMachines();
      } catch (error) {
        notifyError(
          error instanceof Error
            ? error.message
            : t("settings.remote.deleteFailed"),
        );
      }
    },
    [loadRemoteMachines, notifyError, notifySuccess, t],
  );

  const handleTestRemoteMachine = useCallback(
    async (machineId: string) => {
      setBusyMachineId(machineId);
      try {
        const result = await testRemoteMachine(machineId);
        if (result.ok) {
          notifySuccess(result.message || t("settings.remote.testReady"));
        } else {
          notifyError(result.message || t("settings.remote.testFailed"));
        }
        await loadRemoteMachines();
      } catch (error) {
        notifyError(
          error instanceof Error ? error.message : t("settings.remote.testFailed"),
        );
      } finally {
        setBusyMachineId(null);
      }
    },
    [loadRemoteMachines, notifyError, notifySuccess, t],
  );

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      fullWidth={false}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: dialogWidth,
          maxWidth: "90vw",
          position: "relative",
        },
      }}
    >
      <DialogTitle>{t("settings.title")}</DialogTitle>
      <DialogContent dividers>
        <Box
          sx={{
            position: "absolute",
            top: 0,
            right: 0,
            height: "100%",
            width: 8,
            cursor: "col-resize",
            bgcolor: "transparent",
            "&:hover": { bgcolor: "var(--color-surface-muted)" },
          }}
          onMouseDown={(event) => {
            resizeState.current = {
              startX: event.clientX,
              startWidth: dialogWidth,
            };
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
          }}
          title={t("settings.resizeWidth")}
          aria-label={t("settings.resizeWidth")}
        />
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label={t("settings.tabs.llm")} />
          <Tab label={t("settings.tabs.remote")} />
          <Tab label={t("settings.tabs.preferences")} />
          <Tab label={t("settings.tabs.account")} />
        </Tabs>

        {tabValue === 0 && (
          <LlmSettingsTab
            providerStatuses={providerStatuses}
            defaultProvider={defaultProvider}
            onDefaultProviderChange={setDefaultProvider}
            onSaveDefault={handleSaveDefaultProvider}
            isSavingDefault={isSaving}
            providerInputs={providerInputs}
            onProviderInputChange={(provider, next) =>
              setProviderInputs((prev) => ({
                ...prev,
                [provider]: {
                  apiKey: next.apiKey ?? prev[provider]?.apiKey ?? "",
                  model: next.model ?? prev[provider]?.model ?? "",
                },
              }))
            }
            onSaveProvider={handleSaveProvider}
            onTestProvider={handleTestLatency}
            savingProvider={savingProvider}
            testingProvider={testingProvider}
            testMessages={testMessages}
          />
        )}

        {tabValue === 1 && (
          <RemoteMachinesTab
            machines={remoteMachines}
            onSave={handleSaveRemoteMachine}
            onDelete={handleDeleteRemoteMachine}
            onTest={handleTestRemoteMachine}
            busyMachineId={busyMachineId}
          />
        )}

        {tabValue === 2 && <PreferencesTab />}

        {tabValue === 3 && (
          <Paper variant='outlined' sx={{ p: 2, mt: 2, borderStyle: "dashed" }}>
            <Typography variant='subtitle2' sx={{ mb: 1 }}>
              {t("settings.tabs.account")}
            </Typography>
            <Typography variant='caption' color='text.secondary'>
              {t("settings.placeholders.account")}
            </Typography>
          </Paper>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant='contained'>
          {t("common.close")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
