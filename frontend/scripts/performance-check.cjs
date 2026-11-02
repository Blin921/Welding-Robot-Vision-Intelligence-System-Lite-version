/* Run against the deployed live backend on the actual acceptance machine/LAN. */
const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const ts = require("typescript");
const parser = ts.transpileModule(fs.readFileSync("src/lib/blob.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    headless: process.env.HEADED !== "1",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
    });
    const start = Date.now();
    await page.goto(process.env.APP_URL || "http://localhost:3000");
    const health = await page.request.get(new URL("/api/health", page.url()).href);
    if (!health.ok()) throw Error("请先配置 live 模式并连接真实 FastAPI 后端，再执行性能验收。");
    await page.locator("[data-acquisition-screen] canvas").waitFor({ timeout: 30000 });
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    const firstFrameMs = Date.now() - start;
    const transfer = await page.evaluate(async (code) => {
      const ex = {};
      new Function("exports", code)(ex);
      const frames = await fetch("/api/frames", { cache: "no-store" }).then(
        (r) => r.json(),
      );
      const frame = frames.frames.find((f) => f.has_artifacts);
      if (!frame)
        throw Error("No backend frame with artifacts; prepare sw2_e30 first.");
      const begin = performance.now();
      const response = await fetch(
        "/api/view/" + encodeURIComponent(frame.id),
        { cache: "no-store" },
      );
      if (!response.ok) throw Error("View HTTP " + response.status);
      const buffer = await response.arrayBuffer();
      const received = performance.now();
      const cloud = ex.parseView(buffer);
      return {
        frame: frame.id,
        points: cloud.header.n,
        bytes: buffer.byteLength,
        downloadMs: received - begin,
        parseMs: performance.now() - received,
        downloadAndParseMs: performance.now() - begin,
      };
    }, parser);
    const sampling = page.evaluate(
      () =>
        new Promise((resolve) => {
          let frames = 0,
            start;
          function tick(now) {
            start ??= now;
            frames++;
            if (now - start >= 3000)
              resolve(((frames - 1) * 1000) / (now - start));
            else requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
        }),
    );
    const box = await page.locator(".viewer canvas").boundingBox();
    await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.55, {
      steps: 45,
    });
    await page.mouse.up();
    const interactionFps = await sampling;
    const report = {
      url: process.env.APP_URL || "http://localhost:3000",
      viewport: [1920, 1080],
      firstFrameMs,
      ...transfer,
      interactionRafFps: interactionFps,
      checks: {
        firstFrameUnder2s: firstFrameMs <= 2000,
        atLeast200kPoints: transfer.points >= 200000,
        downloadAndParseUnder500ms: transfer.downloadAndParseMs <= 500,
        interactionAtLeast30fps: interactionFps >= 30,
      },
      note: "Fresh browser context; RAF cadence during orbit drag approximates presented frame rate, not GPU completion or long-duration memory certification. Run on target Chrome/Edge with a real backend; no fixtures.",
    };
    fs.mkdirSync("reports", { recursive: true });
    fs.writeFileSync(
      "reports/performance.json",
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report, null, 2));
    if (Object.values(report.checks).some((v) => !v)) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

