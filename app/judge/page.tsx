"use client";

import Link from "next/link";
import PassGate from "@/components/PassGate";
import { CRITERIA_CATALOG, GROUP_LABELS } from "@/lib/criteria";

// 심사위원 모드 1단계 껍데기: 게이트 + 화면 구조만.
// 5단계에서 실제 배정·채점 입력·진행률이 붙는다. 참가자는 항상 참가번호로만 표시한다.
export default function JudgePage() {
  const groups = Array.from(new Set(CRITERIA_CATALOG.map((c) => c.group)));

  return (
    <PassGate role="judge" title="심사위원 모드">
      <main className="page">
        <div className="topbar">
          <Link href="/" className="home-link">← 처음으로</Link>
        </div>
        <h1 className="contest-title">심사위원 모드</h1>
        <p className="subtitle">참가자는 참가번호로만 표시됩니다 · 내 점수만 볼 수 있습니다</p>

        <div className="role-grid">
          <div className="card">
            <h2>배정된 참가자 <span className="badge soon">5단계 예정</span></h2>
            <p>녹음이 시작되면 해당 참가자의 채점 입력 화면이 자동으로 열립니다.</p>
          </div>
          <div className="card">
            <h2>채점 입력 <span className="badge soon">5단계 예정</span></h2>
            <p>관리자가 구성한 평가기준표(항목 + 비중)에 따라 점수를 입력합니다.</p>
          </div>
        </div>

        <div className="card" style={{ width: "100%", maxWidth: 860 }}>
          <h2>평가항목 카탈로그 미리보기</h2>
          <p style={{ marginBottom: 12 }}>
            아래 전체 항목 중에서 대회마다 필요한 것만 골라 비중을 설정해 사용합니다.
          </p>
          {groups.map((g) => (
            <p key={g} style={{ marginBottom: 6 }}>
              <strong style={{ color: "var(--cyan)" }}>{GROUP_LABELS[g]}</strong>{" — "}
              {CRITERIA_CATALOG.filter((c) => c.group === g).map((c) => c.name).join(", ")}
            </p>
          ))}
        </div>
      </main>
    </PassGate>
  );
}
