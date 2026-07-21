"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PassGate from "@/components/PassGate";
import { ContestSettings, DEFAULT_SETTINGS, loadSettings, saveSettings } from "@/lib/settings";

// 관리자 모드 1단계 껍데기: 대회 기본 설정(대회명·타이머)은 실제로 동작하고,
// 나머지 메뉴는 자리만 잡아둔다. 각 메뉴의 단계 번호는 CLAUDE.md의 단계별 계획과 일치한다.
export default function AdminPage() {
  return (
    <PassGate role="admin" title="관리자 모드">
      <AdminInner />
    </PassGate>
  );
}

function AdminInner() {
  const [settings, setSettings] = useState<ContestSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const update = (patch: Partial<ContestSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    setSaved(false);
  };

  return (
    <main className="page">
      <div className="topbar">
        <Link href="/" className="home-link">← 처음으로</Link>
      </div>
      <h1 className="contest-title">관리자 모드</h1>

      <div className="card" style={{ width: "100%", maxWidth: 860 }}>
        <h2>대회 기본 설정</h2>
        <form
          className="form"
          style={{ maxWidth: "100%", marginTop: 14 }}
          onSubmit={(e) => {
            e.preventDefault();
            saveSettings(settings);
            setSaved(true);
          }}
        >
          <label>
            대회명 (참가자·발표 화면에 표시됩니다)
            <input
              value={settings.contestName}
              onChange={(e) => update({ contestName: e.target.value })}
            />
          </label>
          <label>
            지문 읽기(준비) 시간 — 초
            <input
              type="number"
              min={10}
              value={settings.readTimeSec}
              onChange={(e) => update({ readTimeSec: Number(e.target.value) })}
            />
          </label>
          <label>
            말하기 시간 — 초
            <input
              type="number"
              min={10}
              value={settings.speakTimeSec}
              onChange={(e) => update({ speakTimeSec: Number(e.target.value) })}
            />
          </label>
          <button className="btn" type="submit">저장</button>
          {saved && <p style={{ color: "var(--cyan)", fontSize: 13 }}>저장되었습니다.</p>}
        </form>
      </div>

      <div className="role-grid">
        <Link href="/admin/generate" className="card">
          <h2>문제 생성 <span className="badge">사용 가능</span></h2>
          <p>난이도(초1~고3 / Lexile·CEFR) + 카테고리 또는 키워드 직접 입력 → AI가 지문·질문 생성.</p>
        </Link>
        <div className="card">
          <h2>평가기준표 구성 <span className="badge soon">5단계 예정</span></h2>
          <p>전체 평가항목 카탈로그에서 선택 + 비중 설정. AI:심사위원 반영 비율 설정.</p>
        </div>
        <div className="card">
          <h2>심사 진행 현황 <span className="badge soon">5단계 예정</span></h2>
          <p>심사위원별·참가자별 채점 진행률. 미채점 알림.</p>
        </div>
        <div className="card">
          <h2>결과 집계·공개 <span className="badge soon">6단계 예정</span></h2>
          <p>편차 보정, 동점 처리, 점수 비공개/공개 전환, 결과 발표 화면 제어.</p>
        </div>
        <div className="card">
          <h2>데이터 관리 <span className="badge soon">6단계 예정</span></h2>
          <p>CSV 다운로드, 데이터 삭제, 감사 로그, 녹음 보관기한 관리.</p>
        </div>
        <div className="card">
          <h2>연습 모드 <span className="badge soon">수업용</span></h2>
          <p>점수 미기록 연습, 학생별 성장 추이 그래프.</p>
        </div>
      </div>
    </main>
  );
}
