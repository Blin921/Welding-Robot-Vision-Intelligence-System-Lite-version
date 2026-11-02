"use client";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  Box,
  Database,
  Play,
  ScanLine,
  Workflow,
} from "lucide-react";
import FeatureArt from "./FeatureArt";
const HomeCloud = dynamic(() => import("./HomeCloud"), { ssr: false });
export default function Overview({
  light,
  onNavigate,
}: {
  light: boolean;
  onNavigate: (tab: number) => void;
  onHelp: () => void;
}) {
  return (
    <main className="overview home-overview">
      <div className="home-background-cloud" aria-label="技术流程三维点云背景"><HomeCloud light={light} /></div>
      <div className="home-scene-label"><span className="home-scene-dot" />三维构件感知<span className="home-scene-divider" />钢管 · 钢筋 · 连接焊缝</div>
      <section className="hero">
        <div className="hero-copy">
          <div className="home-eyebrow"><span className="hero-rule" />焊接机器人视觉工作台</div>
          <h1>
            让每一道焊缝
            <br />
            清晰可见，精准可达
          </h1>
          <p className="home-intro">从三维感知到焊接执行。导入点云、提取焊缝、验证轨迹，让每一步准备都有据可依。</p>
          <div className="home-capabilities"><span>三维点云</span><i /><span>智能识别</span><i /><span>轨迹模拟</span></div>
          <div className="hero-actions">
            <button className="primary" onClick={() => onNavigate(1)}>
              <Play size={17} fill="currentColor" />
              开始点云建模
              <ArrowRight size={16} />
            </button>

          </div>
        </div>

        <span className="hero-edge edge-top" />
        <span className="hero-edge edge-bottom" />
      </section>
      <section className="home-workflow">
      <div className="home-section-heading"><div><span>从数据到执行</span><h2>开启你的焊接工作流</h2></div><p>导入点云 / 识别焊缝 / 模拟与下发</p></div>
      <div className="workflow-cards">
        {[
          {
            title: "点云建模",
            desc: "导入 PCD 文件，管理点云帧并查看三维模型",
            icon: Database,
            tab: 1,
          },
          {
            title: "焊缝识别",
            desc: "配置识别参数，提取焊缝并检查识别结果",
            icon: ScanLine,
            tab: 2,
          },
          {
            title: "焊接模拟",
            desc: "选择焊缝，生成 LS、预演轨迹并下发程序",
            icon: Workflow,
            tab: 5,
          },

        ].map((card, i) => (
          <button
            className="workflow-card"
            aria-label={`打开${card.title}`}
            key={card.title}
            onClick={() => onNavigate(card.tab)}
          >
            <div className="feature-heading">
              <span className="home-feature-index" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
              <card.icon />
              <h2>{card.title}</h2>
              <span>
                <ArrowRight size={13} />
              </span>
            </div>
            <p>{card.desc}</p>
            <span className="home-card-action">进入{card.title}<ArrowRight size={16} /></span>
            <div className="feature-image">
              <FeatureArt index={i === 2 ? 3 : i} />


            </div>
          </button>
        ))}
      </div>
      </section>
      <span className="sr-only">
        <Box />
        技术流程点云为系统功能展示示意
      </span>
    </main>
  );
}

