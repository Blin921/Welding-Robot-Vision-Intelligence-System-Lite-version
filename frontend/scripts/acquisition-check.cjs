const { openDemo } = require("./browser-mode.cjs");
const { chromium, expect } = require("@playwright/test");
const fs = require("node:fs");
(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  try {
    const p = await b.newPage({
      viewport: { width: 1680, height: 944 },
      deviceScaleFactor: 1,
    });
    p.setDefaultTimeout(45000);
    const view = p.locator("[data-acquisition-screen]");
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await openDemo(p, process.env.APP_URL || "http://localhost:3005");
    
    await p.locator("[data-acquisition-screen] canvas").waitFor();
    await expect(view.getByText("286742", { exact: true })).toBeVisible();
    await p.waitForTimeout(800);
    fs.mkdirSync("screenshots", { recursive: true });
    await p.screenshot({ path: "screenshots/acquisition-v3.png" });
    const btn = (n) =>
      view.getByRole(n.startsWith("选择帧 ") ? "option" : "button", {
        name: n,
        exact: true,
      });
    await btn("选择帧 frame_002").click();
    await expect(
      view.getByText("frame_002.pcd", { exact: true }).first(),
    ).toBeVisible();
    await btn("查看或隐藏 frame_002").click();
    await expect(btn("显示 frame_002")).toBeVisible();
    await btn("显示 frame_002").click();
    await btn("实例").click();
    await expect(btn("实例")).toHaveAttribute("aria-pressed", "true");
    await btn("语义").click();
    await view.getByLabel("点大小", { exact: true }).fill("6");
    await expect(view.locator("output")).toHaveText("6");
    await view.getByLabel("点大小", { exact: true }).fill("4");
    for (const n of [
      "显示或隐藏包围盒",
      "平移点云",
      "旋转点云",
      "放大点云",
      "切换正交透视",
      "重置视角",
    ])
      await btn(n).click();
    await btn("测量点间距离").click();
    await p.mouse.click(750, 460);
    await p.mouse.click(850, 480);
    await expect(view.getByText(/^距离：/)).toBeVisible();
    await btn("清除测量").click();
    await btn("全屏预览").click();
    await expect
      .poll(() => p.evaluate(() => !!document.fullscreenElement))
      .toBe(true);
    await p.evaluate(() => document.exitFullscreen());
    await btn("卸载当前点云").click();
    await expect(p.locator("[data-acquisition-screen] canvas")).toHaveCount(0);
    await btn("选择帧 frame_001").click();
    await p.locator("[data-acquisition-screen] canvas").waitFor();
    for (const n of [
      "点云数据管理",
      "扫描采集设置",
      "当前帧信息",
      "采集任务",
      "任务日志",
    ]) {
      await btn("折叠或展开" + n).click();
      await btn("折叠或展开" + n).click();
    }
    await btn("清空帧列表").click();
    await btn("确认清空").click();
    await expect(view.getByText("帧列表（0）", { exact: true })).toBeVisible();
    await btn("更多点云操作").click();
    await btn("恢复 / 刷新帧列表").click();
    await p.locator("[data-acquisition-screen] canvas").waitFor();
    const text =
      "VERSION .7\nFIELDS x y z rgb instance\nSIZE 4 4 4 4 2\nTYPE F F F U U\nWIDTH 3\nHEIGHT 1\nPOINTS 3\nDATA ascii\n-50 0 0 16711680 1\n0 50 0 65280 2\n50 0 50 255 3\n";
    await view.getByLabel("选择 PCD 文件", { exact: true }).setInputFiles({
      name: "browser_upload.pcd",
      mimeType: "application/octet-stream",
      buffer: Buffer.from(text),
    });
    await expect(
      view.getByText("browser_upload.pcd", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      view.getByText("3", { exact: true }).filter({ hasNot: p.locator("span") }),
    ).not.toHaveCount(0);
    await p.locator("[data-acquisition-screen] canvas").waitFor();
    await btn("更多点云操作").click();
    const download = p.waitForEvent("download");
    await btn("导出当前视图 (.pcd)").click();
    const d = await download;
    await d.saveAs("/tmp/acquisition-browser-export.pcd");
    if (
      !fs
        .readFileSync("/tmp/acquisition-browser-export.pcd")
        .includes(Buffer.from("DATA binary"))
    )
      throw Error("Export failed");
    await view.getByLabel("选择 PCD 文件", { exact: true }).setInputFiles({
      name: "broken.pcd",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("invalid"),
    });
    await expect(view.getByText(/缺少 DATA/).first()).toBeVisible();
    await btn("系统设置").click();
    await expect(view.getByRole("dialog")).toBeVisible();
    await p.keyboard.press("Escape");
    await btn("操作者信息").click();
    await expect(view.getByRole("dialog")).toBeVisible();
    await btn("关闭弹窗").click();
    await view.getByLabel("扫描时长 (ms)", { exact: true }).fill("0");
    await btn("开始采集").first().click();
    await expect(
      view.getByText(/扫描时长.*(范围|大于|10|100)/).first(),
    ).toBeVisible();
    await view.getByLabel("扫描时长 (ms)", { exact: true }).fill("2500");
    await btn("开始采集").first().click();
    await expect(btn("采集进行中").first()).toBeDisabled();
    await expect(view.getByText(/本机未接相机/).first()).toBeVisible();
    await expect(btn("开始采集").first()).toBeEnabled();
    await btn("筛选任务日志").click();
    await btn("错误").click();
    await expect(view.getByText(/本机未接相机/).first()).toBeVisible();
    await btn("会话历史").click();
    await expect(view.getByLabel("关闭任务中心")).toBeVisible();
    await btn("关闭任务中心").click();
    await p.setViewportSize({ width: 1366, height: 768 });
    await expect
      .poll(() =>
        p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await p.screenshot({ path: "screenshots/acquisition-v3-1366.png" });
    if (errors.length) throw Error(errors.join("\n"));
    console.log(
      "PASS: acquisition layout, frame visibility, PCD worker upload/export/error, viewport controls, ruler/fullscreen, clear/restore, panels, settings, validation, task mutex/polling/errors/history, responsive stage; no browser errors.",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

