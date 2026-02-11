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
      enabled:
        typeof parsed.enabled === "boolean"
          ? parsed.enabled
          : DEFAULT_TTS_PREFERENCES.enabled,
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

/**
 * Speech segment type for mixed-language text.
 */
export type SpeechSegment = { lang: "zh" | "en"; text: string };

/**
 * Splits text into segments by language (Chinese/English) for TTS playback.
 * This function detects character-by-character and groups contiguous
 * characters of the same language into segments.
 *
 * @param content - The text content to split
 * @returns Array of speech segments with language tags
 */
export function splitSpeechSegments(content: string): SpeechSegment[] {
  const segments: SpeechSegment[] = [];
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
}

/**
 * Speaks text using the Web Speech API with mixed-language support.
 *
 * @param text - The text to speak
 * @param preferences - TTS preferences including voice selection and speech parameters
 * @returns void
 */
export function speakText(text: string, preferences: TtsPreferences): void {
  if (!preferences.enabled) {
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

  const chooseVoice = (langPrefix: "zh" | "en"): SpeechSynthesisVoice | undefined => {
    const preferredUri =
      langPrefix === "zh" ? preferences.voiceURIZh : preferences.voiceURIEn;
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

  const speakNext = (index: number): void => {
    if (index >= segments.length) {
      return;
    }
    const segment = segments[index];
    const utterance = new SpeechSynthesisUtterance(segment.text);
    const langPrefix = segment.lang;
    utterance.lang = langPrefix === "zh" ? "zh-CN" : "en-US";
    utterance.rate = preferences.rate;
    utterance.pitch = preferences.pitch;
    utterance.volume = preferences.volume;
    const voice = chooseVoice(langPrefix);
    if (voice) {
      utterance.voice = voice;
    }
    utterance.onend = () => speakNext(index + 1);
    utterance.onerror = () => speakNext(index + 1);
    synth.speak(utterance);
  };

  speakNext(0);
}
