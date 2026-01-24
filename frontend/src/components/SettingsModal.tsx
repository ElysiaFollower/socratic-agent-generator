/**
 * Settings modal.
 *
 * This component provides LLM provider configuration UI.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Box,
  Chip,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import {
  getLLMSettings,
  saveLLMProviderSettings,
  setDefaultLLMProvider,
  testLLMLatency,
} from "../api/settings";
import { LLMProviderStatus } from "../types";
import { useNotification } from "../hooks";
import { LLM_PROVIDERS, getProviderOption } from "../utils/llmProviders";

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
  const [providerStatuses, setProviderStatuses] = useState<
    readonly LLMProviderStatus[]
  >([]);
  const [defaultProvider, setDefaultProvider] = useState("deepseek");
  const [selectedProvider, setSelectedProvider] = useState("deepseek");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);

  const selectedProviderStatus = useMemo(
    () =>
      providerStatuses.find((status) => status.provider === selectedProvider),
    [providerStatuses, selectedProvider],
  );

  const loadSettings = useCallback(async () => {
    try {
      const data = await getLLMSettings();
      setProviderStatuses(data.providers);
      setDefaultProvider(data.default_provider);
      setSelectedProvider(data.default_provider);
    } catch (error) {
      notifyError(
        error instanceof Error ? error.message : t("settings.messages.fetchFailed"),
      );
    }
  }, [notifyError, t]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    void loadSettings();
  }, [isOpen, loadSettings]);

  useEffect(() => {
    if (!selectedProviderStatus) {
      setModel("");
      return;
    }
    setModel(selectedProviderStatus.model || "");
  }, [selectedProviderStatus]);

  useEffect(() => {
    setApiKey("");
    setTestMessage(null);
  }, [selectedProvider]);

  const handleSaveProvider = useCallback(async () => {
    if (!apiKey.trim()) {
      notifyWarning(t("settings.messages.apiKeyRequired"));
      return;
    }
    setIsSaving(true);
    try {
      await saveLLMProviderSettings({
        provider: selectedProvider,
        api_key: apiKey.trim(),
        model: model.trim() || undefined,
      });
      notifySuccess(t("settings.messages.saveSuccess"));
      setApiKey("");
      await loadSettings();
      onSettingsUpdated?.();
    } catch (error) {
      notifyError(
        error instanceof Error ? error.message : t("settings.messages.saveFailed"),
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    apiKey,
    loadSettings,
    model,
    notifyError,
    notifySuccess,
    notifyWarning,
    onSettingsUpdated,
    selectedProvider,
    t,
  ]);

  const handleTestLatency = useCallback(async () => {
    if (!apiKey.trim()) {
      notifyWarning(t("settings.messages.apiKeyRequiredForTest"));
      return;
    }
    setIsTesting(true);
    setTestMessage(null);
    try {
      const result = await testLLMLatency({
        provider: selectedProvider,
        api_key: apiKey.trim(),
        model: model.trim() || undefined,
      });
      setTestMessage(
        result.latency_ms
          ? t("settings.llm.latencyResult", { ms: result.latency_ms })
          : t("settings.llm.testComplete"),
      );
    } catch (error) {
      setTestMessage(
        error instanceof Error ? error.message : t("settings.messages.latencyFailed"),
      );
    } finally {
      setIsTesting(false);
    }
  }, [
    apiKey,
    model,
    notifyWarning,
    selectedProvider,
    t,
  ]);

  const handleSaveDefaultProvider = useCallback(async () => {
    setIsSaving(true);
    try {
      await setDefaultLLMProvider({ provider: defaultProvider });
      notifySuccess(t("settings.messages.defaultUpdated"));
      onSettingsUpdated?.();
    } catch (error) {
      notifyError(
        error instanceof Error ? error.message : t("settings.messages.defaultFailed"),
      );
    } finally {
      setIsSaving(false);
    }
  }, [defaultProvider, notifyError, notifySuccess, onSettingsUpdated, t]);

  return (
    <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t("settings.title")}</DialogTitle>
      <DialogContent dividers>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label={t("settings.tabs.llm")} />
          <Tab label={t("settings.tabs.preferences")} />
          <Tab label={t("settings.tabs.account")} />
        </Tabs>

        {tabValue === 0 && (
          <Stack spacing={2} sx={{ mt: 2 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={2}>
                <Typography variant="subtitle2">
                  {t("settings.llm.defaultProvider")}
                </Typography>
                <FormControl fullWidth size="small">
                  <InputLabel>{t("settings.llm.defaultProvider")}</InputLabel>
                  <Select
                    value={defaultProvider}
                    label={t("settings.llm.defaultProvider")}
                    onChange={(e) => setDefaultProvider(String(e.target.value))}
                  >
                    {LLM_PROVIDERS.map((provider) => (
                      <MenuItem key={provider.value} value={provider.value}>
                        {provider.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Box>
                  <Button
                    variant="outlined"
                    onClick={handleSaveDefaultProvider}
                    disabled={isSaving}
                  >
                    {t("settings.llm.saveDefault")}
                  </Button>
                </Box>
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={2}>
                <Typography variant="subtitle2">
                  {t("settings.llm.providerConfig")}
                </Typography>
                <FormControl fullWidth size="small">
                  <InputLabel>{t("settings.llm.provider")}</InputLabel>
                  <Select
                    value={selectedProvider}
                    label={t("settings.llm.provider")}
                    onChange={(e) => setSelectedProvider(String(e.target.value))}
                  >
                    {LLM_PROVIDERS.map((provider) => (
                      <MenuItem key={provider.value} value={provider.value}>
                        {provider.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary">
                    {t("settings.llm.status")}:
                  </Typography>
                  <Chip
                    size="small"
                    color={selectedProviderStatus?.has_api_key ? "success" : "default"}
                    label={
                      selectedProviderStatus?.has_api_key
                        ? t("settings.llm.configured")
                        : t("settings.llm.notConfigured")
                    }
                  />
                </Stack>

                <TextField
                  fullWidth
                  label={t("settings.llm.apiKey")}
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={t("settings.placeholders.apiKey")}
                />
                <TextField
                  fullWidth
                  label={t("settings.llm.modelOptional")}
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={
                    getProviderOption(selectedProvider)?.defaultModel || ""
                  }
                />

                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    onClick={handleSaveProvider}
                    disabled={isSaving}
                  >
                    {t("settings.llm.saveProvider")}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={handleTestLatency}
                    disabled={isTesting}
                  >
                    {t("settings.llm.testLatency")}
                  </Button>
                </Stack>

                {testMessage && (
                  <Typography variant="caption" color="text.secondary">
                    {testMessage}
                  </Typography>
                )}
              </Stack>
            </Paper>
          </Stack>
        )}

        {tabValue === 1 && (
          <Paper variant="outlined" sx={{ p: 2, mt: 2, borderStyle: "dashed" }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {t("settings.tabs.preferences")}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t("settings.placeholders.preferences")}
            </Typography>
          </Paper>
        )}

        {tabValue === 2 && (
          <Paper variant="outlined" sx={{ p: 2, mt: 2, borderStyle: "dashed" }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {t("settings.tabs.account")}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t("settings.placeholders.account")}
            </Typography>
          </Paper>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          {t("common.close")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
