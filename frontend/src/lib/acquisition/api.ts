import { DemoApi } from "../demo-api";
import { ApiError, HttpApi } from "../api";
import { parsePcdFile } from "./parse-file";
import { demoCloud, demoSeams } from "../demo-data";
import type { Frame, Seam, SeamResult } from "../types";
export const ACQUISITION_FRAMES: Frame[] = [
  "dataset",
  "camera",
  "upload",
  "dataset",
  "camera",
].map((source, i) => ({
  id: `frame_${String(i + 1).padStart(3, "0")}`,
  source: source as Frame["source"],
  bytes: 12400000 - i * 97000,
  mtime: 1761984000 - i * 120,
  has_artifacts: true,
}));
export class AcquisitionDemoApi extends DemoApi {
  private previews = new Map<string, ArrayBuffer>();
  private pairedSamples = new Set<string>();
  constructor() {
    super();
    this.frameData = ACQUISITION_FRAMES.map((frame) => ({ ...frame }));
  }
  override async upload(frame: string, file: Blob) {
    const buffer = await parsePcdFile(file, frame);
    const result = await super.upload(frame, file);
    this.previews.set(frame, buffer);
    // Match the distributed fixture by content, never by filename alone.
    let hash = 2166136261;
    for (const byte of new Uint8Array(await file.arrayBuffer()))
      hash = Math.imul(hash ^ byte, 16777619) >>> 0;
    if (file.size === 1735827 && hash === 119509985) {
      this.pairedSamples.add(frame);
      this.frameData.find((f) => f.id === frame)!.has_artifacts = true;
    }
    return result;
  }
  override async view(frame: string) {
    const preview = this.previews.get(frame);
    if (preview) return preview;
    if (!this.frameData.some((f) => f.id === frame))
      throw new ApiError(404, "帧不存在");
    return demoCloud();
  }
  override async seams(frame: string): Promise<SeamResult> {
    const status = await this.calibration(frame);
    return {
      frame,
      calib_tag: status.calib_tag,
      uncalibrated: status.uncalibrated,
      seams: this.pairedSamples.has(frame)
        ? [-35, 35].map((y, i): Seam => ({
            id: i + 1, shape: "钢管-扁钢", type: "模拟接缝", length_mm: 360,
            trajectory_mm: Array.from({ length: 37 }, (_, j) => [-180 + j * 10, y, 650]),
          }))
        : this.previews.has(frame) ? [] : demoSeams(),
      primitives: [],
    };
  }
}
/** Real backend remains authoritative. Raw previews are a local fallback until recognition exists. */
export class AcquisitionHttpApi extends HttpApi {
  private rawPreviews = new Map<string, Blob>();
  private previews = new Map<string, Promise<ArrayBuffer | null>>();
  override async upload(frame: string, file: Blob) {
    // The backend receives the original bytes before any optional browser preview.
    const result = await super.upload(frame, file);
    this.rawPreviews.set(result.id, file);
    this.previews.delete(result.id);
    return result;
  }
  override async view(frame: string, signal?: AbortSignal) {
    try {
      const buffer = await super.view(frame, signal);
      this.rawPreviews.delete(frame);
      this.previews.delete(frame);
      return buffer;
    } catch (error) {
      const file = this.rawPreviews.get(frame);
      if (!(error instanceof ApiError) || error.status !== 404 || !file)
        throw error;
      let preview = this.previews.get(frame);
      if (!preview) {
        preview = parsePcdFile(file, frame).catch(() => null);
        this.previews.set(frame, preview);
      }
      const buffer = await preview;
      if (signal?.aborted) throw new DOMException("请求已取消", "AbortError");
      if (buffer) return buffer;
      // A failed convenience preview must not turn an accepted upload into a failure.
      throw error;
    }
  }
}
