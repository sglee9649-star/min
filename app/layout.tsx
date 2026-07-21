import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "영어 스피킹 평가 플랫폼",
  description: "AI 리텔링 대회 및 학생 스피킹 연습 플랫폼",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
