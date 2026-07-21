// ⚠️ 1단계 임시 접속코드 — 보안 장치가 아니라 자리표시자입니다.
// 브라우저에 코드가 그대로 들어 있으므로 실제 대회에서는 절대 이 방식을 쓰면 안 되며,
// 2단계에서 Supabase Auth(서버 검증)로 교체합니다. (CLAUDE.md 참고)
export const TEMP_CODES = {
  judge: "judge2026",
  admin: "admin2026",
} as const;

export type GateRole = keyof typeof TEMP_CODES;

const KEY = (role: GateRole) => `gate:${role}`;

export function isUnlocked(role: GateRole): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(KEY(role)) === "1";
}

export function tryUnlock(role: GateRole, code: string): boolean {
  const ok = code.trim() === TEMP_CODES[role];
  if (ok) sessionStorage.setItem(KEY(role), "1");
  return ok;
}

export function lock(role: GateRole) {
  sessionStorage.removeItem(KEY(role));
}
