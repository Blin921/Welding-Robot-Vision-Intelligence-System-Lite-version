import { describe, expect, it } from "vitest";
import {
  backendErrorDetail,
  calibrationPayload,
  transferTimeoutMs,
} from "../backend-contract";
import { calibrationStatus } from "../calibration-status";

describe("backend integration boundaries", () => {
  it("serializes point pairs, a matrix and clear as mutually exclusive requests", () => {
    const pair = {
      cam: [1, 2, 3] as [number, number, number],
      base: [4, 5, 6] as [number, number, number],
    };
    expect(calibrationPayload({ frame: "f", pairs: [pair] })).toEqual({
      frame: "f",
      pairs: [pair],
    });
    expect(
      calibrationPayload(
        { frame: "f", pairs: [pair] },
        { camera: "camera_xyz", base: "base_xyz" },
      ),
    ).toEqual({
      frame: "f",
      pairs: [{ camera_xyz: pair.cam, base_xyz: pair.base }],
    });
    const matrix = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
    expect(calibrationPayload({ frame: "f", matrix })).toEqual({
      frame: "f",
      matrix,
    });
    expect(calibrationPayload({ frame: "f", clear: true })).toEqual({
      frame: "f",
      clear: true,
    });
    expect(() =>
      calibrationPayload(
        { frame: "f", clear: true },
        { camera: "same", base: "same" },
      ),
    ).toThrow();
  });
  it("retains validation locations without exposing submitted input or context", () => {
    const result = backendErrorDetail([
      {
        loc: ["body", "pairs", 0, "cam"],
        msg: "Field required",
        input: "password-secret",
        ctx: { hidden: "password-secret" },
      },
    ]);
    expect(result).toContain("pairs.0.cam");
    expect(result).toContain("Field required");
    expect(result).not.toContain("password-secret");
    expect(backendErrorDetail("后端中文原因")).toBe("后端中文原因");
    expect(backendErrorDetail({ unknown: true })).toBeNull();
  });
  it("allows long FTP operations and bounds the timeout to a supported timer value", () => {
    expect(transferTimeoutMs(15)).toBeGreaterThanOrEqual(120000);
    expect(transferTimeoutMs(60)).toBeGreaterThan(60000);
    expect(transferTimeoutMs(Number.MAX_VALUE)).toBe(2147483647);
    expect(transferTimeoutMs(NaN)).toBe(120000);
  });
  it("distinguishes unknown, uncalibrated and excessive residuals across pages", () => {
    expect(calibrationStatus(null).color).toBe("yellow");
    expect(
      calibrationStatus({
        calib_tag: null,
        has_calib: false,
        uncalibrated: true,
      }).color,
    ).toBe("red");
    expect(
      calibrationStatus({
        calib_tag: "a",
        has_calib: true,
        uncalibrated: false,
        max_dev_mm: 1.5,
      }).color,
    ).toBe("green");
    expect(
      calibrationStatus({
        calib_tag: "a",
        has_calib: true,
        uncalibrated: false,
        max_dev_mm: 1.51,
      }).color,
    ).toBe("yellow");
    expect(
      calibrationStatus({
        calib_tag: "a",
        has_calib: true,
        uncalibrated: false,
      }).title,
    ).toContain("未返回残差");
  });
});
