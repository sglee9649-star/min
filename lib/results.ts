// 결과 집계 (6단계): 심사위원 점수 + AI 점수를 가중치·편차보정·동점규칙으로 최종 순위화.
import type { TaskType } from "./criteria";
import { loadConfig, loadScores, type JudgeScore, type JudgingConfig, type RubricItem } from "./judging";

export type DeviationMethod = "none" | "dropHighLow" | "zscore";

export interface ResultSettings {
  deviationMethod: DeviationMethod; // 심사위원 편차 보정 방식
  tieBreakers: string[]; // 동점 시 우선하는 criterionId 순서
  published: boolean; // 점수 공개 여부 (발표 화면 노출)
}

export const DEFAULT_RESULT_SETTINGS: ResultSettings = {
  deviationMethod: "dropHighLow",
  tieBreakers: [],
  published: false,
};

const KEY = "results:settings";
const AUDIT_KEY = "results:audit";

export function loadResultSettings(): ResultSettings {
  if (typeof window === "undefined") return DEFAULT_RESULT_SETTINGS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_RESULT_SETTINGS;
    return { ...DEFAULT_RESULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_RESULT_SETTINGS;
  }
}

export function saveResultSettings(s: ResultSettings) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

// ---------- 감사 로그 (점수 수정·공개 전환·삭제 이력) ----------
export interface AuditEntry {
  at: string;
  action: string;
  detail: string;
}

