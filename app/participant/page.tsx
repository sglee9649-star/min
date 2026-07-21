"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import JarvisOrb from "@/components/JarvisOrb";
import { TASK_TYPE_LABELS } from "@/lib/criteria";
import { getActiveProblem, type GeneratedProblem } from "@/lib/problems";
import { pickMimeType, saveRecording } from "@/lib/recordings";
import { ContestSettings, DEFAULT_SETTINGS, loadSettings } from "@/lib/settings";

// 참가자 모드 (3단계): 참가번호 → 대기 → 읽기 타이머 → 자동 녹음 + 말하기 타이머 → 로컬 저장.
// 녹음은 기기(IndexedDB)에 먼저 저장된다 — 현장 와이파이가 끊겨도 유실되지 않음.
type Phase = "enter" | "waiting" | "ready" | "reading" | "speaking" | "done" | "error";

export default function ParticipantPage() {
  const [settings, setSettings] = useState<ContestSettings>(DEFAULT_SETTINGS);
  const [number, setNumber] = useState("");
  const [phase, setPhase] = useState<Phase>("enter");
  const [problem, setProblem] = useState<GeneratedProblem | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [attempt, setAttempt] = useState(1);
  const [retryReason, setRetryReason] = useState("기기 오류");
  const [errorMsg, setErrorMsg] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speakStartRef = useRef(0);

  useEffect(() => {
    setSettings(loadSettings());
    return () => stopEverything();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 대기 화면: 관리자가 문제를 출제할 때까지 3초마다 확인
  useEffect(() => {
    if (phase !== "waiting") return;
    const check = () => {
      const p = getActiveProblem();
      if (p) {
        setProblem(p);
        setPhase("ready");
      }
    };
    check();
    const iv = setInterval(check, 3000);
    return () => clearInterval(iv);
  }, [phase]);

  const stopEverything = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try { recorderRef.current.stop(); } catch { /* 이미 종료됨 */ }
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startCountdown = (seconds: number, onEnd: () => void) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const endAt = Date.now() + seconds * 1000;
    setRemaining(seconds);
    timerRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        onEnd();
      }
    }, 200);
  };

  // "시작" — 마이크 권한을 먼저 받아두고 읽기 단계로
  const begin = async () => {
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErrorMsg("마이크 사용 권한이 필요합니다. 브라우저 주소창의 마이크 아이콘을 눌러 허용해주세요.");
      setPhase("error");
      return;
    }
    setPhase("reading");
    startCountdown(loadSettings().readTimeSec, startSpeaking);
  };

  const startSpeaking = () => {
    const stream = streamRef.current;
    if (!stream) return;
    const mimeType = pickMimeType();
    if (!mimeType) {
      setErrorMsg("이 브라우저는 녹음을 지원하지 않습니다. 크롬 또는 사파리 최신 버전을 사용해주세요.");
      setPhase("error");
      return;
    }
    chunksRef.current = [];
    const rec = new MediaRecorder(stream, { mimeType });
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => finishRecording(mimeType);
    rec.start(1000); // 1초 단위로 데이터 확보 (중간에 꺼져도 최대한 보존)
    recorderRef.current = rec;
    speakStartRef.current = Date.now();
    setPhase("speaking");
    startCountdown(loadSettings().speakTimeSec, () => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    });
  };

  const finishRecording = async (mimeType: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const blob = new Blob(chunksRef.current, { type: mimeType });
    const durationSec = Math.round((Date.now() - speakStartRef.current) / 1000);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setAudioUrl(URL.createObjectURL(blob));
    setPhase("done");
    const p = problem;
    if (!p) return;
    try {
      await saveRecording({
        id: crypto.randomUUID(),
        participantNumber: number.trim(),
        problemId: p.id,
        problemTitle: p.title,
        taskType: p.taskType,
        attempt,
        retryReason: attempt > 1 ? retryReason : undefined,
        createdAt: new Date().toISOString(),
        durationSec,
        mimeType,
        uploaded: false,
        blob,
      });
      setSavedOk(true);
    } catch {
      setSavedOk(false);
    }
  };

  const retry = () => {
    setAttempt((a) => a + 1);
    setAudioUrl(null);
    setSavedOk(false);
    setPhase("ready");
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // ---------- 화면들 ----------

  if (phase === "enter") {
    return (
      <main className="page">
        <div className="topbar"><Link href="/" className="home-link">← 처음으로</Link></div>
        <h1 className="contest-title">{settings.contestName}</h1>
        <p className="subtitle">참가번호를 입력하세요</p>
        <form
          className="form"
          onSubmit={(e) => { e.preventDefault(); if (number.trim()) setPhase("waiting"); }}
        >
          <input inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value)} placeholder="예: 7" autoFocus />
          <button className="btn" type="submit">입장</button>
        </form>
      </main>
    );
  }

  if (phase === "waiting") {
    return (
      <main className="page" style={{ justifyContent: "center", minHeight: "80vh" }}>
        <h1 className="contest-title">{settings.contestName}</h1>
        <p className="subtitle">참가번호 {number.trim()}번</p>
        <JarvisOrb status="문제가 출제되면 자동으로 시작됩니다…" />
        <p className="note">관리자가 문제 보관함에서 &quot;출제하기&quot;를 누르면 이 화면이 바뀝니다.</p>
      </main>
    );
  }

  if (phase === "ready" && problem) {
    return (
      <main className="page" style={{ justifyContent: "center", minHeight: "80vh" }}>
        <h1 className="contest-title">{TASK_TYPE_LABELS[problem.taskType]}</h1>
        <p className="subtitle">참가번호 {number.trim()}번{attempt > 1 && ` · ${attempt}번째 시도`}</p>
        <div className="card" style={{ maxWidth: 560, textAlign: "center" }}>
          <p style={{ lineHeight: 1.9 }}>
            시작을 누르면 <strong style={{ color: "var(--cyan)" }}>읽기 시간 {fmt(settings.readTimeSec)}</strong> 동안 지문이 보이고,
            <br />그 다음 <strong style={{ color: "var(--cyan)" }}>말하기 시간 {fmt(settings.speakTimeSec)}</strong> 동안 자동으로 녹음됩니다.
          </p>
          <p style={{ marginTop: 10, color: "var(--text-dim)", fontSize: 14 }}>
            시작 시 마이크 사용을 허용해주세요.
          </p>
        </div>
        <button className="btn" style={{ fontSize: 18, padding: "16px 40px" }} onClick={begin}>🎤 시작</button>
      </main>
    );
  }

  if (phase === "reading" && problem) {
    return (
      <main className="page">
        <div className="timer-bar">
          <span className="timer-label">읽기 시간</span>
          <span className="timer-big">{fmt(remaining)}</span>
        </div>
        <div className="card" style={{ width: "100%", maxWidth: 720 }}>
          <h2>{problem.title}</h2>
          <p style={{ marginTop: 14, lineHeight: 2, fontSize: 18 }}>{problem.passage}</p>
        </div>
        <button className="btn ghost" onClick={startSpeaking}>다 읽었어요 — 바로 말하기 시작</button>
      </main>
    );
  }

  if (phase === "speaking" && problem) {
    return (
      <main className="page">
        <div className="timer-bar recording">
          <span className="timer-label"><span className="rec-dot" /> 녹음 중</span>
          <span className="timer-big">{fmt(remaining)}</span>
        </div>

        {problem.taskType === "readAloud" && (
          <div className="card" style={{ width: "100%", maxWidth: 720 }}>
            <h2>{problem.title}</h2>
            <p style={{ marginTop: 14, lineHeight: 2, fontSize: 18 }}>{problem.passage}</p>
          </div>
        )}

        {problem.taskType === "retelling" && (
          <div className="card" style={{ width: "100%", maxWidth: 720, textAlign: "center" }}>
            <h2>{problem.title}</h2>
            <p style={{ marginTop: 12, lineHeight: 1.9 }}>
              지문을 보지 않고, 자신의 말로 이야기를 다시 들려주세요.
            </p>
          </div>
        )}

        {problem.taskType === "qna" && (
          <div className="card" style={{ width: "100%", maxWidth: 720 }}>
            <h2>{problem.title}</h2>
            {problem.questions.map((q, i) => (
              <p key={i} style={{ marginTop: 10, fontSize: 16, lineHeight: 1.8 }}>
                <strong>Q{i + 1}.</strong> {q.question}
              </p>
            ))}
          </div>
        )}

        <button
          className="btn ghost"
          onClick={() => { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); }}
        >
          다 말했어요 — 녹음 끝내기
        </button>
      </main>
    );
  }

  if (phase === "done") {
    return (
      <main className="page" style={{ justifyContent: "center", minHeight: "80vh" }}>
        <h1 className="contest-title">수고했어요! 🎉</h1>
        <p className="subtitle">
          참가번호 {number.trim()}번 · {attempt}번째 시도
          {savedOk ? " · 이 기기에 저장되었습니다" : " · ⚠️ 저장에 실패했습니다"}
        </p>
        {audioUrl && (
          <audio controls src={audioUrl} style={{ width: "100%", maxWidth: 480 }} />
        )}
        {settings.allowRetry && (
          <div className="card" style={{ maxWidth: 480 }}>
            <p style={{ fontSize: 14, color: "var(--text-dim)", lineHeight: 1.7 }}>
              녹음에 문제가 있었나요? 재녹음은 기록(로그)에 남습니다.
            </p>
            <div className="form" style={{ marginTop: 10, maxWidth: "100%" }}>
              <select value={retryReason} onChange={(e) => setRetryReason(e.target.value)}>
                <option>기기 오류</option>
                <option>주변 소음</option>
                <option>기타</option>
              </select>
              <button className="btn ghost" onClick={retry}>다시 녹음하기</button>
            </div>
          </div>
        )}
        <Link href="/" className="home-link">처음으로 돌아가기</Link>
      </main>
    );
  }

  if (phase === "error") {
    return (
      <main className="page" style={{ justifyContent: "center", minHeight: "80vh" }}>
        <h1 className="contest-title">문제가 생겼어요</h1>
        <p className="error" style={{ maxWidth: 480, textAlign: "center", lineHeight: 1.8 }}>{errorMsg}</p>
        <button className="btn" onClick={() => setPhase("ready")}>다시 시도</button>
      </main>
    );
  }

  return null;
}
