"use client";

import { useEffect, useState } from "react";
import JarvisOrb from "@/components/JarvisOrb";
import { DEFAULT_SETTINGS, loadSettings } from "@/lib/settings";

// 프로젝션(발표) 화면 — 대회명을 크게 띄운다. 6단계에서 결과 발표 기능이 추가된다.
export default function DisplayPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  return (
    <main className="display-page">
      <p className="hero-eyebrow">{settings.eyebrow}</p>
      <h1 className="contest-title">{settings.contestName}</h1>
      <p className="subtitle">{settings.subtitle}</p>
      <JarvisOrb />
    </main>
  );
}
