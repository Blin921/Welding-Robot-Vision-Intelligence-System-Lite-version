"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown, CircleHelp, LoaderCircle, X } from "lucide-react";
export function Panel({
  title,
  icon,
  children,
  extra,
  className = "",
  collapsible = true,
  defaultOpen = true,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  extra?: ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <section className={`panel ${className}`}>
      <div className="panel-title">
        {collapsible ? (
          <button
            className="panel-collapse"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen(!open)}
          >
            <span>
              {icon}
              {title}
            </span>
            <ChevronDown className={open ? "" : "flip"} />
          </button>
        ) : (
          <span>
            {icon}
            {title}
          </span>
        )}
        {extra}
      </div>
      <div id={id} className="panel-body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
export function Field({
  label,
  value,
  onChange,
  unit,
  type = "text",
  min,
  max,
  step = "any",
  disabled = false,
  placeholder = "",
  maxLength,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  unit?: string;
  type?: string;
  min?: number;
  max?: number;
  step?: number | "any";
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div>
        <input
          aria-label={label}
          type={type}
          value={
            typeof value === "number" && !Number.isFinite(value) ? "" : value
          }
          onChange={(e) => onChange(e.target.value)}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={maxLength}
        />
        {unit && <small>{unit}</small>}
      </div>
    </label>
  );
}
export function Notice({
  children,
  warning = false,
}: {
  children: ReactNode;
  warning?: boolean;
}) {
  return (
    <div className={`notice ${warning ? "warning" : ""}`}>
      <CircleHelp />
      {children}
    </div>
  );
}
export function Busy({
  busy,
  children,
}: {
  busy: boolean;
  children: ReactNode;
}) {
  return (
    <>
      {busy && <LoaderCircle className="spin" size={16} />} {children}
    </>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    const focusables = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, textarea, select, [tabindex="0"]',
        ) ?? [],
      );
    focusables()[0]?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const all = focusables();
        const first = all[0],
          last = all.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button className="modal-close" aria-label="关闭弹窗" onClick={onClose}>
          <X size={18} />
        </button>
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
