import type {
  FtpSettings,
  PointPair,
  ProgramSettings,
  RecognizeRequest,
  ScanRequest,
} from "./types";
export function validateProgram(p: ProgramSettings): string | null {
  if (p.name !== "" && !/^[A-Z][A-Z0-9_]{0,7}$/.test(p.name))
    return "程序名应以大写字母开头，只含大写字母、数字、下划线，最多 8 位";
  const parts = p.wpr.split(",");
  if (
    parts.length !== 3 ||
    parts.some((v) => v.trim() === "" || !Number.isFinite(Number(v)))
  )
    return "WPR 必须是逗号分隔的三个有限数字";
  if (p.comment.length > 60) return "程序备注不能超过 60 个字符";
  if (
    ![p.utool, p.uframe, p.weld_prog, p.weld_set].every(
      (v) => Number.isInteger(v) && v >= 0,
    )
  )
    return "工具号、坐标系号与焊机编号必须为非负整数";
  if (
    ![p.speed_weld, p.eps, p.max_seg].every((v) => Number.isFinite(v) && v > 0)
  )
    return "速度、简化偏差与最大分段必须大于 0";
  return null;
}
export function validateScan(p: ScanRequest): string | null {
  if (!Number.isInteger(p.scan_ms) || p.scan_ms < 500 || p.scan_ms > 20000)
    return "扫描时长范围为 500–20000 ms";
  if (!Number.isInteger(p.exp_us) || p.exp_us < 10 || p.exp_us > 5000)
    return "曝光时间范围为 10–5000 μs";
  if (!p.dist.every(Number.isFinite) || p.dist[0] >= p.dist[1])
    return "工作距离下限必须小于上限";
  return null;
}
export function validateRecognition(
  p: Omit<RecognizeRequest, "frame">,
): string | null {
  if (
    ![p.voxel, p.tile, p.stride, p.smooth_r, p.max_gap].every(
      (v) => Number.isFinite(v) && v > 0,
    ) ||
    !Number.isInteger(p.smooth_k) ||
    p.smooth_k < 1 ||
    !Number.isFinite(p.min_len) ||
    p.min_len < 0
  )
    return "高级参数应为有效正数，smooth_k 为正整数，最短长度不小于 0";
  return null;
}
export function validatePairs(pairs: PointPair[]): string | null {
  if (pairs.length < 3) return "至少需要 3 组点对";
  if (pairs.some((p) => [...p.cam, ...p.base].some((v) => !Number.isFinite(v))))
    return "点对坐标必须全部为有限数字";
  return null;
}
export function parseMatrix(text: string): number[][] {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("请输入合法的 JSON 4×4 矩阵");
  }
  if (
    !Array.isArray(value) ||
    value.length !== 4 ||
    value.some(
      (row) =>
        !Array.isArray(row) ||
        row.length !== 4 ||
        row.some((v) => typeof v !== "number" || !Number.isFinite(v)),
    )
  )
    throw new Error("矩阵必须是 4 行 × 4 列的有限数字");
  return value;
}
export function validateFtp(p: FtpSettings): string | null {
  if (!p.host.trim() || /[\s/]/.test(p.host) || p.host.includes("://"))
    return "请输入控制器主机名或 IP，不要包含协议和路径";
  if (!Number.isInteger(p.port) || p.port < 1 || p.port > 65535)
    return "端口范围为 1–65535";
  if (!p.remote_dir.trim()) return "请输入远端目录";
  if (!Number.isFinite(p.timeout_s) || p.timeout_s <= 0)
    return "超时必须大于 0";
  return null;
}

/** Accept the legacy JSON wrapper as well as a bare homogeneous matrix. */
export function parseCalibrationInput(
  text: string,
  frame: string,
): import("./types").CalibrationRequest {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("请输入有效的标定 JSON 或 4×4 矩阵");
  }
  if (Array.isArray(value)) return { frame, matrix: parseMatrix(text) };
  if (value && typeof value === "object") {
    const data = value as Record<string, unknown>;
    if ("matrix" in data)
      return { frame, matrix: parseMatrix(JSON.stringify(data.matrix)) };
    if (Array.isArray(data.pairs)) {
      const valid = data.pairs.every(
        (pair) =>
          pair &&
          typeof pair === "object" &&
          ["cam", "base"].every((key) => {
            const vector = (pair as Record<string, unknown>)[key];
            return (
              Array.isArray(vector) &&
              vector.length === 3 &&
              vector.every((v) => typeof v === "number" && Number.isFinite(v))
            );
          }),
      );
      if (!valid) throw new Error("每组点对需要 cam 与 base 两个三维数字坐标");
      const pairs = data.pairs as PointPair[];
      const error = validatePairs(pairs);
      if (error) throw new Error(error);
      return { frame, pairs };
    }
  }
  throw new Error("标定 JSON 应包含 matrix 或 pairs；清除标定请使用独立按钮");
}
