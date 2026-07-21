// 생성된 문제 보관함 — 1~2단계에서는 localStorage에 저장하고,
// Supabase 도입(추후) 시 DB로 교체한다.
import type { TaskType } from "./criteria";

export interface GeneratedProblem {
  id: string;
  createdAt: string;
  taskType: TaskType;
  gradeId: string;
  proficiencyId?: string;
  category?: string;
  keywords?: string;
  title: string;
  passage: string;
  passageKo: string;
  vocabulary: { word: string; meaning: string }[];
  questions: { question: string; sampleAnswer: string }[];
  keyPoints: string[];
}

const KEY = "problems:bank";

export function loadProblems(): GeneratedProblem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveProblem(p: GeneratedProblem) {
  const all = loadProblems();
  all.unshift(p);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function deleteProblem(id: string) {
  localStorage.setItem(KEY, JSON.stringify(loadProblems().filter((p) => p.id !== id)));
  if (getActiveProblemId() === id) clearActiveProblem();
}

// "출제": 참가자 화면에 내보낼 현재 문제. Supabase 도입 전에는 같은 기기(브라우저) 안에서만 공유된다.
const ACTIVE_KEY = "problems:active";

export function setActiveProblem(id: string) {
  localStorage.setItem(ACTIVE_KEY, id);
}

export function clearActiveProblem() {
  localStorage.removeItem(ACTIVE_KEY);
}

export function getActiveProblemId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}

export function getActiveProblem(): GeneratedProblem | null {
  const id = getActiveProblemId();
  if (!id) return null;
  return loadProblems().find((p) => p.id === id) ?? null;
}

// ---------- 참가번호별 배정 출제 ----------
// 문제마다 참가번호를 배정해 한 번에 출제한다. 한 문제에 여러 명 배정 가능.
// 저장 형태: { "7": "problemId-abc", "8": "problemId-abc", "9": "problemId-def" }
const ASSIGN_KEY = "problems:assignmentMap";

export function loadAssignmentMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(ASSIGN_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function saveAssignmentMap(map: Record<string, string>) {
  localStorage.setItem(ASSIGN_KEY, JSON.stringify(map));
}

export function clearAssignmentMap() {
  localStorage.removeItem(ASSIGN_KEY);
}

// 참가번호로 배정된 문제 찾기. 배정이 없으면 공통 출제(active) 문제로 대체.
export function getProblemForNumber(participantNumber: string): GeneratedProblem | null {
  const map = loadAssignmentMap();
  const pid = map[participantNumber.trim()];
  if (pid) {
    const p = loadProblems().find((x) => x.id === pid);
    if (p) return p;
  }
  return getActiveProblem();
}

// QR/링크로 받은 출제 세트를 이 기기에 저장 (태블릿에서 링크를 열면 호출됨)
export function importAssignments(problems: GeneratedProblem[], map: Record<string, string>) {
  const bank = loadProblems();
  for (const p of problems) {
    if (!bank.some((x) => x.id === p.id)) bank.push(p);
  }
  localStorage.setItem(KEY, JSON.stringify(bank));
  saveAssignmentMap(map);
}
