import { parsePcd } from "./pcd";
export async function parsePcdFile(
  file: Blob,
  frame: string,
): Promise<ArrayBuffer> {
  const buffer = await file.arrayBuffer();
  if (typeof Worker === "undefined") return parsePcd(buffer, frame);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./pcd.worker.ts", import.meta.url), {
      type: "module",
    });
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("点云解析超时，请缩小文件后重试"));
    }, 120000);
    const done = () => {
      clearTimeout(timeout);
      worker.terminate();
    };
    worker.onmessage = (event) => {
      done();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.buffer);
    };
    worker.onerror = () => {
      done();
      reject(new Error("点云解析进程启动失败，请刷新浏览器后重试"));
    };
    worker.postMessage({ buffer, frame }, [buffer]);
  });
}
