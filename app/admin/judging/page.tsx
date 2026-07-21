"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import PassGate from "@/components/PassGate";
import { CRITERIA_CATALOG, GROUP_LABELS, TASK_TYPE_LABELS, criteriaForTask, type TaskType } from "@/lib/criteria";
import {
  defaultRubrics, loadConfig, saveConfig, rubricWeightSum,
  type JudgingConfig, type RubricItem,
} from "@/lib/judging";
import { loadAssignmentMap, loadProblems } from "@/lib/problems";
import { encodeHashPayload } from "@/lib/share";

// 5단계: 심사 설정 — 평가기준표(루브릭) 빌더, AI 반영 비율, 심사위원·참가자 명단.
// 구성 후 "심사 설정 링크"를 심사위원 태블릿으로 보내면 그 기기에서 채점할 수 있다.
export default function JudgingPage() {
  return (
    <PassGate role="admin" title="심사 설정">
      <JudgingInner />
    </PassGate>
  );
}

function JudgingInner() {
  const [config, setConfig] = useState<JudgingConfig | null>(null);
  const [taskTab, setTaskTab] = useState<TaskType>("retelling");
  const [newJudge, setNewJudge] = useState("");
  const [participantInput, setParticipantInput] = useState("");
  const [saved, setSaved] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareQr, setShareQr] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const c = loadConfig();
    setConfig(c);
    setParticipantInput(c.participants.join(", "));
  }, []);

  if (!config) return null;

  const update = (patch: Partial<JudgingConfig>) => {
    setConfig((c) => (c ? { ...c, ...patch } : c));
    setSaved(false);
    setShareUrl("");
    setError("");
  };

  const rubric = config.rubrics[taskTab];
  const catalog = criteriaForTask(taskTab);
  const sum = rubricWeightSum(rubric);

  const toggleItem = (criterionId: string) => {
    const exists = rubric.some((i) => i.criterionId === criterionId);
    const next = exists
      ? rubric.filter((i) => i.criterionId !== criterionId)
      : [...rubric, { criterionId, weight: 0 }];
    update({ rubrics: { ...config.rubrics, [taskTab]: next } });
  };

  const setWeight = (criterionId: string, weight: number) => {
    const next = rubric.map((i) => (i.criterionId === criterionId ? { ...i, weight } : i));
    update({ rubrics: { ...config.rubrics, [taskTab]: next } });
  };

  const equalize = () => {
    if (rubric.length === 0) return;
    const base = Math.floor(100 / rubric.length);
    const next: RubricItem[] = rubric.map((i, idx) => ({
      ...i,
      weight: base + (idx === 0 ? 100 - base * rubric.length : 0),
    }));
    update({ rubrics: { ...config.rubrics, [taskTab]: next } });
  };

  const loadAssignedParticipants = () => {
    const map = loadAssignmentMap();
    const numbers = Object.keys(map).sort((a, b) => Number(a) - Number(b));
    if (numbers.length === 0) {
      alert("배정된 참가번호가 없습니다. 문제 보관함에서 먼저 일괄 출제를 해주세요.");
      return;
    }
    setParticipantInput(numbers.join(", "));
    // 배정된 문제의 과제 유형도 함께 연결
    const bank = loadProblems();
    const taskTypes: Record<string, TaskType> = {};
    for (const [num, pid] of Object.entries(map)) {
      const p = bank.find((x) => x.id === pid);
      if (p) taskTypes[num] = p.taskType;
    }
    update({ participants: numbers, participantTaskTypes: taskTypes });
  };

  const save = () => {
    // 참가자 입력 반영
    const participants = participantInput.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    // 유형별 루브릭 합 검증 (항목이 있는 유형만)
    for (const t of Object.keys(config.rubrics) as TaskType[]) {
      const items = config.rubrics[t];
      if (items.length > 0 && rubricWeightSum(items) !== 100) {
        setError(`${TASK_TYPE_LABELS[t]} 평가기준표의 비중 합이 ${rubricWeightSum(items)}%입니다. 100%가 되도록 조정해주세요.`);
        setTaskTab(t);
        return;
      }
    }
    if (config.judges.length === 0) {
      setError("심사위원을 한 명 이상 추가해주세요.");
      return;
    }
    if (participants.length === 0) {
      setError("참가자 번호를 입력하거나 '배정된 번호 불러오기'를 눌러주세요.");
      return;
    }
    const next = { ...config, participants };
    setConfig(next);
    saveConfig(next);
    setSaved(true);
    setError("");
  };

  const makeShareLink = async () => {
    save();
    const c = loadConfig();
    if (c.judges.length === 0 || c.participants.length === 0) return;
    const hash = await encodeHashPayload("j", c);
    const url = `${window.location.origin}/judge${hash}`;
    setShareUrl(url);
    setShareQr(await QRCode.toDataURL(url, { errorCorrectionLevel: "L", margin: 1, width: 320 }));
    setCopied(false);
  };

  return (
    <main className="page">
      <div className="topbar">
        <Link href="/admin" className="home-link">← 관리자 홈</Link>
      </div>
      <h1 className="contest-title">심사 설정</h1>

      {/* ---------- 평가기준표 빌더 ---------- */}
      <div className="card" style={{ width: "100%", maxWidth: 860 }}>
        <h2>평가기준표 (루브릭)</h2>
        <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 6, lineHeight: 1.7 }}>
          과제 유형별로 평가항목을 선택하고 비중을 정합니다. 합이 100%가 되어야 합니다.
          <br />🤖 표시는 AI도 채점하는 항목, 👂 표시는 심사위원만 채점하는 항목(소리 기반)입니다.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {(Object.keys(TASK_TYPE_LABELS) as TaskType[]).map((t) => (
            <button key={t} type="button" className={taskTab === t ? "btn" : "btn ghost"} onClick={() => setTaskTab(t)}>
              {TASK_TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        {(["delivery", "language", "content", "readAloud", "interaction", "compliance"] as const)
          .filter((g) => catalog.some((c) => c.group === g))
          .map((g) => (
            <div key={g} style={{ marginTop: 16 }}>
              <p style={{ color: "var(--cyan)", fontSize: 13, letterSpacing: "0.08em" }}>{GROUP_LABELS[g]}</p>
              {catalog.filter((c) => c.group === g).map((c) => {
                const item = rubric.find((i) => i.criterionId === c.id);
                return (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 300px", cursor: "pointer" }}>
                      <input type="checkbox" checked={!!item} onChange={() => toggleItem(c.id)} style={{ width: "auto" }} />
                      <span style={{ fontSize: 14 }}>
                        {c.aiEvaluable ? "🤖" : "👂"} <strong>{c.name}</strong>
                        <span style={{ color: "var(--text-dim)", fontSize: 12 }}> — {c.description}</span>
                      </span>
                    </label>
                    {item && (
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={item.weight}
                          onChange={(e) => setWeight(c.id, Number(e.target.value))}
                          style={{
                            width: 70, padding: "6px 8px", borderRadius: 8, fontSize: 14, textAlign: "right",
                            border: "1px solid var(--border)", background: "rgba(8,14,28,0.8)", color: "var(--text)",
                          }}
                        />
                        <span style={{ fontSize: 13, color: "var(--text-dim)" }}>%</span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: sum === 100 ? "var(--cyan)" : "var(--danger)" }}>
            비중 합계: {sum}% {sum === 100 ? "✓" : "(100%가 되어야 합니다)"}
          </span>
          <button className="btn ghost" style={{ padding: "6px 12px", fontSize: 13 }} onClick={equalize}>
            균등 배분
          </button>
        </div>
      </div>

      {/* ---------- AI 반영 비율 ---------- */}
      <div className="card" style={{ width: "100%", maxWidth: 860 }}>
        <h2>AI 점수 반영 비율</h2>
        <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 6, lineHeight: 1.7 }}>
          최종 집계(6단계)에서 AI 점수를 몇 % 반영할지 정합니다. 나머지는 심사위원 점수입니다.
          AI 점수는 참고용이므로 50%를 넘지 않는 것을 권장합니다.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={config.aiWeight}
            onChange={(e) => update({ aiWeight: Number(e.target.value) })}
            style={{ flex: 1, accentColor: "#4dd8ff" }}
          />
          <span style={{ fontSize: 16, fontWeight: 600, color: "var(--cyan)", minWidth: 130, textAlign: "right" }}>
            AI {config.aiWeight}% : 심사위원 {100 - config.aiWeight}%
          </span>
        </div>
      </div>

      {/* ---------- 심사위원 ---------- */}
      <div className="card" style={{ width: "100%", maxWidth: 860 }}>
        <h2>심사위원 ({config.judges.length}명)</h2>
        {config.judges.map((j) => (
          <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
            <span style={{ fontSize: 15 }}>👤 {j.name}</span>
            <button
              className="btn ghost"
              style={{ padding: "4px 10px", fontSize: 12 }}
              onClick={() => update({ judges: config.judges.filter((x) => x.id !== j.id) })}
            >
              삭제
            </button>
          </div>
        ))}
        <form
          style={{ display: "flex", gap: 8, marginTop: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            const name = newJudge.trim();
            if (!name) return;
            update({ judges: [...config.judges, { id: crypto.randomUUID(), name }] });
            setNewJudge("");
          }}
        >
          <input
            value={newJudge}
            onChange={(e) => setNewJudge(e.target.value)}
            placeholder="심사위원 이름 (예: 김민수)"
            style={{
              flex: 1, maxWidth: 260, padding: "10px 14px", borderRadius: 10, fontSize: 15,
              border: "1px solid var(--border)", background: "rgba(8,14,28,0.8)", color: "var(--text)",
            }}
          />
          <button className="btn ghost" type="submit">+ 추가</button>
        </form>
      </div>

      {/* ---------- 참가자 ---------- */}
      <div className="card" style={{ width: "100%", maxWidth: 860 }}>
        <h2>참가자 명단 (참가번호)</h2>
        <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 6 }}>
          심사위원 화면에는 이름 없이 참가번호만 표시됩니다 (익명 심사).
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <input
            value={participantInput}
            onChange={(e) => { setParticipantInput(e.target.value); setSaved(false); }}
            placeholder="예: 1, 2, 3, 4, 5"
            style={{
              flex: 1, minWidth: 220, padding: "10px 14px", borderRadius: 10, fontSize: 15,
              border: "1px solid var(--border)", background: "rgba(8,14,28,0.8)", color: "var(--text)",
            }}
          />
          <button className="btn ghost" onClick={loadAssignedParticipants}>배정된 번호 불러오기</button>
        </div>
      </div>

      {/* ---------- 저장 + 공유 ---------- */}
      <div className="card" style={{ width: "100%", maxWidth: 860 }}>
        {error && <p className="error" style={{ marginBottom: 10 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn" onClick={save}>{saved ? "저장됨 ✓" : "저장"}</button>
          <button className="btn ghost" onClick={makeShareLink}>📤 심사 설정 링크 만들기 (심사위원 태블릿용)</button>
          <button
            className="btn ghost"
            onClick={() => {
              if (confirm("평가기준표를 기본값(균등 배분)으로 되돌릴까요?")) {
                update({ rubrics: defaultRubrics() });
              }
            }}
          >
            기준표 초기화
          </button>
        </div>
        {shareUrl && (
          <div style={{ marginTop: 16, textAlign: "center" }}>
            <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 10 }}>
              심사위원 태블릿에서 이 QR을 찍거나 링크를 열면, 설정이 적용된 채점 화면이 열립니다.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shareQr} alt="심사 설정 QR" style={{ width: 280, maxWidth: "100%", borderRadius: 12, background: "#fff", padding: 8 }} />
            <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "center" }}>
              <button
                className="btn ghost"
                style={{ padding: "6px 12px", fontSize: 13 }}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    setCopied(true);
                  } catch { /* 클립보드 미지원 */ }
                }}
              >
                {copied ? "복사됨 ✓" : "링크 복사"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
