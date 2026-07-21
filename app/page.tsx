"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, loadSettings } from "@/lib/settings";

// 입장 화면: 참가자 중심. 심사위원/관리자 입구는 하단에 작게 배치한다.
export default function Home() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  return (
    <main className="page hero">
      <div className="hero-glow" aria-hidden />
      <p className="hero-eyebrow">{settings.eyebrow}</p>
      <h1 className="contest-title">{settings.contestName}</h1>
      <p className="subtitle">{settings.subtitle}</p>

      <Link href="/participant" className="cta">
        <span className="cta-icon">🎤</span>
        <span>
          <strong>참가자 입장</strong>
          <small>참가번호를 입력하고 시작하세요</small>
        </span>
        <span className="cta-arrow">→</span>
      </Link>

      <Link href="/display" className="btn ghost" style={{ marginTop: 4 }}>
        🖥️ 발표 화면 (프로젝션용)
      </Link>

      <footer className="staff-links">
        <Link href="/judge">심사위원</Link>
        <span aria-hidden>·</span>
        <Link href="/admin">관리자</Link>
      </footer>
    </main>
  );
}
