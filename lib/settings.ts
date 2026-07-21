// 1단계 임시 설정 저장소 (localStorage). 2단계에서 Supabase DB로 교체한다.
export interface ContestSettings {
  contestName: string;
  readTimeSec: number; // 지문 읽기(준비) 시간
  speakTimeSec: number; // 말하기 시간
  allowRetry: boolean; // 기기 오류 등으로 재녹음 허용 여부 (재시도는 로그로 기록됨)
}

export const DEFAULT_SETTINGS: ContestSettings = {
  contestName: "English AI Retelling Contest",
  readTimeSec: 60,
  speakTimeSec: 90,
  allowRetry: true,
};

const KEY = "contest:settings";

export function loadSettings(): ContestSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: ContestSettings) {
  localStorage.setItem(KEY, JSON.stringify(s));
}
