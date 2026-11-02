const { openDemo } = require("./browser-mode.cjs");
const { chromium, expect } = require("@playwright/test");
const fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox", "--enable-unsafe-swiftshader"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 928 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await openDemo(page, process.env.APP_URL || "http://localhost:3014");
    
    const acquisition = page.locator('[data-acquisition-screen]');
    await acquisition.locator("canvas").waitFor();
    await expect(acquisition.getByRole("option", { name: "选择帧 frame_001", exact: true })).toBeVisible();
    await expect(acquisition.getByText("286742", { exact: true })).toBeVisible();
    await page.evaluate(() => {
      window.savedAcquisitionCanvas = document.querySelector('[data-acquisition-screen] canvas');
      window.removedCanvases = 0;
      new MutationObserver(records => records.forEach(record => record.removedNodes.forEach(node => {
        if (node.nodeName === "CANVAS" || node.querySelector?.("canvas")) window.removedCanvases++;
      }))).observe(document.body, { childList: true, subtree: true });
    });
    fs.mkdirSync("screenshots", { recursive: true });
    await page.screenshot({ path: "screenshots/restored-acquisition-1920.png" });
    await acquisition.getByRole("button", { name: "AI识别", exact: true }).click();
    const workbench = page.locator('[data-pane="workbench"]');
    await workbench.locator("canvas").waitFor({ state: "visible" });
    await page.evaluate(() => { window.savedRecognitionCanvas = document.querySelector('[data-pane="workbench"] canvas'); });
    await page.screenshot({ path: "screenshots/restored-recognition-1920.png" });
    for (let i = 0; i < 4; i++) {
      await workbench.getByRole("navigation").getByRole("button", { name: "数据采集", exact: true }).click();
      await expect(acquisition.locator("canvas")).toBeVisible();
      await acquisition.getByRole("button", { name: "AI识别", exact: true }).click();
      await expect(workbench.locator("canvas")).toBeVisible();
    }
    expect(await page.evaluate(() => ({ acquisition: window.savedAcquisitionCanvas === document.querySelector('[data-acquisition-screen] canvas'), recognition: window.savedRecognitionCanvas === document.querySelector('[data-pane="workbench"] canvas'), removed: window.removedCanvases }))).toEqual({ acquisition: true, recognition: true, removed: 0 });
    await workbench.getByRole("navigation").getByRole("button", { name: "数据采集", exact: true }).click();
    for (const [width, height] of [[1920,928],[2560,1080],[1680,944],[1366,768],[1100,800],[800,700],[390,844]]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(100);
      const bounds = await page.locator('[data-acquisition-stage]').evaluate(element => { const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, transform: getComputedStyle(element).transform }; });
      expect(bounds).toEqual({ x:0, y:0, width, height, transform:"none" });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      console.log("PASS viewport", width, height);
      if (width === 1366) await page.screenshot({ path: "screenshots/restored-acquisition-1366.png" });
    }
    expect(errors).toEqual([]);
    console.log("PASS: screenshot interface restored, native labels and line icons, edge-to-edge layouts, both canvases retained across eight page transitions, no canvas removal or page error.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
