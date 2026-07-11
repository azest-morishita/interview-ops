import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InterviewOps | 面接回答をCI/CDするAIエージェント",
  description:
    "エンジニア・ITコンサル向けの面接回答を、AIエージェントが評価・差分分析・改善するInterview Pipelineアプリです。"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
