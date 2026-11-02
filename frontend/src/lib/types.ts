export type Vec3 = [number, number, number];
export type AppMode = "demo" | "live";
export type JobState = "submitting" | "queued" | "running" | "done" | "error";
export interface Health {
  model_ok: boolean;
  model_error: string | null;
  cpp_ok: boolean;
  ckpt?: string;
  cpp?: string;
  threads?: number;
  torch?: string;
}
export interface Frame {
  id: string;
  source: "dataset" | "camera" | "upload";
  bytes: number;
  mtime: number | string;
  has_artifacts: boolean;
}
export interface ViewHeader {
  version: number;
  units: "mm";
  frame: "camera";
  frame_id: string;
  n: number;
  n_full: number;
  source: string;
  center: Vec3;
  extent: number[];
  semantic_counts: Record<string, number>;
  n_instances: number;
  offsets: { xyz: number; rgb: number; instance: number };
  dtype?: unknown;
}
export interface CloudData {
  header: ViewHeader;
  xyz: Float32Array;
  rgb: Uint8Array;
  instance: Uint16Array;
  instanceColors: Uint8Array;
}
export interface Seam {
  id: number;
  shape: string;
  type: string;
  length_mm: number;
  trajectory_mm: Vec3[];
}
export interface SeamResult {
  frame: string;
  calib_tag: string | null;
  uncalibrated: boolean;
  seams: Seam[];
  primitives: unknown[];
}
export interface Calibration {
  matrix?: number[][];
  calib_tag: string | null;
  has_calib: boolean;
  uncalibrated: boolean;
  max_dev_mm?: number;
  mean_dev_mm?: number;
}
export interface CalibrationResult {
  calib_tag: string | null;
  max_dev_mm?: number;
  mean_dev_mm?: number;
}
// The PDF does not specify the nested pair keys. Verify cam/base against schemas.py at integration.
export interface PointPair {
  cam: Vec3;
  base: Vec3;
}
export type CalibrationRequest = { frame: string } & (
  { pairs: PointPair[] } | { matrix: number[][] } | { clear: true }
);
export interface ScanRequest {
  scan_ms: number;
  exp_us: number;
  dist: [number, number];
  loose: boolean;
}
export interface RecognizeRequest {
  frame: string;
  reuse_artifacts: boolean;
  voxel: number;
  tile: number;
  stride: number;
  smooth_k: number;
  smooth_r: number;
  max_gap: number;
  min_len: number;
}
export interface Job {
  id: string;
  kind: "scan" | "recognize";
  state: JobState;
  log: string[];
  error: string | null;
  result: { n_seams?: number; seconds?: number; frame?: string } | null;
  seconds: number;
}
export interface TaskRecord extends Job {
  frame: string;
  createdAt: string;
}
export interface ProgramSettings {
  name: string;
  comment: string;
  utool: number;
  uframe: number;
  weld: boolean;
  inst: "Weld" | "Arc";
  weld_prog: number;
  weld_set: number;
  speed_weld: number;
  eps: number;
  max_seg: number;
  wpr: string;
}
export interface ProgramRequest extends ProgramSettings {
  frame: string;
  seam_id: number;
}
export interface Program {
  ls_name: string;
  ls_text: string;
  issues: string[];
  waypoints_cam_mm: Vec3[];
  waypoints_base_mm: Vec3[];
  wpr_list: Vec3[];
  download: string;
}
export interface GeneratedProgram {
  data: Program;
  frame: string;
  seamId: number;
  uncalibrated: boolean;
  calibTag: string | null;
}
export interface FtpSettings {
  host: string;
  port: number;
  user: string;
  password: string;
  remote_dir: string;
  passive: boolean;
  timeout_s: number;
}
export interface PushRequest extends FtpSettings {
  frame: string;
  seam_id: number;
}
export interface PushResult {
  remote_path: string;
  bytes: number;
  existed_before: boolean;
}
export interface LogEntry {
  id: number;
  time: string;
  text: string;
  kind: "ok" | "info" | "warn" | "error";
}
export const DEFAULT_SCAN: ScanRequest = {
  scan_ms: 2500,
  exp_us: 300,
  dist: [400, 800],
  loose: false,
};
export const DEFAULT_RECOGNIZE: Omit<RecognizeRequest, "frame"> = {
  reuse_artifacts: false,
  voxel: 1.5,
  tile: 200,
  stride: 120,
  smooth_k: 16,
  smooth_r: 3,
  max_gap: 0.008,
  min_len: 50,
};
export const DEFAULT_PROGRAM: ProgramSettings = {
  name: "",
  comment: "",
  utool: 1,
  uframe: 0,
  weld: false,
  inst: "Weld",
  weld_prog: 1,
  weld_set: 1,
  speed_weld: 30,
  eps: 0.5,
  max_seg: 50,
  wpr: "180,0,0",
};
export const DEFAULT_FTP: FtpSettings = {
  host: "",
  port: 21,
  user: "anonymous",
  password: "",
  remote_dir: "MD:",
  passive: true,
  timeout_s: 15,
};

