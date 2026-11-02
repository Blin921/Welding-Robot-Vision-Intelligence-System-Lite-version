import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkspaceStore } from "../../stores/workspace";
import { DemoApi } from "../demo-api";
import {
  DEFAULT_FTP,
  DEFAULT_PROGRAM,
  DEFAULT_RECOGNIZE,
  DEFAULT_SCAN,
} from "../types";
const matrix = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
];
afterEach(() => vi.useRealTimers());
describe("workspace consistency", () => {
  it("blocks oversize/empty/non-PCD files before issuing upload requests", async () => {
    const api = new DemoApi(),
      upload = vi.spyOn(api, "upload"),
      store = new WorkspaceStore(api, "demo");
    for (const file of [
      { name: "large.pcd", size: 300 * 1024 * 1024 + 1 },
      { name: "empty.pcd", size: 0 },
      { name: "wrong.txt", size: 20 },
    ])
      await store.upload(file as File);
    expect(upload).not.toHaveBeenCalled();
    expect(store.getSnapshot().logs).toHaveLength(3);
    store.dispose();
  });
  it("simulates file-only transfer with display calibration without starting motion", async () => {
    const api = new DemoApi(),
      push = vi.spyOn(api, "push"),
      store = new WorkspaceStore(api, "demo");
    await store.start();
    await store.generate(DEFAULT_PROGRAM);
    expect(store.currentProgram()?.uncalibrated).toBe(false);
    await store.push({
      ...DEFAULT_FTP,
      host: "fixture",
      frame: "sw2_e30",
      seam_id: 1,
    });
    expect(push).toHaveBeenCalledTimes(1);
    expect(store.currentPush()?.bytes).toBeGreaterThan(0);
    store.dispose();
  });
  it("unloads without deleting frames, clears only the workspace and restores the backend list", async () => {
    const api = new DemoApi(),
      store = new WorkspaceStore(api, "demo");
    await store.start();
    const ids = store.getSnapshot().frames.map((f) => f.id);
    store.unloadFrame();
    expect(store.getSnapshot().cloud).toBeNull();
    expect(store.getSnapshot().frames.map((f) => f.id)).toEqual(ids);
    await store.selectFrame(ids[0]);
    await store.removeFramesFromWorkspace(ids);
    expect(store.getSnapshot().frames).toHaveLength(0);
    expect(store.getSnapshot().cloud).toBeNull();
    await store.refreshFrames();
    expect(store.getSnapshot().frames).toHaveLength(0);
    expect((await api.frames()).frames).toHaveLength(ids.length);
    await store.restoreWorkspaceFrames();
    expect(store.getSnapshot().frames.map((f) => f.id)).toEqual(ids);
    expect(store.getSnapshot().cloud).not.toBeNull();
    store.dispose();
  });
  it("loads selected frame in parallel and reuses cached binary views", async () => {
    const api = new DemoApi(),
      spy = vi.spyOn(api, "view");
    const store = new WorkspaceStore(api, "demo");
    await store.start();
    expect(store.getSnapshot().frame).toBe("sw2_e30");
    await store.selectFrame("frame_002");
    await store.selectFrame("sw2_e30");
    expect(spy).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot().cloud?.header.n).toBe(200000);
    store.dispose();
  });
  it("ignores late data from an older selected frame", async () => {
    const api = new DemoApi(),
      real = api.view.bind(api);
    let release: ((buffer: ArrayBuffer) => void) | undefined;
    vi.spyOn(api, "view").mockImplementation((frame) =>
      frame === "sw2_e30"
        ? new Promise((resolve) => {
            release = resolve;
          })
        : real(frame),
    );
    const store = new WorkspaceStore(api, "demo");
    const first = store.selectFrame("sw2_e30");
    await store.selectFrame("frame_002");
    release!(await real("sw2_e30"));
    await first;
    expect(store.getSnapshot().frame).toBe("frame_002");
    expect(store.getSnapshot().loading).toBe(false);
    store.dispose();
  });
  it("keeps programs keyed by frame/seam and invalidates them after calibration changes", async () => {
    const store = new WorkspaceStore(new DemoApi(), "demo");
    await store.start();
    await store.calibrate({ frame: "sw2_e30", matrix });
    await store.generate({ ...DEFAULT_PROGRAM, name: "FIRST" });
    expect(store.currentProgram()?.data.ls_name).toBe("FIRST");
    store.selectSeam(2);
    expect(store.currentProgram()).toBeNull();
    await store.generate({ ...DEFAULT_PROGRAM, name: "SECOND" });
    store.selectSeam(1);
    expect(store.currentProgram()?.data.ls_name).toBe("FIRST");
    await store.selectFrame("frame_002");
    expect(store.currentProgram()).toBeNull();
    await store.selectFrame("sw2_e30");
    expect(store.currentProgram()?.data.ls_name).toBe("FIRST");
    await store.calibrate({ frame: "sw2_e30", clear: true });
    expect(store.currentProgram()).toBeNull();
    store.selectSeam(2);
    expect(store.currentProgram()).toBeNull();
    store.dispose();
  });
  it("enforces one shared task, stops polling while hidden and resumes when visible", async () => {
    vi.useFakeTimers();
    const api = new DemoApi(),
      spy = vi.spyOn(api, "job"),
      store = new WorkspaceStore(api, "demo");
    await store.start();
    await store.run("recognize", {
      ...DEFAULT_RECOGNIZE,
      reuse_artifacts: true,
      frame: "sw2_e30",
    });
    await store.run("scan", DEFAULT_SCAN);
    expect(store.getSnapshot().history).toHaveLength(1);
    expect(store.getSnapshot().activeTask?.kind).toBe("recognize");
    store.setVisible(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(spy).not.toHaveBeenCalled();
    store.setVisible(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().activeTask).toBeNull();
    expect(store.getSnapshot().history[0].state).toBe("done");
    store.dispose();
  });
  it("completes a labelled simulated scan without a camera", async () => {
    vi.useFakeTimers();
    const store = new WorkspaceStore(new DemoApi(), "demo");
    await store.start();
    await store.run("scan", DEFAULT_SCAN);
    await vi.advanceTimersByTimeAsync(3100);
    expect(store.getSnapshot().history[0].state).toBe("done");
    expect(store.getSnapshot().history[0].log.join(" ")).toContain("模拟采集完成");
    expect(store.getSnapshot().activeTask).toBeNull();
    store.dispose();
  });
  it("does not treat a frame without artifacts as a rendering error", async () => {
    const store = new WorkspaceStore(new DemoApi(), "demo");
    await store.start();
    await store.selectFrame("frame_003");
    expect(store.getSnapshot()).toMatchObject({
      cloud: null,
      seams: [],
      selected: null,
      loadError: null,
      loading: false,
    });
    store.dispose();
  });
});

describe("program validity after remote mutations", () => {
  it("invalidates a program immediately after calibration save even if status refresh fails", async () => {
    const api = new DemoApi(),
      store = new WorkspaceStore(api, "demo");
    await store.start();
    await store.calibrate({ frame: "sw2_e30", matrix });
    await store.generate(DEFAULT_PROGRAM);
    expect(store.currentProgram()).not.toBeNull();
    vi.spyOn(api, "calibration").mockRejectedValueOnce(
      new Error("status unavailable"),
    );
    await store.calibrate({ frame: "sw2_e30", matrix });
    expect(store.currentProgram()).toBeNull();
    expect(Object.keys(store.getSnapshot().generated)).toHaveLength(0);
    store.dispose();
  });
  it("invalidates an old program when the backend calibration tag changes outside this client", async () => {
    const api = new DemoApi(),
      store = new WorkspaceStore(api, "demo");
    await store.start();
    await store.calibrate({ frame: "sw2_e30", matrix });
    await store.generate(DEFAULT_PROGRAM);
    await api.calibrate({ frame: "sw2_e30", clear: true });
    await store.selectFrame("sw2_e30");
    expect(store.currentProgram()).toBeNull();
    store.dispose();
  });
});
