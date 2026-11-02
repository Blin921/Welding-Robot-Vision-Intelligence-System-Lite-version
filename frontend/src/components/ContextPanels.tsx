"use client";
import {
  Activity,
  ArrowDownToLine,
  Code2,
  Copy,
  Crosshair,
  Eye,
  FileCode2,
  Layers3,
  Play,
  Send,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { useWorkspace } from "../stores/provider";
import { Notice, Panel } from "./ui";
import SeamList, { seamLabel } from "./SeamList";
const xyz = (value: number[] | undefined) =>
  value?.map((n) => n.toFixed(3)).join(", ") ?? "—";
export default function ContextPanels({
  tab,
  minLength,
  onAction,
  onTaskOpen,
  onNavigate,
}: {
  tab: number;
  calibrationMode?: "pairs" | "matrix";
  pairCount?: number;
  minLength: number;
  onAction: (
    action: "view" | "preview" | "program" | "push",
    id: number,
  ) => void;
  onTaskOpen: () => void;
  onNavigate: (tab: number) => void;
}) {
  const { store, state } = useWorkspace(),
    program = store.currentProgram(),
    seam = state.seams.find((s) => s.id === state.selected),
    calib = state.calibration,
    cloud = state.cloud;
  const logs = (
    <Panel
      title={tab === 4 ? "任务历史" : "任务日志"}
      icon={<Terminal />}
      extra={
        <button className="subtle-button" onClick={onTaskOpen}>
          全部⌄
        </button>
      }
      className="logs-panel"
    >
      <div className="log-list">
        {state.logs.slice(0, 5).map((log) => (
          <div className="log" key={log.id}>
            <i
              className={
                log.kind === "error"
                  ? "red"
                  : log.kind === "warn"
                    ? "yellow"
                    : log.kind === "info"
                      ? "blue"
                      : "green"
              }
            />
            <time>{log.time}</time>
            <span>{log.text}</span>
          </div>
        ))}
        {!state.logs.length && (
          <div className="log-empty">
            <Activity size={16} />
            <span>当前无{tab === 1 ? "采集" : "运行"}任务</span>
          </div>
        )}
      </div>
    </Panel>
  );
  if (tab === 1) {
    const frame = state.frames.find((f) => f.id === state.frame);
    return (
      <>
        <Panel title="当前帧信息" icon={<FileCode2 />}>
          <div className="frame-info-grid">
            {[
              ["当前帧", frame?.id ?? "未选择"],
              ["文件格式", "PCD"],
              ["点云数量", cloud?.header.n.toLocaleString() ?? "—"],
              ["数据来源", frame?.source ?? "—"],
              ["坐标系", "相机系"],
              ["标定状态", calib?.has_calib ? "已标定" : "未标定"],
            ].map(([label, value]) => (
              <div key={label}>
                <small>{label}</small>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="采集任务" icon={<Activity />}>
          <div className="scan-task-progress">
            <span className={state.activeTask ? "running" : ""} />
            <small>{state.activeTask ? "任务运行中" : "空闲"}</small>
          </div>
          <p className="ready-line">
            <ShieldCheck size={17} />
            采集与识别任务互斥
          </p>
          <button
            className="primary wide"
            disabled={Boolean(state.activeTask || state.pending)}
            onClick={() => {
              onNavigate(1);
              document
                .querySelector<HTMLButtonElement>(".left-column form .primary")
                ?.click();
            }}
          >
            <Play size={15} fill="currentColor" />
            开始采集
          </button>
        </Panel>
        {logs}
      </>
    );
  }
  if (tab === 5)
    return (
      <>
        <Panel
          title="程序预览"
          icon={<Code2 />}
          extra={<span className="badge">规范提示，不阻断</span>}
        >
          <div className="segmented program-preview-tabs">
            <span className="active">
              {state.mode === "demo" ? "示例文本（不可执行）" : "后端程序文本"}
            </span>
          </div>
          {program ? (
            <>
              {program.uncalibrated && (
                <Notice warning>坐标仍是相机系，禁止上机</Notice>
              )}
              {program.data.issues.length > 0 && (
                <details className="issues" open>
                  <summary>规范提示 · advisory，不阻断生成</summary>
                  <ul>
                    {program.data.issues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                </details>
              )}
              <pre className="code-preview" aria-label="LS 程序文本">
                {program.data.ls_text.split("\n").map((line, i) => (
                  <div key={i}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    {line}
                  </div>
                ))}
              </pre>
              <div className="two-buttons">
                <button
                  className="secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(program.data.ls_text);
                      store.notify("程序文本已复制");
                    } catch {
                      store.notify(
                        "浏览器未允许剪贴板访问，可选择文本复制",
                        "error",
                      );
                    }
                  }}
                >
                  <Copy size={14} />
                  复制
                </button>
                <button
                  className="secondary"
                  onClick={() => void store.download()}
                >
                  <ArrowDownToLine size={14} />
                  下载 .LS
                </button>
              </div>
            </>
          ) : (
            <div className="empty">
              <FileCode2 size={32} />
              <p>请先生成程序</p>
              <small>选择焊缝，生成后显示程序文本与预演数据。</small>
            </div>
          )}
        </Panel>
        <Panel title="TCP 坐标位置" icon={<Crosshair />}>
          <div id="tcp-context">
            {!program && (
              <>
                <div className="tcp-cells">
                  {["X (mm)", "Y (mm)", "Z (mm)"].map((label) => (
                    <div key={label}>
                      <small>{label}</small>
                      <strong>—</strong>
                    </div>
                  ))}
                </div>
                <div className="coordinate-pair">
                  <div>
                    <strong>相机系坐标</strong>
                    <p>等待程序生成</p>
                  </div>
                  <div>
                    <strong>基座系坐标</strong>
                    <p>等待程序生成</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </Panel>
      </>
    );
  if (tab === 6)
    return (
      <>
        <Panel title="上下文信息" icon={<ShieldCheck />}>
          <div className="context-section">
            <h3>
              <FileCode2 size={17} />
              当前帧
            </h3>
            <strong className="mono">{state.frame || "未选择"}</strong>
            <p>
              来源：
              {state.frames.find((f) => f.id === state.frame)?.source ?? "—"}
            </p>
          </div>
          <div className="context-section">
            <h3>
              <Crosshair size={17} />
              选中焊缝
            </h3>
            <dl className="detail-list">
              <dt>编号</dt>
              <dd>{seam ? seamLabel(seam.id) : "未选择"}</dd>
              <dt>类型</dt>
              <dd>{seam?.shape ?? "—"}</dd>
              <dt>拓扑</dt>
              <dd>{seam?.type ?? "—"}</dd>
              <dt>路径点数</dt>
              <dd>{program?.data.waypoints_cam_mm.length ?? "—"}</dd>
            </dl>
          </div>
          <div className="context-section">
            <h3>
              <Activity size={17} />
              任务状态
            </h3>
            <div className="steps">
              {["点云处理", "语义分割", "焊缝识别", "程序生成", "任务下发"].map(
                (label, i) => (
                  <div key={label}>
                    <i
                      className={
                        (i < 3 && cloud) ||
                        (i === 3 && program) ||
                        (i === 4 && store.currentPush())
                          ? "green"
                          : ""
                      }
                    />
                    <span>{label}</span>
                    <small>
                      {(i < 3 && cloud) ||
                      (i === 3 && program) ||
                      (i === 4 && store.currentPush())
                        ? "完成"
                        : "未开始"}
                    </small>
                  </div>
                ),
              )}
            </div>
          </div>
          <Notice warning>
            仅传输程序文件；程序选择与启动须由操作者在示教器上人工确认。
          </Notice>
        </Panel>
      </>
    );
  if (tab === 2) return <>
    <Panel title="识别结果" icon={<Activity />}>
      <div className="stats recognition-stats">
        <div><small>焊缝数量</small><strong>{state.recognitionReady ? state.seams.length : "—"}</strong></div>
        <div><small>点云总数</small><strong>{state.recognitionReady ? cloud?.header.n.toLocaleString() ?? "—" : "—"}</strong></div>
        <div><small>实例数</small><strong>{state.recognitionReady ? cloud?.header.n_instances ?? "—" : "—"}</strong></div>
      </div>
    </Panel>
    <Panel title="焊缝列表" icon={<Layers3 />}>
      <SeamList compact hideActions minLength={minLength} onAction={onAction} />
    </Panel>
  </>;
  return (
    <>
      {tab === 2 && (
        <Panel title="识别结果" icon={<Activity />}>
          <div className="stats recognition-stats">
            <div>
              <small>焊缝数量</small>
              <strong>{state.recognitionReady ? state.seams.length : "—"}</strong>
            </div>
            <div>
              <small>点云总数</small>
              <strong>{state.recognitionReady ? cloud?.header.n.toLocaleString() ?? "—" : "—"}</strong>
            </div>
            <div>
              <small>实例数</small>
              <strong>{state.recognitionReady ? cloud?.header.n_instances ?? "—" : "—"}</strong>
            </div>
          </div>
        </Panel>
      )}
      <Panel title={tab === 2 ? "焊缝列表" : "焊缝几何详情"} icon={<Layers3 />}>
        {tab === 2 ? (
          <SeamList compact minLength={minLength} onAction={onAction} />
        ) : seam ? (
          <>
            <div className="geometry-seam-heading">
              <FileCode2 size={21} />
              <span>
                编号<strong>{seamLabel(seam.id)}</strong>
              </span>
            </div>
            <dl className="detail-list seam-geometry">
              <dt>构件关系</dt>
              <dd>{seam.shape}</dd>
              <dt>类型</dt>
              <dd>{seam.type}</dd>
              <dt>长度</dt>
              <dd>{seam.length_mm.toFixed(1)} mm</dd>
              <dt>坐标系</dt>
              <dd>相机系</dd>
            </dl>
            <div className="endpoint">
              <Eye size={16} />
              <div>
                起点坐标（X, Y, Z）
                <p className="mono">{xyz(seam.trajectory_mm[0])}</p>
              </div>
            </div>
            <div className="endpoint">
              <Eye size={16} />
              <div>
                终点坐标（X, Y, Z）
                <p className="mono">{xyz(seam.trajectory_mm.at(-1))}</p>
              </div>
            </div>
            <div className="single-seam-actions">
              <h3>
                <Layers3 size={17} />
                单条焊缝操作
              </h3>
              <div>
                {[
                  { label: "查看", action: "view", Icon: Eye },
                  { label: "预演", action: "preview", Icon: Play },
                  { label: "生成 .LS", action: "program", Icon: FileCode2 },
                  { label: "下发", action: "push", Icon: Send },
                ].map((item) => (
                  <button
                    key={item.action}
                    onClick={() =>
                      onAction(
                        item.action as "view" | "preview" | "program" | "push",
                        seam.id,
                      )
                    }
                  >
                    <item.Icon size={19} />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="empty">
            <Layers3 />
            <p>尚未选择焊缝</p>
            <button onClick={() => onNavigate(2)}>前往识别</button>
          </div>
        )}
      </Panel>
      {logs}
    </>
  );
}