export function loadAudit(): AuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(AUDIT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function addAudit(action: string, detail: string) {
  const log = loadAudit();
  log.unshift({ at: new Date().toISOString(), action, detail });
  localStorage.setItem(AUDIT_KEY, JSON.stringify(log.slice(0, 500)));
}

export function clearAudit() {
  localStorage.removeItem(AUDIT_KEY);
}

// ---------- 집계 계산 ----------
// 한 심사위원이 한 참가자에게 준 가중치 반영 점수 (0~100)
function weightedJudgeScore(score: JudgeScore, rubric: RubricItem[]): number | null {
  const totalWeight = rubric.reduce((sum, i) => sum + i.weight, 0);
  if (totalWeight === 0) return null;
  let acc = 0;
  let covered = 0;
  for (const item of rubric) {
    const v = score.scores[item.criterionId];
    if (v === undefined) continue;
    acc += (v / 5) * item.weight;
    covered += item.weight;
  }
  if (covered === 0) return null;
  // 채점된 항목 비중만으로 정규화 (일부 항목 누락 대비)
  return (acc / covered) * 100;
}

// 심사위원 편차 보정: 심사위원별 점수 배열 → 대표값
function applyDeviation(values: number[], method: DeviationMethod): number | null {
  const v = values.filter((x) => Number.isFinite(x));
  if (v.length === 0) return null;
  if (method === "dropHighLow" && v.length >= 3) {
    const sorted = [...v].sort((a, b) => a - b);
    const trimmed = sorted.slice(1, -1); // 최고·최저 1개씩 제외
    return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  }
  // zscore 보정은 심사위원 전체 통계가 필요 → 아래 buildResults에서 처리
  return v.reduce((a, b) => a + b, 0) / v.length;
}

export interface ParticipantResult {
  participantNumber: string;
  taskType: TaskType | null;
  judgeAvg: number | null; // 편차 보정된 심사위원 평균 (0~100)
  aiScore: number | null; // AI 참고 점수 (0~100)
  finalScore: number | null; // 가중 혼합 최종 (0~100)
  rank: number | null;
  judgeCount: number; // 채점한 심사위원 수
  perJudge: { judgeName: string; score: number }[];
  tieBreakAvgs: number[]; // 동점 처리용 항목별 평균 (0~5)
}

export interface AggregateInput {
  config?: JudgingConfig;
  scores?: JudgeScore[];
  aiScores?: Record<string, number>; // 참가번호 → AI totalScore
  settings?: ResultSettings;
}

export function buildResults(input: AggregateInput = {}): ParticipantResult[] {
  const config = input.config ?? loadConfig();
  const allScores = input.scores ?? loadScores();
  const aiScores = input.aiScores ?? {};
  const settings = input.settings ?? loadResultSettings();
  const aiRatio = config.aiWeight / 100;

  // zscore 보정용: 심사위원별 (평균, 표준편차) 사전 계산
  const judgeStats: Record<string, { mean: number; sd: number }> = {};
  if (settings.deviationMethod === "zscore") {
    for (const judge of config.judges) {
      const vals: number[] = [];
      for (const num of config.participants) {
        const s = allScores.find((x) => x.judgeId === judge.id && x.participantNumber === num);
        if (!s) continue;
        const rubric = config.rubrics[s.taskType] ?? [];
        const w = weightedJudgeScore(s, rubric);
        if (w !== null) vals.push(w);
      }
      if (vals.length > 0) {
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
        judgeStats[judge.id] = { mean, sd: Math.sqrt(variance) || 1 };
      }
    }
  }

  const results: ParticipantResult[] = config.participants.map((num) => {
    const taskType = config.participantTaskTypes[num] ?? null;
    const perJudge: { judgeName: string; score: number }[] = [];
    const rawValues: number[] = [];
    // 동점 처리용 항목별 점수 수집
    const tieBreakVals: Record<string, number[]> = {};
    for (const cid of settings.tieBreakers) tieBreakVals[cid] = [];

    for (const judge of config.judges) {
      const s = allScores.find((x) => x.judgeId === judge.id && x.participantNumber === num);
      if (!s) continue;
      const rubric = config.rubrics[s.taskType] ?? [];
      let w = weightedJudgeScore(s, rubric);
      if (w === null) continue;
      if (settings.deviationMethod === "zscore" && judgeStats[judge.id]) {
        const { mean, sd } = judgeStats[judge.id];
        // 표준화 후 50±15 스케일로 재배치 (0~100 클램프)
        w = Math.max(0, Math.min(100, 50 + ((w - mean) / sd) * 15));
      }
      perJudge.push({ judgeName: judge.name, score: Math.round(w) });
      rawValues.push(w);
      for (const cid of settings.tieBreakers) {
        if (s.scores[cid] !== undefined) tieBreakVals[cid].push(s.scores[cid]);
      }
    }

    const judgeAvg =
      settings.deviationMethod === "zscore"
        ? (rawValues.length ? rawValues.reduce((a, b) => a + b, 0) / rawValues.length : null)
        : applyDeviation(rawValues, settings.deviationMethod);

    const aiScore = aiScores[num] ?? null;

    let finalScore: number | null;
    if (judgeAvg === null && aiScore === null) finalScore = null;
    else if (aiScore === null) finalScore = judgeAvg;
    else if (judgeAvg === null) finalScore = aiScore;
    else finalScore = judgeAvg * (1 - aiRatio) + aiScore * aiRatio;

    const tieBreakAvgs = settings.tieBreakers.map((cid) => {
      const arr = tieBreakVals[cid];
      return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    });

    return {
      participantNumber: num,
      taskType,
      judgeAvg: judgeAvg === null ? null : Math.round(judgeAvg * 10) / 10,
      aiScore,
      finalScore: finalScore === null ? null : Math.round(finalScore * 10) / 10,
      rank: null,
      judgeCount: perJudge.length,
      perJudge,
      tieBreakAvgs,
    };
  });

  // 순위 매기기 (동점 시 tieBreaker 항목 평균 높은 순)
  const ranked = [...results]
    .filter((r) => r.finalScore !== null)
    .sort((a, b) => {
      if (b.finalScore! !== a.finalScore!) return b.finalScore! - a.finalScore!;
      for (let i = 0; i < a.tieBreakAvgs.length; i++) {
        if (b.tieBreakAvgs[i] !== a.tieBreakAvgs[i]) return b.tieBreakAvgs[i] - a.tieBreakAvgs[i];
      }
      return 0;
    });
  ranked.forEach((r, i) => {
    // 완전 동점(최종점수+타이브레이커 모두 같음)이면 같은 순위
    if (i > 0) {
      const prev = ranked[i - 1];
      const sameFinal = prev.finalScore === r.finalScore;
      const sameTie = prev.tieBreakAvgs.every((v, k) => v === r.tieBreakAvgs[k]);
      r.rank = sameFinal && sameTie ? prev.rank : i + 1;
    } else {
      r.rank = 1;
    }
  });

  return results;
}
