"use client";
import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  Box,
  Home, ScanLine, Crosshair, Layers3, Workflow, Send, Settings2, UserRound, SlidersHorizontal, Activity,
  ChevronDown,
  ChevronUp,
  CloudUpload,
  Database,
  Download,
  Hand,
  History,
  Info,
  Maximize,
  Play,
  RefreshCcw,
  Rotate3D,
  Ruler,
  Settings,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCompact } from "../useCompact";
import { WorkflowIcon } from "../WorkflowSteps";
import { calibrationStatus } from "../../lib/calibration-status";
import ProcessPresentation from "../ProcessPresentation";
import BrandMark from "../BrandMark";
import { useWorkspace } from "../../stores/provider";
import {
  DEFAULT_SCAN,
  type AppMode,
  type ScanRequest,
} from "../../lib/types";
import { validateScan } from "../../lib/validation";
import { exportPcd } from "../../lib/acquisition/export-pcd";
import type { CloudHandle, Measurement } from "./CloudViewport";
import styles from "./acquisition.module.css";
const CloudViewport = dynamic(() => import("./CloudViewport"), { ssr: false });
function Sprite({
  x,
  y,
  w,
  h,
  className = "",
  style,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  className?: string;
  style?: CSSProperties;
}) {
  const { state } = useWorkspace();
  const nav = navigation.findIndex((item) => item.x === x && item.y === y);
  const icons = [Home, Database, ScanLine, Crosshair, Layers3, Workflow, Send];
  const labels = new Map([
    ["45:108", [Database, "点云数据管理"]],
    ["45:515", [Settings2, "扫描采集设置"]],
    ["417:109", [Box, "三维点云预览"]],
    ["1241:108", [Info, "当前帧信息"]],
    ["1241:378", [Activity, "采集任务"]],
    ["1241:602", [History, "任务日志"]],
  ] as const);
  const heading = labels.get(`${x}:${y}` as "45:108");
  const Icon = nav >= 0 ? icons[nav] : heading?.[0];
  let content;
  if (x === 47 && y === 27) content = <><BrandMark /><strong>焊接机器人视觉识别系统</strong></>;
  else if (nav >= 0) content = <>{Icon && <WorkflowIcon tab={nav}><Icon size={15} /></WorkflowIcon>}{navigation[nav].label}</>;
  else if (heading) content = <>{Icon && <Icon size={19} />}{heading[1]}</>;
  else if (x === 1158) content = <><i className={state.health?.model_ok ? styles.green : styles.red} />模型</>;
  else if (x === 1229) content = <><i className={state.health?.cpp_ok ? styles.green : styles.red} />C++ 解算器</>;
  else if (x === 1336) content = <><i className={styles[calibrationStatus(state.calibration).color]} />{calibrationStatus(state.calibration).label}</>;
  else if (x === 1463) content = "离线演示";
  else if (x === 1567) content = <SlidersHorizontal size={19} />;
  else if (x === 1606) content = <UserRound size={20} />;
  else if (x === 94) content = <small>支持 .pcd 格式，单文件不超过 300MB</small>;
  else if (x === 416) content = <svg viewBox="0 0 91 107" width="70" height="80"><g fill="none" stroke="#758d99" strokeWidth="2"><path d="M24 72V24m-5 7 5-7 5 7M24 72h43m-7-5 7 5-7 5M24 72l-15-20m0 7v-7h7" /></g><g fill="#758d99" fontSize="12"><text x="19" y="18">z</text><text x="73" y="77">x</text><text x="1" y="48">y</text></g></svg>;
  return <span aria-hidden="true" className={`${styles.sprite} ${heading ? styles.nativeHeading : ""} ${nav >= 0 ? styles.nativeNav : ""} ${className}`}
    style={{ width: w, height: h, ...style }}>{content}</span>;
}
const navigation = [
  { label: "技术流程", x: 291, y: 30, w: 79, h: 37 },
  { label: "点云建模", x: 393, y: 29, w: 115, h: 39 },
  { label: "焊缝识别", x: 529, y: 29, w: 93, h: 38 },
  { label: "坐标标定", x: 646, y: 29, w: 116, h: 38 },
  { label: "焊缝管理", x: 774, y: 29, w: 114, h: 38 },
  { label: "焊接模拟", x: 900, y: 29, w: 132, h: 38 },
  { label: "程序下发", x: 1041, y: 29, w: 109, h: 38 },
];
type Dialog = "settings" | "profile" | "clear" | null;
function filename(id: string) {
  return id ? (/\.pcd$/i.test(id) ? id : id + ".pcd") : "未载入点云";
}
function numberValue(value: number) {
  return Number.isFinite(value) ? String(value) : "";
}
export default function AcquisitionPage({
  onMode,
  mode, light, active,
}: {
  onNavigate: (page: number) => void;
  onMode: (mode: AppMode) => void;
  mode: AppMode;
  light: boolean;
  onTheme: () => void;
  active: boolean;
}) {
  const { state, store } = useWorkspace();
  const compact = useCompact();
  const outer = useRef<HTMLDivElement>(null),
    viewport = useRef<HTMLElement>(null),
    cloudRef = useRef<CloudHandle>(null),
    fileInput = useRef<HTMLInputElement>(null),
    menu = useRef<HTMLDivElement>(null);
  const [scan, setScan] = useState<ScanRequest>(DEFAULT_SCAN),
    [colorMode, setColorMode] = useState<"semantic" | "instance">("semantic"),
    [pointSize, setPointSize] = useState(2),
    [hidden, setHidden] = useState(false),
    [bounds, setBounds] = useState(false),
    [tool, setTool] = useState<"rotate" | "pan" | "measure">("rotate"),
    [measurement, setMeasurement] = useState<Measurement | null>(null),
    [uploadMenu, setUploadMenu] = useState(false),
    [logMenu, setLogMenu] = useState(false),
    [dialog, setDialog] = useState<Dialog>(null),
    [dragging, setDragging] = useState(false),
    [folded, setFolded] = useState<Record<string, boolean>>({}),
    [projection, setProjection] = useState(false);
  const current = state.frames.find((frame) => frame.id === state.frame),
    busy = Boolean(state.activeTask),
    pending = Boolean(state.pending),
    cloud = state.cloud;
  const cloudSummary = cloud
    ? `${state.frame} · 显示 ${cloud.header.n.toLocaleString()} / 原始 ${cloud.header.n_full.toLocaleString()} 点 · 实例 ${cloud.header.n_instances} · 来源 ${current?.source ?? cloud.header.source} · mm`
    : "尚未载入点云";
  const notify = useCallback(
    (text: string) => store.notify(text, "warn"),
    [store],
  );
  const onMeasure = useCallback(
    (value: Measurement | null) => setMeasurement(value),
    [],
  );
  useEffect(() => {
    if (!uploadMenu && !logMenu) return;
    const close = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) {
        setUploadMenu(false);
        setLogMenu(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [uploadMenu, logMenu]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDialog(null);
        setUploadMenu(false);
        setLogMenu(false);
        setTool("rotate");
        cloudRef.current?.clearMeasurement();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!state.toast) return;
    const timer = setTimeout(store.clearToast, 4000);
    return () => clearTimeout(timer);
  }, [state.toast, store]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    if (!dialog) return;
    const element =
      outer.current?.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () =>
      Array.from(
        element?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,select,[tabindex="0"]',
        ) ?? [],
      );
    focusable()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const all = focusable();
      if (event.shiftKey && document.activeElement === all[0]) {
        event.preventDefault();
        all.at(-1)?.focus();
      } else if (!event.shiftKey && document.activeElement === all.at(-1)) {
        event.preventDefault();
        all[0]?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [dialog]);
  const toggle = (name: string) =>
    setFolded((value) => ({ ...value, [name]: !value[name] }));
  async function upload(files: FileList | File[] | null) {
    setUploadMenu(false);
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      if (!/\.pcd$/i.test(file.name)) {
        store.notify("只支持 .pcd 点云文件", "error");
        continue;
      }
      if (file.size > 300 * 1024 * 1024) {
        store.notify("单文件不能超过 300MB", "error");
        continue;
      }
      setHidden(false);
      await store.upload(file);
    }
  }
  async function selectFrame(id: string) {
    setHidden(false);
    setMeasurement(null);
    await store.selectFrame(id);
  }
  function startScan() {
    const error = validateScan(scan);
    if (error) {
      store.notify(error, "error");
      return;
    }
    void store.run("scan", scan);
  }
  function saveCloud() {
    if (!cloud) {
      store.notify("请先载入点云", "warn");
      return;
    }
    const blob = exportPcd(cloud),
      url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = state.frame + "_view.pcd";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setUploadMenu(false);
    store.notify("当前显示点云已导出", "info");
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await viewport.current?.requestFullscreen();
    } catch {
      store.notify("浏览器未允许全屏，请检查浏览器设置", "error");
    }
  }
  const numeric = (key: "scan_ms" | "exp_us", value: string) =>
    setScan((previous) => ({
      ...previous,
      [key]: value.trim() === "" ? NaN : Number(value),
    }));
  const reset = () => {
    setPointSize(4);
    setColorMode("semantic");
    setHidden(false);
    setProjection(false);
    cloudRef.current?.reset();
  };
  return (
    <div
      ref={outer}
      className={`${styles.screen} ${light ? "" : styles.dark}`}
      data-acquisition-screen
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void upload(event.dataTransfer.files);
      }}
    >
      <div
        className={styles.stage}
        style={{ gridTemplateColumns: compact ? "232px minmax(0, 1fr)" : "320px minmax(0, 1fr)", gridTemplateRows: "76px minmax(0, 1fr)" }}
        data-acquisition-stage
      >
        <div className="app-header-space" aria-hidden="true" />
        <div className={styles.leftColumn} style={compact ? { gridColumn: 1, gridRow: 2 } : undefined}>
          <section
            className={`${styles.panel} ${styles.dataPanel} ${folded.data ? styles.folded : ""}`}
          >
            <button
              className={`${styles.panelHeading} ${styles.darkHeading}`}
              aria-label="折叠或展开点云数据管理"
              aria-expanded={!folded.data}
              onClick={() => toggle("data")}
            >
              <Sprite
                x={45}
                y={108}
                w={171}
                h={30}
                style={{ position: "absolute", left: 14, top: 9 }}
              />
              {folded.data ? <ChevronDown /> : <ChevronUp />}
            </button>
            <div hidden={folded.data} className={styles.dataBody}>
              <div className={styles.frameListHeading}>
                <strong>帧列表（{state.frames.length}）</strong>
                <button
                  aria-label="清空帧列表"
                  title="清空当前工作区列表，不删除后端文件"
                  disabled={!state.frames.length || busy || pending}
                  onClick={() => setDialog("clear")}
                >
                  <Trash2 size={16} />
                  清空
                </button>
              </div>
              <div
                className={styles.frames}
                role="listbox"
                aria-label="点云帧列表"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (
                    !["ArrowUp", "ArrowDown", "Enter"].includes(event.key) ||
                    !state.frames.length
                  )
                    return;
                  event.preventDefault();
                  const index = state.frames.findIndex(
                      (frame) => frame.id === state.frame,
                    ),
                    next = Math.min(
                      state.frames.length - 1,
                      Math.max(
                        0,
                        index +
                          (event.key === "ArrowDown"
                            ? 1
                            : event.key === "ArrowUp"
                              ? -1
                              : 0),
                      ),
                    );
                  void selectFrame(state.frames[next].id);
                }}
              >
                {state.frames.map((frame, index) => (
                  <div
                    key={frame.id}
                    className={`${styles.frameRow} ${state.frame === frame.id ? styles.selectedRow : ""}`}
                  >
                    <button
                      className={styles.selectFrame}
                      role="option"
                      aria-selected={state.frame === frame.id}
                      aria-label={`选择帧 ${frame.id}`}
                      onClick={() => void selectFrame(frame.id)}
                    >
                      <span className={styles.rowRadio}>
                        {state.frame === frame.id ? (
                          <span />
                        ) : frame.source === "dataset" ? (
                          <Database size={12} />
                        ) : frame.source === "camera" ? (
                          <Box size={12} />
                        ) : null}
                      </span>
                      <span className={styles.frameName}>
                        {frame.id.replace(/\.pcd$/i, "")}
                      </span>
                      <span className={styles.sourceLabel}>
                        {frame.source === "dataset" ? (
                          <Box size={16} />
                        ) : frame.source === "camera" ? (
                          <svg
                            width="17"
                            height="17"
                            viewBox="0 0 20 20"
                            aria-hidden="true"
                          >
                            <path
                              d="M2 5h4l1-2h6l1 2h4v12H2Z"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            />
                            <circle
                              cx="10"
                              cy="10"
                              r="3"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            />
                          </svg>
                        ) : (
                          <Upload size={16} />
                        )}
                        <span>{frame.source}</span>
                      </span>
                      <span
                        className={`${styles.resultBadge} ${!frame.has_artifacts ? styles.noResult : ""}`}
                      >
                        {frame.has_artifacts ? "有结果" : "待识别"}
                      </span>
                    </button>
                    <button
                      className={styles.eyeButton}
                      aria-label={`删除帧 ${frame.id}`}
                      title="从工作区删除此帧"
                      disabled={busy || pending}
                      onClick={() => void store.removeFramesFromWorkspace([frame.id])}
                    >
                      <Trash2 size={18} />
                    </button>
                    <span className={styles.srOnly}>{index + 1}</span>
                  </div>
                ))}
                {!state.frames.length && (
                  <div className={styles.emptyFrames}>
                    暂无点云，点击上传或从菜单恢复帧列表。
                  </div>
                )}
              </div>
            </div>
          </section>
          <section className={`${styles.panel} ${styles.importPanel}`} aria-label="导入点云文件">
              <div className={styles.uploadGroup} ref={menu}>
                <button
                  className={styles.uploadMain}
                  aria-label="上传 PCD 文件"
                  disabled={pending}
                  onClick={() => fileInput.current?.click()}
                  style={{ backgroundPosition: "-45px -141px" }}
                >
                  <CloudUpload size={20} /><span>上传 PCD 文件</span>
                </button>
                <button
                  className={styles.uploadArrow}
                  aria-label="更多点云操作"
                  aria-expanded={uploadMenu}
                  onClick={() => setUploadMenu(!uploadMenu)}
                  style={{ backgroundPosition: "-335px -141px" }}
                >
                  <ChevronDown size={16} />
                </button>
                {uploadMenu && (
                  <div className={styles.menu}>
                    <button onClick={() => fileInput.current?.click()}>
                      <CloudUpload />
                      上传 PCD 文件
                    </button>
                    <button onClick={saveCloud} disabled={!cloud}>
                      <Download />
                      导出当前视图 (.pcd)
                    </button>
                    <button
                      onClick={() => {
                        setUploadMenu(false);
                        void store.restoreWorkspaceFrames();
                      }}
                    >
                      <RefreshCcw />
                      恢复 / 刷新帧列表
                    </button>
                  </div>
                )}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept=".pcd"
                multiple
                hidden
                aria-label="选择 PCD 文件"
                onChange={(event) => {
                  void upload(event.target.files);
                  event.target.value = "";
                }}
              />
              <Sprite
                x={94}
                y={189}
                w={265}
                h={20}
                style={{ position: "absolute", left: 63, top: 46 }}
              />

          </section>
          <section
            className={`${styles.panel} ${styles.scanSettings} ${folded.parameters ? styles.folded : ""}`}
          >
            <button
              className={styles.panelHeading}
              aria-label="折叠或展开扫描采集设置"
              aria-expanded={!folded.parameters}
              onClick={() => toggle("parameters")}
            >
              <Sprite
                x={45}
                y={515}
                w={135}
                h={28}
                style={{ position: "absolute", left: 14, top: 8 }}
              />
              {folded.parameters ? <ChevronDown /> : <ChevronUp />}
            </button>
            <form
              className={styles.scanForm}
              hidden={folded.parameters}
              onSubmit={(event) => {
                event.preventDefault();
                startScan();
              }}
              noValidate
            >
              <label className={`${styles.scanField} ${styles.duration}`}>
                <span>扫描时长 (ms)</span>
                <input
                  aria-label="扫描时长 (ms)"
                  type="number"
                  min={500}
                  max={20000}
                  step={1}
                  value={numberValue(scan.scan_ms)}
                  onChange={(event) => numeric("scan_ms", event.target.value)}
                  disabled={busy}
                />
                <i />
              </label>
              <label className={`${styles.scanField} ${styles.exposure}`}>
                <span>曝光 (us)</span>
                <input
                  aria-label="曝光 (us)"
                  type="number"
                  min={10}
                  max={5000}
                  step={1}
                  value={numberValue(scan.exp_us)}
                  onChange={(event) => numeric("exp_us", event.target.value)}
                  disabled={busy}
                />
                <i />
              </label>
              <div className={`${styles.scanField} ${styles.distance}`}>
                <span>工作距离 (mm)</span>
                <div>
                  <input
                    aria-label="工作距离下限"
                    type="number"
                    value={numberValue(scan.dist[0])}
                    disabled={busy}
                    onChange={(event) =>
                      setScan((value) => ({
                        ...value,
                        dist: [
                          event.target.value === ""
                            ? NaN
                            : Number(event.target.value),
                          value.dist[1],
                        ],
                      }))
                    }
                  />
                  <b>–</b>
                  <input
                    aria-label="工作距离上限"
                    type="number"
                    value={numberValue(scan.dist[1])}
                    disabled={busy}
                    onChange={(event) =>
                      setScan((value) => ({
                        ...value,
                        dist: [
                          value.dist[0],
                          event.target.value === ""
                            ? NaN
                            : Number(event.target.value),
                        ],
                      }))
                    }
                  />
                </div>
                <i />
              </div>
              <label className={`${styles.scanField} ${styles.loose}`}>
                <span>loose 模式</span>
                <div className={styles.switchField}>
                  <input
                    aria-label="loose 模式"
                    role="switch"
                    type="checkbox"
                    checked={scan.loose}
                    disabled={busy}
                    onChange={(event) =>
                      setScan((value) => ({
                        ...value,
                        loose: event.target.checked,
                      }))
                    }
                  />
                </div>
                <i />
              </label>
              <button
                className={`${styles.startButton} ${styles.settingsStart}`}
                disabled={busy || pending}
                type="submit"
              >
                <Play size={18} fill="currentColor" />
                {busy ? "采集进行中" : "开始采集"}
              </button>
            </form>
          </section>


        </div>
        <section
          ref={viewport}
          className={`${styles.panel} ${styles.viewport}`}
          style={compact ? { gridColumn: 2, gridRow: 2 } : undefined}
        >
          <div className={styles.viewportHeading} title={cloudSummary}>
            <Sprite x={417} y={109} w={255} h={29} />
          </div>
          <div className={styles.viewToolbar}>
            <div className={styles.pointControl}>
              <label htmlFor="acquisition-point-size">点大小</label>
              <input
                id="acquisition-point-size"
                style={
                  {
                    "--progress": `${((pointSize - 1) / 5) * 100}%`,
                  } as CSSProperties
                }
                type="range"
                min={1}
                max={6}
                step={1}
                value={pointSize}
                onChange={(event) => setPointSize(Number(event.target.value))}
              />
              <output>{pointSize}</output>
            </div>
            <button
              className={styles.resetButton}
              onClick={reset}
              disabled={!cloud}
            >
              重置视角
            </button>
            <button
              className={`${styles.squareButton} ${bounds ? styles.pressed : ""}`}
              aria-label="显示或隐藏包围盒"
              aria-pressed={bounds}
              title="包围盒"
              onClick={() => setBounds(!bounds)}
              disabled={!cloud}
            >
              <Box size={19} />
            </button>
            <button
              className={styles.squareButton}
              aria-label="全屏预览"
              title="全屏"
              onClick={() => void fullscreen()}
            >
              <Maximize size={19} />
            </button>
          </div>
          <div className={styles.cloudLayer} role="group" aria-label={cloudSummary}>
            <ProcessPresentation stage={1} light={light} active={active} pointSize={pointSize} />
            {cloud && !state.loading ? (
              <CloudViewport
                ref={cloudRef}
                cloud={cloud}
                light={light}
                mode={colorMode}
                size={pointSize}
                hidden={hidden}
                bounds={bounds}
                tool={tool}
                onMeasure={onMeasure}
                onError={notify}
              />
            ) : (
              <div className={styles.viewportEmpty}>
                {state.loading
                  ? "正在载入点云…"
                  : (state.loadError ?? "尚未载入点云，请上传文件或选择一帧")}
                {state.loadError && (
                  <button onClick={() => void store.retry()}>重新载入</button>
                )}
              </div>
            )}
          </div>
          {hidden && (
            <div className={styles.hiddenHint}>
              点云已隐藏，点击帧列表的眼睛图标恢复
            </div>
          )}
          <div className={styles.axis} aria-hidden="true">
            <Sprite x={416} y={695} w={91} h={107} />
          </div>
          <div className={styles.viewportTools}>
            <button
              aria-label="平移点云"
              aria-pressed={tool === "pan"}
              title="左键平移"
              onClick={() => setTool("pan")}
            >
              <Hand size={23} />
            </button>
            <button
              aria-label="旋转点云"
              aria-pressed={tool === "rotate"}
              title="左键旋转，滚轮缩放"
              onClick={() => setTool("rotate")}
            >
              <Rotate3D size={22} />
            </button>
            <button
              aria-label="放大点云"
              title="放大"
              onClick={() => cloudRef.current?.zoomIn()}
            >
              <svg width="23" height="23" viewBox="0 0 24 24">
                <circle
                  cx="10"
                  cy="10"
                  r="7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="m15 15 7 7M6 10h8M10 6v8"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </button>
            <button aria-label="适配视角" title="适配视角" onClick={reset}>
              <Maximize size={22} />
            </button>
            <i />
            <button
              aria-label="切换正交透视"
              aria-pressed={projection}
              title="切换正交 / 透视投影"
              onClick={() => {
                setProjection(!projection);
                cloudRef.current?.toggleProjection();
              }}
            >
              <Box size={22} />
            </button>
            <i />
            <button
              aria-label="测量点间距离"
              aria-pressed={tool === "measure"}
              title={"点击两个点，测量毫米距离；Esc 结束"}
              onClick={() => {
                setTool(tool === "measure" ? "rotate" : "measure");
                cloudRef.current?.clearMeasurement();
              }}
            >
              <Ruler size={23} />
            </button>
          </div>
          {tool === "measure" && (
            <div className={styles.measurement}>
              <strong>
                {measurement?.distance !== undefined
                  ? `${measurement.reference ? "示例距离" : "距离"}：${measurement.distance.toFixed(2)} mm`
                  : measurement?.first
                    ? "请选择第二个点"
                    : "请选择第一个点"}
              </strong>
              <button
                aria-label="清除测量"
                onClick={() => cloudRef.current?.clearMeasurement()}
              >
                <X size={15} />
              </button>
            </div>
          )}
        </section>
        {state.toast && (
          <div className={styles.toast} role="status">
            <Info size={18} />
            <span>{state.toast.text}</span>
            <button aria-label="关闭提示" onClick={store.clearToast}>
              <X size={16} />
            </button>
          </div>
        )}
        {dragging && (
          <div className={styles.dropOverlay}>
            <CloudUpload size={45} />
            <strong>松开以载入 PCD 文件</strong>
            <span>单个文件不超过 300MB</span>
          </div>
        )}
        {dialog && (
          <div
            className={styles.modalBackdrop}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setDialog(null);
            }}
          >
            <div
              className={styles.dialog}
              role="dialog"
              aria-modal="true"
              aria-label={
                dialog === "clear"
                  ? "清空工作区"
                  : dialog === "settings"
                    ? "系统设置"
                    : "操作者信息"
              }
            >
              <button
                className={styles.closeDialog}
                aria-label="关闭弹窗"
                onClick={() => setDialog(null)}
              >
                <X size={19} />
              </button>
              {dialog === "clear" ? (
                <>
                  <h2>清空工作区帧列表？</h2>
                  <p>
                    将移除当前工作区的 {state.frames.length}{" "}
                    帧，并卸载点云。后端原始文件不会被删除，可通过上传菜单恢复列表。
                  </p>
                  <div className={styles.dialogActions}>
                    <button onClick={() => setDialog(null)}>保留帧列表</button>
                    <button
                      className={styles.confirmButton}
                      onClick={() => {
                        setDialog(null);
                        void store.removeFramesFromWorkspace(
                          state.frames.map((frame) => frame.id),
                        );
                      }}
                    >
                      确认清空
                    </button>
                  </div>
                </>
              ) : dialog === "settings" ? (
                <>
                  <h2>
                    <Settings size={22} />
                    系统设置
                  </h2>
                  <div className={styles.modeOptions}>
                    <button
                      aria-pressed={mode === "demo"}
                      disabled={busy || pending}
                      onClick={() => onMode("demo")}
                    >
                      离线示例
                    </button>
                    <button
                      aria-pressed={mode === "live"}
                      disabled={busy || pending}
                      onClick={() => onMode("live")}
                    >
                      真实后端
                    </button>
                  </div>
                  <p>
                    离线示例与其他页面共用原有三维演示点云和渲染器。上传的 PCD
                    会实际解析并显示。
                  </p>
                  <p>
                    真实后端通过同源 /api 连接
                    FastAPI。原始文件清理仅作用于本工作区；真实采集需要 RVC
                    相机。
                  </p>
                  <dl>
                    <dt>模型</dt>
                    <dd>
                      {state.health?.model_ok
                        ? "已就绪"
                        : (state.health?.model_error ??
                          state.healthError ??
                          "未就绪")}
                    </dd>
                    <dt>C++ 解算器</dt>
                    <dd>
                      {state.health?.cpp_ok ? "已就绪" : "未连接 / 未就绪"}
                    </dd>
                    <dt>当前帧标定</dt>
                    <dd>
                      {state.calibration?.has_calib ? "已标定" : "未标定"}
                    </dd>
                  </dl>
                  <button
                    className={styles.dialogRefresh}
                    onClick={() => void store.retry()}
                  >
                    <RefreshCcw size={16} />
                    重新检查连接和当前帧
                  </button>
                </>
              ) : (
                <>
                  <h2>操作者信息</h2>
                  <p>
                    当前为本地会话。此版本没有账号认证后端，不会伪造登录状态。文件与任务记录保留在当前浏览器会话中。
                  </p>

                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
