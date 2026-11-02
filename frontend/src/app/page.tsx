"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  CircleHelp,
  Radio,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import { WorkspaceProvider, useWorkspace } from "../stores/provider";
import {
  DEFAULT_FTP,
  DEFAULT_PROGRAM,
  DEFAULT_RECOGNIZE,
  DEFAULT_SCAN,
  type AppMode,
  type ProgramSettings,
  type PushRequest,
} from "../lib/types";
import {
  validateFtp,
  validateProgram,
} from "../lib/validation";
import { Modal, Notice } from "../components/ui";
import Overview from "../components/Overview";
import AppHeader from "../components/AppHeader";
import WorkflowControls, {
  INITIAL_PAIRS,
  type Forms,
} from "../components/WorkflowControls";
import WorkspaceViewport from "../components/WorkspaceViewport";
import ContextPanels from "../components/ContextPanels";

import { useCompact } from "../components/useCompact";
import AcquisitionPage from "../components/acquisition/AcquisitionPage";
import PdfStage from "../components/PdfStage";
import { seamLabel } from "../components/SeamList";
const initialForms: Forms = {
  scan: DEFAULT_SCAN,
  recognize: DEFAULT_RECOGNIZE,
  program: DEFAULT_PROGRAM,
  ftp: DEFAULT_FTP,
  pairs: INITIAL_PAIRS,
  matrix: "[[1,0,0,0],\n [0,1,0,0],\n [0,0,1,0],\n [0,0,0,1]]",
  calibMode: "pairs",
};
type Dialog =
  | { kind: "help" | "settings" | "clear" }
  | {
      kind: "uncalibrated";
      frame: string;
      seamId: number;
      settings: ProgramSettings;
    }
  | { kind: "push"; request: PushRequest; name: string }
  | null;
