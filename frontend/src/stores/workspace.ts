import { ApiError, errorMessage, type WeldingApi } from "../lib/api";
import { parseView } from "../lib/blob";
import type {
  AppMode,
  Calibration,
  CalibrationRequest,
  CloudData,
  Frame,
  GeneratedProgram,
  Health,
  Job,
  LogEntry,
  ProgramSettings,
  PushRequest,
  PushResult,
  RecognizeRequest,
  ScanRequest,
  Seam,
  TaskRecord,
} from "../lib/types";
export interface WorkspaceState {
  mode: AppMode;
  health: Health | null;
  healthError: string | null;
  frames: Frame[];
  frame: string;
  loading: boolean;
  loadError: string | null;
  cloud: CloudData | null;
  seams: Seam[];
  recognitionReady: boolean;
  calibration: Calibration | null;
  selected: number | null;
  activeTask: TaskRecord | null;
  history: TaskRecord[];
  pollError: string | null;
  logs: LogEntry[];
  toast: { id: number; text: string; kind: LogEntry["kind"] } | null;
  pending: string | null;
  generated: Record<string, GeneratedProgram>;
  pushes: Record<string, PushResult>;
}
const key = (frame: string, seamId: number) => `${frame}:${seamId}`;
export class WorkspaceStore {
  private state: WorkspaceState;
  private listeners = new Set<() => void>();
  private cloudCache = new Map<string, Promise<CloudData>>();
  private calibrations = new Map<string, Calibration>();
  private disposed = false;
  private visible = true;
  private pollTimer: ReturnType<typeof setTimeout> | undefined;
  private pollAbort: AbortController | undefined;
  private loadAbort: AbortController | undefined;
  private initAbort: AbortController | undefined;
  private version = 0;
  private serial = 0;
  private excludedFrames = new Set<string>();
  private resetRecognitionFrames = new Set<string>();
  private recognitionAnimationFrame: string | null = null;
  constructor(
    readonly api: WeldingApi,
    mode: AppMode,
  ) {
    this.state = {
      mode,
      health: null,
      healthError: null,
      frames: [],
      frame: "",
      loading: true,
      loadError: null,
      cloud: null,
      seams: [],
      recognitionReady: false,
      calibration: null,
      selected: null,
      activeTask: null,
      history: [],
      pollError: null,
      logs: [],
      toast: null,
      pending: null,
      generated: {},
      pushes: {},
    };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private patch(p: Partial<WorkspaceState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...p };
    this.listeners.forEach((l) => l());
  }
  notify(text: string, kind: LogEntry["kind"] = "ok") {
    const id = ++this.serial;
    const entry: LogEntry = {
      id,
      time: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
      text,
      kind,
    };
    this.patch({
      toast: { id, text, kind },
      logs: [entry, ...this.state.logs].slice(0, 500),
    });
  }
  clearToast = () => this.patch({ toast: null });
  private appendLog(text: string, kind: LogEntry["kind"] = "info") {
    this.patch({
      logs: [
        {
          id: ++this.serial,
          time: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
          text,
          kind,
        },
        ...this.state.logs,
      ].slice(0, 500),
    });
  }
  private fail(error: unknown) {
    if (error instanceof Error && error.name === "AbortError") return;
    this.notify(errorMessage(error), "error");
  }
  async start() {
    this.disposed = false;
    this.initAbort?.abort();
    const abort = new AbortController();
    this.initAbort = abort;
    await Promise.allSettled([
      this.api
        .health(abort.signal)
        .then((health) => {
          if (!abort.signal.aborted) this.patch({ health, healthError: null });
        })
        .catch((e) => {
          if (!abort.signal.aborted) {
            this.patch({ healthError: errorMessage(e) });
            this.fail(e);
          }
        }),
      this.refreshFrames(abort.signal).catch((e) => {
        if (!abort.signal.aborted) {
          this.patch({ loading: false, loadError: errorMessage(e) });
          this.fail(e);
        }
      }),
    ]);
  }
  dispose() {
    this.disposed = true;
    this.version++;
    this.initAbort?.abort();
    this.loadAbort?.abort();
    this.pollAbort?.abort();
    clearTimeout(this.pollTimer);
  }
  async refreshFrames(signal?: AbortSignal) {
    const { frames } = await this.api.frames(signal);
    if (signal?.aborted || this.disposed) return;
    const visibleFrames = frames.filter(
      (frame) => !this.excludedFrames.has(frame.id),
    );
    this.patch({ frames: visibleFrames });
    if (
      !this.state.frame ||
      !visibleFrames.some((f) => f.id === this.state.frame)
    ) {
      const frame =
        visibleFrames.find((f) => f.has_artifacts)?.id ??
        visibleFrames[0]?.id ??
        "";
      if (frame) await this.selectFrame(frame);
      else
        this.patch({
          loading: false,
          frame: "",
          cloud: null,
          seams: [],
      recognitionReady: false,
          calibration: null,
          selected: null,
        });
    }
  }
  retry = async () => {
    await this.start();
    if (this.state.frame) await this.selectFrame(this.state.frame, true);
  };
  private loadCloud(frame: string) {
    let promise = this.cloudCache.get(frame);
    if (!promise) {
      promise = this.api
        .view(frame)
        .then(parseView)
        .catch((error) => {
          this.cloudCache.delete(frame);
          throw error;
        });
      this.cloudCache.set(frame, promise);
    }
    return promise;
  }
  async selectFrame(frame: string, force = false) {
    const version = ++this.version;
    this.loadAbort?.abort();
    const abort = new AbortController();
    this.loadAbort = abort;
    if (force) this.cloudCache.delete(frame);
    this.patch({
      frame,
      loading: true,
      loadError: null,
      cloud: null,
      seams: [],
      recognitionReady: false,
      calibration: this.calibrations.get(frame) ?? null,
      selected: null,
    });
    const results = await Promise.allSettled([
      this.loadCloud(frame),
      this.api.seams(frame, abort.signal),
      this.api.calibration(frame, abort.signal),
    ] as const);
    if (abort.signal.aborted || version !== this.version || this.disposed)
      return;
    const [view, seams, calib] = results;
    const errors: string[] = [];
    for (const result of results)
      if (
        result.status === "rejected" &&
        !(result.reason instanceof ApiError && result.reason.status === 404)
      )
        errors.push(errorMessage(result.reason));
    const calibration =
      calib.status === "fulfilled"
        ? {
            ...(this.calibrations.get(frame)?.calib_tag === calib.value.calib_tag
              ? this.calibrations.get(frame)
              : {}),
            ...calib.value,
          }
        : null;
    if (calibration) {
      this.calibrations.set(frame, calibration);
      if (
        Object.values(this.state.generated).some(
          (p) =>
            p.frame === frame &&
            (p.calibTag !== calibration.calib_tag ||
              p.uncalibrated !== calibration.uncalibrated),
        )
      )
        this.invalidatePrograms(frame);
    }
    const recognitionReady = !this.resetRecognitionFrames.has(frame) &&
      this.state.frames.find(item => item.id === frame)?.has_artifacts !== false;
    const items = recognitionReady && seams.status === "fulfilled" ? seams.value.seams : [];
    this.patch({
      loading: false,
      cloud: view.status === "fulfilled" ? view.value : null,
      seams: items,
      recognitionReady,
      selected: items[0]?.id ?? null,
      calibration,
      loadError: errors[0] ?? null,
    });
    if (errors.length) this.notify(errors[0], "error");
  }
  beginRecognitionAnimation = (frame: string) => {
    this.recognitionAnimationFrame = frame;
    this.resetRecognitionFrames.add(frame);
    if (this.state.frame === frame) this.patch({ recognitionReady: false, seams: [], selected: null });
  };
  finishRecognitionAnimation = () => {
    const frame = this.recognitionAnimationFrame;
    this.recognitionAnimationFrame = null;
    if (!frame || this.disposed) return;
    const latest = this.state.history.find(task => task.kind === "recognize" && task.frame === frame);
    if (latest?.state === "done" && !(this.state.activeTask?.kind === "recognize" && this.state.activeTask.frame === frame)) {
      this.resetRecognitionFrames.delete(frame);
      if (this.state.frame === frame) void this.selectFrame(frame);
    }
  };
  resetRecognition = () => {
    const { frame, activeTask, pending, loading } = this.state;
    if (!frame || activeTask || pending || loading) return;
    this.resetRecognitionFrames.add(frame);
    this.invalidatePrograms(frame);
    this.patch({ seams: [], selected: null, recognitionReady: false });
    this.notify("当前帧识别结果已重置，请重新开始识别");
  };
  selectSeam = (id: number) => {
    if (this.state.seams.some((s) => s.id === id)) this.patch({ selected: id });
  };
  unloadFrame() {
    if (this.state.pending) {
      this.notify("当前操作进行中，请稍后卸载", "warn");
      return;
    }
    this.version++;
    this.loadAbort?.abort();
    this.patch({
      frame: "",
      cloud: null,
      seams: [],
      recognitionReady: false,
      selected: null,
      calibration: null,
      loading: false,
      loadError: null,
    });
  }
  async removeFramesFromWorkspace(ids: string[]) {
    if (this.state.activeTask || this.state.pending) {
      this.notify("任务进行中，请完成后再清理工作区", "warn");
      return;
    }
    ids.forEach((id) => {
      this.excludedFrames.add(id);
      this.cloudCache.delete(id);
    });
    if (ids.includes(this.state.frame)) this.unloadFrame();
    const frames = this.state.frames.filter(
      (f) => !this.excludedFrames.has(f.id),
    );
    this.patch({ frames });
    if (!this.state.frame && frames[0]) await this.selectFrame(frames[0].id);
    this.notify("已从当前工作区移除，后端文件未删除", "info");
  }
  async restoreWorkspaceFrames() {
    this.excludedFrames.clear();
    try {
      await this.refreshFrames();
      this.notify("帧列表已刷新");
    } catch (error) {
      this.fail(error);
    }
  }
  async upload(file: File) {
    if (file.size > 300 * 1024 * 1024) {
      this.notify("点云超过 300MB，请缩小后上传", "error");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pcd")) {
      this.notify("请选择 .pcd 格式的点云文件", "error");
      return;
    }
    if (!file.size) {
      this.notify("不能上传空文件", "error");
      return;
    }
    if (this.state.pending) return;
    const frame = file.name.replace(/\.pcd$/i, "");
    this.patch({ pending: "upload" });
    try {
      const result = await this.api.upload(frame, file);
      this.excludedFrames.delete(result.id);
      this.cloudCache.delete(result.id);
      this.invalidatePrograms(result.id);
      await this.refreshFrames();
      await this.selectFrame(result.id);
      this.notify(
        this.state.mode === "demo"
          ? `已载入点云：${result.id}.pcd`
          : `上传成功：${result.id}`,
      );
    } catch (e) {
      if (this.state.mode === "live") {
        this.notify(`上传失败：${errorMessage(e)}。若仅测试本地点云，请在系统设置切换“离线示例”后重新上传；真实后端模式需要 FastAPI 上传接口可用。`, "error");
        return;
      }
      this.fail(e);
    } finally {
      this.patch({ pending: null });
    }
  }
  async run(
    kind: "scan" | "recognize",
    request: ScanRequest | RecognizeRequest,
  ) {
    if (this.state.activeTask) {
      this.notify("已有采集或识别任务，请等待完成", "warn");
      return;
    }
    const frame =
      kind === "recognize"
        ? (request as RecognizeRequest).frame
        : this.state.frame;
    const initial: TaskRecord = {
      id: `submitting-${++this.serial}`,
      kind,
      state: "submitting",
      log: [],
      error: null,
      result: null,
      seconds: 0,
      frame,
      createdAt: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
    };
    if (kind === "recognize") {
      this.resetRecognitionFrames.add(frame);
      if (this.state.frame === frame) this.patch({ seams: [], selected: null, recognitionReady: false });
    }
    this.patch({ activeTask: initial, pollError: null });
    this.appendLog(`${kind === "scan" ? "采集" : "识别"}任务提交中`);
    try {
      const response =
        kind === "scan"
          ? await this.api.scan(request as ScanRequest)
          : await this.api.recognize(request as RecognizeRequest);
      const task = {
        ...initial,
        id: response.job_id,
        state: "queued" as const,
      };
      this.patch({
        activeTask: task,
        history: [task, ...this.state.history].slice(0, 20),
      });
      this.schedulePoll(0);
    } catch (e) {
      const failed = {
        ...initial,
        state: "error" as const,
        error: errorMessage(e),
      };
      this.patch({
        activeTask: null,
        history: [failed, ...this.state.history].slice(0, 20),
      });
      this.fail(e);
    }
  }
  private schedulePoll(delay = 1500) {
    clearTimeout(this.pollTimer);
    if (this.visible && !this.disposed && this.state.activeTask)
      this.pollTimer = setTimeout(() => void this.poll(), delay);
  }
  setVisible(visible: boolean) {
    this.visible = visible;
    if (!visible) {
      clearTimeout(this.pollTimer);
      this.pollAbort?.abort();
    } else this.schedulePoll(0);
  }
  retryPolling = () => this.schedulePoll(0);
  private async poll() {
    const task = this.state.activeTask;
    if (!task || this.disposed || !this.visible || task.state === "submitting")
      return;
    const abort = new AbortController();
    this.pollAbort = abort;
    try {
      const job: Job = await this.api.job(task.id, abort.signal);
      if (
        abort.signal.aborted ||
        this.disposed ||
        this.state.activeTask?.id !== task.id
      )
        return;
      const record = { ...task, ...job };
      for (const line of job.log.slice(task.log.length))
        this.appendLog(line, job.state === "error" ? "error" : "info");
      this.patch({
        activeTask: record,
        history: this.state.history.map((t) => (t.id === job.id ? record : t)),
        pollError: null,
      });
      if (job.state === "done" || job.state === "error") {
        this.patch({ activeTask: null });
        if (job.state === "error") {
          this.notify(job.log.at(-1) || job.error || "任务失败", "error");
          return;
        }
        if (job.kind === "recognize") {
          if (this.recognitionAnimationFrame !== task.frame) this.resetRecognitionFrames.delete(task.frame);
          this.cloudCache.delete(task.frame);
          this.invalidatePrograms(task.frame);
        }
        this.notify(
          job.kind === "recognize"
            ? `识别完成：${job.result?.n_seams ?? "—"} 条焊缝，耗时 ${(job.result?.seconds ?? job.seconds).toFixed(1)} 秒`
            : "采集完成",
        );
        try {
          await this.refreshFrames();
          if (this.state.frame === task.frame && job.kind === "recognize")
            await this.selectFrame(task.frame);
          if (job.kind === "scan" && job.result?.frame)
            await this.selectFrame(job.result.frame);
        } catch (error) {
          this.fail(error);
        }
      } else this.schedulePoll();
    } catch (e) {
      if (abort.signal.aborted || this.disposed) return;
      if (e instanceof ApiError && e.status === 404) {
        const record = {
          ...task,
          state: "error" as const,
          error: "后端已不再保留此任务；请检查结果后重新提交",
        };
        this.patch({
          activeTask: null,
          history: this.state.history.map((t) =>
            t.id === task.id ? record : t,
          ),
        });
        this.fail(new Error(record.error));
        return;
      }
      const message = errorMessage(e);
      if (this.state.pollError !== message) this.fail(e);
      this.patch({ pollError: message });
      this.schedulePoll(1500);
    }
  }
  private invalidatePrograms(frame: string) {
    this.patch({
      generated: Object.fromEntries(
        Object.entries(this.state.generated).filter(
          ([, p]) => p.frame !== frame,
        ),
      ),
      pushes: Object.fromEntries(
        Object.entries(this.state.pushes).filter(
          ([k]) => !k.startsWith(`${frame}:`),
        ),
      ),
    });
  }
  async calibrate(request: CalibrationRequest) {
    if (this.state.pending) return;
    this.patch({ pending: "calib" });
    try {
      const result = await this.api.calibrate(request);
      // The mutation has already succeeded even if the subsequent status read fails.
      this.invalidatePrograms(request.frame);
      this.calibrations.delete(request.frame);
      if (this.state.frame === request.frame) this.patch({ calibration: null });
      const status = await this.api.calibration(request.frame);
      const calibration = {
        ...status,
        ...("matrix" in request ? { matrix: request.matrix } : {}),
        max_dev_mm: result.max_dev_mm,
        mean_dev_mm: result.mean_dev_mm,
      };
      this.calibrations.set(request.frame, calibration);
      this.invalidatePrograms(request.frame);
      if (this.state.frame === request.frame) this.patch({ calibration });
      this.notify(
        "clear" in request
          ? "当前帧标定已清除"
          : `标定已保存：${result.calib_tag}${(result.max_dev_mm ?? 0) > 1.5 ? "；最大残差超过 1.5mm，请复核" : ""}`,
        (result.max_dev_mm ?? 0) > 1.5 ? "warn" : "ok",
      );
      return calibration;
    } catch (e) {
      this.fail(e);
      return null;
    } finally {
      this.patch({ pending: null });
    }
  }
  currentProgram() {
    const s = this.state;
    if (s.selected === null) return null;
    const program = s.generated[key(s.frame, s.selected)];
    if (
      !program ||
      !s.calibration ||
      program.calibTag !== s.calibration.calib_tag ||
      program.uncalibrated !== s.calibration.uncalibrated
    )
      return null;
    return program;
  }
  currentPush() {
    const s = this.state;
    return s.selected === null
      ? null
      : (s.pushes[key(s.frame, s.selected)] ?? null);
  }
  async generate(settings: ProgramSettings) {
    const { frame, selected, calibration } = this.state;
    if (!frame || selected === null) {
      this.notify("请先识别并选择一条焊缝", "warn");
      return null;
    }
    if (!calibration) {
      this.notify("无法确认标定状态，请刷新后重试", "error");
      return null;
    }
    if (this.state.pending) return null;
    this.patch({ pending: "program" });
    try {
      const data = await this.api.program({
        ...settings,
        frame,
        seam_id: selected,
      });
      const generated: GeneratedProgram = {
        data,
        frame,
        seamId: selected,
        uncalibrated: calibration.uncalibrated,
        calibTag: calibration.calib_tag,
      };
      const k = key(frame, selected);
      const pushes = { ...this.state.pushes };
      delete pushes[k];
      this.patch({
        generated: { ...this.state.generated, [k]: generated },
        pushes,
      });
      this.notify("程序已生成；请查看规范提示与坐标系");
      return generated;
    } catch (e) {
      this.fail(e);
      return null;
    } finally {
      this.patch({ pending: null });
    }
  }
  async download() {
    const program = this.currentProgram();
    if (!program) {
      this.notify("请先生成当前焊缝的程序", "warn");
      return;
    }
    try {
      const blob = await this.api.download(program.data);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = program.data.ls_name.replace(/\.ls$/i, "") + ".ls";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      this.notify("程序文件已下载");
    } catch (e) {
      this.fail(e);
    }
  }
  async push(request: PushRequest) {
    const program = this.currentProgram();
    if (
      !program ||
      program.frame !== request.frame ||
      program.seamId !== request.seam_id
    ) {
      this.notify("请先生成当前帧、当前焊缝的程序", "warn");
      return;
    }
    if (this.state.pending) return;
    this.patch({ pending: "push" });
    try {
      const result = await this.api.push(request);
      this.patch({
        pushes: {
          ...this.state.pushes,
          [key(request.frame, request.seam_id)]: result,
        },
      });
      this.notify(
        `${this.state.mode === "demo" ? "模拟传输完成（未连接设备）" : "下发完成"}：${result.bytes} 字节 → ${result.remote_path}${result.existed_before ? "；已覆盖控制器同名程序" : ""}`,
        result.existed_before ? "warn" : "ok",
      );
      return result;
    } catch (e) {
      this.fail(e);
    } finally {
      this.patch({ pending: null });
    }
  }
}
