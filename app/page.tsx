"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, loadSettings } from "@/lib/settings";

export default function Home() {
  const [contestName, setContestName] = useState(DEFAULT_SETTINGS.contestName);

  useEffect(() => {
    setContestName(loadSettings().contestName);
  }, []);

  return (
    <main className="page">
      <h1 className="contest-title">{contestName}</h1>
      <p className="subtitle">역할을 선택해 입장하세요</p>

      <div className="role-grid">
        <Link href="/participant" className="card">
          <span className="icon">🎤</span>
          <h2>참가자</h2>
          <p>지문을 읽고, 타이머에 맞춰 녹음합니다. 점수나 다른 참가자 정보는 보이지 않습니다.</p>
        </Link>
        <Link href="/judge" className="card">
          <span className="icon">📋</span>
          <h2>심사위원</h2>
          <p>접속코드 필요. 배정된 참가자를 참가번호로만 보고 채점합니다.</p>
        </Link>
        <Link href="/admin" className="card">
          <span className="icon">🛠️</span>
          <h2>관리자</h2>
          <p>접속코드 필요. 대회 설정, 문제 생성, 심사 현황, 결과 집계를 관리합니다.</p>
        </Link>
      </div>

      <Link href="/display" className="card" style={{ maxWidth: 860, width: "100%" }}>
        <span className="icon">🖥️</span>
        <h2>발표 화면 (프로젝션용)</h2>
        <p>대회명을 크게 띄우는 화면입니다. 빔프로젝터·대형 화면에 이 페이지를 열어두세요.</p>
      </Link>
    </main>
  );
}
