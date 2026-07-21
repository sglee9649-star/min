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
}
