import type { Metadata } from "next";
import "./globals.css";
import "./pdf-layout.css";
import "./process.css";
import "./home.css";
export const metadata: Metadata = {
  title: "焊接机器人视觉识别系统 · 机器人视觉工作台",
  description: "焊接机器人视觉智能系统 · 离线交互演示",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

