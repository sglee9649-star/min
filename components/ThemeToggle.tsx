"use client";

import { useEffect, useState } from "react";

// 다크/화이트 모드 전환 버튼 (우상단 고정). 선택은 기기에 저장된다.
export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("ui:theme") === "light" ? "light" : "dark";
    setTheme(saved);
    document.documentElement.dataset.theme = saved;
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("ui:theme", next);
    document.documentElement.dataset.theme = next;
  };

  return (
    <button className="theme-toggle" onClick={toggle} aria-label="다크/화이트 모드 전환 (Toggle theme)">
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
