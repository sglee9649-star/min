"use client";

import { useEffect, useState } from "react";
import JarvisOrb from "@/components/JarvisOrb";
import { DEFAULT_SETTINGS, loadSettings } from "@/lib/settings";

// 프로젝션(발표) 화면 — 대회명을 크게 띄운다. 6단계에서 결과 발표 기능이 추가된다.
export default function DisplayPage() {
  const [contestName, setContestName] = useState(DEFAULT_SETTINGS.contestName);

  useEffect(() => {
    setContestName(loadSettings().contestName);
  }, []);

  return (
    <main className="display-page">
      <h1 className="contest-title">{contestName}</h1>
      <JarvisOrb />
    </main>
  );
}