export default function Page() {
  const [mode, setMode] = useState<AppMode>(
    process.env.NEXT_PUBLIC_DATA_MODE === "live" ? "live" : "demo",
  );
  return (
    <WorkspaceProvider mode={mode}>
      <Workspace key={mode} mode={mode} onMode={setMode} />
    </WorkspaceProvider>
  );
}
function Workspace({
  mode,
  onMode,
}: {
  mode: AppMode;
  onMode: (mode: AppMode) => void;
}) {
  const { state, store } = useWorkspace();
  const calibrationDefaults = useMemo(() => ({
    ...initialForms,
    pairs: mode === "demo" ? INITIAL_PAIRS : Array.from({ length: 3 }, () => ({ cam: [NaN, NaN, NaN] as [number, number, number], base: [NaN, NaN, NaN] as [number, number, number] })),
  }), [mode]);
  const [tab, setTab] = useState(1),
    [light, setLight] = useState(true),

    [dialog, setDialog] = useState<Dialog>(null),
    [forms, setForms] = useState<Forms>(() => ({
      ...calibrationDefaults,
      recognize: { ...DEFAULT_RECOGNIZE, reuse_artifacts: mode === "demo" },
    })),
    [compactPanel, setCompactPanel] = useState<"workflow" | "context">(
      "workflow",
    );
  const recognitionOpened = useRef(false);
  useEffect(() => {
    if (tab !== 2 || recognitionOpened.current || !state.frame || state.loading || state.activeTask || state.pending) return;
    recognitionOpened.current = true;
    store.resetRecognition();
  }, [tab, state.frame, state.loading, state.activeTask, state.pending, store]);
  const toggleTheme = useCallback(() => {
    setLight(previous => {
      const next = !previous;
      try { localStorage.setItem("weld-theme", next ? "light" : "dark"); } catch {}
      return next;
    });
  }, []);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try { const saved = localStorage.getItem("weld-theme"); if (saved === "dark" || saved === "light") setLight(saved === "light"); } catch {}
    });
    return () => { active = false; };
  }, []);
  const [calibrationDrafts, setCalibrationDrafts] = useState<
    Record<string, Pick<Forms, "pairs" | "matrix" | "calibMode">>
  >({});
  const effectiveForms = {
    ...forms,
    pairs: calibrationDrafts[state.frame]?.pairs ?? calibrationDefaults.pairs,
    matrix: calibrationDrafts[state.frame]?.matrix ?? calibrationDefaults.matrix,
    calibMode:
      calibrationDrafts[state.frame]?.calibMode ?? calibrationDefaults.calibMode,
  };
  const leftColumn = useRef<HTMLElement>(null),
    rightColumn = useRef<HTMLElement>(null);
  useEffect(() => {
    leftColumn.current?.scrollTo({ top: 0 });
    rightColumn.current?.scrollTo({ top: 0 });
  }, [tab, compactPanel]);
  const compact = useCompact(),
    closeDialog = useCallback(() => setDialog(null), []);
  // Only non-secret FTP preferences are restored. A password is never persisted.
  useEffect(() => {
    let disposed = false;
    queueMicrotask(() => {
      if (disposed) return;
      try {
        const raw = JSON.parse(
          localStorage.getItem("weld-ftp-preferences") ?? "null",
        ) as unknown;
        if (raw && typeof raw === "object") {
          const safe = raw as Record<string, unknown>;
          setForms((f) => ({
            ...f,
            ftp: {
              ...DEFAULT_FTP,
              host: typeof safe.host === "string" ? safe.host : "",
              port: typeof safe.port === "number" ? safe.port : 21,
              user: typeof safe.user === "string" ? safe.user : "anonymous",
              remote_dir:
                typeof safe.remote_dir === "string" ? safe.remote_dir : "MD:",
              passive: typeof safe.passive === "boolean" ? safe.passive : true,
              timeout_s:
                typeof safe.timeout_s === "number" ? safe.timeout_s : 15,
              password: "",
            },
          }));
        }
      } catch {
        /* Private browsing or corrupt preferences must not prevent startup. */
      }
    });
    return () => {
      disposed = true;
    };
  }, []);
  useEffect(() => {
    if (!state.toast) return;
    const timer = setTimeout(store.clearToast, 4000);
    return () => clearTimeout(timer);
  }, [state.toast, store]);
  const go = (next: number) => {
    setTab(next === 6 ? 5 : next);
    setCompactPanel("workflow");
  };
  const setAndRememberForms: typeof setForms = (update) => {
    const previous = effectiveForms;
    const next = typeof update === "function" ? update(previous) : update;
    if (next.ftp !== previous.ftp) {
      const { host, port, user, remote_dir, passive, timeout_s } = next.ftp;
      try {
        localStorage.setItem(
          "weld-ftp-preferences",
          JSON.stringify({ host, port, user, remote_dir, passive, timeout_s }),
        );
      } catch {
        /* Preference persistence is optional. */
      }
    }
    if (
      next.pairs !== previous.pairs ||
      next.matrix !== previous.matrix ||
      next.calibMode !== previous.calibMode
    )
      setCalibrationDrafts((d) => ({
        ...d,
        [state.frame]: {
          pairs: next.pairs,
          matrix: next.matrix,
          calibMode: next.calibMode,
        },
      }));
    setForms(next);
  };
  function generate() {
    const error = validateProgram(forms.program);
    if (error) {
      store.notify(error, "error");
      return;
    }
    if (!state.frame || state.selected === null) {
      store.notify("请先识别并选择一条焊缝", "warn");
      return;
    }
    if (!state.calibration) {
      store.notify("标定状态未知，请刷新后重试", "error");
      return;
    }
    if (state.calibration.uncalibrated) {
      setDialog({
        kind: "uncalibrated",
        frame: state.frame,
        seamId: state.selected,
        settings: { ...forms.program },
      });
      return;
    }
    void store.generate(forms.program);
  }
  function push() {
    const program = store.currentProgram();
    if (!program) {
      store.notify("请先为当前帧、当前焊缝生成程序", "warn");
      return;
    }
    if (program.uncalibrated) {
      store.notify("坐标仍是相机系，禁止上机。请先标定并重新生成程序", "error");
      return;
    }
    // A simulated transfer has no controller; allow an empty address in demo mode.
    const ftp = {
      ...forms.ftp,
      host: mode === "demo" && !forms.ftp.host.trim()
        ? "controller.demo"
        : forms.ftp.host.trim(),
    };
    const error = validateFtp(ftp);
    if (error) {
      store.notify(error, "error");
      return;
    }
    setDialog({
      kind: "push",
      request: { ...ftp, frame: program.frame, seam_id: program.seamId },
      name: program.data.ls_name,
    });
  }
  function seamAction(
    action: "view" | "preview" | "program" | "push",
    id: number,
  ) {
    store.selectSeam(id);
    if (action === "view") {
      go(2);
      if (compact) setCompactPanel("context");
    } else if (action === "push") {
      go(6);
      if (!store.currentProgram())
        store.notify("请先生成当前帧、当前焊缝的程序", "warn");
    } else {
      go(5);
      if (action === "preview" && !store.currentProgram())
        store.notify("先生成程序，预演将使用返回的相机系途经点和姿态", "info");
    }
  }
  const context = (
    <ContextPanels
      tab={tab}
      minLength={
        Number.isFinite(forms.recognize.min_len) ? forms.recognize.min_len : 0
      }
      onAction={seamAction}
      onTaskOpen={() => {}}
      onNavigate={go}
      calibrationMode={effectiveForms.calibMode}
      pairCount={effectiveForms.pairs.length}
    />
  );
  return (
    <>
      <AppHeader tab={tab} light={light} onNavigate={go} onTheme={toggleTheme} onSettings={() => setDialog({ kind: "settings" })} />
      <div hidden={tab !== 1} data-pane="acquisition">
        <AcquisitionPage onNavigate={go} onMode={onMode} mode={mode} light={light} onTheme={toggleTheme} active={tab === 1} />
      </div>
      <div hidden={tab === 1} data-pane="workbench">
    <PdfStage>
      <div className={`app pdf-app ${light ? "light" : ""}`}>
        <div className="app-header-space" aria-hidden="true" />
        {state.healthError && (
          <div className="connection-error" role="alert">
            <TriangleAlert size={16} />
            {state.healthError}
            <button onClick={() => void store.retry()}>
              <RotateCcw size={14} />
              重新连接
            </button>
          </div>
        )}
        {tab === 0 ? (
          <Overview
            light={light}
            onNavigate={go}
            onHelp={() => setDialog({ kind: "help" })}
          />
        ) : (
          <>
            <main
              className={`workspace page-${tab} ${compact ? "compact" : ""}`}
              style={tab === 2 || tab === 5 ? { gridTemplateColumns: compact ? "232px minmax(0, 1fr)" : "320px minmax(0, 1fr)" } : compact ? { gridTemplateColumns: "232px minmax(602px, 1fr)", gridTemplateRows: "minmax(0, 1fr)", overflowX: "auto" } : undefined}
            >
              <aside className="left-column" ref={leftColumn} style={compact ? { gridColumn: 1, gridRow: 1 } : undefined}>
                {compact && tab !== 2 && tab !== 5 && (
                  <div className="segmented context-tabs">
                    <button
                      className={compactPanel === "workflow" ? "active" : ""}
                      onClick={() => setCompactPanel("workflow")}
                    >
                      工作流
                    </button>
                    <button
                      className={compactPanel === "context" ? "active" : ""}
                      onClick={() => setCompactPanel("context")}
                    >
                      焊缝与上下文
                    </button>
                  </div>
                )}
                {tab === 2 || tab === 5 || !compact || compactPanel === "workflow" ? (
                  <>
                    <WorkflowControls
                      tab={tab}
                      forms={effectiveForms}
                      setForms={setAndRememberForms}
                      onGenerate={generate}
                      onPush={push}
                      onSeamAction={seamAction}
                    />
                    {tab === 2 && context}
                    <div className="sidebar-foot">
                      <ShieldCheck size={15} />
                      <span>
                        {mode === "demo" ? "浏览器演示" : "后端接口"} · 单位 mm
                      </span>
                    </div>
                  </>
                ) : (
                  context
                )}
              </aside>
              <section className="center-column" style={compact ? { gridColumn: 2, gridRow: 1 } : undefined}>
                <WorkspaceViewport
                  tab={tab}
                  light={light}
                  onNavigate={go}
                  calibrationPairs={
                    effectiveForms.calibMode === "pairs"
                      ? effectiveForms.pairs
                      : undefined
                  }
                />
              </section>
              {!compact && tab !== 2 && tab !== 5 && tab !== 5 && (
                <aside className="right-column" ref={rightColumn}>
                  {context}
                </aside>
              )}
            </main>
          </>
        )}

        {state.toast && (
          <div className={`toast toast-${state.toast.kind}`} role="status">
            <CircleHelp size={18} />
            {state.toast.text}
            <button aria-label="关闭提示" onClick={store.clearToast}>
              <X size={16} />
            </button>
          </div>
        )}
        {dialog && (
          <Modal
            title={
              dialog.kind === "uncalibrated"
                ? "当前帧尚未标定"
                : dialog.kind === "push"
                  ? "确认 FTP 程序下发"
                  : dialog.kind === "clear"
                    ? "清除当前帧标定？"
                    : dialog.kind === "settings"
                      ? "系统连接设置"
                      : "关于 WELD VISION"
            }
            onClose={closeDialog}
          >
            {dialog.kind === "uncalibrated" ? (
              <>
                <div className="modal-icon danger">
                  <TriangleAlert />
                </div>
                <p>
                  当前帧 <b>{dialog.frame}</b> · {seamLabel(dialog.seamId)}
                  <br />
                  坐标仍是相机系，<strong>禁止上机</strong>
                  。确认后仅生成供检查的程序文件。
                </p>
                <Notice warning>
                  生成后仍须完成标定并重新生成，才能下发到控制器。
                </Notice>
                <div className="modal-actions">
                  <button
                    className="secondary"
                    onClick={() => {
                      closeDialog();
                      store.notify("请由后端或设备端完成标定，再刷新当前帧", "info");
                    }}
                  >
                    标定说明
                  </button>
                  <button
                    className="primary"
                    onClick={() => {
                      if (
                        state.frame !== dialog.frame ||
                        state.selected !== dialog.seamId
                      ) {
                        store.notify("帧或焊缝已改变，请重新确认", "warn");
                        closeDialog();
                        return;
                      }
                      void store.generate(dialog.settings);
                      closeDialog();
                    }}
                  >
                    确认生成
                  </button>
                </div>
              </>
            ) : dialog.kind === "clear" ? (
              <>
                <p>
                  将清除 <b>{state.frame}</b>{" "}
                  的标定。当前帧已生成程序将失效，需重新生成。
                </p>
                <div className="modal-actions">
                  <button className="secondary" onClick={closeDialog}>
                    保留标定
                  </button>
                  <button
                    className="primary"
                    disabled={Boolean(state.pending)}
                    onClick={() => {
                      void store.calibrate({ frame: state.frame, clear: true });
                      closeDialog();
                    }}
                  >
                    确认清除
                  </button>
                </div>
              </>
            ) : dialog.kind === "push" ? (
              <>
                <dl className="confirmation-details">
                  <dt>目标主机</dt>
                  <dd>
                    {dialog.request.host}:{dialog.request.port}
                  </dd>
                  <dt>目标目录</dt>
                  <dd>{dialog.request.remote_dir}</dd>
                  <dt>程序文件</dt>
                  <dd>
                    {/\.ls$/i.test(dialog.name)
                      ? dialog.name
                      : dialog.name + ".ls"}
                  </dd>
                  <dt>帧 / 焊缝</dt>
                  <dd>
                    {dialog.request.frame} / {seamLabel(dialog.request.seam_id)}
                  </dd>
                </dl>
                <Notice warning>
                  同名程序将被覆盖。只传输文件，不触发电机启动；程序选择与循环启动必须在示教器上人工确认。
                </Notice>
                {mode === "demo" && (
                  <Notice>
                    当前是浏览器模拟，确认后不会建立真实 FTP 连接。
                  </Notice>
                )}
                <div className="modal-actions">
                  <button className="secondary" onClick={closeDialog}>
                    返回检查
                  </button>
                  <button
                    className="primary"
                    onClick={() => {
                      if (
                        state.frame !== dialog.request.frame ||
                        state.selected !== dialog.request.seam_id
                      ) {
                        store.notify("帧或焊缝已改变，请重新确认", "warn");
                        closeDialog();
                        return;
                      }
                      void store.push(dialog.request);
                      closeDialog();
                    }}
                  >
                    {mode === "demo" ? "确认模拟下发" : "确认传输文件"}
                  </button>
                </div>
              </>
            ) : dialog.kind === "settings" ? (
              <>
                <p>
                  当前模式：
                  {mode === "demo" ? "浏览器离线演示" : "FastAPI 后端接口"}
                  。切换模式将开启新的前端会话，保留非敏感 FTP 连接设置。
                </p>
                <div className="mode-options">
                  <button
                    className={mode === "demo" ? "chosen" : ""}
                    disabled={Boolean(state.activeTask || state.pending)}
                    onClick={() => onMode("demo")}
                  >
                    <Box />
                    <strong>离线演示</strong>
                    <small>配套示例数据；不连接后端和设备</small>
                  </button>
                  <button
                    className={mode === "live" ? "chosen" : ""}
                    disabled={Boolean(state.activeTask || state.pending)}
                    onClick={() => onMode("live")}
                  >
                    <Radio />
                    <strong>后端模式</strong>
                    <small>同源 /api，连接既有 FastAPI</small>
                  </button>
                </div>
                {Boolean(state.activeTask || state.pending) && (
                  <Notice warning>
                    任务或提交进行中，请完成后再切换模式。
                  </Notice>
                )}
                <Notice>
                  后端地址通过 BACKEND_ORIGIN 设置，默认
                  127.0.0.1:8000。接口失败会明确提示，不会自动切换成模拟成功。
                </Notice>
                <button
                  className="secondary wide"
                  onClick={() => void store.retry()}
                >
                  <RotateCcw size={15} />
                  刷新健康状态与当前帧
                </button>
              </>
            ) : (
              <>
                <p>
                  使用三维点云完成采集、识别、标定、程序生成、TCP
                  预演与文件下发。所有几何单位均为毫米，预演使用相机系坐标。
                </p>
                <Notice>
                  {mode === "demo"
                    ? "离线示例不请求后端，使用模拟标定和程序。上传配套 demo_workpiece.pcd 可演示焊缝与预演；其他 PCD 仅预览，识别需切换真实后端。"
                    : "当前通过同源 /api 请求既有后端。后端负责推理、标定、程序生成及 FTP。"}
                </Notice>
                <p>
                  真机程序选择与启动须在示教器上人工确认：T1 倍率不高于
                  10%、单段模式、手不离急停。
                </p>
                <button className="primary wide" onClick={closeDialog}>
                  我已了解
                </button>
              </>
            )}
          </Modal>
        )}
      </div>
    </PdfStage>
      </div>
    </>
  );
}

