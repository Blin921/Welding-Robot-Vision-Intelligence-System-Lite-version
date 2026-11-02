import { ApiError, type WeldingApi } from "./api";
import { demoCloud, demoSeams } from "./demo-data";
import { validatePairs, validateProgram } from "./validation";
import type {
  Calibration,
  CalibrationRequest,
  CalibrationResult,
  Frame,
  Job,
  Program,
  ProgramRequest,
  PushRequest,
  RecognizeRequest,
  ScanRequest,
  SeamResult,
  Vec3,
} from "./types";
const blankCalibration = (): Calibration => ({
  calib_tag: "demo_display_only",
  has_calib: true,
  uncalibrated: false,
  matrix: [[1, 0, 0, 120], [0, 1, 0, -80], [0, 0, 1, 250], [0, 0, 0, 1]],
  max_dev_mm: 0.42,
  mean_dev_mm: 0.26,
});
/** A browser-only fixture adapter. It never opens connections to a camera/controller. */
export class DemoApi implements WeldingApi {
  protected frameData: Frame[] = [
    {
      id: "sw2_e30",
      source: "dataset",
      bytes: 13002342,
      mtime: Date.now() / 1000,
      has_artifacts: true,
    },
    {
      id: "frame_002",
      source: "camera",
      bytes: 12373197,
      mtime: Date.now() / 1000 - 300,
      has_artifacts: true,
    },
    {
      id: "frame_003",
      source: "upload",
      bytes: 12687769,
      mtime: Date.now() / 1000 - 900,
      has_artifacts: false,
    },
  ];
  private calibrations = new Map<string, Calibration>();
  private jobs = new Map<
    string,
    { job: Job; started: number; request: ScanRequest | RecognizeRequest }
  >();
  private programs = new Map<string, Program>();
  private pushed = new Set<string>();
  async health() {
    return {
      model_ok: false,
      model_error: "浏览器演示模式：未加载模型",
      cpp_ok: false,
    };
  }
  async frames() {
    return { frames: this.frameData.map((f) => ({ ...f })) };
  }
  async upload(frame: string, file: Blob) {
    if (!/^[\w.-]+$/.test(frame))
      throw new ApiError(400, "演示帧名只支持字母、数字、点、下划线和连字符");
    if (file.size === 0) throw new ApiError(400, "不能上传空文件");
    if (file.size > 300 * 1024 * 1024)
      throw new ApiError(413, "点云超过 300MB");
    if (this.frameData.some((f) => f.id === frame))
      throw new ApiError(400, "演示帧名已存在，请重命名文件");
    this.frameData.push({
      id: frame,
      source: "upload",
      bytes: file.size,
      mtime: Date.now() / 1000,
      has_artifacts: false,
    });
    return { id: frame, bytes: file.size };
  }
  private createJob(
    kind: "scan" | "recognize",
    request: ScanRequest | RecognizeRequest,
  ) {
    for (const { job } of this.jobs.values())
      if (job.state === "running") throw new ApiError(409, "已有任务正在运行");
    const id = `demo-${Date.now()}-${this.jobs.size}`;
    const job: Job = {
      id,
      kind,
      state: "running",
      log: [
        `${kind === "scan" ? "相机采集" : "焊缝识别"}任务受理（浏览器模拟）`,
      ],
      error: null,
      result: null,
      seconds: 0,
    };
    this.jobs.set(id, { job, started: Date.now(), request });
    return { job_id: id };
  }
  async scan(p: ScanRequest) {
    return this.createJob("scan", p);
  }
  async recognize(p: RecognizeRequest) {
    if (!this.frameData.some((f) => f.id === p.frame))
      throw new ApiError(404, "帧不存在");
    return this.createJob("recognize", p);
  }
  async job(id: string) {
    const entry = this.jobs.get(id);
    if (!entry) throw new ApiError(404, "任务不存在");
    const { job, request } = entry;
    job.seconds = (Date.now() - entry.started) / 1000;
    if (job.state === "running" && job.seconds >= 2) {
      if (job.kind === "scan") {
        const frame = `demo_scan_${Date.now()}`;
        this.frameData.push({ id: frame, source: "camera", bytes: 12400000, mtime: Date.now() / 1000, has_artifacts: true });
        job.state = "done";
        job.result = { frame, seconds: job.seconds };
        job.log.push("模拟采集完成：示例点云，未连接相机");
      } else {
        const p = request as RecognizeRequest;
        const f = this.frameData.find((f) => f.id === p.frame)!;
        if (!f) {
          job.state = "error";
          job.error = !p.reuse_artifacts
            ? "未加载模型，请勾选复用历史结果"
            : "此帧无历史产物，请选择 sw2_e30；演示模式不推理上传文件";
          job.log.push(job.error);
        } else {
          f.has_artifacts = true;
          job.state = "done";
          job.result = { n_seams: 4, seconds: job.seconds, frame: p.frame };
          job.log.push("复用历史结果（模拟），跳过模型推理", "完成：4 条焊缝");
        }
      }
    }
    return { ...job, log: [...job.log] };
  }
  private requireResult(frame: string) {
    const f = this.frameData.find((f) => f.id === frame);
    if (!f?.has_artifacts) throw new ApiError(404, "此帧无识别结果");
  }
  async view(frame: string) {
    this.requireResult(frame);
    return demoCloud();
  }
  async seams(frame: string): Promise<SeamResult> {
    this.requireResult(frame);
    const c = await this.calibration(frame);
    return {
      frame,
      calib_tag: c.calib_tag,
      uncalibrated: c.uncalibrated,
      seams: demoSeams(),
      primitives: [],
    };
  }
  async calibration(frame: string) {
    return this.calibrations.get(frame) ?? blankCalibration();
  }
  async calibrate(p: CalibrationRequest): Promise<CalibrationResult> {
    if ("clear" in p) {
      this.calibrations.set(p.frame, { calib_tag: null, has_calib: false, uncalibrated: true });
      this.invalidatePrograms(p.frame);
      return { calib_tag: "" };
    }
    if ("pairs" in p) {
      const error = validatePairs(p.pairs);
      if (error) throw new ApiError(400, error);
      const [a, b, c] = p.pairs.map((x) => x.cam);
      const ab = b.map((v, i) => v - a[i]),
        ac = c.map((v, i) => v - a[i]);
      if (
        Math.hypot(
          ab[1] * ac[2] - ab[2] * ac[1],
          ab[2] * ac[0] - ab[0] * ac[2],
          ab[0] * ac[1] - ab[1] * ac[0],
        ) < 1e-6
      )
        throw new ApiError(400, "标定点共线，请选择不共线的三组点对");
    }
    const tag = `demo_calib_${Date.now()}`;
    const c: Calibration = {
      calib_tag: tag,
      has_calib: true,
      uncalibrated: false,
      matrix: "matrix" in p ? p.matrix : blankCalibration().matrix,
      ...("pairs" in p ? { max_dev_mm: 0.42, mean_dev_mm: 0.26 } : {}),
    };
    this.calibrations.set(p.frame, c);
    this.invalidatePrograms(p.frame);
    return {
      calib_tag: tag,
      max_dev_mm: c.max_dev_mm,
      mean_dev_mm: c.mean_dev_mm,
    };
  }
  private invalidatePrograms(frame: string) {
    for (const key of this.programs.keys())
      if (key.startsWith(frame + ":")) this.programs.delete(key);
  }
  async program(p: ProgramRequest) {
    this.requireResult(p.frame);
    const error = validateProgram(p);
    if (error) throw new ApiError(400, error);
    const seam = (await this.seams(p.frame)).seams.find((s) => s.id === p.seam_id);
    if (!seam) throw new ApiError(404, "焊缝不存在");
    const c = await this.calibration(p.frame);
    const name =
      p.name ||
      p.frame
        .toUpperCase()
        .replace(/[^A-Z0-9_]/g, "_")
        .slice(0, 8)
        .replace(/^[^A-Z]/, "D");
    const wpr = p.wpr.split(",").map(Number) as Vec3;
    const program: Program = {
      ls_name: name,
      ls_text: `/PROG ${name}\n/ATTR\nCOMMENT = "DEMO ONLY - DO NOT RUN";\n/MN\n  1: ! Browser fixture, no motion instructions ;\n  2: ! UTOOL ${p.utool}, UFRAME ${p.uframe} ;\n  3: ! ${c.uncalibrated ? "UNCALIBRATED CAMERA COORDINATES" : "SIMULATED CALIBRATION"} ;\n/POS\n! No executable positions in demo output\n/END`,
      issues: [
        "浏览器模拟文件，不含机器人运动指令，禁止上机",
        ...(c.uncalibrated ? ["坐标仍是相机系，禁止上机"] : []),
      ],
      waypoints_cam_mm: seam.trajectory_mm,
      waypoints_base_mm: seam.trajectory_mm.map((point) => point.map((_, row) => (c.matrix?.[row]?.[3] ?? 0) + point.reduce((sum, v, col) => sum + v * (c.matrix?.[row]?.[col] ?? (row === col ? 1 : 0)), 0)) as Vec3),
      wpr_list: seam.trajectory_mm.map(() => [...wpr] as Vec3),
      download: `/api/program/${encodeURIComponent(name)}/download`,
    };
    this.programs.set(`${p.frame}:${p.seam_id}`, program);
    return program;
  }
  async download(p: Program) {
    return new Blob([p.ls_text], { type: "text/plain" });
  }
  async push(p: PushRequest) {
    const program = this.programs.get(`${p.frame}:${p.seam_id}`);
    if (!program) throw new ApiError(404, "请先生成当前帧、当前焊缝的程序");
    if (p.host === "fail.demo")
      throw new ApiError(502, "模拟 FTP 连接失败，请检查控制器地址");
    const remote_path = `${p.remote_dir.replace(/\/$/, "")}/${program.ls_name}.ls`,
      key = `${p.host}:${p.port}/${remote_path}`,
      existed_before = this.pushed.has(key);
    this.pushed.add(key);
    return {
      remote_path,
      bytes: new TextEncoder().encode(program.ls_text).length,
      existed_before,
    };
  }
}
