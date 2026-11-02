"use client";
import { Home, Database, ScanLine, Workflow, Send, Moon, Sun, SlidersHorizontal, UserRound } from "lucide-react";
import BrandMark from "./BrandMark";
import { WorkflowIcon } from "./WorkflowSteps";
import { useWorkspace } from "../stores/provider";
import { calibrationStatus } from "../lib/calibration-status";
import styles from "./AppHeader.module.css";
const links = [
  { label: "首页", Icon: Home }, { label: "数据采集", Icon: Database },
  { label: "AI识别", Icon: ScanLine }, 
   { label: "程序与预演", Icon: Workflow },
  { label: "程序下发", Icon: Send },
];
export default function AppHeader({ tab, light, onNavigate, onTheme, onSettings, onProfile }: {
  tab: number; light: boolean; onNavigate: (tab: number) => void; onTheme: () => void;
  onSettings: () => void; onProfile?: () => void;
}) {
  const { state } = useWorkspace();
  const calibration = calibrationStatus(state.calibration);
  return <header className={`${styles.header} ${!light ? styles.dark : ""}`}>
    <button className={styles.brand} onClick={() => onNavigate(0)}><BrandMark /><strong>焊接机器人视觉识别系统</strong></button>
    <nav aria-label="主要导航">{links.map(({label, Icon}, position) => { const index = [0, 1, 2, 5, 6][position]; return <button key={label} aria-label={index === 2 ? "AI 识别" : label} aria-current={tab === index ? "page" : undefined} onClick={() => onNavigate(index)}><WorkflowIcon tab={index}><Icon size={18} /></WorkflowIcon><span>{label}</span></button>})}</nav>
    <div className={styles.health} aria-label="系统健康状态">
      <button onClick={onSettings} title={state.health?.model_error ?? state.healthError ?? "模型状态"}><i data-color={state.health?.model_ok ? "green" : "red"} />模型</button>
      <button onClick={onSettings} title={state.health?.cpp_ok ? "解算器可用" : "解算器未就绪"}><i data-color={state.health?.cpp_ok ? "green" : "red"} />C++ 解算器</button>
      <button onClick={onSettings} title={calibration.title}><i data-color={calibration.color} />{calibration.label}</button>
    </div>
    <div className={styles.tools}>
      <button className={styles.mode} onClick={onSettings} aria-label={state.mode === "demo" ? "离线演示，切换连接模式" : "后端模式，切换连接模式"} title={state.mode === "demo" ? "离线模拟，不连接设备" : "连接 FastAPI"}>{state.mode === "demo" ? "离线演示" : "后端模式"}</button>
      <button onClick={onTheme} aria-label="切换深浅主题">{light ? <Moon size={21} /> : <Sun size={21} />}</button>
      <button onClick={onSettings} aria-label="系统设置"><SlidersHorizontal size={23} /></button>
      <button onClick={onProfile ?? onSettings} aria-label="操作者信息"><UserRound size={23} /></button>
    </div>
  </header>;
}
