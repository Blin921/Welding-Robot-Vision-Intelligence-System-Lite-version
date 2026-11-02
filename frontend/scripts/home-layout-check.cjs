const { openDemo } = require("./browser-mode.cjs");
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
  try {
    const page = await browser.newPage({viewport:{width:1536,height:742}});
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if(response.status()>=400) errors.push(`${response.status()} ${response.url()}`); });
    if (process.env.HTML_FILE) {
      page.on('request', request => { if(/^https?:/.test(request.url())) requests.push(request.url()); });
      await page.route(/^https?:/, route => route.abort());
      await page.setContent(fs.readFileSync(process.env.HTML_FILE,'utf8'));
    } else await openDemo(page, process.env.APP_URL || 'http://localhost:3021');
    const acquisition = page.locator('[data-acquisition-screen]');
    await acquisition.locator('canvas').waitFor();
    await acquisition.getByRole('navigation').getByRole('button',{name:'首页',exact:true}).click();
    const home = page.locator('.home-overview'), workbench=page.locator('[data-pane="workbench"]');
    await home.locator('.hero-cloud canvas').waitFor();
    const output = process.env.HTML_FILE ? 'reports/home-offline' : 'reports/home';
    fs.mkdirSync(output,{recursive:true});
    const measurements=[];
    for(const [width,height] of [[1536,742],[1366,768],[1920,1080],[1536,696]]) {
      await page.setViewportSize({width,height});
      const measure=await home.evaluate(el=>{
        const hero=el.querySelector('.hero').getBoundingClientRect();
        const controls=[...el.querySelectorAll('.hero-actions button')].map(button=>{
          const r=button.getBoundingClientRect();
          return {label:button.textContent,inside:r.left>=hero.left&&r.right<=hero.right&&r.top>=hero.top&&r.bottom<=hero.bottom,clickable:button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};
        });
        const cards=[...el.querySelectorAll('.workflow-card')].map(card=>{const r=card.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,clickable:card.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};});
        return {width:innerWidth,height:innerHeight,controls,cards,overflow:el.scrollHeight>el.clientHeight+1,pageOverflow:document.documentElement.scrollWidth>innerWidth};
      });
      measure.controls.forEach(control=>{expect(control.inside).toBe(true);expect(control.clickable).toBe(true);});
      measure.cards.forEach(card=>{expect(card.top).toBe(measure.cards[0].top);expect(card.bottom).toBe(measure.cards[0].bottom);expect(card.bottom).toBeLessThan(height);expect(card.clickable).toBe(true);});
      expect(measure.overflow).toBe(false);expect(measure.pageOverflow).toBe(false);
      await expect(home.locator('.hero input[aria-label="点大小"]')).toHaveCount(0);
      await expect(home.locator('.home-feature-art')).toHaveCount(5);
      measurements.push(measure);console.log('PASS home layout',width,height);
      if(width===1536&&height===742)await page.screenshot({path:`${output}/home-light.png`});
    }
    await page.setViewportSize({width:1536,height:742});
    await workbench.getByRole('button',{name:'切换深浅主题',exact:true}).click();
    await page.screenshot({path:`${output}/home-dark.png`});
    for(const [label,tab] of [['数据采集与管理',1],['AI焊缝识别',2],['坐标标定',3],['程序生成与轨迹预演',5],['机器人程序下发',6]]) {
      await home.getByRole('button',{name:`打开${label}`,exact:true}).click();
      if(tab===1){await expect(acquisition).toBeVisible();await acquisition.getByRole('navigation').getByRole('button',{name:'首页',exact:true}).click();}
      else {await expect(workbench.locator(`.workspace.page-${tab}`)).toBeVisible();await workbench.getByRole('navigation').getByRole('button',{name:'首页',exact:true}).click();}
    }
    await home.getByRole('button',{name:'进入工作台',exact:true}).click();await expect(workbench.locator('.workspace.page-2')).toBeVisible();
    await workbench.getByRole('navigation').getByRole('button',{name:'首页',exact:true}).click();
    await home.getByRole('button',{name:'离线演示',exact:true}).click();await expect(workbench.locator('.workspace.page-5')).toBeVisible();
    await workbench.getByRole('navigation').getByRole('button',{name:'首页',exact:true}).click();
    await home.getByRole('button',{name:'过程演示',exact:true}).click();await expect(home.locator('[data-process-stage="overview"]')).toBeVisible();await home.getByRole('button',{name:'返回实际点云',exact:true}).click();
    expect(errors).toEqual([]);expect(requests).toEqual([]);
    fs.writeFileSync(`${output}/result.json`,JSON.stringify({measurements,errors,requests,cardLinks:5,primaryActions:2,overviewAnimation:true},null,2));
    console.log('PASS aligned cards, visible buttons, correct navigation, process animation, no errors');
  }finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
