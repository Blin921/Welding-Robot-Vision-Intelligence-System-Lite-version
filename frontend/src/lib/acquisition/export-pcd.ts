import type { CloudData } from "../types";
export function exportPcd(cloud: CloudData): Blob {
  const count = cloud.header.n,
    header = new TextEncoder().encode(
      `# .PCD v0.7\n# SOURCE ${cloud.header.source}\n# Units mm; camera coordinates\nVERSION 0.7\nFIELDS x y z rgb instance\nSIZE 4 4 4 4 2\nTYPE F F F U U\nCOUNT 1 1 1 1 1\nWIDTH ${count}\nHEIGHT 1\nVIEWPOINT 0 0 0 1 0 0 0\nPOINTS ${count}\nDATA binary\n`,
    );
  const buffer = new ArrayBuffer(count * 18),
    view = new DataView(buffer);
  for (let i = 0; i < count; i++) {
    const at = i * 18;
    for (let j = 0; j < 3; j++)
      view.setFloat32(at + j * 4, cloud.xyz[i * 3 + j], true);
    view.setUint32(
      at + 12,
      (cloud.rgb[i * 3] << 16) |
        (cloud.rgb[i * 3 + 1] << 8) |
        cloud.rgb[i * 3 + 2],
      true,
    );
    view.setUint16(at + 16, cloud.instance[i], true);
  }
  return new Blob([header, buffer], { type: "application/octet-stream" });
}
