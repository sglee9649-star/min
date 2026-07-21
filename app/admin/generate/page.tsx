"use client";

import Link from "next/link";
import { useState } from "react";
import PassGate from "@/components/PassGate";
import JarvisOrb from "@/components/JarvisOrb";
import { TASK_TYPE_LABELS, type TaskType } from "@/lib/criteria";
import { CATEGORIES, GRADE_LEVELS, PROFICIENCY_LEVELS } from "@/lib/levels";
import QRCode from "qrcode";
import {
  loadProblems, saveProblem, deleteProblem,
  setActiveProblem, clearActiveProblem, getActiveProblemId,
  loadAssignmentMap, saveAssignmentMap,
  type GeneratedProblem,
} from "@/lib/problems";
import { buildShareHash, buildAssignmentShareHash } from "@/lib/share";
import { loadSettings } from "@/lib/settings";

// 2단계: AI 문제 생성 + 출제 관리.
// - 한 번에 최대 10개 생성
// - 보관함에서 문제마다 참가번호를 배정하고 "일괄 출제" (한 문제에 여러 명 가능)
export default function GeneratePage() {
  return (
    <PassGate role="admin" title="문제 생성">
      <GenerateInner />
    </PassGate>
  );
}

interface GenResult {
  title: string;
  passage: string;
  passageKo: string;
  vocabulary: { word: string; meaning: string }[];
  questions: { question: string; sampleAnswer: string }[];
  keyPoints: string[];
}

