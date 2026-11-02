"use client";
import type { ReactNode } from "react";
import { useWorkspace } from "../stores/provider";
export default function WorkflowSteps({
  current,
  onNavigate,
}: {
  current: number;
  onNavigate: (tab: number) => void;
}) {
  const { state, store } = useWorkspace();
  const program = store.currentProgram(),
    push = store.currentPush();
  const steps = [
    {
      tab: 2,
      label: "帧与识别",
      ready: state.seams.length > 0,
      running:
        state.activeTask?.kind === "scan" ||
        state.activeTask?.kind === "recognize",
    },
    {
      tab: 3,
      label: "标定",
      ready: Boolean(state.calibration?.has_calib),
      running: state.pending === "calib",
    },
    { tab: 4, label: "焊缝", ready: state.selected !== null, running: false },
    {
      tab: 5,
      label: "程序与预演",
      ready: Boolean(program),
      running: state.pending === "program",
    },
    {
      tab: 6,
      label: "下发",
      ready: Boolean(push),
      running: state.pending === "push",
    },
  ];
  return (
    <nav className="workflow-steps" aria-label="五步业务流程">
      {steps.map((step, i) => (
        <button
          key={step.tab}
          className={
            current === step.tab || (current === 1 && i === 0) ? "current" : ""
          }
          aria-current={
            current === step.tab || (current === 1 && i === 0)
              ? "step"
              : undefined
          }
          title={`${step.label}：${step.running ? "进行中" : step.ready ? "就绪" : "未就绪"}`}
          onClick={() => onNavigate(step.tab)}
        >
          <i
            className={
              step.running ? "blue" : step.ready ? "green" : "idle-dot"
            }
          />
          <span>
            {i + 1}. {step.label}
          </span>
          {step.tab >= 5 && state.calibration?.uncalibrated && (
            <b aria-label="未标定警示">!</b>
          )}
        </button>
      ))}
    </nav>
  );
}


/** Reuse the existing navigation icons; no extra toolbar or layout row. */
export function WorkflowIcon({ tab, children }: { tab: number; children: ReactNode }) {
  const { state, store } = useWorkspace();
  if (tab < 2 || tab > 6) return <>{children}</>;
  const running = tab === 2 ? Boolean(state.activeTask) : tab === 3 ? state.pending === "calib" : tab === 5 ? state.pending === "program" : tab === 6 ? state.pending === "push" : false;
  const ready = tab === 2 ? Boolean(state.cloud && state.frames.find(frame => frame.id === state.frame)?.has_artifacts)
    : tab === 3 ? Boolean(state.calibration?.has_calib)
    : tab === 4 ? state.selected !== null
    : tab === 5 ? Boolean(store.currentProgram()) : Boolean(store.currentPush());
  const warning = tab >= 5 && (!state.calibration || state.calibration.uncalibrated);
  const label = `${running ? "进行中" : ready ? "就绪" : "未就绪"}${warning ? "；未标定，禁止上机" : ""}`;
  return <span title={label} data-workflow-state={running ? "running" : ready ? "ready" : "idle"} style={{ position: "relative", display: "inline-flex", width: 16, height: 16, alignItems: "center", justifyContent: "center" }}>
    {children}
    <i aria-hidden="true" className={running ? "blue" : ready ? "green" : "idle-dot"} style={{ position: "absolute", right: -1, bottom: -1, width: 5, height: 5, borderRadius: "50%", background: !running && !ready ? "var(--muted)" : undefined }} />
    <span className="sr-only">{label}</span>
  </span>;
}
