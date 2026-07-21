"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PassGate from "@/components/PassGate";
import { CRITERIA_CATALOG, taskTypeLabel } from "@/lib/criteria";
import { loadConfig, type JudgingConfig } from "@/lib/judging";
import { listRecordings } from "@/lib/recordings";
import {
  buildResults, loadResultSettings, saveResultSettings, addAudit,
  type DeviationMethod, type ParticipantResult, type ResultSettings,
} from "@/lib/results";

// 6단계: 결과 집계·공개. 가중치·AI 반영·편차보정·동점규칙을 적용해 최종 순위를 내고,
// 관리자가 "공개"로 전환하면 발표 화면(/display)에 순위가 표시된다.
export default function ResultsPage() {
  return (
    <PassGate role="admin" title="결과 집계">
      <ResultsInner />
    </PassGate>
  );
}

const DEV_LABELS: Record<DeviationMethod, string> = {
  none: "보정 없음 (None — 단순 평균)",
  dropHighLow: "최고·최저 제외 (Drop high/low — 심사위원 3명 이상)",
  zscore: "표준화 (Z-score — 심사위원별 후함/짬 보정)",
};

function ResultsInner() {
  const [config, setConfig] = useState<JudgingConfig | null>(null);
  const [settings, setSettings] = useState<ResultSettings>(loadResultSettings());
  const [aiScores, setAiScores] = useState<Record<string, number>>({});
  const [results, setResults] = useState<ParticipantResult[]>([]);
  const [loaded, setLoaded] = useState(false);

  const recompute = (cfg: JudgingConfig, ai: Record<string, number>, st: ResultSettings) => {
    setResults(buildResults({ config: cfg, aiScores: ai, settings: st }));
  };

  useEffect(() => {
    (async () => {
      const cfg = loadConfig();
      setConfig(cfg);
      const st = loadResultSettings();
      setSettings(st);
      let ai: Record<string, number> = {};
      try {
        const recs = await listRecordings();
        // 참가자별 최신 AI 평가 점수
        for (const r of recs) {
          if (r.evaluation && r.participantNumber) ai[r.participantNumber] = r.evaluation.totalScore;
        }
      } catch { /* IndexedDB 미지원 */ }
      setAiScores(ai);
      recompute(cfg, ai, st);
      setLoaded(true);
    })();
  }, []);

  if (!loaded || !config) return null;

  if (config.judges.length === 0 || config.participants.length === 0) {
    return (
      <main className="page" style={{ justifyContent: "center", minHeight: "80vh" }}>
        <h1 className="contest-title">결과 집계 (Results)</h1>
        <div className="card" style={{ maxWidth: 520, textAlign: "center" }}>
          <p style={{ lineHeight: 1.9 }}>
            먼저 <Link href="/admin/judging" style={{ color: "var(--cyan)" }}>심사 설정</Link>에서
            심사위원·참가자를 등록하고 채점을 받아주세요.
          </p>
        </div>
        <Link href="/admin" className="home-link">← 관리자 홈 (Admin)</Link>
      </main>
    );
  }

  const update = (patch: Partial<ResultSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveResultSettings(next);
    recompute(config, aiScores, next);
  };

  const togglePublish = () => {
    const next = { ...settings, published: !settings.published };
    setSettings(next);
    saveResultSettings(next);
    addAudit(next.published ? "점수 공개" : "점수 비공개 전환", `발표 화면 노출 ${next.published ? "ON" : "OFF"}`);
  };

  // 동점 처리용 후보 항목 (현재 루브릭에 쓰인 항목들)
  const usedCriteria = Array.from(
    new Set(Object.values(config.rubrics).flat().map((i) => i.criterionId)),
  ).map((id) => CRITERIA_CATALOG.find((c) => c.id === id)).filter(Boolean);

  const ranked = [...results].sort((a, b) => {
    if (a.rank === null) return 1;
    if (b.rank === null) return -1;
    return a.rank - b.rank;
  });

  const fmt = (v: number | null) => (v === null ? "–" : v.toFixed(1));

  return (
    <main className="page">
      <div className="topbar">
        <Link href="/admin" className="home-link">← 관리자 홈 (Admin)</Link>
        <Link href="/admin/progress" className="home-link">심사 진행 현황 (Progress) →</Link>
      </div>
      <h1 className="contest-title">결과 집계·공개 (Results)</h1>

      {/* 공개 상태 */}
      <div className="card" style={{ width: "100%", maxWidth: 860 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>점수 공개 (Publish)</h2>
            <p style={{ fontSize: 13, color: "var(--text-dim)" }}>
              {settings.published
                ? "🟢 공개됨 — 발표 화면에 순위가 표시됩니다. (Published — shown on display screen)"
                : "🔒 비공개 — 관리자만 볼 수 있습니다. (Private — admin only)"}
            </p>
          </div>
          <button
            className="btn"
            style={settings.published ? { background: "rgba(255,107,107,0.15)", borderColor: "var(--danger)", color: "var(--danger)" } : {}}
            onClick={togglePublish}
          >
            {settings.published ? "비공개로 전환 (Unpublish)" : "🏆 결과 공개 (Publish)"}
          </button>
        </div>
      </div>

      {/* 집계 옵션 */}
      <div className="card" style={{ width: "100%", maxWidth: 860 }}>
        <h2>집계 방식 (Aggregation)</h2>
        <label style={{ display: "block", marginTop: 12, fontSize: 14 }}>
          심사위원 편차 보정 (Judge deviation correction)
          <select
            value={settings.deviationMethod}
            onChange={(e) => update({ deviationMethod: e.target.value as DeviationMethod })}
            style={{ display: "block", width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 10, fontSize: 14,
              border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--text)" }}
          >
            {(Object.keys(DEV_LABELS) as DeviationMethod[]).map((m) => (
              <option key={m} value={m}>{DEV_LABELS[m]}</option>
            ))}
          </select>
        </label>

        <div style={{ marginTop: 16, fontSize: 14 }}>
          <p>동점 처리 우선순위 (Tie-breakers) — 클릭 순서대로 적용</p>
          <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
            최종 점수가 같을 때, 아래 선택한 항목의 점수가 높은 참가자를 우선합니다.
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {usedCriteria.map((c) => {
              const idx = settings.tieBreakers.indexOf(c!.id);
              return (
                <button
                  key={c!.id}
                  className={idx >= 0 ? "btn" : "btn ghost"}
                  style={{ padding: "6px 12px", fontSize: 13 }}
                  onClick={() => {
                    const next = idx >= 0
                      ? settings.tieBreakers.filter((x) => x !== c!.id)
                      : [...settings.tieBreakers, c!.id];
                    update({ tieBreakers: next });
                  }}
                >
                  {idx >= 0 ? `${idx + 1}. ` : ""}{c!.name}
                </button>
              );
            })}
          </div>
        </div>

        <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 16 }}>
          AI : 심사위원 반영 비율 = <strong style={{ color: "var(--cyan)" }}>{config.aiWeight}% : {100 - config.aiWeight}%</strong>
          {" "}(<Link href="/admin/judging" style={{ color: "var(--cyan)" }}>심사 설정</Link>에서 변경)
        </p>
      </div>

      {/* 결과 표 */}
      <div className="card" style={{ width: "100%", maxWidth: 860, overflowX: "auto" }}>
        <h2>최종 결과 (Final Ranking)</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginTop: 12 }}>
          <thead>
            <tr>
              {["순위 (Rank)", "참가번호 (No.)", "유형 (Task)", "심사위원 (Judges)", "AI", "최종 (Final)"].map((h) => (
                <th key={h} style={{ padding: "8px 10px", color: "var(--text-dim)", borderBottom: "1px solid var(--border)", textAlign: h.startsWith("참가") ? "left" : "center", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ranked.map((r) => (
              <tr key={r.participantNumber}>
                <td style={{ padding: "10px", textAlign: "center", borderBottom: "1px solid var(--border)", fontWeight: 700, color: r.rank && r.rank <= 3 ? "var(--cyan)" : "var(--text)" }}>
                  {r.rank ? (r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank) : "–"}
                </td>
                <td style={{ padding: "10px", fontWeight: 600, borderBottom: "1px solid var(--border)" }}>{r.participantNumber}번</td>
                <td style={{ padding: "10px", textAlign: "center", borderBottom: "1px solid var(--border)", fontSize: 12, color: "var(--text-dim)" }}>
                  {r.taskType ? taskTypeLabel(r.taskType).split(" ")[0] : "–"}
                </td>
                <td style={{ padding: "10px", textAlign: "center", borderBottom: "1px solid var(--border)" }} title={r.perJudge.map((p) => `${p.judgeName}: ${p.score}`).join("\n")}>
                  {fmt(r.judgeAvg)} <span style={{ color: "var(--text-dim)", fontSize: 12 }}>({r.judgeCount}명)</span>
                </td>
                <td style={{ padding: "10px", textAlign: "center", borderBottom: "1px solid var(--border)", color: "var(--text-dim)" }}>{fmt(r.aiScore)}</td>
                <td style={{ padding: "10px", textAlign: "center", borderBottom: "1px solid var(--border)", fontWeight: 700, color: "var(--cyan)" }}>{fmt(r.finalScore)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 10 }}>
          심사위원 칸에 마우스를 올리면 개별 점수가 보입니다. 미채점 참가자는 순위에서 제외됩니다.
        </p>
      </div>
    </main>
  );
}
