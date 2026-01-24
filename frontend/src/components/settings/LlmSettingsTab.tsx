/**
 * LLM settings tab content.
 */

import React, { useMemo } from "react";
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
import SpeedOutlinedIcon from "@mui/icons-material/SpeedOutlined";
import { useTranslation } from "react-i18next";
import { LLMProviderStatus } from "../../types";
import { LLM_PROVIDERS, getProviderOption } from "../../utils/llmProviders";

export interface LlmSettingsTabProps {
  readonly providerStatuses: readonly LLMProviderStatus[];
  readonly defaultProvider: string;
  readonly onDefaultProviderChange: (provider: string) => void;
  readonly onSaveDefault: () => void;
  readonly isSavingDefault: boolean;
  readonly providerInputs: Record<string, { apiKey: string; model: string }>;
  readonly onProviderInputChange: (
    provider: string,
    next: { apiKey?: string; model?: string },
  ) => void;
  readonly onSaveProvider: (provider: string) => void;
  readonly onTestProvider: (provider: string) => void;
  readonly savingProvider: string | null;
  readonly testingProvider: string | null;
  readonly testMessages: Record<string, string>;
}

export function LlmSettingsTab(props: LlmSettingsTabProps): JSX.Element {
  const { t } = useTranslation();
  const {
    providerStatuses,
    defaultProvider,
    onDefaultProviderChange,
    onSaveDefault,
    isSavingDefault,
    providerInputs,
    onProviderInputChange,
    onSaveProvider,
    onTestProvider,
    savingProvider,
    testingProvider,
    testMessages,
  } = props;

  const availableProviders = useMemo(
    () => providerStatuses.filter((status) => status.source !== "none"),
    [providerStatuses],
  );

  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <Paper variant='outlined' sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Typography variant='subtitle2'>
            {t("settings.llm.defaultProvider")}
          </Typography>
          <Stack direction='row' spacing={2} alignItems='center'>
            <FormControl fullWidth size='small'>
              <InputLabel>{t("settings.llm.defaultProvider")}</InputLabel>
              <Select
                value={availableProviders.length ? defaultProvider : ""}
                label={t("settings.llm.defaultProvider")}
                onChange={(e) =>
                  onDefaultProviderChange(String(e.target.value))
                }
                disabled={availableProviders.length === 0}
              >
                {availableProviders.map((provider) => (
                  <MenuItem key={provider.provider} value={provider.provider}>
                    {LLM_PROVIDERS.find(
                      (item) => item.value === provider.provider,
                    )?.label || provider.provider}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant='outlined'
              onClick={onSaveDefault}
              disabled={isSavingDefault || availableProviders.length === 0}
              sx={{ flexShrink: 0 }}
            >
              {t("settings.llm.saveDefault")}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper variant='outlined' sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Typography variant='subtitle2'>
            {t("settings.llm.providerList")}
          </Typography>
          {LLM_PROVIDERS.map((provider) => {
            const status = providerStatuses.find(
              (item) => item.provider === provider.value,
            );
            const input = providerInputs[provider.value] || {
              apiKey: "",
              model: status?.model || "",
            };

            return (
              <Paper key={provider.value} variant='outlined' sx={{ p: 2 }}>
                <Stack spacing={2}>
                  <Stack
                    direction='row'
                    spacing={2}
                    alignItems='center'
                    justifyContent='space-between'
                  >
                    <Stack direction='row' spacing={1} alignItems='center'>
                      <Typography variant='subtitle2'>
                        {provider.label}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        {t("settings.llm.status")}:
                      </Typography>
                      <Chip
                        size='small'
                        color={
                          status?.source === "user"
                            ? "success"
                            : status?.source === "preset"
                              ? "info"
                              : "default"
                        }
                        label={
                          status?.source === "user"
                            ? t("settings.llm.configured")
                            : status?.source === "preset"
                              ? t("settings.llm.preset")
                              : t("settings.llm.notConfigured")
                        }
                      />
                    </Stack>
                    <Stack direction='row' spacing={1}>
                      <Button
                        size='small'
                        variant='contained'
                        onClick={() => onSaveProvider(provider.value)}
                        disabled={savingProvider === provider.value}
                      >
                        {t("common.save")}
                      </Button>
                      <Button
                        size='small'
                        variant='outlined'
                        startIcon={<SpeedOutlinedIcon />}
                        onClick={() => onTestProvider(provider.value)}
                        disabled={testingProvider === provider.value}
                      >
                        {t("settings.llm.testLatency")}
                      </Button>
                    </Stack>
                  </Stack>

                  <TextField
                    fullWidth
                    label={t("settings.llm.apiKey")}
                    type='text'
                    value={input.apiKey}
                    onChange={(e) =>
                      onProviderInputChange(provider.value, {
                        apiKey: e.target.value,
                      })
                    }
                    placeholder={t("settings.placeholders.apiKey")}
                  />
                  <TextField
                    fullWidth
                    label={t("settings.llm.modelOptional")}
                    value={input.model}
                    onChange={(e) =>
                      onProviderInputChange(provider.value, {
                        model: e.target.value,
                      })
                    }
                    placeholder={
                      getProviderOption(provider.value)?.defaultModel || ""
                    }
                  />
                  {testMessages[provider.value] && (
                    <Typography variant='caption' color='text.secondary'>
                      {testMessages[provider.value]}
                    </Typography>
                  )}
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      </Paper>
    </Stack>
  );
}
