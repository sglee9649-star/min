"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PassGate from "@/components/PassGate";
import { CRITERIA_CATALOG } from "@/lib/criteria";
import { loadConfig, loadScores, clearScores } from "@/lib/judging";
import { listRecordings, deleteRecording } from "@/lib/recordings";
import { buildResults, loadAudit, addAudit, clearAudit, loadResultSettings, type AuditEntry } from "@/lib/results";

// 6단계: 데이터 관리 — CSV 다운로드, 데이터 삭제, 감사 로그, 보관 안내.
export default function DataPage() {
  return (
    <PassGate role="admin" title="데이터 관리">
      <DataInner />
    </PassGate>
  );
}

function download(filename: string, text: string) {
  // 엑셀 한글 깨짐 방지: BOM 추가
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function DataInner() {
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [recCount, setRecCount] = useState(0);
  const [scoreCount, setScoreCount] = useState(0);

  const refresh = async () => {
    setAudit(loadAudit());
    setScoreCount(loadScores().length);
    try {
      setRecCount((await listRecordings()).length);
    } catch { /* IndexedDB 미지원 */ }
  };

  useEffect(() => {
    refresh();
  }, []);

  // 최종 결과 CSV (순위·참가번호·심사위원평균·AI·최종)
  const exportResults = async () => {
    const config = loadConfig();
    const ai: Record<string, number> = {};
    try {
      for (const r of await listRecordings()) {
        if (r.evaluation && r.participantNumber) ai[r.participantNumber] = r.evaluation.totalScore;
      }
    } catch { /* skip */ }
    const results = buildResults({ config, aiScores: ai, settings: loadResultSettings() })
      .filter((r) => r.finalScore !== null)
      .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));

    const header = ["순위", "참가번호", "심사위원평균", "AI점수", "최종점수", ...config.judges.map((j) => j.name)];
    const rows = results.map((r) => {
      const perJudge = config.judges.map((j) => r.perJudge.find((p) => p.judgeName === j.name)?.score ?? "");
      return [r.rank ?? "", r.participantNumber, r.judgeAvg ?? "", r.aiScore ?? "", r.finalScore ?? "", ...perJudge];
    });
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    download(`대회결과_${new Date().toISOString().slice(0, 10)}.csv`, csv);
    addAudit("CSV 내보내기", "최종 결과");
    setAudit(loadAudit());
  };

  // 심사위원 상세 점수 CSV (항목별 원점수)
  const exportDetailed = () => {
    const config = loadConfig();
    const scores = loadScores();
    const critName = (id: string) => CRITERIA_CATALOG.find((c) => c.id === id)?.name ?? id;
    const rows: string[][] = [["참가번호", "심사위원", "과제유형", "항목", "점수(0-5)", "코멘트", "제출시각"]];
    for (const s of scores) {
      for (const [cid, val] of Object.entries(s.scores)) {
        rows.push([s.participantNumber, s.judgeName, s.taskType, critName(cid), String(val), s.comment, new Date(s.submittedAt).toLocaleString("ko-KR")]);
      }
    }
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    download(`심사상세_${new Date().toISOString().slice(0, 10)}.csv`, csv);
    addAudit("CSV 내보내기", "심사위원 상세 점수");
    setAudit(loadAudit());
  };

  const deleteScores = () => {
    if (!confirm("모든 심사위원 채점 데이터를 삭제할까요? 되돌릴 수 없습니다.\n(Delete all judge scores? This cannot be undone.)")) return;
    clearScores();
    addAudit("데이터 삭제", "심사위원 채점 전체");
    refresh();
  };

  const deleteRecordings = async () => {
    if (!confirm("이 기기에 저장된 모든 녹음을 삭제할까요? 되돌릴 수 없습니다.\n(Delete all recordings on this device?)")) return;
    try {
      for (const r of await listRecordings()) await deleteRecording(r.id);
    } catch { /* skip */ }
    addAudit("데이터 삭제", "녹음 전체 (이 기기)");
    refresh();
  };

  return (
    <main className="page">
      <div className="topbar">
        <Link href="/admin" className="home-link">← 관리자 홈 (Admin)</Link>
        <button className="btn ghost" style={{ padding: "6px 12px", fontSize: 13 }} onClick={refresh}>새로고침 (Refresh)</button>
      </div>
      <h1 className="contest-title">데이터 관리 (Data)</h1>

      {/* 내보내기 */}
      <div className="card" style={{ width: "100%", maxWidth: 860 }}>
        <h2>엑셀(CSV) 다운로드 (Export)</h2>
        <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 6 }}>
          엑셀에서 바로 열립니다. 최종 결과표와, 심사위원별 항목 점수 상세를 각각 받을 수 있습니다.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button className="btn" onClick={exportResults}>📊 최종 결과표 (Final results)</button>
          <button className="btn ghost" onClick={exportDetailed}>📋 심사 상세 점수 (Detailed scores)</button>
        </div>
      </div>

      {/* 보관 안내 */}
      <div className="card" style={{ width: "100%", maxWidth: 860 }}>
        <h2>녹음 보관 안내 (Recording Retention)</h2>
        <p style={{ fontSize: 14, lineHeight: 1.8, marginTop: 6 }}>
          미성년자 음성은 민감 개인정보입니다. 학부모 동의를 받고, 대회 후 정해진 기간(예: 6개월) 안에 파기하세요.
        </p>
        <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 6, lineHeight: 1.7 }}>
          현재 녹음은 이 기기에만 저장됩니다({recCount}건). 자동 파기 예약은 서버(Supabase) 도입 후 제공됩니다.
          지금은 대회가 끝나면 아래에서 직접 삭제하세요.
        </p>
      </div>

      {/* 삭제 */}
      <div className="card" style={{ width: "100%", maxWidth: 860, borderColor: "rgba(255,107,107,0.4)" }}>
        <h2 style={{ color: "var(--danger)" }}>데이터 삭제 (Delete) — 주의</h2>
        <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 6 }}>
          되돌릴 수 없습니다. 삭제 전 반드시 CSV로 백업하세요.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button className="btn ghost" style={{ color: "var(--danger)", borderColor: "rgba(255,107,107,0.4)" }} onClick={deleteScores}>
            채점 데이터 삭제 ({scoreCount}건)
          </button>
          <button className="btn ghost" style={{ color: "var(--danger)", borderColor: "rgba(255,107,107,0.4)" }} onClick={deleteRecordings}>
            녹음 전체 삭제 ({recCount}건)
          </button>
        </div>
      </div>

      {/* 감사 로그 */}
      <div className="card" style={{ width: "100%", maxWidth: 860 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>감사 로그 (Audit Log)</h2>
          {audit.length > 0 && (
            <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 12 }}
              onClick={() => { if (confirm("감사 로그를 지울까요?")) { clearAudit(); setAudit([]); } }}>
              로그 지우기
            </button>
          )}
        </div>
        <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 6 }}>
          점수 공개 전환, CSV 내보내기, 데이터 삭제 이력이 기록됩니다 (이 기기 기준).
        </p>
        {audit.length === 0 ? (
          <p style={{ marginTop: 10, color: "var(--text-dim)" }}>기록이 없습니다.</p>
        ) : (
          <div style={{ marginTop: 10 }}>
            {audit.map((a, i) => (
              <p key={i} style={{ fontSize: 13, lineHeight: 1.9, borderBottom: "1px solid var(--border)", paddingBottom: 4 }}>
                <span style={{ color: "var(--text-dim)" }}>{new Date(a.at).toLocaleString("ko-KR")}</span>{" · "}
                <strong style={{ color: "var(--cyan)" }}>{a.action}</strong> — {a.detail}
              </p>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
