"use client";

import { useEffect, useState } from "react";
import { GateRole, isUnlocked, tryUnlock } from "@/lib/tempAuth";

// 심사위원/관리자 화면 앞에 세우는 접속코드 게이트.
// ⚠️ 1단계 자리표시자 — 실제 보안은 2단계 Supabase Auth에서 구현한다.
export default function PassGate({
  role,
  title,
  children,
}: {
  role: GateRole;
  title: string;
  children: React.ReactNode;
}) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setUnlocked(isUnlocked(role));
  }, [role]);

  if (unlocked === null) return null;
  if (unlocked) return <>{children}</>;

  return (
    <main className="page">
      <h1 className="contest-title">{title}</h1>
      <p className="subtitle">접속코드를 입력하세요</p>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (tryUnlock(role, code)) setUnlocked(true);
          else setError("접속코드가 올바르지 않습니다.");
        }}
      >
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="접속코드"
          autoFocus
        />
        {error && <p className="error">{error}</p>}
        <button className="btn" type="submit">입장</button>
      </form>
      <p className="note">
        ⚠️ 지금은 개발용 임시 코드입니다 (심사위원: judge2026 / 관리자: admin2026).
        실제 대회 전에 Supabase 로그인으로 교체됩니다.
      </p>
    </main>
  );
}
