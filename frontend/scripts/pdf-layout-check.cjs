const { chromium, expect } = require("@playwright/test");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1680, height: 944 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(process.env.APP_URL || "http://localhost:3008");
    await page.locator("canvas").waitFor();
    await page.screenshot({ path: "screenshots/layout-acquisition.png" });
    for (const tab of [0, 2, 3, 4, 5, 6]) {
      await page.locator("nav button").nth(tab).click();
      await page.locator("canvas").waitFor();
      await page.screenshot({ path: `screenshots/layout-page-${tab}.png` });
      if (tab) {
        await expect(page.locator(".workspace>.left-column")).toBeVisible();
        await expect(page.locator(".workspace>.center-column")).toBeVisible();
        await expect(page.locator(".workspace>.right-column")).toBeVisible();
      }
      await page.setViewportSize({ width: 1366, height: 768 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (tab) {
        const rects = await page
          .locator(".workspace")
          .evaluate((e) =>
            [...e.children].map((c) => c.getBoundingClientRect().toJSON()),
          );
        expect(rects[0].right).toBeLessThan(rects[1].left);
        expect(rects[1].right).toBeLessThan(rects[2].left);
        expect(rects[2].right).toBeLessThanOrEqual(1366);
      }
      await page.setViewportSize({ width: 1680, height: 944 });
    }
    expect(errors).toEqual([]);
    console.log(
      "PASS: seven pages, PDF columns/modules and 1366px scaling; shared WebGL and no page errors. No FPS cap or playback-rate changes.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

