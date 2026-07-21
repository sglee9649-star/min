"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import JarvisOrb from "@/components/JarvisOrb";
import { ContestSettings, DEFAULT_SETTINGS, loadSettings } from "@/lib/settings";

// 참가자 모드 1단계 껍데기: 참가번호 입력 → 대기화면(자비스 오브).
// 3단계에서 지문 표시·타이머·녹음이 이 흐름 뒤에 붙는다.
export default function ParticipantPage() {
  const [settings, setSettings] = useState<ContestSettings>(DEFAULT_SETTINGS);
  const [number, setNumber] = useState("");
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  if (!entered) {
    return (
      <main className="page">
        <div className="topbar">
          <Link href="/" className="home-link">← 처음으로</Link>
        </div>
        <h1 className="contest-title">{settings.contestName}</h1>
        <p className="subtitle">참가번호를 입력하세요</p>
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            if (number.trim()) setEntered(true);
          }}
        >
          <input
            inputMode="numeric"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="예: 7"
            autoFocus
          />
          <button className="btn" type="submit">입장</button>
        </form>
      </main>
    );
  }

  return (
    <main className="page" style={{ justifyContent: "center", minHeight: "80vh" }}>
      <h1 className="contest-title">{settings.contestName}</h1>
      <p className="subtitle">참가번호 {number.trim()}번</p>
      <JarvisOrb status="AI가 문제를 준비하고 있습니다…" />
      <p className="note">
        읽기 시간 {settings.readTimeSec}초 · 말하기 시간 {settings.speakTimeSec}초로 진행됩니다.
        문제 생성(2단계)과 녹음·타이머(3단계)가 완성되면 이 화면에서 바로 시작됩니다.
      </p>
      <button className="btn ghost" onClick={() => setEntered(false)}>참가번호 다시 입력</button>
    </main>
  );
}
