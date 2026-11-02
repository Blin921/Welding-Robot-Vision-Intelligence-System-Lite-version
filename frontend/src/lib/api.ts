import {
  backendErrorDetail,
  calibrationPayload,
  transferTimeoutMs,
} from "./backend-contract";
import type {
  Calibration,
  CalibrationRequest,
  CalibrationResult,
  Frame,
  Health,
  Job,
  Program,
  ProgramRequest,
  PushRequest,
  PushResult,
  RecognizeRequest,
  ScanRequest,
  SeamResult,
} from "./types";
export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail);
    this.name = "ApiError";
  }
}
export interface WeldingApi {
  health(signal?: AbortSignal): Promise<Health>;
  frames(signal?: AbortSignal): Promise<{ frames: Frame[] }>;
  upload(frame: string, file: Blob): Promise<{ id: string; bytes: number }>;
  scan(request: ScanRequest): Promise<{ job_id: string }>;
  recognize(request: RecognizeRequest): Promise<{ job_id: string }>;
  job(id: string, signal?: AbortSignal): Promise<Job>;
  view(frame: string, signal?: AbortSignal): Promise<ArrayBuffer>;
  seams(frame: string, signal?: AbortSignal): Promise<SeamResult>;
  calibration(frame: string, signal?: AbortSignal): Promise<Calibration>;
  calibrate(request: CalibrationRequest): Promise<CalibrationResult>;
  program(request: ProgramRequest): Promise<Program>;
  download(program: Program): Promise<Blob>;
  push(request: PushRequest): Promise<PushResult>;
}
export class HttpApi implements WeldingApi {
  constructor(
    private fetcher: typeof fetch = (input, init) => fetch(input, init),
  ) {}
  private async request<T>(
    path: string,
    options: RequestInit = {},
    binary = false,
    expected?: number,
    timeoutMs?: number,
  ): Promise<T> {
    const timeout = AbortSignal.timeout(
      timeoutMs ?? (options.method === "PUT" ? 120000 : 30000),
    );
    const signal = options.signal
      ? AbortSignal.any([options.signal, timeout])
      : timeout;
    try {
      const response = await this.fetcher(`/api${path}`, {
        cache: "no-store",
        ...options,
        signal,
      });
      if (!response.ok) {
        let detail = `请求失败 (${response.status})`;
        try {
          detail = backendErrorDetail((await response.json()).detail) ?? detail;
        } catch {
          /* Non-JSON proxy errors retain the HTTP status. */
        }
        throw new ApiError(response.status, detail);
      }
      if (expected && response.status !== expected)
        throw new ApiError(
          response.status,
          `任务接口应返回 ${expected}，实际返回 ${response.status}`,
        );
      return (
        binary ? await response.arrayBuffer() : await response.json()
      ) as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (options.signal?.aborted)
        throw new DOMException("请求已取消", "AbortError");
      if (
        timeout.aborted ||
        (error instanceof Error && error.name === "TimeoutError")
      )
        throw new ApiError(
          408,
          "请求超时，后端操作可能仍在执行，请先核对任务或传输结果",
        );
      if (error instanceof SyntaxError)
        throw new ApiError(
          502,
          "后端响应不是有效 JSON，请检查接口契约与代理配置",
        );
      if (error instanceof Error && error.name === "AbortError") throw error;
      throw new ApiError(0, "无法连接后端，请检查 FastAPI 服务和代理地址");
    }
  }
  private post<T>(
    path: string,
    body: unknown,
    expected?: number,
    timeoutMs?: number,
  ) {
    return this.request<T>(
      path,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      false,
      expected,
      timeoutMs,
    );
  }
  health(signal?: AbortSignal) {
    return this.request<Health>("/health", { signal });
  }
  frames(signal?: AbortSignal) {
    return this.request<{ frames: Frame[] }>("/frames", { signal });
  }
  upload(frame: string, file: Blob) {
    return this.request<{ id: string; bytes: number }>(
      `/frames/${encodeURIComponent(frame)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: file,
      },
    );
  }
  private async submitTask(path: string, body: ScanRequest | RecognizeRequest) {
    const value = await this.post<{ job_id: string }>(path, body, 202);
    if (!value || typeof value.job_id !== "string" || !value.job_id.trim())
      throw new ApiError(502, "任务接口未返回有效 job_id，请检查后端契约");
    return value;
  }
  scan(body: ScanRequest) {
    return this.submitTask("/scan", body);
  }
  recognize(body: RecognizeRequest) {
    return this.submitTask("/recognize", body);
  }
  job(id: string, signal?: AbortSignal) {
    return this.request<Job>(`/jobs/${encodeURIComponent(id)}`, { signal });
  }
  view(frame: string, signal?: AbortSignal) {
    return this.request<ArrayBuffer>(
      `/view/${encodeURIComponent(frame)}`,
      { signal },
      true,
    );
  }
  seams(frame: string, signal?: AbortSignal) {
    return this.request<SeamResult>(`/seams/${encodeURIComponent(frame)}`, {
      signal,
    });
  }
  calibration(frame: string, signal?: AbortSignal) {
    return this.request<Calibration>(`/calib/${encodeURIComponent(frame)}`, {
      signal,
    });
  }
  calibrate(body: CalibrationRequest) {
    return this.post<CalibrationResult>("/calib", calibrationPayload(body));
  }
  program(body: ProgramRequest) {
    return this.post<Program>("/program", body, undefined, 120000);
  }
  async download(program: Program) {
    // Only same-origin API downloads are allowed; never trust an arbitrary response URL.
    const url = new URL(
      program.download,
      typeof location === "undefined" ? "http://local" : location.origin,
    );
    if (
      url.origin !==
        (typeof location === "undefined" ? "http://local" : location.origin) ||
      !url.pathname.startsWith("/api/program/")
    )
      throw new ApiError(400, "后端返回了非同源程序下载地址");
    return new Blob(
      [
        await this.request<ArrayBuffer>(
          url.pathname.slice(4) + url.search,
          {},
          true,
        ),
      ],
      { type: "text/plain" },
    );
  }
  push(body: PushRequest) {
    return this.post<PushResult>(
      "/push",
      body,
      undefined,
      transferTimeoutMs(body.timeout_s),
    );
  }
}
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return "采集或识别任务正在运行，请稍候再试";
    if (error.status === 413) return "点云超过 300MB，请缩小文件后重试";
    if (
      error.status === 400 &&
      /5000|超限|坐标.*(范围|超出)/.test(error.detail)
    )
      return `请先完成标定：${error.detail}`;
    return error.detail;
  }
  return error instanceof Error ? error.message : "操作失败，请重试";
}
