"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PassGate from "@/components/PassGate";
import { CRITERIA_CATALOG, TASK_TYPE_LABELS } from "@/lib/criteria";
import { loadProblems } from "@/lib/problems";
import {
  deleteRecording, listRecordings, updateRecording,
  type AiEvaluation, type RecordingEntry,
} from "@/lib/recordings";

// 녹음 관리 (3~4단계): 이 기기에 저장된 녹음 확인 + AI 평가(전사 → 루브릭 채점).
// 녹음은 로컬 우선 저장이므로, 참가자가 녹음한 그 기기에서 열어야 보인다.
export default function RecordingsPage() {
  return (
    <PassGate role="admin" title="녹음 관리">
      <RecordingsInner />
    </PassGate>
  );
}

type EvalStatus = "transcribing" | "evaluating";

function RecordingsInner() {
  const [recordings, setRecordings] = useState<RecordingEntry[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<Record<string, EvalStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const refresh = async () => {
    const all = await listRecordings();
    setRecordings(all);
    setUrls((prev) => {
      Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
      const next: Record<string, string> = {};
      for (const r of all) next[r.id] = URL.createObjectURL(r.blob);
      return next;
    });
    setLoaded(true);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ext = (mime: string) => (mime.includes("mp4") ? "m4a" : "webm");

  // 문제 내용 찾기: 녹음에 동봉된 내용 우선, 없으면(구버전 녹음) 보관함에서 검색
  const problemContentFor = (r: RecordingEntry) => {
    if (r.problemPassage) {
      return { passage: r.problemPassage, keyPoints: r.problemKeyPoints ?? [], questions: r.problemQuestions ?? [] };
    }
    const p = loadProblems().find((x) => x.id === r.problemId);
    if (p) return { passage: p.passage, keyPoints: p.keyPoints, questions: p.questions };
    return null;
  };

  const evaluate = async (r: RecordingEntry) => {
    setErrors((e) => ({ ...e, [r.id]: "" }));
    const content = problemContentFor(r);
    if (!content) {
      setErrors((e) => ({ ...e, [r.id]: "이 녹음의 문제 내용을 찾을 수 없어 평가할 수 없습니다. (구버전 녹음) 새로 녹음해주세요." }));
      return;
    }
    try {
      // 1) 전사 (이미 했으면 재사용)
      let transcript = r.transcript;
      if (!transcript) {
        setStatus((s) => ({ ...s, [r.id]: "transcribing" }));
        const fd = new FormData();
        fd.append("file", r.blob, `recording.${ext(r.mimeType)}`);
        const res = await fetch("/api/transcribe", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "음성 인식에 실패했습니다.");
        transcript = data.text as string;
        if (!transcript.trim()) throw new Error("음성에서 인식된 말이 없습니다. 녹음을 재생해 목소리가 담겼는지 확인해주세요.");
        await updateRecording(r.id, { transcript });
      }

      // 2) 채점
      setStatus((s) => ({ ...s, [r.id]: "evaluating" }));
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType: r.taskType,
          transcript,
          passage: content.passage,
          keyPoints: content.keyPoints,
          questions: content.questions,
          durationSec: r.durationSec,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "채점에 실패했습니다.");
      await updateRecording(r.id, { evaluation: data.evaluation as AiEvaluation });
      await refresh();
    } catch (e) {
      setErrors((err) => ({ ...err, [r.id]: e instanceof Error ? e.message : "평가에 실패했습니다." }));
    } finally {
      setStatus((s) => {
        const next = { ...s };
        delete next[r.id];
        return next;
      });
    }
  };

  const criterionName = (id: string) => CRITERIA_CATALOG.find((c) => c.id === id)?.name ?? id;

  return (
    <main className="page">
      <div className="topbar">
        <Link href="/admin" className="home-link">← 관리자 홈</Link>
        <button className="btn ghost" onClick={refresh}>새로고침</button>
      </div>
      <h1 className="contest-title">녹음 관리</h1>
      <p className="note">
        녹음은 참가자가 사용한 기기에 먼저 저장됩니다. 여기에는 <strong>이 기기</strong>에 저장된 녹음만 보입니다.
        <br />🤖 <strong>AI 평가</strong>는 녹음을 글로 옮긴 뒤(전사) 내용·언어 항목을 채점합니다.
        발음·억양처럼 소리로 판단하는 항목은 심사위원이 채점합니다(5단계). AI 점수는 참고용입니다.
      </p>

      {loaded && recordings.length === 0 && (
        <div className="card" style={{ maxWidth: 560, textAlign: "center" }}>
          <p>저장된 녹음이 없습니다. 참가자 화면에서 녹음을 해보세요.</p>
        </div>
      )}

      {recordings.map((r) => (
        <div key={r.id} className="card" style={{ width: "100%", maxWidth: 860 }}>
          <p>
            <strong>참가번호 {r.participantNumber}번</strong>{" "}
            <span className="badge">{TASK_TYPE_LABELS[r.taskType]}</span>{" "}
            <span className="badge">{r.attempt}번째 시도</span>
            {r.retryReason && <span className="badge soon">재녹음 사유: {r.retryReason}</span>}
            {r.evaluation && <span className="badge">AI {r.evaluation.totalScore}점</span>}
          </p>
          <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 6 }}>
            {r.problemTitle} · {r.durationSec}초 · {new Date(r.createdAt).toLocaleString("ko-KR")}
          </p>
          {urls[r.id] && (
            <audio controls src={urls[r.id]} style={{ width: "100%", marginTop: 10 }} />
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button
              className="btn"
              style={{ padding: "6px 14px", fontSize: 13 }}
              disabled={!!status[r.id]}
              onClick={() => evaluate(r)}
            >
              {status[r.id] === "transcribing" ? "전사 중…"
                : status[r.id] === "evaluating" ? "채점 중…"
                : r.evaluation ? "🤖 다시 평가" : "🤖 AI 평가하기"}
            </button>
            {urls[r.id] && (
              <a
                className="btn ghost"
                style={{ padding: "6px 12px", fontSize: 13 }}
                href={urls[r.id]}
                download={`${r.participantNumber}번_${r.attempt}차_${r.problemTitle}.${ext(r.mimeType)}`}
              >
                다운로드
              </a>
            )}
            <button
              className="btn ghost"
              style={{ padding: "6px 12px", fontSize: 13 }}
              onClick={async () => {
                if (confirm(`참가번호 ${r.participantNumber}번의 녹음을 삭제할까요?`)) {
                  await deleteRecording(r.id);
                  refresh();
                }
              }}
            >
              삭제
            </button>
          </div>
          {errors[r.id] && <p className="error" style={{ marginTop: 8 }}>{errors[r.id]}</p>}

          {r.transcript && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer", color: "var(--cyan)", fontSize: 14 }}>전사본 보기 (학생이 말한 내용)</summary>
              <p style={{ marginTop: 8, lineHeight: 1.8, fontSize: 14, color: "var(--text-dim)" }}>{r.transcript}</p>
            </details>
          )}

          {r.evaluation && (
            <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <p style={{ fontSize: 15 }}>
                <strong style={{ color: "var(--cyan)", fontSize: 22 }}>{r.evaluation.totalScore}점</strong>
                <span style={{ color: "var(--text-dim)", fontSize: 12 }}> / 100 · AI 참고 점수 (내용·언어 항목 평균)</span>
              </p>
              {r.evaluation.scores.map((s) => (
                <div key={s.criterionId} style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 14 }}>
                    <strong>{criterionName(s.criterionId)}</strong>{" "}
                    <span style={{ color: "var(--cyan)" }}>{s.score}/5</span>
                  </p>
                  <p style={{ fontSize: 13, color: "var(--text-dim)", fontStyle: "italic", marginTop: 3 }}>
                    근거: “{s.evidence}”
                  </p>
                  <p style={{ fontSize: 13, marginTop: 3, lineHeight: 1.7 }}>{s.comment}</p>
                </div>
              ))}
              <div style={{ marginTop: 14, background: "rgba(77,216,255,0.06)", borderRadius: 10, padding: "12px 14px" }}>
                <p style={{ fontSize: 13, color: "var(--cyan)", marginBottom: 6 }}>총평</p>
                <p style={{ fontSize: 14, lineHeight: 1.8 }}>{r.evaluation.overallComment}</p>
              </div>
            </div>
          )}
        </div>
      ))}
    </main>
  );
}
