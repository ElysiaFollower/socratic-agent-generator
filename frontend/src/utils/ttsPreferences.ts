export interface TtsPreferences {
  enabled: boolean;
  voiceURIZh: string;
  voiceURIEn: string;
  rate: number;
  pitch: number;
  volume: number;
}

export const DEFAULT_TTS_PREFERENCES: TtsPreferences = {
  enabled: true,
  voiceURIZh: "",
  voiceURIEn: "",
  rate: 1,
  pitch: 1,
  volume: 1,
};

const STORAGE_KEY = "tts_preferences_v1";

export const TTS_ALLOWED_VOICES = [
  { name: "Karen", lang: "en-AU" },
  { name: "Daniel", lang: "en-GB" },
  { name: "Samantha", lang: "en-US" },
  { name: "婷婷", lang: "zh-CN" },
  { name: "美嘉", lang: "zh-TW" },
  { name: "Google 普通话（中国大陆）", lang: "zh-CN" },
  { name: "Google 粵語（香港）", lang: "zh-HK" },
  { name: "Google 國語（臺灣）", lang: "zh-TW" },
] as const;

export function isAllowedVoice(voice: SpeechSynthesisVoice): boolean {
  return TTS_ALLOWED_VOICES.some(
    (allowed) => allowed.name === voice.name && allowed.lang === voice.lang,
  );
}

export function filterAllowedVoices(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice[] {
  return voices.filter(isAllowedVoice);
}

export function loadTtsPreferences(): TtsPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_TTS_PREFERENCES;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return DEFAULT_TTS_PREFERENCES;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<TtsPreferences>;

    return {
      enabled: Boolean(parsed.enabled ?? DEFAULT_TTS_PREFERENCES.enabled),
      voiceURIZh:
        typeof parsed.voiceURIZh === "string"
          ? parsed.voiceURIZh
          : DEFAULT_TTS_PREFERENCES.voiceURIZh,
      voiceURIEn:
        typeof parsed.voiceURIEn === "string"
          ? parsed.voiceURIEn
          : DEFAULT_TTS_PREFERENCES.voiceURIEn,
      rate:
        typeof parsed.rate === "number"
          ? parsed.rate
          : DEFAULT_TTS_PREFERENCES.rate,
      pitch:
        typeof parsed.pitch === "number"
          ? parsed.pitch
          : DEFAULT_TTS_PREFERENCES.pitch,
      volume:
        typeof parsed.volume === "number"
          ? parsed.volume
          : DEFAULT_TTS_PREFERENCES.volume,
    };
  } catch {
    return DEFAULT_TTS_PREFERENCES;
  }
}

export function saveTtsPreferences(next: TtsPreferences): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