function GenerateInner() {
  const [taskType, setTaskType] = useState<TaskType>("retelling");
  const [gradeId, setGradeId] = useState("e3");
  const [proficiencyId, setProficiencyId] = useState("");
  const [category, setCategory] = useState("animals");
  const [useKeywords, setUseKeywords] = useState(false);
  const [keywords, setKeywords] = useState("");
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<GenResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [bank, setBank] = useState<GeneratedProblem[]>([]);
  const [bankOpen, setBankOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [share, setShare] = useState<{ id: string; url: string; qr: string } | null>(null);
  const [copied, setCopied] = useState(false);
  // 참가번호 배정 입력값 (문제 id → "1, 2, 3" 형태)
  const [assignDrafts, setAssignDrafts] = useState<Record<string, string>>({});
  const [assignUrl, setAssignUrl] = useState("");
  const [assignCopied, setAssignCopied] = useState(false);

  const requestBody = () => ({
    taskType,
    gradeId,
    proficiencyId: proficiencyId || undefined,
    category: useKeywords ? undefined : category,
    keywords: useKeywords ? keywords : undefined,
  });

  const generateOne = async (): Promise<GenResult> => {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody()),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "생성에 실패했습니다.");
    return data.result as GenResult;
  };

  const toProblem = (r: GenResult): GeneratedProblem => ({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    taskType,
    gradeId,
    proficiencyId: proficiencyId || undefined,
    category: useKeywords ? undefined : category,
    keywords: useKeywords ? keywords : undefined,
    ...r,
  });

  const generate = async () => {
    setLoading(true);
    setError("");
    setNotice("");
    setResult(null);
    setSaved(false);
    try {
      if (count === 1) {
        setProgress({ done: 0, total: 1 });
        setResult(await generateOne());
      } else {
        // 여러 개: 5개씩 동시에 생성하고 전부 보관함에 자동 저장
        setProgress({ done: 0, total: count });
        let done = 0;
        let failed = 0;
        for (let i = 0; i < count; i += 5) {
          const n = Math.min(5, count - i);
          await Promise.all(
            Array.from({ length: n }, async () => {
              try {
                saveProblem(toProblem(await generateOne()));
              } catch {
                failed++;
              } finally {
                done++;
                setProgress({ done, total: count });
              }
            }),
          );
        }
        setBank(loadProblems());
        setActiveId(getActiveProblemId());
        setBankOpen(true);
        setNotice(`${count - failed}개가 생성되어 보관함에 저장되었습니다.${failed ? ` (${failed}개 실패 — 다시 시도해주세요)` : ""} 아래에서 참가번호를 배정하고 일괄 출제하세요.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const save = () => {
    if (!result) return;
    saveProblem(toProblem(result));
    setSaved(true);
  };

  const openBank = () => {
    const all = loadProblems();
    setBank(all);
    setActiveId(getActiveProblemId());
    // 저장돼 있던 배정을 입력칸에 복원
    const map = loadAssignmentMap();
    const drafts: Record<string, string> = {};
    for (const [num, pid] of Object.entries(map)) {
      drafts[pid] = drafts[pid] ? `${drafts[pid]}, ${num}` : num;
    }
    setAssignDrafts(drafts);
    setBankOpen(!bankOpen);
  };

  // QR/링크 출제: 문제+타이머 설정을 URL에 담아 태블릿 등 다른 기기로 전달
  const shareProblem = async (p: GeneratedProblem) => {
    const hash = await buildShareHash(p, loadSettings());
    const url = `${window.location.origin}/participant${hash}`;
    const qr = await QRCode.toDataURL(url, { errorCorrectionLevel: "L", margin: 1, width: 320 });
    setShare({ id: p.id, url, qr });
    setCopied(false);
  };

  // 참가번호 배정 일괄 출제
  const publishAssignments = async () => {
    const map: Record<string, string> = {};
    for (const p of bank) {
      const nums = (assignDrafts[p.id] ?? "").split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
      for (const n of nums) {
        if (map[n]) {
          alert(`참가번호 ${n}번이 두 문제에 배정되어 있습니다. 하나만 남겨주세요.`);
          return;
        }
        map[n] = p.id;
      }
    }
    const numbers = Object.keys(map);
    if (numbers.length === 0) {
      alert("참가번호를 하나 이상 입력해주세요. (예: 1, 2, 3)");
      return;
    }
    saveAssignmentMap(map);
    const usedProblems = bank.filter((p) => Object.values(map).includes(p.id));
    const hash = await buildAssignmentShareHash(usedProblems, map, loadSettings());
    setAssignUrl(`${window.location.origin}/participant${hash}`);
    setAssignCopied(false);
    setNotice(`참가번호 ${numbers.length}명 배정 출제 완료! 이 브라우저의 참가자 화면에는 바로 적용됩니다. 태블릿 등 다른 기기는 아래 "배정 출제 링크"를 보내서 한 번 열어주세요.`);
  };

  if (loading) {
    return (
      <main className="page" style={{ justifyContent: "center", minHeight: "80vh" }}>
        <JarvisOrb status={progress.total > 1 ? `AI가 문제를 만들고 있습니다… ${progress.done}/${progress.total}` : "AI가 지문을 만들고 있습니다…"} />
        <p className="subtitle">
          {GRADE_LEVELS.find((g) => g.id === gradeId)?.label} · {TASK_TYPE_LABELS[taskType]}
          {progress.total > 1 ? ` · ${progress.total}개 생성 중` : " · 30초 정도 걸릴 수 있어요"}
        </p>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="topbar">
        <Link href="/admin" className="home-link">← 관리자 홈</Link>
        <button className="btn ghost" onClick={openBank}>
          문제 보관함 {bankOpen ? "닫기" : "열기"}
        </button>
      </div>
      <h1 className="contest-title">문제 생성</h1>
      {notice && <p className="note" style={{ borderColor: "var(--cyan)", color: "var(--text)" }}>{notice}</p>}

      {bankOpen && (
        <div className="card" style={{ width: "100%", maxWidth: 860 }}>
          <h2>문제 보관함 ({bank.length}개)</h2>
          {bank.length === 0 && <p style={{ marginTop: 8 }}>저장된 문제가 없습니다. 생성 후 &quot;보관함에 저장&quot;을 누르세요.</p>}
          {bank.length > 0 && (
            <>
              <p style={{ marginTop: 8, fontSize: 13, color: "var(--text-dim)", lineHeight: 1.7 }}>
                각 문제의 <strong>참가번호</strong> 칸에 번호를 적고(여러 명이면 쉼표로: 1, 2, 3)
                아래 <strong>일괄 출제하기</strong>를 누르세요. 참가자가 자기 번호를 입력하면 배정된 문제가 나옵니다.
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <button className="btn" onClick={publishAssignments}>📢 일괄 출제하기</button>
              </div>
              {assignUrl && (
                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    className="btn ghost"
                    style={{ padding: "6px 12px", fontSize: 13 }}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(assignUrl);
                        setAssignCopied(true);
                      } catch { /* 클립보드 미지원 */ }
                    }}
                  >
                    {assignCopied ? "복사됨 ✓" : "🔗 배정 출제 링크 복사 (태블릿으로 보내기)"}
                  </button>
                </div>
              )}
            </>
          )}
          {bank.map((p) => (
            <div key={p.id} style={{ borderTop: "1px solid var(--border)", padding: "12px 0", marginTop: 12 }}>
              <p>
                <strong>{p.title}</strong>{" "}
                <span className="badge">{TASK_TYPE_LABELS[p.taskType]}</span>{" "}
                <span className="badge">{GRADE_LEVELS.find((g) => g.id === p.gradeId)?.label ?? "외부"}</span>
              </p>
              <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 4 }}>
                {p.passage.slice(0, 100)}…
              </p>
              <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  value={assignDrafts[p.id] ?? ""}
                  onChange={(e) => setAssignDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                  placeholder="참가번호 (예: 1, 2, 3)"
                  style={{
                    padding: "8px 12px", borderRadius: 8, fontSize: 14, width: 180,
                    border: "1px solid var(--border)", background: "rgba(8,14,28,0.8)", color: "var(--text)",
                  }}
                />
                {activeId === p.id ? (
                  <button
                    className="btn"
                    style={{ padding: "6px 12px", fontSize: 13 }}
                    onClick={() => { clearActiveProblem(); setActiveId(null); }}
                  >
                    공통 출제 중 ✓ (회수)
                  </button>
                ) : (
                  <button
                    className="btn ghost"
                    style={{ padding: "6px 12px", fontSize: 13 }}
                    onClick={() => { setActiveProblem(p.id); setActiveId(p.id); }}
                  >
                    공통 출제
                  </button>
                )}
                <button
                  className="btn ghost"
                  style={{ padding: "6px 12px", fontSize: 13 }}
                  onClick={() => shareProblem(p)}
                >
                  📱 QR
                </button>
                <button
                  className="btn ghost"
                  style={{ padding: "6px 12px", fontSize: 13 }}
                  onClick={() => { deleteProblem(p.id); setBank(loadProblems()); setActiveId(getActiveProblemId()); }}
                >
                  삭제
                </button>
              </div>
              {share?.id === p.id && (
                <div style={{ marginTop: 14, textAlign: "center" }}>
                  <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 10 }}>
                    태블릿 <strong>카메라</strong>로 이 QR을 찍으면 바로 이 문제로 응시가 시작됩니다.
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={share.qr} alt="출제 QR 코드" style={{ width: 280, maxWidth: "100%", borderRadius: 12, background: "#fff", padding: 8 }} />
                  <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "center", flexWrap: "wrap" }}>
                    <button
                      className="btn ghost"
                      style={{ padding: "6px 12px", fontSize: 13 }}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(share.url);
                          setCopied(true);
                        } catch { /* 클립보드 미지원 */ }
                      }}
                    >
                      {copied ? "복사됨 ✓" : "링크 복사"}
                    </button>
                    <button className="btn ghost" style={{ padding: "6px 12px", fontSize: 13 }} onClick={() => setShare(null)}>
                      닫기
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ width: "100%", maxWidth: 860 }}>
        <div className="form" style={{ maxWidth: "100%" }}>
          <label>
            과제 유형
            <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              {(Object.keys(TASK_TYPE_LABELS) as TaskType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={taskType === t ? "btn" : "btn ghost"}
                  onClick={() => setTaskType(t)}
                >
                  {TASK_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </label>

          <label>
            학년 (연령 기준)
            <select value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
              {GRADE_LEVELS.map((g) => (
                <option key={g.id} value={g.id}>{g.label}</option>
              ))}
            </select>
          </label>

          <label>
            실력 레벨 (선택 — Lexile·AR 지수 기준)
            <select value={proficiencyId} onChange={(e) => setProficiencyId(e.target.value)}>
              <option value="">학년 기준 자동</option>
              {PROFICIENCY_LEVELS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} — Lexile {p.lexile} · AR {p.ar}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={useKeywords}
              onChange={(e) => setUseKeywords(e.target.checked)}
              style={{ width: "auto" }}
            />
            카테고리 대신 키워드 직접 입력
          </label>

          {useKeywords ? (
            <label>
              키워드 (쉼표로 구분)
              <input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="예: 우주여행, 강아지, 생일파티"
              />
            </label>
          ) : (
            <label>
              카테고리
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </label>
          )}

          <label>
            생성 개수 (여러 개면 서로 다른 문제가 만들어져 보관함에 자동 저장됩니다)
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}개</option>
              ))}
            </select>
          </label>

          <button className="btn" type="button" onClick={generate}>
            ✨ {count > 1 ? `${count}개 생성하기` : "생성하기"}
          </button>
          {error && <p className="error">{error}</p>}
        </div>
      </div>

      {result && (
        <div className="card" style={{ width: "100%", maxWidth: 860 }}>
          <h2>{result.title}</h2>
          <p style={{ marginTop: 12, lineHeight: 1.8, fontSize: 16 }}>{result.passage}</p>

          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: "pointer", color: "var(--cyan)" }}>한국어 번역 (교사용)</summary>
            <p style={{ marginTop: 8, lineHeight: 1.8, color: "var(--text-dim)" }}>{result.passageKo}</p>
          </details>

          {result.vocabulary.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ marginBottom: 8 }}>주요 어휘</h3>
              {result.vocabulary.map((v, i) => (
                <p key={i} style={{ fontSize: 14, lineHeight: 1.8 }}>
                  <strong>{v.word}</strong> — {v.meaning}
                </p>
              ))}
            </div>
          )}

          {result.keyPoints.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ marginBottom: 8 }}>리텔링 핵심 포인트 (채점 참고용)</h3>
              {result.keyPoints.map((k, i) => (
                <p key={i} style={{ fontSize: 14, lineHeight: 1.8 }}>{i + 1}. {k}</p>
              ))}
            </div>
          )}

          {result.questions.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ marginBottom: 8 }}>질문</h3>
              {result.questions.map((q, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 15 }}><strong>Q{i + 1}.</strong> {q.question}</p>
                  <p style={{ fontSize: 13, color: "var(--text-dim)" }}>예시 답변: {q.sampleAnswer}</p>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button className="btn" onClick={save} disabled={saved}>
              {saved ? "저장됨 ✓" : "보관함에 저장"}
            </button>
            <button className="btn ghost" onClick={generate}>다시 생성</button>
          </div>
        </div>
      )}
    </main>
  );
}
