import type { Metadata } from "next";
import ThemeToggle from "@/components/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "영어 스피킹 평가 플랫폼",
  description: "AI 리텔링 대회 및 학생 스피킹 연습 플랫폼",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        {/* 저장된 테마를 첫 화면 그리기 전에 적용 (화면 깜빡임 방지) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('ui:theme');if(t==='light')document.documentElement.dataset.theme='light'}catch(e){}`,
          }}
        />
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
