"use client";
import { useEffect, useMemo, useState } from "react";
import { makeTimeline, sampleTimeline } from "../lib/trajectory";
import type { Program } from "../lib/types";
import type { TcpPose } from "./PointCloud";
export function usePlayback(program: Program | null, active = true) {
  const timeline = useMemo(
    () =>
      makeTimeline(program?.waypoints_cam_mm ?? [], program?.wpr_list ?? []),
    [program],
  );
  const [playing, setPlaying] = useState(false),
    [seconds, setSeconds] = useState(0),
    [speed, setSpeed] = useState(1),
    [previousProgram, setPreviousProgram] = useState(program);
  if (previousProgram !== program) {
    setPreviousProgram(program);
    setPlaying(false);
    setSeconds(0);
  }
  useEffect(() => {
    if (!playing || !active) return;
    let raf = 0,
      last = 0;
    const visibility = () => {
      last = 0;
    };
    document.addEventListener("visibilitychange", visibility);
    const tick = (time: number) => {
      if (!document.hidden && last) {
        const elapsed = ((time - last) / 1000) * speed;
        setSeconds((value) => Math.min(timeline.duration, value + elapsed));
      }
      last = time;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [playing, speed, timeline.duration, active]);
  const atEnd = seconds >= timeline.duration;
  const pose: TcpPose | null =
    program && timeline.points.length
      ? sampleTimeline(timeline, seconds)
      : null;
  return {
    timeline,
    playing: playing && !atEnd,
    seconds,
    speed,
    pose,
    toggle: () => {
      if (atEnd) setSeconds(0);
      setPlaying(!playing || atEnd);
    },
    reset: () => {
      setPlaying(false);
      setSeconds(0);
    },
    seek: (percentage: number) =>
      setSeconds(
        Math.min(1, Math.max(0, percentage / 100)) * timeline.duration,
      ),
    setSpeed,
  };
}
