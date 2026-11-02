import { encodeView } from "./view-buffer";
interface Field {
  name: string;
  size: number;
  type: string;
  count: number;
  byte: number;
  token: number;
  plane: number;
}
export function decodeLzf(input: Uint8Array, length: number): Uint8Array {
  if (!Number.isSafeInteger(length) || length < 0 || length > 512 * 1024 * 1024)
    throw new Error("解压后的点云超过 512MB 安全容量");
  const output = new Uint8Array(length);
  let at = 0,
    out = 0;
  while (at < input.length) {
    const control = input[at++];
    if (control < 32) {
      const size = control + 1;
      if (at + size > input.length || out + size > length)
        throw new Error("LZF 字面量越界");
      output.set(input.subarray(at, at + size), out);
      at += size;
      out += size;
    } else {
      let size = control >> 5;
      let reference = out - ((control & 31) << 8) - 1;
      if (size === 7) {
        if (at >= input.length) throw new Error("LZF 长度不完整");
        size += input[at++];
      }
      if (at >= input.length) throw new Error("LZF 偏移不完整");
      reference -= input[at++];
      size += 2;
      if (reference < 0 || out + size > length) throw new Error("LZF 引用越界");
      for (let i = 0; i < size; i++) output[out++] = output[reference++];
    }
  }
  if (out !== length) throw new Error("LZF 解压长度与 PCD 头不符");
  return output;
}
export function parsePcd(
  buffer: ArrayBuffer,
  frame: string,
  maxPoints = 400000,
): ArrayBuffer {
  if (buffer.byteLength > 300 * 1024 * 1024)
    throw new Error("PCD 文件不能超过 300MB");
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder("ascii");
  const header: Record<string, string[]> = {};
  let body = 0,
    data = "";
  for (let begin = 0; begin < Math.min(bytes.length, 65536);) {
    let end = begin;
    while (end < bytes.length && bytes[end] !== 10) end++;
    if (end === bytes.length) break;
    const line = decoder.decode(bytes.subarray(begin, end)).trim();
    body = end + 1;
    begin = end + 1;
    if (!line || line.startsWith("#")) continue;
    const [key, ...value] = line.split(/\s+/);
    header[key.toUpperCase()] = value;
    if (key.toUpperCase() === "DATA") {
      data = value[0]?.toLowerCase();
      break;
    }
  }
  if (!data) throw new Error("不是有效 PCD：缺少 DATA 头");
  const names = header.FIELDS ?? header.FIELD,
    sizes = header.SIZE?.map(Number),
    types = header.TYPE,
    counts = header.COUNT?.map(Number) ?? names?.map(() => 1);
  const points = Number(
    header.POINTS?.[0] ??
      Number(header.WIDTH?.[0]) * Number(header.HEIGHT?.[0] ?? 1),
  );
  if (
    !names ||
    !sizes ||
    !types ||
    !counts ||
    [sizes.length, types.length, counts.length].some(
      (n) => n !== names.length,
    ) ||
    !Number.isSafeInteger(points) ||
    points < 1
  )
    throw new Error("PCD 字段、点数或 COUNT 不合法");
  const fields: Field[] = [];
  let stride = 0,
    tokens = 0,
    plane = 0;
  for (let i = 0; i < names.length; i++) {
    if (
      ![1, 2, 4, 8].includes(sizes[i]) ||
      !["F", "I", "U"].includes(types[i]) ||
      !Number.isInteger(counts[i]) ||
      counts[i] < 1 ||
      (types[i] === "F" && ![4, 8].includes(sizes[i]))
    )
      throw new Error("PCD SIZE/TYPE/COUNT 不支持");
    fields.push({
      name: names[i].toLowerCase(),
      size: sizes[i],
      type: types[i],
      count: counts[i],
      byte: stride,
      token: tokens,
      plane,
    });
    stride += sizes[i] * counts[i];
    plane += sizes[i] * counts[i] * points;
    tokens += counts[i];
  }
  const field = (...names: string[]) =>
      fields.find((f) => names.includes(f.name)),
    xField = field("x"),
    yField = field("y"),
    zField = field("z");
  if (!xField || !yField || !zField)
    throw new Error("PCD 必须包含 x、y、z 字段");
  if (
    !Number.isSafeInteger(points * stride) ||
    points * stride > 512 * 1024 * 1024
  )
    throw new Error("PCD 声明的数据量超过 512MB");
  let payload: DataView | undefined,
    soa = false;
  if (data === "binary") {
    if (bytes.length - body < points * stride)
      throw new Error("PCD 二进制数据不完整");
    payload = new DataView(buffer, body);
  } else if (data === "binary_compressed") {
    if (bytes.length < body + 8) throw new Error("PCD 压缩头不完整");
    const size = new DataView(buffer, body, 8),
      compressed = size.getUint32(0, true),
      expanded = size.getUint32(4, true);
    if (compressed > bytes.length - body - 8 || expanded !== points * stride)
      throw new Error("PCD 压缩尺寸与头信息不符");
    const decoded = decodeLzf(
      bytes.subarray(body + 8, body + 8 + compressed),
      expanded,
    );
    payload = new DataView(decoded.buffer);
    soa = true;
  } else if (data !== "ascii")
    throw new Error(`不支持的 PCD DATA 格式：${data}`);
  const capacity = Math.min(points, maxPoints),
    step = Math.max(1, Math.ceil(points / capacity)),
    xyz = new Float32Array(capacity * 3),
    rgb = new Uint8Array(capacity * 3),
    instance = new Uint16Array(capacity);
  let used = 0;
  const rgbField = field("rgb", "rgba"),
    red = field("r", "red"),
    green = field("g", "green"),
    blue = field("b", "blue"),
    semantic = field("semantic", "label", "class"),
    inst = field("instance", "instance_id", "instanceid");
  const read = (f: Field, index: number, values?: string[]) => {
    if (values) return Number(values[f.token]);
    const offset = soa
      ? f.plane + index * f.size * f.count
      : index * stride + f.byte;
    const v = payload!;
    if (f.type === "F")
      return f.size === 4
        ? v.getFloat32(offset, true)
        : v.getFloat64(offset, true);
    if (f.type === "I")
      return f.size === 1
        ? v.getInt8(offset)
        : f.size === 2
          ? v.getInt16(offset, true)
          : f.size === 4
            ? v.getInt32(offset, true)
            : Number(v.getBigInt64(offset, true));
    return f.size === 1
      ? v.getUint8(offset)
      : f.size === 2
        ? v.getUint16(offset, true)
        : f.size === 4
          ? v.getUint32(offset, true)
          : Number(v.getBigUint64(offset, true));
  };
  const packed = new DataView(new ArrayBuffer(4));
  const append = (index: number, values?: string[]) => {
    const p = [
      read(xField, index, values),
      read(yField, index, values),
      read(zField, index, values),
    ];
    if (!p.every(Number.isFinite)) return;
    xyz.set(p, used * 3);
    let color = [180, 180, 180];
    if (rgbField) {
      let bits: number;
      if (values) {
        const value = read(rgbField, index, values);
        if (rgbField.type === "F") {
          packed.setFloat32(0, value, true);
          bits = packed.getUint32(0, true);
        } else bits = value >>> 0;
      } else {
        const offset = soa
          ? rgbField.plane + index * rgbField.size * rgbField.count
          : index * stride + rgbField.byte;
        if (rgbField.size !== 4)
          throw new Error("packed RGB 字段必须为 4 字节");
        bits = payload!.getUint32(offset, true);
      }
      color = [(bits >>> 16) & 255, (bits >>> 8) & 255, bits & 255];
    } else if (red && green && blue)
      color = [
        read(red, index, values),
        read(green, index, values),
        read(blue, index, values),
      ].map((v) => Math.max(0, Math.min(255, Number.isFinite(v) ? v : 0)));
    else if (semantic) {
      const label = read(semantic, index, values);
      color =
        [
          [180, 180, 180],
          [70, 130, 230],
          [50, 200, 80],
          [180, 50, 180],
        ][label] ?? color;
    }
    rgb.set(color, used * 3);
    const id = inst ? read(inst, index, values) : 0;
    instance[used] = Number.isFinite(id) ? Math.max(0, Math.min(65535, id)) : 0;
    used++;
  };
  if (data === "ascii") {
    let row = 0,
      begin = body;
    while (begin < bytes.length && row < points) {
      let end = begin;
      while (end < bytes.length && bytes[end] !== 10) end++;
      const text = decoder.decode(bytes.subarray(begin, end)).trim();
      begin = end + 1;
      if (!text || text.startsWith("#")) continue;
      const values = text.split(/\s+/);
      if (values.length < tokens)
        throw new Error(`PCD 第 ${row + 1} 点字段不足`);
      if (row % step === 0 && used < capacity) append(row, values);
      row++;
    }
    if (row !== points) throw new Error("PCD ASCII 点数与头信息不符");
  } else for (let i = 0; i < points; i += step) if (used < capacity) append(i);
  if (!used) throw new Error("PCD 中没有有效的有限 XYZ 点");
  return encodeView(
    xyz.subarray(0, used * 3),
    rgb.subarray(0, used * 3),
    instance.subarray(0, used),
    { frame, source: "upload", nFull: points },
  );
}
