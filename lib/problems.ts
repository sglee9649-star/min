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
