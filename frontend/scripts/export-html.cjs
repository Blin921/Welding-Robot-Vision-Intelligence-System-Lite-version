const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const temp = path.join(root, ".static-export");
fs.mkdirSync(temp, { recursive: true });
const webpack = require(path.join(root,"node_modules/next/dist/compiled/webpack/webpack")).webpack;
fs.writeFileSync(path.join(temp,"loader.cjs"), `
const ts = require(${JSON.stringify(path.join(root,"node_modules/typescript"))});
const fs = require('node:fs');
const path = require('node:path');
module.exports = function(source) {
 if(this.resourcePath.endsWith('.css')) {
  let css=source, names={};
  if(this.resourcePath.endsWith('.module.css')) {
   const prefix=path.basename(this.resourcePath).replace(/[^a-zA-Z]/g,'')+'_';
   const globals=[];
   css=css.replace(/:global\\(([^)]+)\\)/g,(_,v)=>{globals.push(v);return 'GLOBALTOKEN'+(globals.length-1)});
   css=css.replace(/\\.([a-zA-Z_][\\w-]*)/g,(_,v)=>{names[v]=prefix+v;return '.'+names[v]});
   css=css.replace(/GLOBALTOKEN(\\d+)/g,(_,i)=>globals[Number(i)]);
  }
  return 'const s=document.createElement("style");s.textContent='+JSON.stringify(css)+';document.head.appendChild(s);module.exports='+JSON.stringify(names)+';';
 }
 for(const asset of ['/brand/smart-vision.png','/home/workflow-illustrations.png']) {
  const data='data:image/png;base64,'+fs.readFileSync(path.join(${JSON.stringify(root)},'public',asset)).toString('base64');
  source=source.split(asset).join(data);
 }
 return ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
};`);
fs.writeFileSync(path.join(temp,"dynamic.tsx"),`import React from 'react'; export default function dynamic(load:any){const Component=React.lazy(()=>load().then((m:any)=>({default:m.default??m})));return function Lazy(props:any){return <React.Suspense fallback={null}><Component {...props}/></React.Suspense>}}`);
fs.writeFileSync(path.join(temp,"image.tsx"),`import React from 'react';export default function Image({priority,unoptimized,...props}:any){return <img {...props}/>}`);
fs.writeFileSync(path.join(temp,"parse.ts"),`import {parsePcd} from '../src/lib/acquisition/pcd';export async function parsePcdFile(file:Blob,frame:string){return parsePcd(await file.arrayBuffer(),frame)}`);
fs.writeFileSync(path.join(temp,"entry.tsx"),`import '../src/app/globals.css';import '../src/app/pdf-layout.css';import '../src/app/process.css';import '../src/app/home.css';import React from 'react';import {createRoot} from 'react-dom/client';import Page from '../src/app/page';createRoot(document.getElementById('root')!).render(<Page/>);`);
webpack({mode:'production',context:root,entry:path.join(temp,'entry.tsx'),target:'web',devtool:false,output:{path:temp,filename:'app.js'},resolve:{extensions:['.tsx','.ts','.js','.json'],alias:{'next/dynamic':path.join(temp,'dynamic.tsx'),'next/image':path.join(temp,'image.tsx'),[path.join(root,'src/lib/acquisition/parse-file.ts')]:path.join(temp,'parse.ts')}},module:{rules:[{test:/\.(tsx?|css)$/,exclude:/node_modules/,use:path.join(temp,'loader.cjs')}]},plugins:[new webpack.DefinePlugin({'process.env.NODE_ENV':JSON.stringify('production'),'process.env.NEXT_PUBLIC_DATA_MODE':JSON.stringify('demo')}),new webpack.optimize.LimitChunkCountPlugin({maxChunks:1})],optimization:{minimize:false}},(error,stats)=>{
 if(error||stats.hasErrors()){console.error(error||stats.toString({all:false,errors:true}));process.exitCode=1;return}
 const js=fs.readFileSync(path.join(temp,'app.js'),'utf8').replace(/<\/script/gi,'<\\/script');
 const html='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>焊接机器人视觉识别系统 · 离线展示</title></head><body><div id="root"></div><script>'+js+'</script></body></html>';
 const output=path.resolve(root,'../deliverables/Welding-Vision-current.html');fs.writeFileSync(output,html);console.log(output+' ('+Math.round(Buffer.byteLength(html)/1024/1024*10)/10+' MB)');
});
