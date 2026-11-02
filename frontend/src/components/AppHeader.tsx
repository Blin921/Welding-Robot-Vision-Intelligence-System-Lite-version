"use client";
import { Home, Database, ScanLine, Workflow, Moon, Sun, Settings, UserRound } from "lucide-react";
import BrandMark from "./BrandMark";
import { WorkflowIcon } from "./WorkflowSteps";
import styles from "./AppHeader.module.css";
const links = [
  { label: "技术流程", Icon: Home }, { label: "点云建模", Icon: Database },
  { label: "焊缝识别", Icon: ScanLine }, 
   { label: "焊接模拟", Icon: Workflow },

];
export default function AppHeader({ tab, light, onNavigate, onTheme, onSettings, onProfile }: {
  tab: number; light: boolean; onNavigate: (tab: number) => void; onTheme: () => void;
  onSettings: () => void; onProfile?: () => void;
}) {
  return <header className={`${styles.header} ${!light ? styles.dark : ""}`}>
    <button className={styles.brand} onClick={() => onNavigate(0)}><BrandMark /><strong>焊接机器人视觉识别系统</strong></button>
    <nav aria-label="主要导航">{links.map(({label, Icon}, position) => { const index = [0, 1, 2, 5][position]; return <button key={label} aria-label={index === 2 ? "焊缝识别" : label} aria-current={tab === index ? "page" : undefined} onClick={() => onNavigate(index)}><WorkflowIcon tab={index}><Icon size={18} /></WorkflowIcon><span>{label}</span></button>})}</nav>
    <div className={styles.tools}>

      <button onClick={onTheme} aria-label="切换深浅主题">{light ? <Moon size={21} /> : <Sun size={21} />}</button>
      <button onClick={onSettings} aria-label="系统设置"><Settings size={23} /></button>
      <button onClick={onProfile ?? onSettings} aria-label="操作者信息"><UserRound size={23} /></button>
    </div>
  </header>;
}
