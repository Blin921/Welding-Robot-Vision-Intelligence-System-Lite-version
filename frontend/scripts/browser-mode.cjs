/** Explicit fixture selection keeps visual checks separate from backend acceptance. */
async function useDemoMode(page) {
  const control = page.getByRole("button", {
    name: "后端模式，切换连接模式",
    exact: true,
  });
  if (await control.isVisible()) {
    await control.click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "离线示例", exact: true })
      .click();
  }
}
async function openDemo(page, url) {
  // Prevent a visual-only test from reaching any configured real backend on initial load.
  await page.route("**/api/**", (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const value =
      pathname === "/api/health"
        ? {
            model_ok: false,
            model_error: "visual check: no backend",
            cpp_ok: false,
          }
        : pathname === "/api/frames"
          ? { frames: [] }
          : { detail: "visual check: no backend" };
    return route.fulfill({
      status:
        pathname === "/api/health" || pathname === "/api/frames" ? 200 : 404,
      contentType: "application/json",
      body: JSON.stringify(value),
    });
  });
  await page.goto(url);
  await useDemoMode(page);
}
module.exports = { useDemoMode, openDemo };
