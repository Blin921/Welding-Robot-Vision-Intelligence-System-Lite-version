import type { CloudData, Vec3, ViewHeader } from "./types";
export const SEMANTIC_COLORS = {
  background: [180, 180, 180],
  pipe: [70, 130, 230],
  rebar: [50, 200, 80],
  flat: [180, 50, 180],
} as const;
export const toDisplay = ([x, y, z]: Vec3): Vec3 => [x, -y, z];
function instanceColor(id: number): [number, number, number] {
  if (id === 0) return [65, 70, 78];
  const h = (id * 0.618) % 1,
    s = 0.68,
    l = 0.58;
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return Math.round(
      255 *
        (l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))),
    );
  };
  return [f(0), f(8), f(4)];
}
export function parseView(buffer: ArrayBuffer): CloudData {
  if (buffer.byteLength < 2052) throw new Error("点云视图不完整：缺少定长头区");
  const len = new DataView(buffer).getUint32(0, true);
  if (len === 0 || len > 2048) throw new Error("点云 JSON 头长度不合法");
  let h: ViewHeader;
  try {
    h = JSON.parse(
      new TextDecoder().decode(new Uint8Array(buffer, 4, len)),
    ) as ViewHeader;
  } catch {
    throw new Error("点云头不是有效 JSON");
  }
  if (h.version !== 1 || h.units !== "mm" || h.frame !== "camera")
    throw new Error("不支持的点云版本、单位或坐标系");
  if (
    !Number.isSafeInteger(h.n) ||
    h.n < 0 ||
    !Number.isSafeInteger(h.n_full) ||
    h.n_full < h.n ||
    !Number.isInteger(h.n_instances) ||
    h.n_instances < 0 ||
    !Array.isArray(h.center) ||
    h.center.length !== 3 ||
    !h.center.every(Number.isFinite) ||
    !Array.isArray(h.extent) ||
    h.extent.length !== 6 ||
    !h.extent.every(Number.isFinite)
  )
    throw new Error("点云头包含非法尺寸或范围");
  const ranges: [number, number, number][] = [
    [h.offsets?.xyz, h.n * 12, 4],
    [h.offsets?.rgb, h.n * 3, 1],
    [h.offsets?.instance, h.n * 2, 2],
  ];
  let end = 2052;
  for (const [offset, bytes, alignment] of ranges) {
    if (
      !Number.isSafeInteger(offset) ||
      offset < end ||
      offset % alignment !== 0 ||
      offset + bytes > buffer.byteLength
    )
      throw new Error("点云偏移越界、重叠或未对齐");
    end = offset + bytes;
  }
  // All data arrays directly reference the original network buffer. No per-point JSON/copy.
  const xyz = new Float32Array(buffer, h.offsets.xyz, h.n * 3);
  const rgb = new Uint8Array(buffer, h.offsets.rgb, h.n * 3);
  const instance = new Uint16Array(buffer, h.offsets.instance, h.n);
  // A single local color preparation pass; geometry/coordinates are never copied.
  const instanceColors = new Uint8Array(h.n * 3);
  const palette = new Map<number, [number, number, number]>();
  for (let i = 0; i < h.n; i++) {
    const id = instance[i];
    let c = palette.get(id);
    if (!c) {
      c = instanceColor(id);
      palette.set(id, c);
    }
    instanceColors.set(c, i * 3);
  }
  return { header: h, xyz, rgb, instance, instanceColors };
}
