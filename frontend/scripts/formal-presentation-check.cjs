const { openDemo } = require("./browser-mode.cjs");
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1536, height: 742 } });
    page.setDefaultTimeout(45000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    fs.mkdirSync('reports/formal', { recursive: true });
    await openDemo(page, process.env.APP_URL || 'http://localhost:3019');
    
    const acq = page.locator('[data-acquisition-screen]');
    await acq.locator('canvas').waitFor();
    // A real scan submission automatically opens the illustrative scene.
    await acq.getByRole('button', { name: '开始采集', exact: true }).first().click();
    await expect(acq.locator('[data-process-stage="capture"]')).toBeVisible();
    await acq.getByRole('button', { name: '暂停过程演示' }).click();
    await acq.getByLabel('过程演示进度', { exact: true }).fill('0.47');
    const frozen = await acq.getByLabel('过程演示进度', { exact: true }).inputValue();
    await page.waitForTimeout(150);
    expect(await acq.getByLabel('过程演示进度', { exact: true }).inputValue()).toBe(frozen);
    await acq.getByLabel('过程演示速度', { exact: true }).selectOption('2');
    await page.screenshot({ path: 'reports/formal/capture-light.png' });
    await acq.getByRole('button', { name: '返回实际点云' }).click();
    await acq.getByRole('button', { name: '切换深浅主题' }).click();
    await page.screenshot({ path: 'reports/formal/capture-dark.png' });
    await acq.getByRole('button', { name: 'AI识别', exact: true }).click();
    const wb = page.locator('[data-pane="workbench"]');
    await expect(wb.locator('.pdf-app')).not.toHaveClass(/light/);
    const stages = [['AI 识别', 'recognize'], ['坐标标定', 'calibrate'], ['焊缝管理', 'seams'], ['程序与预演', 'program'], ['程序下发', 'transfer'], ['首页', 'overview']];
    for (const [name, key] of stages) {
      await wb.getByRole('navigation').getByRole('button', { name, exact: true }).click();
      if (key === 'calibrate') {
        for (const [width, height] of [[1536, 742], [1366, 768], [1536, 696], [1920, 928]]) {
          await page.setViewportSize({ width, height });
          const visible = await wb.evaluate(el => {
            const panel = el.querySelector('.right-column > .panel:first-child');
            const bounds = panel.getBoundingClientRect();
            return [...panel.querySelectorAll('.calibration-state, .calibration-stats > div')].every(item => {
              const r = item.getBoundingClientRect();
              return r.top >= bounds.top && r.bottom <= bounds.bottom && r.right <= bounds.right && r.left >= bounds.left;
            });
          });
          expect(visible).toBe(true);
        }
        await page.setViewportSize({ width: 1536, height: 742 });
        await page.screenshot({ path: 'reports/formal/calibration-status-dark.png' });
      }
      await wb.getByRole('button', { name: '过程演示', exact: true }).click();
      await expect(wb.locator(`[data-process-stage="${key}"]`)).toBeVisible();
      await wb.getByRole('button', { name: '暂停过程演示' }).click();
      await wb.getByLabel('过程演示进度', { exact: true }).fill('0.67');
      await wb.locator('.process-presentation canvas').waitFor();
      await page.screenshot({ path: `reports/formal/${key}-dark.png` });
      await wb.getByRole('button', { name: '返回实际点云' }).click();
      console.log('PASS formal stage', name);
    }
    await wb.getByRole('button', { name: '切换深浅主题' }).click();
    await expect(wb.locator('.pdf-app')).toHaveClass(/light/);
    await wb.getByRole('navigation').getByRole('button', { name: '坐标标定', exact: true }).click();
    await page.screenshot({ path: 'reports/formal/calibration-status-light.png' });
    await page.reload();
    await expect(acq.getByRole('button', { name: '切换深浅主题' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('weld-theme'))).toBe('light');
    expect(errors).toEqual([]);
    fs.writeFileSync('reports/formal/result.json', JSON.stringify({ stages: 7, themes: 2, calibrationSizes: 4, automaticScan: true, playPauseScrubSpeed: true, errors }, null, 2));
    console.log('PASS formal integration, calibration card containment, theme sharing and persistence, no page errors');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
