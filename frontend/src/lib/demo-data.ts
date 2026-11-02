import type { Seam, Vec3, ViewHeader } from "./types";
let cloudBuffer: ArrayBuffer | undefined;
export function demoSeams(): Seam[] {
  return Array.from({ length: 4 }, (_, i) => {
    const x = i === 3 ? 207 : (i - 1) * 160 + 47;
    const trajectory_mm = Array.from(
      { length: 17 },
      (_, j) => [x + 300, 154, -135 + j * 35.625] as Vec3,
    );
    return {
      id: i + 1,
      shape: i === 2 ? "钢管-钢筋" : "钢管-扁钢",
      type: "相切",
      length_mm: 570,
      trajectory_mm,
    };
  });
}
export function demoCloud(): ArrayBuffer {
  if (cloudBuffer) return cloudBuffer;
  const n = 200000,
    xyzOffset = 2052,
    rgbOffset = xyzOffset + n * 12,
    instOffset = rgbOffset + n * 3;
  const buffer = new ArrayBuffer(instOffset + n * 2);
  const xyz = new Float32Array(buffer, xyzOffset, n * 3),
    rgb = new Uint8Array(buffer, rgbOffset, n * 3),
    inst = new Uint16Array(buffer, instOffset, n);
  let seed = 92,
    index = 0;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const point = (x: number, y: number, z: number, c: number[], id: number) => {
    xyz.set([x + 300, 150 - y, z + 150], index * 3);
    rgb.set(c, index * 3);
    inst[index] = id;
    index++;
  };
  for (let tube = 0; tube < 3; tube++)
    for (let i = 0; i < 30000; i++) {
      const a = rand() * Math.PI * 2,
        z = i >= 28000 ? (rand() > 0.5 ? 310 : -310) : (rand() - 0.5) * 620,
        r =
          i < 22000
            ? 48 + rand() * 1.2
            : i < 28000
              ? 44.5 + rand() * 0.5
              : 44.5 + rand() * 4.7;
      point(
        (tube - 1) * 160 + Math.cos(a) * r,
        Math.sin(a) * r + 12,
        z,
        [70, 130, 230],
        tube + 1,
      );
    }
  for (let bar = 0; bar < 4; bar++)
    for (let i = 0; i < 10000; i++) {
      const a = rand() * Math.PI * 2,
        z = (rand() - 0.5) * 690,
        r = 11 + Math.sin(z * 0.7) * 1.2;
      point(
        (bar - 1.5) * 160 + Math.cos(a) * r,
        Math.sin(a) * r - 12,
        z,
        [50, 200, 80],
        bar + 4,
      );
    }
  for (let plate = 0; plate < 2; plate++)
    for (let i = 0; i < 20000; i++) {
      const vertical = rand() > 0.72,
        sign = plate ? 1 : -1;
      point(
        sign * (vertical ? 293 : 230 + rand() * 63),
        vertical ? -53 + rand() * 43 : -53 + rand() * 2,
        (rand() - 0.5) * 680,
        [180, 50, 180],
        plate + 8,
      );
    }
  while (index < n)
    point(
      (rand() - 0.5) * 760,
      -62 + rand() * 3,
      (rand() - 0.5) * 800,
      [180, 180, 180],
      0,
    );
  const h: ViewHeader = {
    version: 1,
    units: "mm",
    frame: "camera",
    frame_id: "sw2_e30",
    n,
    n_full: 286742,
    source: "demo",
    center: [300, 150, 150],
    extent: [-80, 85, -250, 680, 215, 550],
    semantic_counts: {
      background: 30000,
      pipe: 90000,
      rebar: 40000,
      flat: 40000,
    },
    n_instances: 9,
    offsets: { xyz: xyzOffset, rgb: rgbOffset, instance: instOffset },
  };
  const encoded = new TextEncoder().encode(JSON.stringify(h));
  new DataView(buffer).setUint32(0, encoded.length, true);
  new Uint8Array(buffer, 4, encoded.length).set(encoded);
  cloudBuffer = buffer;
  return buffer;
}
