"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, History, Terminal, X } from "lucide-react";
import { useWorkspace } from "../stores/provider";
const labels = {
  submitting: "提交中",
  queued: "等待中",
  running: "运行中",
  done: "已完成",
  error: "失败",
};
export default function TaskCenter({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
}) {
  const { state, store } = useWorkspace();
  const [tab, setTab] = useState<"tasks" | "logs">("tasks"),
    [selected, setSelected] = useState<string | null>(null);
  const terminal = useRef<HTMLDivElement>(null);
  const task =
    state.history.find((t) => t.id === selected) ??
    state.activeTask ??
    state.history[0];
  useEffect(() => {
    if (terminal.current)
      terminal.current.scrollTop = terminal.current.scrollHeight;
  }, [task?.log.length, open, task?.id]);
  return (
    <footer className={`task-center ${open ? "expanded" : ""}`}>
      <button
        className="task-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Terminal size={16} />
        <strong>任务中心</strong>
        <span className="task-fold-label">（{open ? "展开" : "已折叠"}）</span>
        <span className="task-count">{state.history.length}</span>
        <ChevronDown className={open ? "flip" : ""} size={14} />
      </button>
      <span className="footer-task">
        <i className={state.activeTask ? "blue" : "green"} />
        {state.activeTask
          ? `${state.activeTask.kind === "scan" ? "采集" : "识别"} · ${labels[state.activeTask.state]}`
          : "当前无运行任务"}
      </span>
      <span className="footer-divider" />
      <span className="footer-note">
        {state.mode === "demo"
          ? "浏览器演示 · 所有数据为模拟，不连接真实设备"
          : `后端模式 · 当前帧 ${state.frame || "未选择"}`}
      </span>
      <button
        className="history-button"
        onClick={() => {
          setOpen(!open);
          setTab("tasks");
        }}
      >
        <History size={15} />
        会话历史
      </button>
      {open && (
        <section className="task-drawer">
          <div className="drawer-heading">
            <div className="segmented">
              <button
                className={tab === "tasks" ? "active" : ""}
                onClick={() => setTab("tasks")}
              >
                任务历史 ({state.history.length})
              </button>
              <button
                className={tab === "logs" ? "active" : ""}
                onClick={() => setTab("logs")}
              >
                操作日志 ({state.logs.length})
              </button>
            </div>
            <span>当前会话 · 最多 20 个任务</span>
            <button aria-label="收起任务中心" onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
          </div>
          {tab === "tasks" ? (
            <div className="task-split">
              <div className="task-history">
                {state.history.map((item) => (
                  <button
                    className={task?.id === item.id ? "current" : ""}
                    key={item.id}
                    onClick={() => setSelected(item.id)}
                  >
                    <i
                      className={
                        item.state === "done"
                          ? "green"
                          : item.state === "error"
                            ? "red"
                            : "blue"
                      }
                    />
                    <span>
                      {item.kind === "scan" ? "相机采集" : "焊缝识别"}
                      <small>
                        {item.frame || "新帧"} · {item.createdAt}
                      </small>
                    </span>
                    <b>{labels[item.state]}</b>
                  </button>
                ))}
                {!state.history.length && (
                  <div className="empty">
                    <Terminal />
                    <p>尚无任务记录</p>
                  </div>
                )}
              </div>
              <div className="task-terminal" ref={terminal} aria-live="polite">
                {task ? (
                  <>
                    <div className="terminal-heading">
                      {task.id} <span>{task.seconds.toFixed(1)}s</span>
                    </div>
                    {task.log.map((line, i) => (
                      <div className="terminal-line" key={i}>
                        <span>{String(i + 1).padStart(2, "0")}</span>
                        {line}
                      </div>
                    ))}
                    {task.error && (
                      <div className="terminal-error">{task.error}</div>
                    )}
                    {state.pollError && task.id === state.activeTask?.id && (
                      <div className="terminal-error">
                        {state.pollError}
                        <button onClick={store.retryPolling}>重新检查</button>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="hint">
                    开始采集或识别后，在此查看实时日志。后台任务不提供取消接口。
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="all-logs">
              {state.logs.map((log) => (
                <div className="task-row" key={log.id}>
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
            </div>
          )}
        </section>
      )}
    </footer>
  );
}
