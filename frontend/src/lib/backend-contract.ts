import type { CalibrationRequest } from "./types";

/** Confirm these nested keys against the supplied schemas.py before live acceptance. */
export const CALIBRATION_POINT_FIELDS = {
  camera: "cam",
  base: "base",
} as const;

export function calibrationPayload(
  request: CalibrationRequest,
  fields: { camera: string; base: string } = CALIBRATION_POINT_FIELDS,
) {
  if (!fields.camera || !fields.base || fields.camera === fields.base)
    throw new Error("标定点对字段映射不合法");
  if ("pairs" in request)
    return {
      frame: request.frame,
      pairs: request.pairs.map((pair) => ({
        [fields.camera]: pair.cam,
        [fields.base]: pair.base,
      })),
    };
  if ("matrix" in request)
    return { frame: request.frame, matrix: request.matrix };
  return { frame: request.frame, clear: true };
}

export function backendErrorDetail(detail: unknown): string | null {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (!Array.isArray(detail)) return null;
  const messages = detail.slice(0, 6).flatMap((item) => {
    if (!item || typeof item !== "object" || typeof item.msg !== "string")
      return [];
    const location = Array.isArray(item.loc)
      ? item.loc
          .filter(
            (part: unknown) =>
              (typeof part === "string" || typeof part === "number") &&
              part !== "body",
          )
          .join(".")
      : "";
    // Never include FastAPI's input/ctx fields: they can contain submitted passwords.
    return [location ? `${location}：${item.msg}` : item.msg];
  });
  return messages.length ? `参数校验失败：${messages.join("；")}` : null;
}

/** FTP timeout_s applies to socket operations, not the whole HTTP exchange. */
export function transferTimeoutMs(seconds: number) {
  const budget =
    Number.isFinite(seconds) && seconds > 0 ? seconds * 6000 + 30000 : 120000;
  return Math.min(2147483647, Math.max(120000, Math.ceil(budget)));
}
