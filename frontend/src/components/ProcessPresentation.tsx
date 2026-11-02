"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, X } from "lucide-react";
import { useWorkspace } from "../stores/provider";
import { STAGES } from "./samples/stages";
const Scene = dynamic(() => import("./samples/SampleCloud"), { ssr: false });

/** An explicitly illustrative layer; business results always come from the workspace store. */
export default function ProcessPresentation({ stage, light, active = true }: { stage: number; light: boolean; active?: boolean }) {
  const { state } = useWorkspace();
  const spec = STAGES[stage] ?? STAGES[0];
  const [open, setOpen] = useState(stage === 5);
  const [playing, setPlaying] = useState(stage === 5);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const previous = useRef("");
  const start = useCallback(() => { setProgress(0); setOpen(true); setPlaying(true); }, []);
  const task = state.activeTask;
  const trigger = stage === 1 && task?.kind === "scan" ? task.id
    : stage === 2 && task?.kind === "recognize" ? task.id
    : stage === 3 && state.pending === "calib" ? "calib"
    : stage === 5 && state.pending === "program" ? "program"
    : stage === 6 && state.pending === "push" ? "push" : "";
  useEffect(() => {
    // Submitting IDs are replaced by server IDs: one animation per operation.
    const next = trigger ? "busy" : "";
    const shouldStart = active && next && !previous.current;
    previous.current = next;
    let disposed = false;
    if (shouldStart) queueMicrotask(() => { if (!disposed) start(); });
    return () => { disposed = true; };
  }, [trigger, active, start]);
  const running = active && open && playing && progress < 1;
  useEffect(() => {
    if (!running) return;
    let frame = 0, last = performance.now(), accumulated = 0;
    const tick = (now: number) => {
      const delta = Math.min(0.2, (now - last) / 1000); last = now;
      if (!document.hidden) accumulated += delta * speed / spec.duration;
      if (accumulated > 0.003) { const amount = accumulated; accumulated = 0; setProgress(p => Math.min(1, p + amount)); }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, speed, spec.duration]);
  if (!active) return null;
  if (!open) return <button className="process-launch" onClick={start}><Play size={14} />过程演示</button>;
  const phase = Math.min(spec.phases.length - 1, Math.floor(progress * spec.phases.length));
  return <div className={`process-presentation ${light ? "process-light" : ""}`} data-process-stage={spec.key}>
    <div className="process-scene"><Scene kind={spec.key} progress={progress} light={light} pointSize={2} grid reset={0} /></div>
    <div className="process-title"><div><strong>{spec.title}</strong><small>流程示意 · 内置样例点云，实际任务状态与结果见侧栏</small></div><button aria-label="返回实际点云" onClick={() => { setOpen(false); setPlaying(false); }}><X size={18} />返回点云</button></div>
    <ol className="process-phases">{spec.phases.map((label, i) => <li key={label} className={i === phase ? "active" : i < phase ? "done" : ""}><i>{i + 1}</i>{label}</li>)}</ol>
    <div className="process-controls"><button aria-label={playing && progress < 1 ? "暂停过程演示" : "播放过程演示"} onClick={() => { if (progress >= 1) setProgress(0); setPlaying(p => !p || progress >= 1); }}>{playing && progress < 1 ? <Pause size={16} /> : <Play size={16} />}</button><button aria-label="重播过程演示" onClick={start}><RotateCcw size={15} /></button><input aria-label="过程演示进度" type="range" min="0" max="1" step="0.001" value={progress} onChange={e => setProgress(Number(e.target.value))} /><span>{Math.round(progress * 100)}%</span><select aria-label="过程演示速度" value={speed} onChange={e => setSpeed(Number(e.target.value))}>{[0.5, 1, 1.5, 2].map(v => <option key={v} value={v}>{v}×</option>)}</select></div>
  </div>;
}
