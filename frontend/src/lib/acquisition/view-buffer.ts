import type { ViewHeader } from "../types";
export function encodeView(
  xyz: Float32Array,
  rgb: Uint8Array,
  instance: Uint16Array,
  options: {
    frame: string;
    source: string;
    nFull?: number;
    center?: [number, number, number];
    extent?: number[];
  },
): ArrayBuffer {
  const n = instance.length;
  if (!n || xyz.length !== n * 3 || rgb.length !== n * 3)
    throw new Error("点云数组长度不一致");
  const extent = options.extent ?? [
    Infinity,
    Infinity,
    Infinity,
    -Infinity,
    -Infinity,
    -Infinity,
  ];
  if (!options.extent)
    for (let i = 0; i < n; i++)
      for (let j = 0; j < 3; j++) {
        extent[j] = Math.min(extent[j], xyz[i * 3 + j]);
        extent[j + 3] = Math.max(extent[j + 3], xyz[i * 3 + j]);
      }
  const center =
    options.center ??
    (extent.slice(0, 3).map((v, i) => (v + extent[i + 3]) / 2) as [
      number,
      number,
      number,
    ]);
  const xyzOffset = 2052,
    rgbOffset = xyzOffset + n * 12,
    instanceOffset = Math.ceil((rgbOffset + n * 3) / 2) * 2;
  const buffer = new ArrayBuffer(instanceOffset + n * 2);
  new Float32Array(buffer, xyzOffset, n * 3).set(xyz);
  new Uint8Array(buffer, rgbOffset, n * 3).set(rgb);
  new Uint16Array(buffer, instanceOffset, n).set(instance);
  const header: ViewHeader = {
    version: 1,
    units: "mm",
    frame: "camera",
    frame_id: options.frame,
    n,
    n_full: Math.max(n, options.nFull ?? n),
    source: options.source,
    center,
    extent,
    n_instances: new Set(instance.filter((id) => id > 0)).size,
    semantic_counts: {},
    offsets: { xyz: xyzOffset, rgb: rgbOffset, instance: instanceOffset },
  };
  const encoded = new TextEncoder().encode(JSON.stringify(header));
  if (encoded.length > 2048) throw new Error("点云头超过协议容量");
  new DataView(buffer).setUint32(0, encoded.length, true);
  new Uint8Array(buffer, 4, encoded.length).set(encoded);
  return buffer;
}
