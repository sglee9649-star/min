"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PassGate from "@/components/PassGate";
import { TASK_TYPE_LABELS } from "@/lib/criteria";
import { deleteRecording, listRecordings, type RecordingEntry } from "@/lib/recordings";

// 녹음 관리 (3단계): 이 기기(브라우저)에 저장된 녹음을 확인한다.
// 녹음은 로컬 우선 저장이므로, 참가자가 녹음한 그 기기에서 열어야 보인다.
// Supabase 도입 후에는 모든 기기의 녹음을 한 곳에서 보게 된다.
export default function RecordingsPage() {
  return (
    <PassGate role="admin" title="녹음 관리">
      <RecordingsInner />
    </PassGate>
  );
}

function RecordingsInner() {
  const [recordings, setRecordings] = useState<RecordingEntry[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  const refresh = async () => {
    const all = await listRecordings();
    setRecordings(all);
    setUrls((prev) => {
      Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
      const next: Record<string, string> = {};
      for (const r of all) next[r.id] = URL.createObjectURL(r.blob);
      return next;
    });
    setLoaded(true);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ext = (mime: string) => (mime.includes("mp4") ? "m4a" : "webm");

  return (
    <main className="page">
      <div className="topbar">
        <Link href="/admin" className="home-link">← 관리자 홈</Link>
        <button className="btn ghost" onClick={refresh}>새로고침</button>
      </div>
      <h1 className="contest-title">녹음 관리</h1>
      <p className="note">
        녹음은 참가자가 사용한 기기에 먼저 저장됩니다. 여기에는 <strong>이 기기</strong>에 저장된 녹음만 보입니다.
        (서버 업로드는 Supabase 도입 단계에서 추가됩니다)
      </p>

      {loaded && recordings.length === 0 && (
        <div className="card" style={{ maxWidth: 560, textAlign: "center" }}>
          <p>저장된 녹음이 없습니다. 참가자 화면에서 녹음을 해보세요.</p>
        </div>
      )}

      {recordings.map((r) => (
        <div key={r.id} className="card" style={{ width: "100%", maxWidth: 860 }}>
          <p>
            <strong>참가번호 {r.participantNumber}번</strong>{" "}
            <span className="badge">{TASK_TYPE_LABELS[r.taskType]}</span>{" "}
            <span className="badge">{r.attempt}번째 시도</span>
            {r.retryReason && <span className="badge soon">재녹음 사유: {r.retryReason}</span>}
          </p>
          <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 6 }}>
            {r.problemTitle} · {r.durationSec}초 · {new Date(r.createdAt).toLocaleString("ko-KR")}
          </p>
          {urls[r.id] && (
            <audio controls src={urls[r.id]} style={{ width: "100%", marginTop: 10 }} />
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            {urls[r.id] && (
              <a
                className="btn ghost"
                style={{ padding: "6px 12px", fontSize: 13 }}
                href={urls[r.id]}
                download={`${r.participantNumber}번_${r.attempt}차_${r.problemTitle}.${ext(r.mimeType)}`}
              >
                다운로드
              </a>
            )}
            <button
              className="btn ghost"
              style={{ padding: "6px 12px", fontSize: 13 }}
              onClick={async () => {
                if (confirm(`참가번호 ${r.participantNumber}번의 녹음을 삭제할까요?`)) {
                  await deleteRecording(r.id);
                  refresh();
                }
              }}
            >
              삭제
            </button>
          </div>
        </div>
      ))}
    </main>
  );
}
