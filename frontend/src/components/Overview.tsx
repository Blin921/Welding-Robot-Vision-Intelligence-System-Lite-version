"use client";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  Box,
  Database,
  MonitorPlay,
  Play,
  ScanLine,
  Send,
  Workflow,
} from "lucide-react";
import { useMemo } from "react";
import { parseView } from "../lib/blob";
import { demoCloud, demoSeams } from "../lib/demo-data";
import ProcessPresentation from "./ProcessPresentation";
import FeatureArt from "./FeatureArt";
const Cloud = dynamic(() => import("./PointCloud"), { ssr: false });
export default function Overview({
  light,
  onNavigate,
}: {
  light: boolean;
  onNavigate: (tab: number) => void;
  onHelp: () => void;
}) {
  const cloud = useMemo(() => parseView(demoCloud()), []),
    seams = useMemo(() => demoSeams(), []);
  return (
    <main className="overview home-overview">
      <section className="hero">
        <div className="hero-copy">
          <div className="home-eyebrow"><span className="hero-rule" />机器人视觉工作台</div>
          <h1>
            看见每一道焊缝，
            <br />
            规划每一步轨迹
          </h1>
          <div className="hero-actions">
            <button className="primary" onClick={() => onNavigate(2)}>
              <Play size={17} fill="currentColor" />
              进入工作台
              <ArrowRight size={16} />
            </button>
            <button
              className="secondary hero-demo"
              onClick={() => onNavigate(5)}
            >
              <MonitorPlay size={19} />
              离线演示
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
        <div className="hero-cloud" aria-label="首页三维流程展示">
          <ProcessPresentation stage={0} light={light} />
          <Cloud
            cloud={cloud}
            seams={seams}
            selected={1}
            light={light}
            mode="语义"
            size={1.6}
            reset={0}
            grid={false}
            interactive={false}
          />
        </div>
        <span className="hero-edge edge-top" />
        <span className="hero-edge edge-bottom" />
      </section>
      <div className="workflow-cards">
        {[
          {
            title: "数据采集与管理",
            desc: "点云采集 · 数据管理",
            icon: Database,
            tab: 1,
          },
          {
            title: "AI焊缝识别",
            desc: "智能识别 · 分类标注",
            icon: ScanLine,
            tab: 2,
          },
          {
            title: "程序生成与轨迹预演",
            desc: "路径规划 · 焊接仿真",
            icon: Workflow,
            tab: 5,
          },
          {
            title: "机器人程序下发",
            desc: "程序传输 · 状态反馈",
            icon: Send,
            tab: 6,
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
            <div className="feature-image">
              <FeatureArt index={i} />
              {i === 1 && (
                <div className="feature-legend">
                  <span>
                    <i style={{ background: "#4682e6" }} />
                    钢管
                  </span>
                  <span>
                    <i style={{ background: "#32c850" }} />
                    钢筋
                  </span>
                  <span>
                    <i style={{ background: "#b432b4" }} />
                    扁钢
                  </span>
                  <span>
                    <i style={{ background: "#efb940" }} />
                    焊缝
                  </span>
                </div>
              )}

            </div>
          </button>
        ))}
      </div>
      <span className="sr-only">
        <Box />
        首页点云为系统功能展示示意
      </span>
    </main>
  );
}

