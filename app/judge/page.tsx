"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PassGate from "@/components/PassGate";
import { CRITERIA_CATALOG, TASK_TYPE_LABELS, taskTypeLabel, type TaskType } from "@/lib/criteria";
import {
  hasConfig, loadConfig, saveConfig, loadScores, upsertScores,
  type JudgingConfig, type JudgeScore,
} from "@/lib/judging";
import { encodeHashPayload, parseHashPayload } from "@/lib/share";

// 심사위원 모드 (5단계): 배정된 참가자를 참가번호로만 보고(익명), 루브릭대로 채점한다.
// 현장 직접 채점 중심. 점수는 이 기기에 저장되고 "채점 결과 보내기" 링크로 관리자에게 전달한다.
// 자기 점수만 볼 수 있다 — 다른 심사위원 점수는 이 기기에 존재하지 않는다.
export default function JudgePage() {
  return (
    <PassGate role="judge" title="심사위원 모드">
      <JudgeInner />
    </PassGate>
  );
}

function JudgeInner() {
  const [config, setConfig] = useState<JudgingConfig | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [judgeId, setJudgeId] = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(null); // 채점 중인 참가번호
  const [taskType, setTaskType] = useState<TaskType>("retelling");
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [myScores, setMyScores] = useState<JudgeScore[]>([]);
  const [sendUrl, setSendUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      // 관리자가 보낸 심사 설정 링크(#j=)로 열었으면 설정을 이 기기에 저장
      const imported = await parseHashPayload<JudgingConfig>("j", window.location.hash);
      if (imported?.judges?.length && imported?.participants?.length) {
        saveConfig(imported);
      }
      if (hasConfig()) setConfig(loadConfig());
      const savedSelf = sessionStorage.getItem("judge:self");
      if (savedSelf) setJudgeId(savedSelf);
      setConfigLoaded(true);
    })();
  }, []);

  const refreshMyScores = (jid: string) => {
    setMyScores(loadScores().filter((s) => s.judgeId === jid));
  };

  useEffect(() => {
    if (judgeId) refreshMyScores(judgeId);
  }, [judgeId]);

  // ---------- 설정 없음 ----------
  if (configLoaded && !config) {
    return (
      <main className="page" style={{ justifyContent: "center", minHeight: "80vh" }}>
        <h1 className="contest-title">심사위원 모드 (Judge Mode)</h1>
        <div className="card" style={{ maxWidth: 520, textAlign: "center" }}>
          <p style={{ lineHeight: 1.9 }}>
            아직 심사 설정이 없습니다.
            <br />관리자에게 <strong style={{ color: "var(--cyan)" }}>심사 설정 링크(QR)</strong>를 받아
            이 기기에서 한 번 열어주세요.
          </p>
          <p style={{ marginTop: 8, fontSize: 13, color: "var(--text-dim)", lineHeight: 1.7 }}>
            No judging setup yet. Please open the setup link (QR) from your administrator once on this device.
          </p>
        </div>
        <Link href="/" className="home-link">← 처음으로 (Home)</Link>
      </main>
    );
  }
  if (!config) return null;

  const judge = config.judges.find((j) => j.id === judgeId) ?? null;

  // ---------- 본인 선택 ----------
  if (!judge) {
    return (
      <main className="page" style={{ justifyContent: "center", minHeight: "80vh" }}>
        <h1 className="contest-title">심사위원 모드 (Judge Mode)</h1>
        <p className="subtitle">본인 이름을 선택하세요 (Select your name)</p>
        <div className="role-grid" style={{ maxWidth: 560 }}>
          {config.judges.map((j) => (
            <button
              key={j.id}
              className="card"
              style={{ cursor: "pointer", textAlign: "center", border: "1px solid var(--border)" }}
              onClick={() => {
                sessionStorage.setItem("judge:self", j.id);
                setJudgeId(j.id);
              }}
            >
              <span className="icon">👤</span>
              <h2>{j.name}</h2>
            </button>
          ))}
        </div>
      </main>
    );
  }

  // ---------- 채점 화면 ----------
  if (current) {
    const rubric = config.rubrics[taskType] ?? [];
    const items = rubric
      .map((i) => ({ item: i, criterion: CRITERIA_CATALOG.find((c) => c.id === i.criterionId) }))
      .filter((x) => x.criterion);
    const allScored = items.every((x) => draft[x.item.criterionId] !== undefined);

    const submit = () => {
      upsertScores([{
        judgeId: judge.id,
        judgeName: judge.name,
        participantNumber: current,
        taskType,
        scores: draft,
        comment: comment.trim(),
        submittedAt: new Date().toISOString(),
      }]);
      refreshMyScores(judge.id);
      setCurrent(null);
    };

    return (
      <main className="page">
        <div className="topbar">
          <button className="btn ghost" style={{ padding: "6px 12px", fontSize: 13 }} onClick={() => setCurrent(null)}>
            ← 참가자 목록 (List)
          </button>
          <span style={{ fontSize: 13, color: "var(--text-dim)" }}>심사위원 (Judge): {judge.name}</span>
        </div>
        <h1 className="contest-title">참가번호 {current}번 (No. {current})</h1>
        <p className="subtitle">
          {taskTypeLabel(taskType)}
          {!config.participantTaskTypes[current] && " · 유형을 확인해주세요 (Confirm task type)"}
        </p>
        {!config.participantTaskTypes[current] && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(Object.keys(TASK_TYPE_LABELS) as TaskType[]).map((t) => (
              <button key={t} className={taskType === t ? "btn" : "btn ghost"} style={{ padding: "6px 14px", fontSize: 13 }}
                onClick={() => { setTaskType(t); setDraft({}); }}>
                {taskTypeLabel(t)}
              </button>
            ))}
          </div>
        )}

        <div className="card" style={{ width: "100%", maxWidth: 720 }}>
          {items.map(({ item, criterion }) => (
            <div key={item.criterionId} style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 15 }}>
                <strong>{criterion!.name} ({criterion!.nameEn})</strong>
                <span className="badge">{item.weight}%</span>
              </p>
              <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 3 }}>{criterion!.description}</p>
              <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2, fontStyle: "italic" }}>{criterion!.descriptionEn}</p>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={draft[item.criterionId] === n ? "btn" : "btn ghost"}
                    style={{ flex: 1, padding: "12px 0", fontSize: 17, fontWeight: 700 }}
                    onClick={() => setDraft((d) => ({ ...d, [item.criterionId]: n }))}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <label style={{ fontSize: 13, color: "var(--text-dim)" }}>
            코멘트 (Comment, 선택 / optional)
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              style={{
                width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 10, fontSize: 14,
                border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--text)",
                resize: "vertical", fontFamily: "inherit",
              }}
            />
          </label>

          <button
            className="btn"
            style={{ width: "100%", marginTop: 14, padding: "14px 0", fontSize: 16 }}
            disabled={!allScored}
            onClick={submit}
          >
            {allScored ? "채점 제출 (Submit)" : `모든 항목에 점수를 매겨주세요 · Score all items (${Object.keys(draft).length}/${items.length})`}
          </button>
        </div>
      </main>
    );
  }

  // ---------- 참가자 목록 ----------
  const scoredSet = new Set(myScores.map((s) => s.participantNumber));

  const makeSendLink = async () => {
    if (myScores.length === 0) {
      alert("아직 제출한 채점이 없습니다. (No scores submitted yet.)");
      return;
    }
    const hash = await encodeHashPayload("s", { scores: myScores });
    setSendUrl(`${window.location.origin}/admin/progress${hash}`);
    setCopied(false);
  };

  return (
    <main className="page">
      <div className="topbar">
        <Link href="/" className="home-link">← 처음으로 (Home)</Link>
        <button
          className="btn ghost"
          style={{ padding: "6px 12px", fontSize: 13 }}
          onClick={() => { sessionStorage.removeItem("judge:self"); setJudgeId(null); }}
        >
          심사위원 변경 (Change judge)
        </button>
      </div>
      <h1 className="contest-title">심사위원 모드 (Judge Mode)</h1>
      <p className="subtitle">{judge.name} · {scoredSet.size}/{config.participants.length}명 채점 완료 (scored)</p>
      <p className="note">
        참가자는 참가번호로만 표시됩니다. 발표를 보면서 번호를 눌러 채점하세요.
        <br />Participants are shown by number only (anonymous). Tap a number to score during the performance.
      </p>

      <div className="role-grid" style={{ maxWidth: 720 }}>
        {config.participants.map((num) => {
          const done = scoredSet.has(num);
          return (
            <button
              key={num}
              className="card"
              style={{
                cursor: "pointer", textAlign: "center",
                borderColor: done ? "rgba(77,216,255,0.5)" : "var(--border)",
              }}
              onClick={() => {
                const existing = myScores.find((s) => s.participantNumber === num);
                setTaskType(config.participantTaskTypes[num] ?? existing?.taskType ?? "retelling");
                setDraft(existing?.scores ?? {});
                setComment(existing?.comment ?? "");
                setCurrent(num);
              }}
            >
              <h2 style={{ fontSize: 26 }}>{num}번</h2>
              <p style={{ marginTop: 6, color: done ? "var(--cyan)" : "var(--text-dim)", fontSize: 13 }}>
                {done ? "채점 완료 ✓ (Done · 수정 가능)" : "미채점 (Not scored)"}
              </p>
            </button>
          );
        })}
      </div>

      <div className="card" style={{ width: "100%", maxWidth: 720, textAlign: "center" }}>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-dim)" }}>
          채점을 마쳤으면 결과를 관리자에게 보내주세요.
          <br />When finished, send your scores to the administrator.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="btn" onClick={makeSendLink}>📤 채점 결과 보내기 (Send scores)</button>
          {sendUrl && (
            <button
              className="btn ghost"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(sendUrl);
                  setCopied(true);
                } catch { /* 클립보드 미지원 */ }
              }}
            >
              {copied ? "복사됨 ✓ (Copied — send it)" : "링크 복사 (Copy link)"}
            </button>
          )}
        </div>
        {sendUrl && (
          <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 8 }}>
            복사한 링크를 관리자에게 보내면, 관리자가 열었을 때 점수가 집계에 반영됩니다.
            <br />Send the copied link to the administrator; scores are applied when they open it.
          </p>
        )}
      </div>
    </main>
  );
}
