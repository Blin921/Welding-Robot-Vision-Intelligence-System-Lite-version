import { build } from "vite";
import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const temp=path.join(root,".single-html");fs.mkdirSync(temp,{recursive:true});
fs.writeFileSync(path.join(temp,"entry.tsx"),`import React from 'react';import {createRoot} from 'react-dom/client';import Page from '../src/app/page';import '../src/app/globals.css';import '../src/app/pdf-layout.css';import '../src/app/process.css';import '../src/app/home.css';createRoot(document.getElementById('root')).render(<Page/>);`);
fs.writeFileSync(path.join(temp,"dynamic.tsx"),`import React,{Suspense} from 'react';export default function dynamic(loader,options={}){const C=React.lazy(loader);return React.forwardRef((props,ref)=><Suspense fallback={options.loading?React.createElement(options.loading):null}><C {...props} ref={ref}/></Suspense>);}`);
fs.writeFileSync(path.join(temp,"image.tsx"),`import React from 'react';export default function Image({priority,unoptimized,fill,...props}){return <img {...props}/>;}`);
fs.writeFileSync(path.join(temp,"parse.ts"),`import {parsePcd} from '../src/lib/acquisition/pcd';export async function parsePcdFile(file,frame){return parsePcd(await file.arrayBuffer(),frame);}`);
const assets=new Map();
function dataUrl(name){if(!assets.has(name)){const f=path.join(root,'public',name);const ext=path.extname(f);const mime=ext==='.svg'?'image/svg+xml':ext==='.jpg'?'image/jpeg':'image/png';assets.set(name,`data:${mime};base64,${fs.readFileSync(f).toString('base64')}`);}return assets.get(name);}
const result=await build({configFile:false,root,define:{'process.env.NEXT_PUBLIC_DATA_MODE':JSON.stringify('demo'),'process.env.NODE_ENV':JSON.stringify('production')},resolve:{alias:{'next/dynamic':path.join(temp,'dynamic.tsx'),'next/image':path.join(temp,'image.tsx')}},plugins:[{name:'offline-assets',enforce:'pre',resolveId(source){if(source.endsWith('/parse-file')||source==='./parse-file')return path.join(temp,'parse.ts');},transform(code,id){if(!id.includes('/src/')&&!id.includes('\\src\\'))return;return code.replace(/(["'])(\/(?:brand|home|acquisition)\/[^"']+\.(?:png|jpg|svg))\1/g,(_,q,url)=>q+dataUrl(url)+q);}}],build:{write:false,minify:true,lib:{entry:path.join(temp,'entry.tsx'),name:'WeldingVision',formats:['iife']},rollupOptions:{output:{inlineDynamicImports:true}},cssCodeSplit:false}});
const output=Array.isArray(result)?result.flatMap(r=>r.output):result.output;
const js=output.filter(x=>x.type==='chunk').map(x=>x.code).join('\n');
const css=output.filter(x=>x.type==='asset'&&x.fileName.endsWith('.css')).map(x=>x.source).join('\n');
const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>焊接机器人视觉识别系统</title><style>${css}</style></head><body><div id="root"></div><script>${js.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
const target=path.join(root,'焊接机器人视觉系统.html');fs.writeFileSync(target,html);console.log('Created '+target+' ('+(Buffer.byteLength(html)/1024/1024).toFixed(1)+' MB)');
