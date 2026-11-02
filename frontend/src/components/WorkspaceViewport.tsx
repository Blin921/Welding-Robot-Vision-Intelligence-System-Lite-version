"use client";
import dynamic from "next/dynamic";
import ProcessPresentation from "./ProcessPresentation";
import {
  Activity,
  Box,
  Expand,
  Focus,
  Hand,
  Maximize,
  ZoomIn,
  FileCode2,
  Check,
  FolderOpen,
  Layers3,
  LoaderCircle,
  Move3D,
  RotateCcw,
} from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import type { PointPair } from "../lib/types";
import { useWorkspace } from "../stores/provider";
import { Notice, Panel } from "./ui";
import { usePlayback } from "./Playback";
const Cloud = dynamic(() => import("./PointCloud"), {
  ssr: false,
  loading: () => (
    <div className="cloud-loading">
      <LoaderCircle className="spin" />
      加载三维渲染器
    </div>
  ),
});
export default function WorkspaceViewport({
  tab,
  light,
  onNavigate,
  calibrationPairs,
}: {
  tab: number;
  light: boolean;
  calibrationPairs?: PointPair[];
  onNavigate: (tab: number) => void;
}) {
  const { state } = useWorkspace();
  return (
    <Viewport
      key={state.frame}
      tab={tab}
      light={light}
      onNavigate={onNavigate}
      calibrationPairs={calibrationPairs}
    />
  );
}
function Viewport({
  tab,
  light,
  onNavigate,
  calibrationPairs,
}: {
  tab: number;
  light: boolean;
  calibrationPairs?: PointPair[];
  onNavigate: (tab: number) => void;
}) {
  const { state, store } = useWorkspace();
  const [mode, setMode] = useState<"语义" | "实例">("语义"),
    [size, setSize] = useState(2),
    [grid, setGrid] = useState(true),
    [reset, setReset] = useState(0),
    [interaction, setInteraction] = useState<"orbit" | "pan">("orbit"),
    [zoom, setZoom] = useState(0),
    [tcpTarget, setTcpTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setTcpTarget(document.getElementById("tcp-context"));
    });
    return () => {
      active = false;
    };
  }, [tab]);
  const viewer = useRef<HTMLDivElement>(null);
  const generated = store.currentProgram(),
    playback = usePlayback(generated?.data ?? null, false),
    cloud = state.cloud,
    push = store.currentPush();
  const headings = [
    "",
    "三维点云预览",
    "三维语义识别结果",
    "标定点云与坐标系",
    "多构件点云视图",
    "轨迹预演",
    "点云与轨迹视图",
  ];
  const colors =
    mode === "语义"
      ? [
          ["#4682e6", "钢管"],
          ["#32c850", "钢筋"],
          ["#b432b4", "扁钢"],
          ["#b4b4b4", "背景"],
        ]
      : [
          ["#efbd66", "实例 · 黄金率配色"],
          ["#41464e", "未分派 / 背景 (0)"],
        ];
  return (
    <>
      <div className="viewer panel" ref={viewer}>
        <div className="viewer-heading">
          <span>
            <Box size={17} />
            {headings[tab]}
          </span>
          <span className="viewport-label">
            <i /> REALTIME VIEWPORT
          </span>
        </div>
        <div className="viewer-toolbar">
          <div className="segmented">
            {(["语义", "实例"] as const).map((value) => (
              <button
                key={value}
                className={mode === value ? "active" : ""}
                onClick={() => setMode(value)}
              >
                {value === "语义" ? <Layers3 size={13} /> : <Box size={13} />}{" "}
                {value}
              </button>
            ))}
          </div>
          <button
            className={`toolbar-grid ${grid ? "on" : ""}`}
            onClick={() => setGrid(!grid)}
            aria-pressed={grid}
          >
            <Focus size={14} />
            网格
          </button>
          <div className="point-size">
            点大小
            <input
              aria-label="点大小"
              type="range"
              min="1"
              max="6"
              step="1"
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
            />
            <span>{size}</span>
          </div>
          <button
            aria-label="重置视角"
            title="按点云范围重置视角"
            onClick={() => setReset((r) => r + 1)}
          >
            <RotateCcw size={15} />
            <span className="reset-label">重置视角</span>
          </button>
          <button
            aria-label="全屏视图"
            onClick={async () => {
              try {
                if (document.fullscreenElement) await document.exitFullscreen();
                else await viewer.current?.requestFullscreen();
              } catch {
                store.notify("浏览器未允许全屏显示", "warn");
              }
            }}
          >
            <Expand size={16} />
          </button>
        </div>
        <div className="main-cloud">
          <ProcessPresentation key={tab} stage={tab} light={light} active={tab !== 1} />
          {state.loading ? (
            <div className="cloud-loading">
              <LoaderCircle className="spin" />
              正在加载点云、焊缝与标定状态
            </div>
          ) : cloud ? (
            <Cloud
              cloud={cloud}
              seams={state.seams}
              selected={state.selected}
              light={light}
              mode={mode}
              size={size}
              reset={reset}
              grid={grid}
              tcp={null}
              tcpPath={generated?.data.waypoints_cam_mm}
              calibrationPairs={tab === 3 ? calibrationPairs : undefined}
              interaction={interaction}
              zoom={zoom}
            />
          ) : (
            <div className="empty">
              <FolderOpen size={40} />
              <h3>{state.loadError ? "数据加载失败" : "等待点云识别结果"}</h3>
              <p>
                {state.loadError ??
                  "当前帧无历史结果，请开始识别或选择有结果的帧。"}
              </p>
              <button
                className="primary"
                onClick={() =>
                  state.loadError ? void store.retry() : onNavigate(2)
                }
              >
                {state.loadError ? "重试加载" : "前往识别"}
              </button>
            </div>
          )}
          {cloud && (
            <>
              <div className="view-corner-label">
                <span className="live-dot" />
                {state.frame}
                <small>CAMERA COORDINATES / mm</small>
              </div>
              <div className="legend">
                <small>{mode === "语义" ? "语义标签" : "实例着色"}</small>
                {colors.map(([c, label]) => (
                  <span key={label}>
                    <i style={{ background: c }} />
                    {label}
                  </span>
                ))}
                <span className="legend-line">选中焊缝</span>
              </div>
              <div className="axis-widget">
                <Move3D />
                <b className="axis-x">X</b>
                <b className="axis-y">Y</b>
                <b className="axis-z">Z</b>
              </div>
              <div className="navigation-tools">
                <button
                  aria-label="平移视图"
                  title="平移"
                  onClick={() => setInteraction("pan")}
                >
                  <Hand />
                </button>
                <button
                  aria-label="旋转视图"
                  title="旋转"
                  onClick={() => setInteraction("orbit")}
                >
                  <RotateCcw />
                </button>
                <button
                  aria-label="放大视图"
                  title="放大"
                  onClick={() => setZoom((v) => v + 1)}
                >
                  <ZoomIn />
                </button>
                <button
                  aria-label="适配视角"
                  title="适配视角"
                  onClick={() => {
                    setZoom(0);
                    setReset((v) => v + 1);
                  }}
                >
                  <Maximize />
                </button>
                <span />
                <button
                  aria-label="切换网格"
                  title="10mm 网格"
                  onClick={() => setGrid((v) => !v)}
                >
                  <Box />
                </button>
              </div>
              <div className="viewer-hint">
                拖动旋转 <span>·</span> 滚轮缩放 <span>·</span> 网格 10mm
              </div>
            </>
          )}
          {tab === 5 && playback.pose && (
            <div className="tcp-readout">
              <span>
                TCP{" "}
                <b>
                  {playback.pose.position.map((v) => v.toFixed(1)).join(" / ")}{" "}
                  mm
                </b>
              </span>
              <span>
                WPR <b>{playback.pose.wpr.join(" / ")}°</b>
              </span>
            </div>
          )}
        </div>
        <div className="viewport-status" style={{ display: "flex" }}>
          <span>
            <i className={state.mode === "demo" ? "yellow" : "green"} />
            {state.mode === "demo" ? "模拟点云" : "后端点云"}
          </span>
          <span>
            显示点数 <b>{cloud?.header.n.toLocaleString() ?? "—"}</b>
            <small> / {cloud?.header.n_full.toLocaleString() ?? "—"}</small>
          </span>
          <span>
            实例 <b>{cloud?.header.n_instances ?? "—"}</b>
          </span>
          <span>
            来源 <b>{cloud?.header.source ?? "—"}</b>
          </span>
          <span className="status-fps">
            mm <Activity size={12} />
          </span>
        </div>
      </div>
      {tab === 5 &&
        tcpTarget &&
        playback.pose &&
        createPortal(
          <>
            <div className="tcp-cells">
              {playback.pose.position.map((v, i) => (
                <div key={i}>
                  <small>{["X (mm)", "Y (mm)", "Z (mm)"][i]}</small>
                  <strong>{v.toFixed(1)}</strong>
                </div>
              ))}
            </div>
            <div className="coordinate-pair">
              <div>
                <strong>相机系坐标</strong>
                <p>
                  {playback.pose.position
                    .map((v, i) => `${["X", "Y", "Z"][i]}: ${v.toFixed(2)}`)
                    .join("\n")}
                </p>
              </div>
              <div>
                <strong>基座系坐标</strong>
                <p>
                  {generated?.data.waypoints_base_mm[playback.pose.index]
                    ?.map((v, i) => `${["X", "Y", "Z"][i]}: ${v.toFixed(2)}`)
                    .join("\n") ?? "—"}
                </p>
              </div>
            </div>
          </>,
          tcpTarget,
        )}
      {state.loadError && cloud && (
        <Notice warning>部分数据未能加载：{state.loadError}</Notice>
      )}
      {tab === 5 && generated && (
        <div className="program-coordinate-grid">
          <div>
            <strong>相机系途经点 · 用于预演</strong>
            <p className="mono">
              {generated.data.waypoints_cam_mm.length} 个点
            </p>
          </div>
          <div>
            <strong>基座系途经点 · 与 .LS 一致</strong>
            <p className="mono">
              {generated.data.waypoints_base_mm.length} 个点
            </p>
          </div>
          <details>
            <summary>查看基座系坐标</summary>
            <pre>
              {generated.data.waypoints_base_mm
                .map(
                  (p, i) =>
                    `${i + 1}: ${p.map((v) => v.toFixed(3)).join(", ")}`,
                )
                .join("\n")}
            </pre>
          </details>
        </div>
      )}
      {tab === 6 && (
        <Panel
          title="文件信息与传输结果"
          icon={<FileCode2 />}
          className="transfer-panel"
        >
          <div className="file-transfer-layout">
            <div className="file-transfer-file">
              <h3>待发送文件</h3>
              <div className="transfer-file-label">
                <FileCode2 size={30} />
                <div>
                  <strong>
                    {generated
                      ? /\.ls$/i.test(generated.data.ls_name)
                        ? generated.data.ls_name
                        : generated.data.ls_name + ".ls"
                      : "尚未生成程序"}
                  </strong>
                  <small>
                    {generated
                      ? `${(new TextEncoder().encode(generated.data.ls_text).length / 1024).toFixed(2)} KB · 程序文件`
                      : "请选择焊缝并生成程序"}
                  </small>
                </div>
                <button className="text-button" onClick={() => onNavigate(5)}>
                  更改文件
                </button>
              </div>
              <h4>传输进度</h4>
              <div className="transfer-stepper">
                {["文件准备", "文件传输", "完成"].map((label, i) => (
                  <div key={label}>
                    <i
                      className={
                        (i === 0 && generated) || push
                          ? "complete"
                          : state.pending === "push" && i === 1
                            ? "pending"
                            : ""
                      }
                    >
                      {(i === 0 && generated) || push ? (
                        <Check size={13} />
                      ) : (
                        i + 1
                      )}
                    </i>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <div
                className={`transfer-progress ${state.pending === "push" ? "indeterminate" : ""}`}
              >
                <span
                  style={{ width: push ? "100%" : generated ? "8%" : "0%" }}
                />
              </div>
              <p className="hint">
                {push
                  ? "传输完成 · 100%"
                  : state.pending === "push"
                    ? "正在传输，请等待后端确认"
                    : generated
                      ? "文件已就绪，等待下发确认"
                      : "等待生成程序"}
              </p>
            </div>
            <div className="file-transfer-result">
              {push ? (
                <>
                  <Check size={38} />
                  <h3>
                    {state.mode === "demo" ? "模拟传输完成" : "文件下发完成"}
                  </h3>
                  <p className="mono">{push.remote_path}</p>
                  <p>{push.bytes} 字节</p>
                  {push.existed_before && (
                    <Notice warning>
                      已覆盖控制器同名程序
                      {state.mode === "demo" ? "（模拟）" : ""}
                    </Notice>
                  )}
                </>
              ) : (
                <>
                  <FileCode2 size={42} />
                  <h3>{generated ? "等待下发确认" : "请先生成程序"}</h3>
                  <p>
                    {generated
                      ? "确认控制器地址与目录后开始传输。"
                      : "当前没有可下发的程序，请先生成程序。"}
                  </p>
                  <button className="secondary" onClick={() => onNavigate(5)}>
                    前往程序预览
                  </button>
                </>
              )}
            </div>
          </div>
        </Panel>
      )}
    </>
  );
}

