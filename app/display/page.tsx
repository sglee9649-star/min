"use client";

import { useEffect, useState } from "react";
import JarvisOrb from "@/components/JarvisOrb";
import { DEFAULT_SETTINGS, loadSettings } from "@/lib/settings";
import { listRecordings } from "@/lib/recordings";
import { buildResults, loadResultSettings, type ParticipantResult } from "@/lib/results";
import { loadConfig } from "@/lib/judging";

// 프로젝션(발표) 화면. 평소엔 대회명, 관리자가 결과를 공개하면 순위를 크게 표시한다.
// (관리자와 같은 기기/브라우저에서 열어야 결과가 보인다 — Supabase 도입 후 다기기 확장)
export default function DisplayPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [published, setPublished] = useState(false);
  const [results, setResults] = useState<ParticipantResult[]>([]);

  const refresh = async () => {
    setSettings(loadSettings());
    const rs = loadResultSettings();
    setPublished(rs.published);
    if (rs.published) {
      const ai: Record<string, number> = {};
      try {
        for (const r of await listRecordings()) {
          if (r.evaluation && r.participantNumber) ai[r.participantNumber] = r.evaluation.totalScore;
        }
      } catch { /* skip */ }
      const ranked = buildResults({ config: loadConfig(), aiScores: ai, settings: rs })
        .filter((r) => r.rank !== null)
        .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
      setResults(ranked);
    }
  };

  useEffect(() => {
    refresh();
    // 관리자가 다른 탭에서 공개로 바꾸면 자동 반영
    const iv = setInterval(refresh, 4000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (published && results.length > 0) {
    return (
      <main className="display-page" style={{ justifyContent: "flex-start", paddingTop: 48 }}>
        <p className="hero-eyebrow">{settings.eyebrow}</p>
        <h1 className="contest-title" style={{ fontSize: "clamp(28px, 5vw, 56px)" }}>{settings.contestName}</h1>
        <p className="subtitle" style={{ marginBottom: 20 }}>🏆 결과 발표 (Results)</p>
        <div className="podium">
          {results.slice(0, 20).map((r) => (
            <div key={r.participantNumber} className={`podium-row${r.rank && r.rank <= 3 ? " top" : ""}`}>
              <span className="podium-rank">
                {r.rank && r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}
              </span>
              <span className="podium-num">참가번호 {r.participantNumber}번</span>
              <span className="podium-score">{r.finalScore?.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="display-page">
      <p className="hero-eyebrow">{settings.eyebrow}</p>
      <h1 className="contest-title">{settings.contestName}</h1>
      <p className="subtitle">{settings.subtitle}</p>
      <JarvisOrb />
    </main>
  );
}
