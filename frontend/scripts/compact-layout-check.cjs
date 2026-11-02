const { openDemo } = require("./browser-mode.cjs");
const {chromium,expect}=require('@playwright/test');
const fs=require('node:fs');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{const page=await browser.newPage({viewport:{width:1536,height:742},deviceScaleFactor:1.25});page.setDefaultTimeout(30000);await openDemo(page, process.env.APP_URL || 'http://localhost:3016');

const acq=page.locator('[data-acquisition-screen]');await acq.locator('canvas').waitFor();
fs.mkdirSync('reports',{recursive:true});const report=[];
for(const [width,height] of [[1536,742],[1920,928],[1366,768],[1536,696]]){
await page.setViewportSize({width,height});await page.waitForTimeout(150);
const data=await page.evaluate(()=>{const stage=document.querySelector('[data-acquisition-stage]');const left=stage.querySelector(':scope > div');const right=stage.querySelector('aside:last-of-type');const header=stage.querySelector('header');const button=[...left.querySelectorAll('button')].find(e=>e.textContent.includes('开始采集'));return{width:innerWidth,height:innerHeight,headerOverflow:header.scrollWidth>header.clientWidth+1,leftOverflow:left.scrollHeight>left.clientHeight+1,rightOverflow:right.scrollHeight>right.clientHeight+1,scanVisible:button.getBoundingClientRect().bottom<=left.getBoundingClientRect().bottom+1,scanFont:getComputedStyle(left.querySelector('input[type=number]')).fontSize,viewerWidth:stage.querySelector(':scope>section').getBoundingClientRect().width,headerRects:[...header.children].map(e=>({tag:e.tagName,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right})),stageWidth:stage.clientWidth};});
report.push(data);console.log('Acquisition',width,height,{headerOverflow:data.headerOverflow,leftOverflow:data.leftOverflow,rightOverflow:data.rightOverflow,scanVisible:data.scanVisible,scanFont:data.scanFont});expect(data.headerOverflow).toBe(false);expect(data.leftOverflow).toBe(false);expect(data.rightOverflow).toBe(false);expect(data.scanVisible).toBe(true);expect(data.scanFont).toBe('14px');expect(data.viewerWidth).toBeGreaterThanOrEqual(600);
if(width===1536&&height===742)await page.screenshot({path:'reports/compact-acquisition-100-percent.png'});
}
await page.setViewportSize({width:1536,height:742});await acq.getByRole('button',{name:'AI识别',exact:true}).click();const wb=page.locator('[data-pane="workbench"]');await wb.locator('canvas').waitFor({state:'visible'});
for(const name of ['AI 识别','坐标标定','焊缝管理','程序与预演','程序下发']){await wb.getByRole('navigation').getByRole('button',{name,exact:true}).click();await page.waitForTimeout(100);const result=await wb.evaluate(el=>{const l=el.querySelector('.left-column'),r=el.querySelector('.right-column'),h=el.querySelector('header');return{headerOverflow:h.scrollWidth>h.clientWidth+1,leftOverflow:l.scrollHeight>l.clientHeight+1,rightOverflow:r.scrollHeight>r.clientHeight+1,viewer:el.querySelector('.viewer').getBoundingClientRect().width};});console.log('Workbench',name,result);expect(result.headerOverflow).toBe(false);expect(result.leftOverflow).toBe(false);expect(result.rightOverflow).toBe(false);}
fs.writeFileSync('reports/compact-report.json',JSON.stringify(report,null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
