import { describe, expect, it } from "vitest";
import { parseView, SEMANTIC_COLORS, toDisplay } from "../blob";
function fixture() {
  const buffer = new ArrayBuffer(2086);
  const header = {
    version: 1,
    units: "mm",
    frame: "camera",
    frame_id: "test",
    n: 2,
    n_full: 3,
    source: "dataset",
    center: [1, 2, 3],
    extent: [0, 0, 0, 2, 4, 6],
    semantic_counts: {},
    n_instances: 1,
    offsets: { xyz: 2052, rgb: 2076, instance: 2082 },
  };
  const encoded = new TextEncoder().encode(JSON.stringify(header));
  new DataView(buffer).setUint32(0, encoded.length, true);
  new Uint8Array(buffer, 4, encoded.length).set(encoded);
  new Float32Array(buffer, 2052, 6).set([1, 2, 3, 4, -5, 6]);
  new Uint8Array(buffer, 2076, 6).set([70, 130, 230, 50, 200, 80]);
  new Uint16Array(buffer, 2082, 2).set([0, 1]);
  return buffer;
}
describe("binary view protocol", () => {
  it("uses little-endian header length and zero-copy typed views at absolute offsets", () => {
    const b = fixture(),
      v = parseView(b);
    expect(v.xyz.buffer).toBe(b);
    expect(v.rgb.buffer).toBe(b);
    expect(v.instance.buffer).toBe(b);
    expect([...v.xyz]).toEqual([1, 2, 3, 4, -5, 6]);
    expect([...v.rgb]).toEqual([70, 130, 230, 50, 200, 80]);
    expect([...v.instance]).toEqual([0, 1]);
  });
  it("keeps instance 0 dark gray and computes a different golden-ratio palette", () => {
    const data = parseView(fixture());
    expect([...data.instanceColors.slice(0, 3)]).toEqual([65, 70, 78]);
    expect([...data.instanceColors.slice(3)]).not.toEqual([65, 70, 78]);
    expect(SEMANTIC_COLORS.pipe).toEqual([70, 130, 230]);
  });
  it("rejects truncated payloads and invalid fixed-header lengths", () => {
    expect(() => parseView(fixture().slice(0, -1))).toThrow(/偏移/);
    const b = fixture();
    new DataView(b).setUint32(0, 2049, true);
    expect(() => parseView(b)).toThrow(/头长度/);
    expect(() => parseView(new ArrayBuffer(200))).toThrow(/不完整/);
  });
  it("rejects unsupported units and overlapping offsets", () => {
    for (const change of [
      { units: "m" },
      { offsets: { xyz: 2052, rgb: 2056, instance: 2082 } },
    ]) {
      const b = fixture(),
        old = JSON.parse(
          new TextDecoder().decode(
            new Uint8Array(b, 4, new DataView(b).getUint32(0, true)),
          ),
        ),
        encoded = new TextEncoder().encode(
          JSON.stringify({ ...old, ...change }),
        );
      new DataView(b).setUint32(0, encoded.length, true);
      new Uint8Array(b, 4, encoded.length).set(encoded);
      expect(() => parseView(b)).toThrow();
    }
  });
});
describe("camera display coordinates", () => {
  it("flips only Y, preserves millimeters, and is involutive", () => {
    const point: [number, number, number] = [130, -62, 800];
    expect(toDisplay(point)).toEqual([130, 62, 800]);
    expect(toDisplay(toDisplay(point))).toEqual(point);
    expect(point).toEqual([130, -62, 800]);
  });
});
