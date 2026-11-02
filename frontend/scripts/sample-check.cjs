const {chromium,expect}=require('@playwright/test');
const fs=require('node:fs');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{const page=await browser.newPage({viewport:{width:1680,height:944},deviceScaleFactor:1});page.setDefaultTimeout(30000);fs.mkdirSync('reports/samples',{recursive:true});const errors=[],api=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))api.push(r.url());});
await page.goto((process.env.APP_URL || 'http://localhost:3018').replace(/\/$/, '') + '/samples');await page.locator('canvas').waitFor();await expect(page.getByRole('button',{name:'开始采集演示',exact:true})).toBeVisible();
await page.getByLabel('过程动画进度',{exact:true}).fill('0.46');await page.waitForTimeout(350);await page.screenshot({path:'reports/samples/sample-dark-capture.png'});
for(const name of ['首页','数据采集','AI 识别','坐标标定','焊缝管理','程序与预演','程序下发']){
 await page.getByRole('navigation',{name:'样板页面'}).getByRole('button',{name,exact:true}).click();await page.getByLabel('过程动画进度',{exact:true}).fill('0.67');await page.waitForTimeout(150);
 if(['AI 识别','坐标标定','程序与预演','程序下发'].includes(name))await page.screenshot({path:'reports/samples/sample-dark-'+({'AI 识别':'recognition','坐标标定':'calibration','程序与预演':'program','程序下发':'transfer'})[name]+'.png'});
 console.log('PASS stage',name);
}
await page.getByRole('navigation',{name:'样板页面'}).getByRole('button',{name:'数据采集',exact:true}).click();await page.getByLabel('过程动画进度',{exact:true}).fill('0.46');await page.getByRole('button',{name:'切换样板明暗主题',exact:true}).click();await expect(page.locator('.sample-lab')).toHaveClass(/sample-light/);await page.waitForTimeout(100);await page.screenshot({path:'reports/samples/sample-light-capture.png'});
await page.getByLabel('过程动画进度',{exact:true}).fill('0');await page.getByRole('button',{name:'开始采集演示',exact:true}).click();await expect(page.getByRole('button',{name:'暂停演示',exact:true})).toBeVisible();await expect.poll(()=>page.getByLabel('过程动画进度',{exact:true}).inputValue()).not.toBe('0');await page.getByRole('button',{name:'暂停演示',exact:true}).click();const frozen=await page.getByLabel('过程动画进度',{exact:true}).inputValue();await page.waitForTimeout(150);expect(await page.getByLabel('过程动画进度',{exact:true}).inputValue()).toBe(frozen);
await page.getByLabel('过程动画速度',{exact:true}).selectOption('2');await expect(page.getByLabel('过程动画速度',{exact:true})).toHaveValue('2');
for(const [width,height] of [[1920,1080],[1366,768],[1100,800],[390,844]]){await page.setViewportSize({width,height});await page.waitForTimeout(100);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);console.log('PASS size',width,height);}
expect(errors).toEqual([]);expect(api).toEqual([]);fs.writeFileSync('reports/samples/sample-check-results.json',JSON.stringify({stages:7,themes:2,errors,apiRequests:api,playPauseScrubSpeed:true},null,2));console.log('PASS: seven stages, both themes, controls, responsive widths, no page/WebGL errors, no real API calls.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
