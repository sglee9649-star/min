// 심사 데이터 계층 (5단계): 루브릭(평가기준표), 심사위원, 참가자 명단, 심사위원 점수.
// 저장은 localStorage — 기기 간 이동은 링크(심사 설정 링크 / 채점 결과 링크)로 한다.
// Supabase 도입 후에는 실시간 동기화로 교체·병행 예정.
import { criteriaForTask, type TaskType } from "./criteria";

export interface RubricItem {
  criterionId: string;
  weight: number; // % — 과제 유형별로 합이 100이어야 함
}

export type RubricSet = Record<TaskType, RubricItem[]>;

export interface JudgeInfo {
  id: string;
  name: string;
}

// 관리자가 구성해 심사위원 기기로 보내는 설정 묶음
export interface JudgingConfig {
  rubrics: RubricSet;
  aiWeight: number; // AI 점수 반영 비율 % (나머지가 심사위원). 집계(6단계)에서 사용
  judges: JudgeInfo[];
  participants: string[]; // 참가번호 목록 (익명 — 이름은 다루지 않는다)
  participantTaskTypes: Record<string, TaskType>; // 참가번호 → 과제 유형 (배정 기준)
}

// 심사위원 1명이 참가자 1명에게 낸 점수
export interface JudgeScore {
  judgeId: string;
  judgeName: string;
  participantNumber: string;
  taskType: TaskType;
  scores: Record<string, number>; // criterionId → 0~5
  comment: string;
  submittedAt: string;
}

const CONFIG_KEY = "judging:config";
const SCORES_KEY = "judging:scores";

// 기본 루브릭: 유형별 기본 항목(optional 제외)을 균등 배분
export function defaultRubrics(): RubricSet {
  const build = (task: TaskType): RubricItem[] => {
    const items = criteriaForTask(task).filter((c) => !c.optional);
    const base = Math.floor(100 / items.length);
    return items.map((c, i) => ({
      criterionId: c.id,
      weight: base + (i === 0 ? 100 - base * items.length : 0),
    }));
  };
  return { retelling: build("retelling"), readAloud: build("readAloud"), qna: build("qna") };
}

export function defaultConfig(): JudgingConfig {
  return {
    rubrics: defaultRubrics(),
    aiWeight: 30,
    judges: [],
    participants: [],
    participantTaskTypes: {},
  };
}

export function loadConfig(): JudgingConfig {
  if (typeof window === "undefined") return defaultConfig();
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return defaultConfig();
    return { ...defaultConfig(), ...JSON.parse(raw) };
  } catch {
    return defaultConfig();
  }
}

export function saveConfig(config: JudgingConfig) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function hasConfig(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(CONFIG_KEY) !== null;
}

export function loadScores(): JudgeScore[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SCORES_KEY) ?? "[]");
  } catch {
    return [];
  }
}

// 점수 저장/병합: 같은 (심사위원, 참가자) 조합은 최신 제출로 교체
export function upsertScores(incoming: JudgeScore[]) {
  const all = loadScores();
  for (const s of incoming) {
    const idx = all.findIndex(
      (x) => x.judgeId === s.judgeId && x.participantNumber === s.participantNumber,
    );
    if (idx >= 0) {
      if (all[idx].submittedAt <= s.submittedAt) all[idx] = s;
    } else {
      all.push(s);
    }
  }
  localStorage.setItem(SCORES_KEY, JSON.stringify(all));
}

export function clearScores() {
  localStorage.removeItem(SCORES_KEY);
}

export function rubricWeightSum(items: RubricItem[]): number {
  return items.reduce((sum, i) => sum + (Number.isFinite(i.weight) ? i.weight : 0), 0);
}
