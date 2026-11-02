import { beforeEach, describe, expect, it, vi } from "vitest";
import { AcquisitionHttpApi } from "../acquisition/api";
import { parsePcdFile } from "../acquisition/parse-file";
import { demoCloud } from "../demo-data";
vi.mock("../acquisition/parse-file", () => ({ parsePcdFile: vi.fn() }));
beforeEach(() => {
  vi.mocked(parsePcdFile).mockReset();
});

describe("authoritative binary upload and optional local preview", () => {
  it("sends the original bytes before parsing, and accepts uploads without a local preview", async () => {
    const file = new Blob(["backend-supported bytes"]);
    vi.mocked(parsePcdFile).mockRejectedValue(new Error("unsupported preview"));
    const api = new AcquisitionHttpApi(async (_url, init) => {
      if (init?.method === "PUT") {
        expect(init.body).toBe(file);
        return new Response(JSON.stringify({ id: "f", bytes: file.size }));
      }
      return new Response(JSON.stringify({ detail: "无识别结果" }), {
        status: 404,
      });
    });
    await expect(api.upload("f", file)).resolves.toEqual({
      id: "f",
      bytes: file.size,
    });
    expect(parsePcdFile).not.toHaveBeenCalled();
    await expect(api.view("f")).rejects.toMatchObject({ status: 404 });
    await expect(api.view("f")).rejects.toMatchObject({ status: 404 });
    expect(parsePcdFile).toHaveBeenCalledTimes(1);
  });
  it("caches a raw preview only after the backend reports no recognition view", async () => {
    const buffer = demoCloud();
    vi.mocked(parsePcdFile).mockResolvedValue(buffer);
    const api = new AcquisitionHttpApi(async (_url, init) =>
      init?.method === "PUT"
        ? new Response(JSON.stringify({ id: "f", bytes: 3 }))
        : new Response(JSON.stringify({ detail: "无识别结果" }), {
            status: 404,
          }),
    );
    await api.upload("f", new Blob(["PCD"]));
    expect(await api.view("f")).toBe(buffer);
    expect(await api.view("f")).toBe(buffer);
    expect(parsePcdFile).toHaveBeenCalledTimes(1);
  });
  it("does not mask server failures with a local preview", async () => {
    const api = new AcquisitionHttpApi(async (_url, init) =>
      init?.method === "PUT"
        ? new Response(JSON.stringify({ id: "f", bytes: 3 }))
        : new Response(JSON.stringify({ detail: "pipeline unavailable" }), {
            status: 500,
          }),
    );
    await api.upload("f", new Blob(["PCD"]));
    await expect(api.view("f")).rejects.toMatchObject({ status: 500 });
    expect(parsePcdFile).not.toHaveBeenCalled();
  });
});
