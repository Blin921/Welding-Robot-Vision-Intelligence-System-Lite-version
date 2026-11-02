import type { Vec3 } from "./types";
export interface Segment {
  start: number;
  end: number;
  from: number;
  to: number;
  distance0: number;
  distance1: number;
  hold: boolean;
}
export interface Timeline {
  points: Vec3[];
  wpr: Vec3[];
  cumulative: number[];
  segments: Segment[];
  duration: number;
  length: number;
}
export function cumulativeLengths(points: Vec3[]): number[] {
  const out = points.length ? [0] : [];
  for (let i = 1; i < points.length; i++)
    out.push(
      out[i - 1] + Math.hypot(...points[i].map((n, j) => n - points[i - 1][j])),
    );
  return out;
}
export function makeTimeline(points: Vec3[], wpr: Vec3[]): Timeline {
  const cumulative = cumulativeLengths(points),
    segments: Segment[] = [];
  let time = 0;
  for (let i = 0; i < points.length; i++) {
    if (i > 0) {
      const duration = (cumulative[i] - cumulative[i - 1]) / 100;
      if (duration > 0) {
        segments.push({
          start: time,
          end: time + duration,
          from: i - 1,
          to: i,
          distance0: cumulative[i - 1],
          distance1: cumulative[i],
          hold: false,
        });
        time += duration;
      }
    }
    if (points.length >= 5 && (i === 2 || i === points.length - 2)) {
      segments.push({
        start: time,
        end: time + 0.4,
        from: i,
        to: i,
        distance0: cumulative[i],
        distance1: cumulative[i],
        hold: true,
      });
      time += 0.4;
    }
  }
  return {
    points,
    wpr,
    cumulative,
    segments,
    duration: time,
    length: cumulative.at(-1) ?? 0,
  };
}
export function sampleTimeline(timeline: Timeline, seconds: number) {
  const { points, wpr, segments } = timeline;
  const t = Math.max(0, Math.min(seconds, timeline.duration));
  const segment = segments.find((s) => t < s.end) ?? segments.at(-1);
  if (!points.length)
    return {
      position: [0, 0, 0] as Vec3,
      wpr: [180, 0, 0] as Vec3,
      distance: 0,
      hold: false,
      index: 0,
    };
  if (!segment)
    return {
      position: points[0],
      wpr: wpr[0] ?? ([180, 0, 0] as Vec3),
      distance: 0,
      hold: false,
      index: 0,
    };
  const fraction = segment.hold
    ? 0
    : Math.min(
        1,
        Math.max(0, (t - segment.start) / (segment.end - segment.start)),
      );
  const position = points[segment.from].map(
    (n, i) => n + (points[segment.to][i] - n) * fraction,
  ) as Vec3;
  return {
    position,
    wpr: wpr[segment.from] ?? ([180, 0, 0] as Vec3),
    distance:
      segment.distance0 + (segment.distance1 - segment.distance0) * fraction,
    hold: segment.hold,
    index: segment.from,
  };
}
