import { describe, expect, it } from "vitest";
import { cumulativeLengths, makeTimeline, sampleTimeline } from "../trajectory";
import type { Vec3 } from "../types";
const points: Vec3[] = [
  [0, 0, 0],
  [100, 0, 0],
  [200, 0, 0],
  [300, 0, 0],
  [400, 0, 0],
  [500, 0, 0],
];
describe("arc length and playback", () => {
  it("accumulates true 3D lengths, including repeated points", () => {
    expect(
      cumulativeLengths([
        [0, 0, 0],
        [3, 4, 0],
        [3, 4, 0],
        [3, 4, 12],
      ]),
    ).toEqual([0, 5, 5, 17]);
    expect(cumulativeLengths([])).toEqual([]);
  });
  it("adds 0.4 s FINE holds at the third and penultimate waypoint", () => {
    const t = makeTimeline(points, []);
    expect(t.length).toBe(500);
    expect(t.duration).toBeCloseTo(5.8);
    const holds = t.segments.filter((s) => s.hold);
    expect(holds.map((h) => h.from)).toEqual([2, 4]);
    holds.forEach((h) => {
      expect(h.end - h.start).toBeCloseTo(0.4);
      expect(sampleTimeline(t, (h.start + h.end) / 2).distance).toBe(
        t.cumulative[h.from],
      );
    });
    expect(sampleTimeline(t, 2.2).position).toEqual([200, 0, 0]);
  });
  it("does not apply FINE to fewer than 5 waypoints", () => {
    const t = makeTimeline(points.slice(0, 4), []);
    expect(t.duration).toBe(3);
    expect(t.segments.some((s) => s.hold)).toBe(false);
  });
  it("samples using the segment-start WPR with continuous clamped positions", () => {
    const t = makeTimeline(points, [
      [180, 0, 0],
      [90, 30, 60],
    ]);
    expect(sampleTimeline(t, 1.5)).toMatchObject({
      position: [150, 0, 0],
      wpr: [90, 30, 60],
      distance: 150,
    });
    expect(sampleTimeline(t, -10).position).toEqual(points[0]);
    expect(sampleTimeline(t, 99).position).toEqual(points.at(-1));
    expect(sampleTimeline(t, 2.40001).distance).toBeCloseTo(200.001, 3);
  });
  it("handles degenerate and empty trajectories without division by zero", () => {
    expect(sampleTimeline(makeTimeline([], []), 0).distance).toBe(0);
    const t = makeTimeline(
      [
        [1, 2, 3],
        [1, 2, 3],
      ],
      [],
    );
    expect(t.duration).toBe(0);
    expect(sampleTimeline(t, 1).position).toEqual([1, 2, 3]);
  });
});
