/**
 * Preferences tab content.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
  Tooltip,
  IconButton,
} from "@mui/material";
import VolumeUpOutlinedIcon from "@mui/icons-material/VolumeUpOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useTranslation } from "react-i18next";
import {
  filterAllowedVoices,
  loadTtsPreferences,
  saveTtsPreferences,
  TtsPreferences,
} from "../../utils/ttsPreferences";

export function PreferencesTab(): JSX.Element {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<TtsPreferences>(() =>
    loadTtsPreferences(),
  );
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const defaultTestText =
    "Let's try this configuration ; 让我们试试这个配置如何 ";
  const [testText, setTestText] = useState(defaultTestText);

  const hasSpeechSupport =
    typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => {
    if (!hasSpeechSupport) {
      return;
    }
    const synth = window.speechSynthesis;
    const updateVoices = () => {
      setVoices(synth.getVoices());
    };
    updateVoices();
    synth.addEventListener?.("voiceschanged", updateVoices);
    return () => {
      synth.removeEventListener?.("voiceschanged", updateVoices);
    };
  }, [hasSpeechSupport]);

  useEffect(() => {
    saveTtsPreferences(prefs);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("tts-preferences-changed"));
    }
  }, [prefs]);

  const allowedVoices = useMemo(() => filterAllowedVoices(voices), [voices]);
  const zhVoices = useMemo(
    () =>
      allowedVoices.filter((voice) =>
        voice.lang.toLowerCase().startsWith("zh"),
      ),
    [allowedVoices],
  );
  const enVoices = useMemo(
    () =>
      allowedVoices.filter((voice) =>
        voice.lang.toLowerCase().startsWith("en"),
      ),
    [allowedVoices],
  );

  const splitSpeechSegments = (content: string) => {
    const segments: Array<{ lang: "zh" | "en"; text: string }> = [];
    let currentLang: "zh" | "en" | null = null;
    let buffer = "";
    let pendingNeutral = "";

    const classify = (char: string): "zh" | "en" | null => {
      if (/[A-Za-z0-9]/.test(char)) {
        return "en";
      }
      if (/[\u4E00-\u9FFF]/.test(char)) {
        return "zh";
      }
      return null;
    };

    for (const char of content) {
      const lang = classify(char);
      if (!lang) {
        if (currentLang) {
          buffer += char;
        } else {
          pendingNeutral += char;
        }
        continue;
      }

      if (!currentLang) {
        currentLang = lang;
        buffer = pendingNeutral + char;
        pendingNeutral = "";
        continue;
      }

      if (lang === currentLang) {
        buffer += char;
        continue;
      }

      segments.push({ lang: currentLang, text: buffer });
      currentLang = lang;
      buffer = char;
    }

    if (currentLang) {
      segments.push({
        lang: currentLang,
        text: buffer + pendingNeutral,
      });
    } else if (pendingNeutral.trim()) {
      segments.push({ lang: "en", text: pendingNeutral });
    }

    return segments;
  };

  const handleTestSpeech = () => {
    if (!hasSpeechSupport || !prefs.enabled) {
      return;
    }
    const text = testText.trim();
    if (!text) {
      return;
    }
    const synth = window.speechSynthesis;
    const available = filterAllowedVoices(synth.getVoices());
    if (!available.length) {
      return;
    }

    const segments = splitSpeechSegments(text);
    if (!segments.length) {
      return;
    }

    const chooseVoice = (langPrefix: "zh" | "en") => {
      const preferredUri =
        langPrefix === "zh" ? prefs.voiceURIZh : prefs.voiceURIEn;
      const preferred =
        preferredUri &&
        available.find(
          (voice) =>
            voice.voiceURI === preferredUri &&
            voice.lang.toLowerCase().startsWith(langPrefix),
        );
      if (preferred) {
        return preferred;
      }
      return (
        available.find((voice) =>
          voice.lang.toLowerCase().startsWith(langPrefix),
        ) || available[0]
      );
    };

    synth.cancel();

    const speakNext = (index: number) => {
      if (index >= segments.length) {
        return;
      }
      const segment = segments[index];
      const utterance = new SpeechSynthesisUtterance(segment.text);
      const langPrefix = segment.lang;
      utterance.lang = langPrefix === "zh" ? "zh-CN" : "en-US";
      utterance.rate = prefs.rate;
      utterance.pitch = prefs.pitch;
      utterance.volume = prefs.volume;
      const voice = chooseVoice(langPrefix);
      if (voice) {
        utterance.voice = voice;
      }
      utterance.onend = () => speakNext(index + 1);
      utterance.onerror = () => speakNext(index + 1);
      synth.speak(utterance);
    };

    speakNext(0);
  };

  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <Paper variant='outlined' sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Stack direction='row' spacing={1} alignItems='center'>
            <VolumeUpOutlinedIcon fontSize='small' />
            <Typography variant='subtitle2'>
              {t("settings.preferences.tts.title")}
            </Typography>
            <Tooltip title={t("settings.preferences.tts.voiceTip")} arrow>
              <IconButton
                size='small'
                aria-label={t("settings.preferences.tts.voiceTip")}
                sx={{ ml: 0.5 }}
              >
                <InfoOutlinedIcon fontSize='inherit' />
              </IconButton>
            </Tooltip>
          </Stack>

          {!hasSpeechSupport && (
            <Typography variant='caption' color='text.secondary'>
              {t("settings.preferences.tts.notSupported")}
            </Typography>
          )}

          <FormControlLabel
            control={
              <Switch
                checked={prefs.enabled}
                onChange={(event) =>
                  setPrefs((prev) => ({
                    ...prev,
                    enabled: event.target.checked,
                  }))
                }
              />
            }
            label={t("settings.preferences.tts.enable")}
          />

          <Stack spacing={1}>
            <Typography variant='caption' color='text.secondary'>
              {t("settings.preferences.tts.testText")}
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                fullWidth
                size='small'
                label={t("settings.preferences.tts.testText")}
                value={testText}
                onChange={(event) => setTestText(event.target.value)}
                disabled={!hasSpeechSupport}
                InputLabelProps={{ shrink: true }}
              />
              <Button
                variant='outlined'
                onClick={handleTestSpeech}
                disabled={!hasSpeechSupport || !prefs.enabled}
                sx={{ flexShrink: 0 }}
              >
                {t("settings.preferences.tts.testButton")}
              </Button>
            </Stack>
          </Stack>

          <Stack spacing={2} direction={{ xs: "column", md: "row" }}>
            <FormControl fullWidth size='small'>
              <InputLabel shrink>
                {t("settings.preferences.tts.voiceEn")}
              </InputLabel>
              <Select
                value={prefs.voiceURIEn}
                label={t("settings.preferences.tts.voiceEn")}
                onChange={(event) =>
                  setPrefs((prev) => ({
                    ...prev,
                    voiceURIEn: String(event.target.value),
                  }))
                }
                disabled={!hasSpeechSupport || enVoices.length === 0}
                displayEmpty
                renderValue={(value) =>
                  value ? value : t("settings.preferences.tts.voiceDefault")
                }
              >
                <MenuItem value=''>
                  {t("settings.preferences.tts.voiceDefault")}
                </MenuItem>
                {enVoices.map((voice) => (
                  <MenuItem key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name} ({voice.lang})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size='small'>
              <InputLabel shrink>
                {t("settings.preferences.tts.voiceZh")}
              </InputLabel>
              <Select
                value={prefs.voiceURIZh}
                label={t("settings.preferences.tts.voiceZh")}
                onChange={(event) =>
                  setPrefs((prev) => ({
                    ...prev,
                    voiceURIZh: String(event.target.value),
                  }))
                }
                disabled={!hasSpeechSupport || zhVoices.length === 0}
                displayEmpty
                renderValue={(value) =>
                  value ? value : t("settings.preferences.tts.voiceDefault")
                }
              >
                <MenuItem value=''>
                  {t("settings.preferences.tts.voiceDefault")}
                </MenuItem>
                {zhVoices.map((voice) => (
                  <MenuItem key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name} ({voice.lang})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Stack spacing={1}>
            <Typography variant='caption' color='text.secondary'>
              {t("settings.preferences.tts.rate")}
            </Typography>
            <Slider
              value={prefs.rate}
              min={0.5}
              max={2}
              step={0.1}
              valueLabelDisplay='auto'
              onChange={(_, next) =>
                setPrefs((prev) => ({
                  ...prev,
                  rate: Array.isArray(next) ? next[0] : next,
                }))
              }
              disabled={!hasSpeechSupport}
            />
          </Stack>

          <Stack spacing={1}>
            <Typography variant='caption' color='text.secondary'>
              {t("settings.preferences.tts.pitch")}
            </Typography>
            <Slider
              value={prefs.pitch}
              min={0}
              max={2}
              step={0.1}
              valueLabelDisplay='auto'
              onChange={(_, next) =>
                setPrefs((prev) => ({
                  ...prev,
                  pitch: Array.isArray(next) ? next[0] : next,
                }))
              }
              disabled={!hasSpeechSupport}
            />
          </Stack>

          <Stack spacing={1}>
            <Typography variant='caption' color='text.secondary'>
              {t("settings.preferences.tts.volume")}
            </Typography>
            <Slider
              value={prefs.volume}
              min={0}
              max={1}
              step={0.05}
              valueLabelDisplay='auto'
              onChange={(_, next) =>
                setPrefs((prev) => ({
                  ...prev,
                  volume: Array.isArray(next) ? next[0] : next,
                }))
              }
              disabled={!hasSpeechSupport}
            />
          </Stack>

          {hasSpeechSupport && (!zhVoices.length || !enVoices.length) && (
            <Typography variant='caption' color='text.secondary'>
              {t("settings.preferences.tts.voiceEmpty")}
            </Typography>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
