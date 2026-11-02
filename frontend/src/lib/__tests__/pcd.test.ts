import { describe, it, expect } from "vitest";
import { parsePcd, decodeLzf } from "../acquisition/pcd";
import { parseView } from "../blob";
import { exportPcd } from "../acquisition/export-pcd";
const enc = new TextEncoder();
function ascii(
  rows: string,
  points = 2,
  fields = "x y z rgb instance",
  sizes = "4 4 4 4 2",
  types = "F F F U U",
) {
  return enc.encode(
    `VERSION .7\nFIELDS ${fields}\nSIZE ${sizes}\nTYPE ${types}\nWIDTH ${points}\nHEIGHT 1\nPOINTS ${points}\nDATA ascii\n${rows}`,
  ).buffer;
}
describe("PCD acquisition", () => {
  it("preserves uploaded XYZ, RGB and instance IDs and exports a readable binary file", async () => {
    const c = parseView(
      parsePcd(ascii("1 2 3 16711680 7\n-2 4 9 65280 8\n"), "part"),
    );
    expect([...c.xyz]).toEqual([1, 2, 3, -2, 4, 9]);
    expect([...c.rgb]).toEqual([255, 0, 0, 0, 255, 0]);
    expect([...c.instance]).toEqual([7, 8]);
    expect(c.header.n_full).toBe(2);
    const back = parseView(
      parsePcd(await exportPcd(c).arrayBuffer(), "roundtrip"),
    );
    expect([...back.xyz]).toEqual([...c.xyz]);
    expect([...back.rgb]).toEqual([...c.rgb]);
    expect([...back.instance]).toEqual([...c.instance]);
  });
  it("skips non-finite XYZ and retains full input count", () => {
    const c = parseView(parsePcd(ascii("nan 2 3 0 0\n1 2 3 0 0\n"), "part"));
    expect(c.header.n).toBe(1);
    expect(c.header.n_full).toBe(2);
  });
  it("handles semantic labels when RGB is absent", () => {
    const c = parseView(
      parsePcd(
        ascii("1 2 3 1\n4 5 6 2\n", 2, "x y z label", "4 4 4 1", "F F F U"),
        "part",
      ),
    );
    expect([...c.rgb]).toEqual([70, 130, 230, 50, 200, 80]);
  });
  it("reads PCL binary_compressed structure-of-arrays via LZF", () => {
    const header = enc.encode(
      "FIELDS x y z\nSIZE 4 4 4\nTYPE F F F\nWIDTH 2\nHEIGHT 1\nPOINTS 2\nDATA binary_compressed\n",
    );
    const payload = new Uint8Array(24);
    const v = new DataView(payload.buffer);
    [1, 4, 2, 5, 3, 6].forEach((n, i) => v.setFloat32(i * 4, n, true));
    const file = new Uint8Array(header.length + 8 + 25);
    file.set(header);
    const size = new DataView(file.buffer, header.length, 8);
    size.setUint32(0, 25, true);
    size.setUint32(4, 24, true);
    file[header.length + 8] = 23;
    file.set(payload, header.length + 9);
    expect([...parseView(parsePcd(file.buffer, "compressed")).xyz]).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });
  it("checks LZF back references and truncated/invalid PCD data", () => {
    expect([...decodeLzf(new Uint8Array([0, 65, 32, 0]), 4)]).toEqual([
      65, 65, 65, 65,
    ]);
    expect(() => decodeLzf(new Uint8Array([32, 0]), 3)).toThrow("越界");
    expect(() => parsePcd(ascii("1 2 3 0 0\n"), "bad")).toThrow("点数");
    expect(() => parsePcd(enc.encode("nothing").buffer, "bad")).toThrow("DATA");
  });
  it("limits the rendered sample without changing total point metadata", () => {
    const c = parseView(parsePcd(ascii("1 2 3 0 0\n4 5 6 0 0\n"), "small", 1));
    expect(c.header.n).toBe(1);
    expect(c.header.n_full).toBe(2);
  });
});
