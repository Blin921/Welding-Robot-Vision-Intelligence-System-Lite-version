"use client";
import { useMemo, useState } from "react";
import {
  ChevronRight,
  Eye,
  FileCode2,
  ListFilter,
  Play,
  ScanLine,
  Send,
} from "lucide-react";
import { useWorkspace } from "../stores/provider";
export function seamLabel(id: number) {
  return `W${String(id).padStart(3, "0")}`;
}
export default function SeamList({
  minLength,
  onAction,
  compact = false,
}: {
  minLength: number;
  compact?: boolean;
  onAction: (
    action: "view" | "preview" | "program" | "push",
    id: number,
  ) => void;
}) {
  const { state, store } = useWorkspace();
  const [query, setQuery] = useState("");
  const seams = useMemo(
    () =>
      state.seams.filter(
        (s) =>
          s.length_mm >= minLength &&
          (seamLabel(s.id).toLowerCase().includes(query.toLowerCase()) ||
            s.shape.includes(query) ||
            s.type.includes(query)),
      ),
    [state.seams, minLength, query],
  );
  return (
    <>
      <div className={`search ${compact ? "compact-search" : ""}`}>
        <ListFilter size={15} />
        <input
          aria-label="搜索焊缝"
          placeholder="搜索焊缝编号 / 构件"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span>{seams.length}</span>
      </div>
      <div
        className={`seam-list ${compact ? "compact-seams" : ""}`}
        role="listbox"
        aria-label="焊缝列表"
        tabIndex={0}
        onKeyDown={(e) => {
          if (!["ArrowUp", "ArrowDown"].includes(e.key) || !seams.length)
            return;
          e.preventDefault();
          const current = seams.findIndex((s) => s.id === state.selected),
            next = Math.max(
              0,
              Math.min(
                seams.length - 1,
                current + (e.key === "ArrowDown" ? 1 : -1),
              ),
            );
          store.selectSeam(seams[next].id);
          e.currentTarget
            .querySelector(`[data-seam="${seams[next].id}"]`)
            ?.scrollIntoView({ block: "nearest" });
        }}
      >
        {seams.map((s) => (
          <div
            className={`seam-card ${state.selected === s.id ? "selected" : ""}`}
            key={s.id}
            data-seam={s.id}
          >
            <button
              className="seam-select"
              role="option"
              aria-selected={state.selected === s.id}
              onClick={() => store.selectSeam(s.id)}
            >
              <span className="radio-dot" />
              <strong>{seamLabel(s.id)}</strong>
              <span className="mono">
                {s.length_mm.toFixed(1)} <small>mm</small>
              </span>
              <ChevronRight size={14} />
            </button>
            <p>
              {s.shape}
              <span>{s.type}</span>
            </p>
            <div className="seam-actions">
              <button onClick={() => onAction("view", s.id)}>
                <Eye />
                查看
              </button>
              <button onClick={() => onAction("preview", s.id)}>
                <Play />
                预演
              </button>
              <button onClick={() => onAction("program", s.id)}>
                <FileCode2 />
                生成 .LS
              </button>
              <button onClick={() => onAction("push", s.id)}>
                <Send />
                下发
              </button>
            </div>
          </div>
        ))}
      </div>
      {!seams.length && (
        <div className="empty">
          <ScanLine />
          <p>
            {state.seams.length
              ? "没有符合筛选条件的焊缝"
              : "当前帧尚无焊缝结果"}
          </p>
          <small>
            {state.seams.length
              ? "调整最短长度或搜索关键字"
              : "选择历史帧，或前往 AI 识别"}
          </small>
        </div>
      )}
      <p className={`hint ${compact ? "compact-hint" : ""}`}>
        ↑ / ↓ 切换焊缝 · 最短长度 {minLength} mm
      </p>
    </>
  );
}
