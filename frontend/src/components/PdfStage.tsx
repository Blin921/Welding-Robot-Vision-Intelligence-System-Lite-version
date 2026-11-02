"use client";
import type { ReactNode } from "react";
export default function PdfStage({ children }: { children: ReactNode }) {
  return <div className="pdf-stage">{children}</div>;
}
