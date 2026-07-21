// 자비스(JARVIS) 느낌의 "AI가 생각 중" 오브 애니메이션.
// AI 생성 대기, 참가자 대기화면 등 모든 로딩 상태에서 공용으로 사용한다.
export default function JarvisOrb({ status }: { status?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
      <div className="orb-wrap" role="status" aria-label={status ?? "처리 중"}>
        <div className="orb-ring r3" />
        <div className="orb-ring r2" />
        <div className="orb-ring r1" />
        <div className="orb-core" />
      </div>
      {status && <p className="orb-status">{status}</p>}
    </div>
  );
}
