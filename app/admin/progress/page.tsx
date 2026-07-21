"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PassGate from "@/components/PassGate";
import { hasConfig, loadConfig, loadScores, upsertScores, type JudgeScore, type JudgingConfig } from "@/lib/judging";
import { listRecordings } from "@/lib/recordings";
import { parseHashPayload } from "@/lib/share";

// 5단계: 채점 진행률 대시보드 — 누가 누구를 아직 안 냈는지 한눈에.
// 심사위원이 보낸 "채점 결과 링크"를 이 페이지에서 열면 점수가 자동으로 반영된다.
export default function ProgressPage() {
  return (
    <PassGate role="admin" title="심사 진행 현황">
      <ProgressInner />
    </PassGate>
  );
}

function ProgressInner() {
  const [config, setConfig] = useState<JudgingConfig | null>(null);
  const [scores, setScores] = useState<JudgeScore[]>([]);
  const [aiDone, setAiDone] = useState<Set<string>>(new Set());
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = async () => {
    if (hasConfig()) setConfig(loadConfig());
    setScores(loadScores());
    // 이 기기에서 AI 평가가 끝난 참가번호
    try {
      const recs = await listRecordings();
      setAiDone(new Set(recs.filter((r) => r.evaluation).map((r) => r.participantNumber)));
    } catch { /* IndexedDB 미지원 등 */ }
    setLoaded(true);
  };

  useEffect(() => {
    (async () => {
      // 심사위원이 보낸 채점 결과 링크(#s=) 처리
      const payload = await parseHashPayload<{ scores: JudgeScore[] }>("s", window.location.hash);
      if (payload?.scores?.length) {
        upsertScores(payload.scores);
        setImportedCount(payload.scores.length);
        // 해시 제거 (새로고침 시 중복 안내 방지)
        history.replaceState(null, "", window.location.pathname);
      }
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded) return null;

  if (!config || config.judges.length === 0 || config.participants.length === 0) {
    return (
      <main className="page" style={{ justifyContent: "center", minHeight: "80vh" }}>
        <h1 className="contest-title">심사 진행 현황</h1>
        <div className="card" style={{ maxWidth: 520, textAlign: "center" }}>
          <p style={{ lineHeight: 1.9 }}>
            먼저 <Link href="/admin/judging" style={{ color: "var(--cyan)" }}>심사 설정</Link>에서
            심사위원과 참가자 명단을 저장해주세요.
          </p>
        </div>
        <Link href="/admin" className="home-link">← 관리자 홈</Link>
      </main>
    );
  }

  const scoreOf = (judgeId: string, num: string) =>
    scores.find((s) => s.judgeId === judgeId && s.participantNumber === num);

  const totalCells = config.judges.length * config.participants.length;
  const doneCells = config.participants.reduce(
    (sum, num) => sum + config.judges.filter((j) => scoreOf(j.id, num)).length,
    0,
  );

  // 항목 평균(0~5)을 100점으로 환산해 표시 (가중치 반영 집계는 6단계)
  const avg100 = (s: JudgeScore) => {
    const vals = Object.values(s.scores);
    if (vals.length === 0) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / (vals.length * 5)) * 100);
  };

  return (
    <main className="page">
      <div className="topbar">
        <Link href="/admin" className="home-link">← 관리자 홈</Link>
        <button className="btn ghost" style={{ padding: "6px 12px", fontSize: 13 }} onClick={refresh}>새로고침</button>
      </div>
      <h1 className="contest-title">심사 진행 현황</h1>
      <p className="subtitle">{doneCells}/{totalCells} 제출 완료 ({Math.round((doneCells / Math.max(1, totalCells)) * 100)}%)</p>

      {importedCount !== null && (
        <p className="note" style={{ borderColor: "var(--cyan)", color: "var(--text)" }}>
          ✅ 심사위원이 보낸 채점 결과 {importedCount}건이 반영되었습니다.
        </p>
      )}

      <p className="note">
        심사위원 태블릿의 &quot;채점 결과 보내기&quot; 링크를 이 기기에서 열면 표에 자동 반영됩니다.
        점수 숫자는 항목 평균의 100점 환산(참고용)이며, 가중치·AI 비율을 반영한 최종 집계는 6단계에서 제공됩니다.
      </p>

      <div className="card" style={{ width: "100%", maxWidth: 860, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "8px 10px", color: "var(--text-dim)", borderBottom: "1px solid var(--border)" }}>참가번호</th>
              {config.judges.map((j) => (
                <th key={j.id} style={{ padding: "8px 10px", color: "var(--text-dim)", borderBottom: "1px solid var(--border)" }}>{j.name}</th>
              ))}
              <th style={{ padding: "8px 10px", color: "var(--text-dim)", borderBottom: "1px solid var(--border)" }}>AI 평가</th>
            </tr>
          </thead>
          <tbody>
            {config.participants.map((num) => (
              <tr key={num}>
                <td style={{ padding: "10px", fontWeight: 600, borderBottom: "1px solid var(--border)" }}>{num}번</td>
                {config.judges.map((j) => {
                  const s = scoreOf(j.id, num);
                  return (
                    <td key={j.id} style={{ padding: "10px", textAlign: "center", borderBottom: "1px solid var(--border)" }}>
                      {s ? (
                        <span style={{ color: "var(--cyan)", fontWeight: 600 }} title={s.comment || undefined}>
                          {avg100(s) ?? "✓"}
                        </span>
                      ) : (
                        <span style={{ color: "var(--danger)", opacity: 0.7 }}>미제출</span>
                      )}
                    </td>
                  );
                })}
                <td style={{ padding: "10px", textAlign: "center", borderBottom: "1px solid var(--border)" }}>
                  {aiDone.has(num) ? <span style={{ color: "var(--cyan)" }}>✓</span> : <span style={{ color: "var(--text-dim)" }}>–</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ width: "100%", maxWidth: 860 }}>
        <h2 style={{ fontSize: 16 }}>심사위원별 진행</h2>
        {config.judges.map((j) => {
          const done = config.participants.filter((num) => scoreOf(j.id, num)).length;
          return (
            <p key={j.id} style={{ marginTop: 8, fontSize: 14 }}>
              👤 {j.name} — <span style={{ color: done === config.participants.length ? "var(--cyan)" : "var(--text)" }}>
                {done}/{config.participants.length}명
              </span>
              {done < config.participants.length && (
                <span style={{ color: "var(--text-dim)", fontSize: 13 }}>
                  {" "}(미채점: {config.participants.filter((num) => !scoreOf(j.id, num)).join(", ")}번)
                </span>
              )}
            </p>
          );
        })}
      </div>
    </main>
  );
}
