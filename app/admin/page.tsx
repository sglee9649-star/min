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
        <Link href="/" className="home-link">← 처음으로 (Home)</Link>
      </div>
      <h1 className="contest-title">관리자 모드 (Admin)</h1>

      <div className="card" style={{ width: "100%", maxWidth: 860 }}>
        <h2>대회 기본 설정 (Contest Settings)</h2>
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
            상단 라벨 (Top label — 입장 화면 맨 위 작은 문구)
            <input
              value={settings.eyebrow}
              onChange={(e) => update({ eyebrow: e.target.value })}
            />
          </label>
          <label>
            대회명 (Contest name — 참가자·발표 화면에 크게 표시)
            <input
              value={settings.contestName}
              onChange={(e) => update({ contestName: e.target.value })}
            />
          </label>
          <label>
            부제 (Subtitle — 대회명 아래 작은 설명 문구)
            <input
              value={settings.subtitle}
              onChange={(e) => update({ subtitle: e.target.value })}
            />
          </label>
          <label>
            지문 읽기(준비) 시간 (Reading time) — 초 (sec)
            <input
              type="number"
              min={10}
              value={settings.readTimeSec}
              onChange={(e) => update({ readTimeSec: Number(e.target.value) })}
            />
          </label>
          <label>
            말하기 시간 (Speaking time) — 초 (sec)
            <input
              type="number"
              min={10}
              value={settings.speakTimeSec}
              onChange={(e) => update({ speakTimeSec: Number(e.target.value) })}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={settings.allowRetry}
              onChange={(e) => update({ allowRetry: e.target.checked })}
              style={{ width: "auto" }}
            />
            재녹음 허용 (Allow re-recording — 재시도는 사유와 함께 기록됨)
          </label>
          <button className="btn" type="submit">저장 (Save)</button>
          {saved && <p style={{ color: "var(--cyan)", fontSize: 13 }}>저장되었습니다. (Saved.)</p>}
        </form>
      </div>

      <div className="role-grid">
        <Link href="/admin/generate" className="card">
          <h2>문제 생성 (Generate) <span className="badge">사용 가능</span></h2>
          <p>난이도(초1~고3 / Lexile·AR) + 카테고리 또는 키워드 → AI가 지문·질문 생성.</p>
        </Link>
        <Link href="/admin/recordings" className="card">
          <h2>녹음 관리 (Recordings) <span className="badge">사용 가능</span></h2>
          <p>녹음 듣기·다운로드·삭제, AI 평가, 재녹음(재시도) 기록 확인.</p>
        </Link>
        <Link href="/admin/judging" className="card">
          <h2>심사 설정 (Judging Setup) <span className="badge">사용 가능</span></h2>
          <p>평가기준표(항목 선택 + 비중), AI 반영 비율, 심사위원·참가자 명단, 심사 설정 링크 공유.</p>
        </Link>
        <Link href="/admin/progress" className="card">
          <h2>심사 진행 현황 (Progress) <span className="badge">사용 가능</span></h2>
          <p>심사위원별·참가자별 채점 진행률. 심사위원이 보낸 채점 결과 반영.</p>
        </Link>
        <Link href="/admin/results" className="card">
          <h2>결과 집계·공개 (Results) <span className="badge">사용 가능</span></h2>
          <p>가중치·AI 반영 집계, 편차 보정, 동점 처리, 비공개/공개 전환, 발표 화면.</p>
        </Link>
        <Link href="/admin/data" className="card">
          <h2>데이터 관리 (Data) <span className="badge">사용 가능</span></h2>
          <p>CSV 다운로드, 감사 로그, 데이터 삭제, 녹음 보관기한 안내.</p>
        </Link>
        <div className="card">
          <h2>연습 모드 (Practice) <span className="badge soon">수업용</span></h2>
          <p>점수 미기록 연습, 학생별 성장 추이 그래프.</p>
        </div>
      </div>
    </main>
  );
}
