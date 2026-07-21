"use client";

import Link from "next/link";
import { useState } from "react";
import PassGate from "@/components/PassGate";
import JarvisOrb from "@/components/JarvisOrb";
import { TASK_TYPE_LABELS, type TaskType } from "@/lib/criteria";
import { CATEGORIES, GRADE_LEVELS, PROFICIENCY_LEVELS } from "@/lib/levels";
import { loadProblems, saveProblem, deleteProblem, type GeneratedProblem } from "@/lib/problems";

// 2단계: AI 문제 생성 화면. 난이도(학년/레벨) + 카테고리 또는 키워드 → 지문·질문 생성.
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GenResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [bank, setBank] = useState<GeneratedProblem[]>([]);
  const [bankOpen, setBankOpen] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    setSaved(false);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskType,
          gradeId,
          proficiencyId: proficiencyId || undefined,
          category: useKeywords ? undefined : category,
          keywords: useKeywords ? keywords : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "생성에 실패했습니다.");
      setResult(data.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const save = () => {
    if (!result) return;
    saveProblem({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      taskType,
      gradeId,
      proficiencyId: proficiencyId || undefined,
      category: useKeywords ? undefined : category,
      keywords: useKeywords ? keywords : undefined,
      ...result,
    });
    setSaved(true);
  };

  const openBank = () => {
    setBank(loadProblems());
    setBankOpen(!bankOpen);
  };

  if (loading) {
    return (
      <main className="page" style={{ justifyContent: "center", minHeight: "80vh" }}>
        <JarvisOrb status="AI가 지문을 만들고 있습니다…" />
        <p className="subtitle">
          {GRADE_LEVELS.find((g) => g.id === gradeId)?.label} · {TASK_TYPE_LABELS[taskType]} · 30초 정도 걸릴 수 있어요
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

      {bankOpen && (
        <div className="card" style={{ width: "100%", maxWidth: 860 }}>
          <h2>문제 보관함 ({bank.length}개)</h2>
          {bank.length === 0 && <p style={{ marginTop: 8 }}>저장된 문제가 없습니다. 생성 후 &quot;보관함에 저장&quot;을 누르세요.</p>}
          {bank.map((p) => (
            <div key={p.id} style={{ borderTop: "1px solid var(--border)", padding: "10px 0", marginTop: 10 }}>
              <p>
                <strong>{p.title}</strong>{" "}
                <span className="badge">{TASK_TYPE_LABELS[p.taskType]}</span>{" "}
                <span className="badge">{GRADE_LEVELS.find((g) => g.id === p.gradeId)?.label}</span>
              </p>
              <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 4 }}>
                {p.passage.slice(0, 100)}…
              </p>
              <button
                className="btn ghost"
                style={{ marginTop: 8, padding: "6px 12px", fontSize: 13 }}
                onClick={() => { deleteProblem(p.id); setBank(loadProblems()); }}
              >
                삭제
              </button>
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
            실력 레벨 (선택 — 학년과 다른 수준으로 만들고 싶을 때)
            <select value={proficiencyId} onChange={(e) => setProficiencyId(e.target.value)}>
              <option value="">학년 기준 자동</option>
              {PROFICIENCY_LEVELS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} (Lexile {p.lexile} · IELTS {p.ielts})
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

          <button className="btn" type="button" onClick={generate}>
            ✨ 생성하기
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
