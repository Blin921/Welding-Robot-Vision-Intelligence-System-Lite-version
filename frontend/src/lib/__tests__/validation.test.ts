import { describe, expect, it } from "vitest";
import {
  DEFAULT_FTP,
  DEFAULT_PROGRAM,
  DEFAULT_RECOGNIZE,
  DEFAULT_SCAN,
} from "../types";
import {
  parseMatrix,
  parseCalibrationInput,
  validateFtp,
  validatePairs,
  validateProgram,
  validateRecognition,
  validateScan,
} from "../validation";
describe("frontend form contracts", () => {
  it("keeps all documented defaults and permits an empty automatic program name", () => {
    expect(DEFAULT_PROGRAM).toEqual({
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
    });
    expect(DEFAULT_RECOGNIZE.reuse_artifacts).toBe(false);
    expect(validateProgram(DEFAULT_PROGRAM)).toBeNull();
    expect(validateScan(DEFAULT_SCAN)).toBeNull();
  });
  it("rejects bad program names, malformed WPR and non-finite fields before requests", () => {
    for (const name of ["a123", "123", "TOO_LONG9", "A-B"])
      expect(validateProgram({ ...DEFAULT_PROGRAM, name })).toBeTruthy();
    for (const wpr of ["1,2", "1,,3", "Infinity,0,0", "a,0,0"])
      expect(validateProgram({ ...DEFAULT_PROGRAM, wpr })).toBeTruthy();
    expect(
      validateProgram({ ...DEFAULT_PROGRAM, speed_weld: NaN }),
    ).toBeTruthy();
    expect(
      validateRecognition({ ...DEFAULT_RECOGNIZE, smooth_k: 2.1 }),
    ).toBeTruthy();
  });
  it("checks collection limits, point count, finite coordinates, and matrix shape", () => {
    expect(validateScan({ ...DEFAULT_SCAN, scan_ms: 499 })).toBeTruthy();
    expect(validatePairs([])).toBeTruthy();
    expect(() => parseMatrix("[[1,0]]")).toThrow();
    expect(() => parseMatrix("invalid")).toThrow();
    expect(
      parseMatrix("[[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]]"),
    ).toHaveLength(4);
  });
  it("requires a host and valid FTP port, but does not invent credentials", () => {
    expect(validateFtp(DEFAULT_FTP)).toBeTruthy();
    expect(validateFtp({ ...DEFAULT_FTP, host: "192.168.0.2" })).toBeNull();
    expect(
      validateFtp({ ...DEFAULT_FTP, host: "https://example.com" }),
    ).toBeTruthy();
    expect(
      validateFtp({ ...DEFAULT_FTP, host: "controller", port: 0 }),
    ).toBeTruthy();
  });
});

describe("legacy calibration input", () => {
  it("accepts a bare matrix or JSON wrapper but always uses the selected frame", () => {
    const matrix = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
    expect(parseCalibrationInput(JSON.stringify(matrix), "selected")).toEqual({
      frame: "selected",
      matrix,
    });
    expect(
      parseCalibrationInput(
        JSON.stringify({ frame: "wrong", matrix }),
        "selected",
      ),
    ).toEqual({ frame: "selected", matrix });
  });
  it("rejects malformed point vectors and disallows clearing through pasted JSON", () => {
    expect(() =>
      parseCalibrationInput('{"pairs":[{"cam":[1,2],"base":[1,2,3]}]}', "f"),
    ).toThrow();
    expect(() => parseCalibrationInput('{"clear":true}', "f")).toThrow();
  });
});
