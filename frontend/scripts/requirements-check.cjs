const { chromium, expect } = require("@playwright/test");
const fs = require("node:fs");
const ts = require("typescript");
const compiled = ts.transpileModule(
  fs.readFileSync("src/lib/demo-data.ts", "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
const fixtures = {};
new Function("exports", compiled)(fixtures);
// Small visual fixture for contract checks; real 200k-point/LAN performance is separate.
function contractCloud() {
  const source = fixtures.demoCloud();
  const header = JSON.parse(
    new TextDecoder().decode(
      new Uint8Array(source, 4, new DataView(source).getUint32(0, true)),
    ),
  );
  const original = header.n,
    n = Math.min(10000, original),
    step = Math.max(1, Math.floor(original / n));
  const xyz = new Float32Array(source, header.offsets.xyz, original * 3);
  const rgb = new Uint8Array(source, header.offsets.rgb, original * 3);
  const instance = new Uint16Array(source, header.offsets.instance, original);
  header.n = n;
  header.offsets = { xyz: 2052, rgb: 2052 + n * 12, instance: 2052 + n * 15 };
  if (header.offsets.instance % 2) header.offsets.instance++;
  const output = new ArrayBuffer(header.offsets.instance + n * 2);
  const encoded = new TextEncoder().encode(JSON.stringify(header));
  new DataView(output).setUint32(0, encoded.length, true);
  new Uint8Array(output, 4, encoded.length).set(encoded);
  const outXYZ = new Float32Array(output, header.offsets.xyz, n * 3),
    outRGB = new Uint8Array(output, header.offsets.rgb, n * 3),
    outInstance = new Uint16Array(output, header.offsets.instance, n);
  for (let i = 0; i < n; i++) {
    const at = i * step;
    outXYZ.set(xyz.subarray(at * 3, at * 3 + 3), i * 3);
    outRGB.set(rgb.subarray(at * 3, at * 3 + 3), i * 3);
    outInstance[i] = instance[at];
  }
  return Buffer.from(output);
}
const cloud = contractCloud(),
  seams = fixtures.demoSeams();
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
      acceptDownloads: true,
    });
    page.setDefaultTimeout(15000);
    const errors = [],
      calls = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let jobId = "fixture-job",
      jobSerial = 0;
    let calibrated = false,
      scanDone = false,
      uploaded = false,
      jobKind = "",
      polls = 0,
      simulate409 = false,
      pushes = 0;
    let scanFails = true,
      holdJob = false,
      calibration422 = false,
      pushFails = false;
    const frames = () => [
      {
        id: "sw2_e30",
        source: "dataset",
        bytes: 3400000,
        mtime: 1,
        has_artifacts: true,
      },
      {
        id: "frame_002",
        source: "camera",
        bytes: 3400000,
        mtime: 2,
        has_artifacts: true,
      },
      {
        id: "frame_003",
        source: "upload",
        bytes: 3400000,
        mtime: 3,
        has_artifacts: false,
      },
      ...(uploaded
        ? [
            {
              id: "upload_test",
              source: "upload",
              bytes: 160,
              mtime: 4,
              has_artifacts: false,
            },
          ]
        : []),
      ...(scanDone
        ? [
            {
              id: "scan_result",
              source: "camera",
              bytes: 3400000,
              mtime: 5,
              has_artifacts: true,
            },
          ]
        : []),
    ];
    await page.route("**/api/**", async (route) => {
      const request = route.request(),
        url = new URL(request.url()),
        path = url.pathname,
        method = request.method();
      let body = null;
      if (method === "POST") body = request.postDataJSON();
      calls.push({ path, method, body, time: Date.now() });
      const json = (value, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(value),
        });
      if (path === "/api/health")
        return json({
          model_ok: false,
          model_error: "fixture: model disabled for offline reuse",
          cpp_ok: true,
        });
      if (path === "/api/frames") return json({ frames: frames() });
      if (path === "/api/frames/upload_test" && method === "PUT") {
        uploaded = true;
        return json({
          id: "upload_test",
          bytes: request.postDataBuffer().length,
        });
      }
      if (path.startsWith("/api/view/")) {
        if (["upload_test", "frame_003"].includes(path.split("/").pop()))
          return json({ detail: "无识别结果" }, 404);
        return route.fulfill({
          contentType: "application/octet-stream",
          body: cloud,
        });
      }
      if (path.startsWith("/api/seams/")) {
        if (["upload_test", "frame_003"].includes(path.split("/").pop()))
          return json({ detail: "无识别结果" }, 404);
        return json({
          frame: path.split("/").pop(),
          calib_tag: calibrated ? "calib-fixture" : null,
          uncalibrated: !calibrated,
          seams,
          primitives: [],
        });
      }
      if (path.startsWith("/api/calib/"))
        return json({
          calib_tag: calibrated ? "calib-fixture" : null,
          has_calib: calibrated,
          uncalibrated: !calibrated,
        });
      if (path === "/api/calib" && method === "POST") {
        if (calibration422)
          return json(
            {
              detail: [
                {
                  loc: ["body", "pairs", 0, "cam"],
                  msg: "Field required",
                  input: "must-not-render",
                },
              ],
            },
            422,
          );
        calibrated = !body.clear;
        return json({
          calib_tag: calibrated ? "calib-fixture" : null,
          max_dev_mm: calibrated ? 1.8 : 0,
          mean_dev_mm: calibrated ? 0.7 : 0,
        });
      }
      if (path === "/api/scan" || path === "/api/recognize") {
        if (simulate409)
          return json({ detail: "已有任务运行，请稍后再试" }, 409);
        jobKind = path.endsWith("scan") ? "scan" : "recognize";
        polls = 0;
        jobId = `fixture-job-${++jobSerial}`;
        return json({ job_id: jobId }, 202);
      }
      if (path === `/api/jobs/${jobId}`) {
        polls++;
        const done = polls >= 2 && !holdJob;
        const failed = done && jobKind === "scan" && scanFails;
        if (done && jobKind === "scan" && !failed) scanDone = true;
        return json({
          id: jobId,
          kind: jobKind,
          state: failed ? "error" : done ? "done" : "running",
          log: failed
            ? ["任务受理", "本机未接相机：fixture RVC unavailable"]
            : done
              ? ["任务受理", "fixture任务完成"]
              : ["任务受理"],
          error: null,
          result:
            done && !failed
              ? {
                  frame: jobKind === "scan" ? "scan_result" : "sw2_e30",
                  n_seams: 4,
                  seconds: 3,
                }
              : null,
          seconds: polls * 1.5,
        });
      }
      if (path === "/api/program")
        return json({
          ls_name: "FIXTURE",
          ls_text: "/PROG FIXTURE\n/COMMENT = fixture only;\n/END",
          issues: ["fixture advisory"],
          waypoints_cam_mm: seams.find((s) => s.id === body.seam_id)
            .trajectory_mm,
          waypoints_base_mm: seams.find((s) => s.id === body.seam_id)
            .trajectory_mm,
          wpr_list: seams
            .find((s) => s.id === body.seam_id)
            .trajectory_mm.map(() => [180, 0, 0]),
          download: "/api/program/FIXTURE/download",
        });
      if (path === "/api/program/FIXTURE/download")
        return route.fulfill({
          contentType: "text/plain",
          headers: { "Content-Disposition": "attachment; filename=FIXTURE.ls" },
          body: "/PROG FIXTURE\n/END",
        });
      if (path === "/api/push") {
        if (pushFails) return json({ detail: "FTP 连接失败（fixture）" }, 502);
        pushes++;
        return json({
          remote_path: "/MD/FIXTURE.ls",
          bytes: 31,
          existed_before: pushes > 1,
        });
      }
      return json({ detail: "unexpected " + path }, 404);
    });
    const acquisition = page.locator("[data-acquisition-screen]");
    const workbench = page.locator('[data-pane="workbench"]');
    const pane = async () =>
      (await acquisition.isVisible()) ? acquisition : workbench;
    const nav = async (index) =>
      (await pane())
        .getByRole("navigation", { name: "主要导航", exact: true })
        .getByRole("button")
        .nth(index)
        .click();
    const btn = async (name) =>
      (await pane()).getByRole("button", { name, exact: true });
    const toast = async (text) =>
      expect(
        page
          .locator('[role="status"]:visible, [role="alert"]:visible')
          .filter({ hasText: text })
          .last(),
      ).toBeVisible({ timeout: 20000 });
    const closeAnimation = async () => {
      const control = (await pane()).getByRole("button", {
        name: "返回实际点云",
        exact: true,
      });
      if (await control.isVisible()) await control.click();
    };
    const fillPairs = async () => {
      const points = [
        [0, 0, 0],
        [100, 0, 0],
        [0, 100, 0],
      ];
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) {
          await workbench
            .getByLabel(`点对${i + 1}相机${"XYZ"[j]}`, { exact: true })
            .fill(String(points[i][j]));
          await workbench
            .getByLabel(`点对${i + 1}基座${"XYZ"[j]}`, { exact: true })
            .fill(String(points[i][j] + [100, 200, 300][j]));
        }
    };
    await page.goto(process.env.APP_URL || "http://localhost:3012");
    const demo = acquisition.getByRole("button", {
      name: "离线演示，切换连接模式",
      exact: true,
    });
    if (await demo.isVisible()) {
      await demo.click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "真实后端", exact: true })
        .click();
    }
    await acquisition
      .locator("canvas")
      .first()
      .waitFor()
      .catch(async (error) => {
        console.error(
          "Initial fixture calls",
          calls.map((call) => call.path),
          "Page errors",
          errors,
        );
        console.error(await acquisition.innerText());
        throw error;
      });
    await expect(
      acquisition.getByRole("option", { name: "选择帧 sw2_e30", exact: true }),
    ).toBeVisible();
    expect(calls.some((call) => call.path === "/api/health")).toBe(true);
    await expect(
      acquisition.getByRole("button", { name: "模型状态", exact: true }),
    ).toHaveAttribute("title", /fixture/);
    fs.mkdirSync("screenshots", { recursive: true });
    await page.screenshot({
      path: "screenshots/requirements-acquisition-1920.png",
    });

    console.log("PASS health and live default");
    // FR2: binary PUT, a real local preview, and a result-free frame guidance state.
    await acquisition
      .getByLabel("选择 PCD 文件", { exact: true })
      .setInputFiles({
        name: "upload_test.pcd",
        mimeType: "application/octet-stream",
        buffer: Buffer.from(
          "FIELDS x y z\nSIZE 4 4 4\nTYPE F F F\nWIDTH 3\nHEIGHT 1\nPOINTS 3\nDATA ascii\n0 0 0\n50 0 0\n0 50 0\n",
        ),
      });
    await expect(
      acquisition.getByText("upload_test.pcd", { exact: true }).first(),
    ).toBeVisible({ timeout: 20000 });
    expect(
      calls.some(
        (call) =>
          call.path === "/api/frames/upload_test" && call.method === "PUT",
      ),
    ).toBe(true);
    await acquisition
      .getByRole("option", { name: "选择帧 frame_003", exact: true })
      .click();
    await nav(2);
    await expect(workbench.locator(".viewer .empty")).toContainText(
      "当前帧无历史结果",
    );
    await nav(1);
    await acquisition
      .getByRole("option", { name: "选择帧 sw2_e30", exact: true })
      .click();
    await expect(
      acquisition.getByText("sw2_e30.pcd", { exact: true }).first(),
    ).toBeVisible();
    const views = calls.filter((call) =>
      call.path.startsWith("/api/view/"),
    ).length;
    await (await btn("实例")).click();
    await (await btn("语义")).click();
    expect(
      calls.filter((call) => call.path.startsWith("/api/view/")).length,
    ).toBe(views);
    await acquisition
      .getByRole("option", { name: "选择帧 frame_002", exact: true })
      .click();
    await expect(
      acquisition.getByText("frame_002.pcd", { exact: true }).first(),
    ).toBeVisible();
    await acquisition
      .getByRole("option", { name: "选择帧 sw2_e30", exact: true })
      .click();
    expect(
      calls.filter((call) => call.path.startsWith("/api/view/")).length,
    ).toBe(views + 1);

    console.log("PASS binary upload, frame guidance, cache and local palette");
    // FR3/4: camera failure, paused polling, successful completion and the shared lock.
    await (await btn("开始采集")).first().click();
    await toast("本机未接相机");
    await closeAnimation();
    scanFails = false;
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await (await btn("开始采集")).first().click();
    const pausedPolls = calls.filter((call) =>
      call.path.startsWith("/api/jobs/"),
    ).length;
    await page.waitForTimeout(1700);
    expect(
      calls.filter((call) => call.path.startsWith("/api/jobs/")).length,
    ).toBe(pausedPolls);
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(
      acquisition.getByText("scan_result.pcd", { exact: true }).first(),
    ).toBeVisible({ timeout: 20000 });
    expect(calls.find((call) => call.path === "/api/scan").body).toEqual({
      scan_ms: 2500,
      exp_us: 300,
      dist: [400, 800],
      loose: false,
    });
    await closeAnimation();
    await acquisition
      .getByRole("option", { name: "选择帧 sw2_e30", exact: true })
      .click();
    await nav(2);
    await workbench.getByLabel("复用历史结果", { exact: true }).check();
    holdJob = true;
    const recognitionPollStart = calls.filter((call) =>
      call.path.startsWith("/api/jobs/"),
    ).length;
    await (await btn("开始识别")).click();
    await expect(
      workbench.locator(".recognition-actions .primary"),
    ).toBeDisabled();
    await nav(1);
    await expect(
      acquisition
        .getByRole("button", { name: /^(开始采集|采集进行中)$/ })
        .first(),
    ).toBeDisabled();
    holdJob = false;
    await toast("识别完成");
    const rec = calls.find((call) => call.path === "/api/recognize");
    expect(rec.body).toEqual({
      frame: "sw2_e30",
      reuse_artifacts: true,
      voxel: 1.5,
      tile: 200,
      stride: 120,
      smooth_k: 16,
      smooth_r: 3,
      max_gap: 0.008,
      min_len: 50,
    });
    const times = calls
      .filter((call) => call.path.startsWith("/api/jobs/"))
      .slice(recognitionPollStart)
      .map((call) => call.time);
    expect(times.length).toBeGreaterThanOrEqual(2);
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(1200);
    await nav(2);
    await closeAnimation();
    await expect(workbench.locator(".viewport-status")).toBeVisible();
    simulate409 = true;
    await (await btn("开始识别")).click();
    await toast("请稍候再试");
    simulate409 = false;
    await closeAnimation();

    console.log("PASS 202 tasks, polling pause, shared lock and 409");
    // FR7: live fields start blank; validate 422, default pair payload, residuals and clear.
    await nav(3);
    await expect(
      workbench.getByLabel("点对1相机X", { exact: true }),
    ).toHaveValue("");
    const beforeCalib = calls.filter(
      (call) => call.path === "/api/calib",
    ).length;
    await (await btn("保存标定")).click();
    await toast("有限数字");
    expect(calls.filter((call) => call.path === "/api/calib").length).toBe(
      beforeCalib,
    );
    await fillPairs();
    calibration422 = true;
    await (await btn("保存标定")).click();
    await toast("pairs.0.cam");
    expect(await page.locator("body").innerText()).not.toContain(
      "must-not-render",
    );
    calibration422 = false;
    await (await btn("保存标定")).click();
    await toast("1.5mm");
    await expect(workbench.locator(".health")).toContainText("需复核");
    const saved = calls
      .filter((call) => call.path === "/api/calib" && call.body.pairs)
      .at(-1).body;
    expect(Object.keys(saved.pairs[0]).sort()).toEqual(["base", "cam"]);
    await nav(1);
    await expect(
      acquisition.getByRole("button", { name: "当前帧标定状态", exact: true }),
    ).toHaveAttribute("title", /1.5mm/);
    await expect(
      acquisition
        .getByRole("button", { name: "当前帧标定状态", exact: true })
        .locator("i"),
    ).toHaveClass(/yellow/);
    await nav(3);
    await closeAnimation();
    await (await btn("清除标定")).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "确认清除", exact: true })
      .click();
    await toast("清除");
    await nav(4);
    await expect(workbench.locator(".viewport-status")).toBeVisible();
    await workbench.locator(".left-column .seam-list").focus();
    await page.keyboard.press("ArrowDown");
    await expect(
      workbench
        .locator(".left-column")
        .getByRole("option")
        .filter({ hasText: "W002" }),
    ).toHaveAttribute("aria-selected", "true");

    console.log(
      "PASS calibration validation, 422, residual warning, clear and seam keyboard",
    );
    // FR8/9: validation, explicit uncalibrated generation, real response playback and download.
    await nav(5);
    await workbench.getByLabel("程序名称", { exact: true }).fill("bad-name");
    await (await btn("生成 .LS 程序")).click();
    await toast("程序名");
    expect(calls.filter((call) => call.path === "/api/program")).toHaveLength(
      0,
    );
    await workbench.getByLabel("程序名称", { exact: true }).fill("VALID");
    await (await btn("生成 .LS 程序")).click();
    await expect(page.getByRole("dialog")).toContainText("禁止上机");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "确认生成", exact: true })
      .click();
    await expect(workbench.locator(".code-preview")).toBeVisible();
    await closeAnimation();
    await expect(workbench.locator(".right-column")).toContainText(
      "fixture advisory",
    );
    await workbench.getByLabel("播放速度", { exact: true }).selectOption("3");
    await expect(workbench.getByLabel("播放速度", { exact: true })).toHaveValue(
      "3",
    );
    await (await btn("播放")).click();
    await expect(await btn("暂停")).toBeVisible();
    await (await btn("暂停")).click();
    await workbench.getByLabel("预演进度", { exact: true }).fill("50");
    const download = page.waitForEvent("download");
    await (await btn("下载 .LS")).click();
    expect((await download).suggestedFilename()).toMatch(/\.ls$/i);
    await nav(6);
    await (await btn("预览下发确认")).click();
    await toast("禁止上机");
    expect(calls.filter((call) => call.path === "/api/push")).toHaveLength(0);

    console.log("PASS program guard, response playback and download");
    // FR10: a valid generated program, file-only confirmation and overwrite feedback.
    await nav(3);
    await (await btn("保存标定")).click();
    await toast("标定已保存");
    await nav(5);
    await (await btn("生成 .LS 程序")).click();
    await expect(workbench.locator(".code-preview")).toBeVisible();
    await closeAnimation();
    await nav(6);
    await workbench
      .getByLabel("控制器地址", { exact: true })
      .fill("robot.fixture");
    await workbench.getByLabel("密码", { exact: true }).fill("do-not-persist");
    await (await btn("预览下发确认")).click();
    await expect(page.getByRole("dialog")).toContainText("robot.fixture");
    await expect(page.getByRole("dialog")).toContainText("同名程序将被覆盖");
    await expect(page.getByRole("dialog")).not.toContainText("do-not-persist");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "确认传输文件", exact: true })
      .click();
    await toast("字节");
    await closeAnimation();
    await (await btn("预览下发确认")).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "确认传输文件", exact: true })
      .click();
    await toast("覆盖");
    await closeAnimation();
    expect(
      await page.evaluate(() => localStorage.getItem("weld-ftp-preferences")),
    ).not.toContain("do-not-persist");
    pushFails = true;
    await (await btn("预览下发确认")).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "确认传输文件", exact: true })
      .click();
    await toast("FTP 连接失败");
    await closeAnimation();
    pushFails = false;

    console.log(
      "PASS file-only FTP confirmation, overwrite, 502 and password handling",
    );
    // Compact contexts remain accessible with the existing panel design; no viewport <600px.
    for (const [width, height] of [
      [1366, 768],
      [1100, 800],
      [800, 700],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await nav(2);
      await expect
        .poll(() =>
          workbench.locator(".viewer").evaluate((el) => el.clientWidth),
        )
        .toBeGreaterThanOrEqual(600);
      if (width < 1200) {
        await (await btn("焊缝与上下文")).click();
        await expect(workbench.locator(".left-column")).toContainText(
          "识别结果",
        );
        await (await btn("工作流")).click();
      }
      await nav(1);
      await expect
        .poll(() =>
          acquisition
            .locator("section")
            .filter({ hasText: "三维点云预览" })
            .first()
            .evaluate((el) => el.clientWidth),
        )
        .toBeGreaterThanOrEqual(600);
      if (width < 1200) {
        await (await btn("焊缝与上下文")).click();
        await expect(
          acquisition.getByText("当前帧信息", { exact: true }),
        ).toBeVisible();
        await (await btn("工作流")).click();
      }
    }
    await page.setViewportSize({ width: 1920, height: 1080 });
    await nav(0);
    await page.screenshot({ path: "screenshots/requirements-home-light.png" });
    await (await btn("切换深浅主题")).click();
    await page.screenshot({ path: "screenshots/requirements-home-dark.png" });
    await (await btn("切换深浅主题")).click();
    await workbench
      .getByRole("button", { name: /任务中心/ })
      .first()
      .click();
    await expect(workbench.locator(".task-drawer")).toBeVisible();
    await (await btn("收起任务中心")).click();
    expect(errors).toEqual([]);
    expect(pushes).toBe(2);
    console.log(
      "PASS FR1–10 controlled HTTP contracts, 13 endpoints, camera error, 202/polling/mutex, 422, calibration, program/playback/download, FTP, responsive contexts. No backend/device connection.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
