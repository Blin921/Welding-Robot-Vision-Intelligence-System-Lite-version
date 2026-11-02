import { parsePcd } from "./pcd";
self.onmessage = (
  event: MessageEvent<{ buffer: ArrayBuffer; frame: string }>,
) => {
  try {
    const buffer = parsePcd(event.data.buffer, event.data.frame);
    self.postMessage({ buffer }, { transfer: [buffer] });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "点云解析失败",
    });
  }
};
