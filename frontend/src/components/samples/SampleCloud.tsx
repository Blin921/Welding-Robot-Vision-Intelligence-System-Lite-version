"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { demoCloud, demoSeams } from "../../lib/demo-data";
import { parseView } from "../../lib/blob";
import type { StageKey } from "./stages";

interface Props { kind: StageKey; progress: number; light: boolean; pointSize: number; grid: boolean; reset: number }
const KINDS: StageKey[] = ["overview", "capture", "recognize", "calibrate", "seams", "program", "transfer"];
export default function SampleCloud(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const fitView = useRef<(() => void) | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { latest.current = props; }, [props]);
  useEffect(() => { fitView.current?.(); }, [props.reset]);
  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" }); }
    catch { queueMicrotask(() => setFailed(true)); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const root = new THREE.Group(); root.scale.y = -1; scene.add(root);
    const camera = new THREE.PerspectiveCamera(39, 1, 1, 6000);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true; orbit.minDistance = 400; orbit.maxDistance = 3000;
    const fit = () => { camera.position.set(950, 500, 950); orbit.target.set(300, -125, 140); orbit.update(); };
    fit(); fitView.current = fit;
    const cloud = parseView(demoCloud());
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(cloud.xyz, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(cloud.rgb, 3, true));
    const indices = new Uint32Array(40000); for (let i = 0; i < indices.length; i++) indices[i] = i * 5;
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, vertexColors: true,
      uniforms: { uSize: { value: 2 }, uProgress: { value: 0 }, uKind: { value: 1 }, uLight: { value: 0 }, uPixel: { value: Math.min(devicePixelRatio, 1.5) } },
      vertexShader: `varying vec3 vColor; varying float vZ; uniform float uSize; uniform float uPixel; uniform float uProgress; uniform float uKind;
      void main(){vec3 p=position; if(uKind>1.5&&uKind<2.5){float voxel=(1.0-smoothstep(0.0,0.35,uProgress))*9.0;if(voxel>0.1)p=mix(p,floor(p/voxel)*voxel,0.75);} vColor=color;vZ=position.z;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);gl_PointSize=uSize*uPixel;}`,
      fragmentShader: `varying vec3 vColor;varying float vZ;uniform float uProgress;uniform float uKind;uniform float uLight;
      void main(){if(length(gl_PointCoord-0.5)>0.5)discard;vec3 c=vColor;float alpha=0.82;
      if(uKind>0.5&&uKind<1.5){float edge=-260.0+uProgress*830.0;if(vZ>edge){c=mix(vec3(0.30,0.39,0.46),c,0.08);alpha=0.10;}else if(abs(vZ-edge)<18.0)c=mix(c,vec3(0.18,0.96,1.0),0.85);}
      if(uKind>1.5&&uKind<2.5){float reveal=smoothstep(0.2,0.75,uProgress);c=mix(vec3(0.45,0.55,0.61),c,reveal);}
      c=mix(c,c*0.82,uLight);gl_FragColor=vec4(c,alpha);}`,
    });
    root.add(new THREE.Points(geometry, material));
    const grid = new THREE.GridHelper(1200, 60, 0x3b6474, 0x29404c); grid.position.set(300, -220, 150); grid.material.transparent = true; grid.material.opacity = 0.24; scene.add(grid);
    scene.add(new THREE.HemisphereLight(0xe8f5ff, 0x294052, 2));
    const sun = new THREE.DirectionalLight(0xffffff, 2.5); sun.position.set(700, 800, 500); scene.add(sun);
    const sweep = new THREE.Group(); root.add(sweep);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(820, 245), new THREE.MeshBasicMaterial({ color: 0x29e5e1, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }));
    plane.position.set(300, 140, 0); sweep.add(plane);
    const beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-95, 18, 0), new THREE.Vector3(695, 18, 0), new THREE.Vector3(695, 260, 0)]), new THREE.LineBasicMaterial({color:0x5ffcf0,transparent:true,opacity:0.9})); sweep.add(beam);
    const sensor = new THREE.Group();
    const sensorBody = new THREE.Mesh(new THREE.BoxGeometry(62, 38, 38), new THREE.MeshStandardMaterial({ color: 0x31576b, metalness: 0.4, roughness: 0.35 }));sensor.add(sensorBody);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 7, 32), new THREE.MeshBasicMaterial({ color: 0x54f1e5 }));lens.rotation.x=Math.PI/2;lens.position.z=23;sensor.add(lens);sensor.position.set(-110,20,0);sweep.add(sensor);
    const rays = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-100,35,0),new THREE.Vector3(160,170,0),new THREE.Vector3(-100,35,0),new THREE.Vector3(470,170,0),new THREE.Vector3(-100,35,0),new THREE.Vector3(680,170,0)]),new THREE.LineBasicMaterial({color:0x43dfd4,transparent:true,opacity:0.25}));sweep.add(rays);
    const recognitionBoxes = new THREE.Group();root.add(recognitionBoxes);
    for(let i=0;i<3;i++){const box=new THREE.Box3(new THREE.Vector3(90+i*160,88,-170),new THREE.Vector3(190+i*160,205,470));const helper=new THREE.Box3Helper(box, [0x65d6ff,0x6bf0b2,0xffb16c][i]);for (const m of Array.isArray(helper.material) ? helper.material : [helper.material]) { m.transparent=true; m.opacity=0.55; }recognitionBoxes.add(helper);}
    const correspondence = new THREE.Group();root.add(correspondence);
    const pairs=[[120,110,-80],[430,120,220],[580,160,450]];
    for(const [x,y,z] of pairs){const sphere=new THREE.Mesh(new THREE.SphereGeometry(9,16,12),new THREE.MeshBasicMaterial({color:0xffbd67}));sphere.position.set(x,y,z);correspondence.add(sphere);const target=sphere.clone();target.material=new THREE.MeshBasicMaterial({color:0x6de8dc});target.position.add(new THREE.Vector3(80,-95,20));correspondence.add(target);const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([sphere.position,target.position]),new THREE.LineDashedMaterial({color:0x8ee5e9,dashSize:10,gapSize:8,transparent:true,opacity:0.7}));line.computeLineDistances();correspondence.add(line);}
    const cameraAxes=new THREE.AxesHelper(130);cameraAxes.position.set(40,50,-150);correspondence.add(cameraAxes);
    const baseAxes=new THREE.AxesHelper(130);baseAxes.position.set(40,50,-150);correspondence.add(baseAxes);
    correspondence.traverse(o=>{o.renderOrder=7;const item=o as THREE.Mesh;if(item.material)for(const m of Array.isArray(item.material)?item.material:[item.material]){m.depthTest=false;m.depthWrite=false;m.transparent=true;}});
    const seams=demoSeams();const seamGroup=new THREE.Group();root.add(seamGroup);
    const seamLines:THREE.Line[]=[];
    seams.forEach((seam,index)=>{const g=new THREE.BufferGeometry().setFromPoints(seam.trajectory_mm.map(p=>new THREE.Vector3(...p)));const line=new THREE.Line(g,new THREE.LineBasicMaterial({color:index===0?0xffb14d:0x54d9cf,transparent:true,opacity:index===0?1:0.6,depthTest:false}));line.renderOrder=5;seamGroup.add(line);seamLines.push(line);
      for(const p of [seam.trajectory_mm[0],seam.trajectory_mm.at(-1)!]){const dot=new THREE.Mesh(new THREE.SphereGeometry(index===0?5:3,12,8),new THREE.MeshBasicMaterial({color:index===0?0xffd68d:0x7ee7de,depthTest:false}));dot.position.set(...p);dot.renderOrder=6;seamGroup.add(dot);}});
    const weldPath=seams[0].trajectory_mm;
    const tube=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(weldPath.map(p=>new THREE.Vector3(...p))),40,2.4,8,false),new THREE.MeshBasicMaterial({color:0xffae43,transparent:true,opacity:0.9,depthTest:false}));tube.renderOrder=6;root.add(tube);
    const torch=new THREE.Group();torch.scale.setScalar(3);torch.rotation.x=-Math.PI/2;
    const nozzle=new THREE.Mesh(new THREE.ConeGeometry(9,30,48),new THREE.MeshStandardMaterial({color:0xffad45,metalness:0.35,roughness:0.3,depthTest:false,depthWrite:false,transparent:true}));nozzle.rotation.x=Math.PI/2;nozzle.position.z=-15;torch.add(nozzle);
    const collar=new THREE.Mesh(new THREE.CylinderGeometry(10,10,4,48),new THREE.MeshStandardMaterial({color:0x205b71,metalness:0.4,roughness:0.3,depthTest:false,depthWrite:false,transparent:true}));collar.rotation.x=Math.PI/2;collar.position.z=-30;torch.add(collar);torch.traverse(o=>{o.renderOrder=8;});root.add(torch);
    const contact=new THREE.Mesh(new THREE.SphereGeometry(5,16,12),new THREE.MeshBasicMaterial({color:0xffe5a3,depthTest:false,depthWrite:false,transparent:true}));contact.renderOrder=9;root.add(contact);
    const transfer=new THREE.Group();root.add(transfer);
    const controller=new THREE.Mesh(new THREE.BoxGeometry(92,170,100),new THREE.MeshStandardMaterial({color:0x294757,metalness:0.25,roughness:0.45}));controller.position.set(820,120,180);transfer.add(controller);
    const display=new THREE.Mesh(new THREE.PlaneGeometry(62,48),new THREE.MeshBasicMaterial({color:0x58e0c7}));display.position.set(820,90,231);transfer.add(display);
    const packets:THREE.Mesh[]=[];for(let i=0;i<7;i++){const packet=new THREE.Mesh(new THREE.BoxGeometry(13,13,13),new THREE.MeshBasicMaterial({color:i%2?0xffb05b:0x63e4d4}));transfer.add(packet);packets.push(packet);}
    let width=0,height=0,visible=true;
    const resize=()=>{width=el.clientWidth;height=el.clientHeight;visible=width>0&&height>0;if(!visible)return;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();renderer.render(scene,camera);};
    const observer=new ResizeObserver(resize);observer.observe(el);resize();
    let raf=0;
    const draw=(time:number)=>{raf=requestAnimationFrame(draw);if(document.hidden||!visible)return;
      const p=latest.current;let t=p.progress;let phase=KINDS.indexOf(p.kind);
      if(phase===0){const step=Math.min(3,Math.floor(t*4));const part=t>=1?1:t*4-step;phase=[1,part<0.5?2:3,5,6][step];t=step===1?(part<0.5?part*2:(part-0.5)*2):part;}
      material.uniforms.uProgress.value=t;material.uniforms.uKind.value=phase;material.uniforms.uSize.value=p.pointSize;material.uniforms.uLight.value=p.light?1:0;
      grid.visible=p.grid;grid.material.opacity=p.light?0.13:0.23;
      sweep.visible=phase===1||phase===0;sweep.position.z=-250+t*800;
      recognitionBoxes.visible=phase===2&&t>0.2;recognitionBoxes.children.forEach((b,i)=>{b.visible=t>(0.2+i*0.17);});
      correspondence.visible=phase===3;correspondence.children.forEach((c,i)=>{c.visible=i>=9||t>(Math.floor(i/3)*0.15);});baseAxes.rotation.z=(1-Math.min(1,t*1.25))*0.7;baseAxes.rotation.x=(1-t)*0.35;
      if(phase===3){const offset=1-THREE.MathUtils.smoothstep(t,0.25,0.9);for(let i=0;i<3;i++){const first=correspondence.children[i*3],second=correspondence.children[i*3+1],line=correspondence.children[i*3+2] as THREE.Line;second.position.copy(first.position).add(new THREE.Vector3(80,-95,20).multiplyScalar(offset));const attr=line.geometry.getAttribute("position") as THREE.BufferAttribute;attr.setXYZ(1,second.position.x,second.position.y,second.position.z);attr.needsUpdate=true;line.computeLineDistances();}}
      seamGroup.visible=phase!==1||t>0.94;
      seamLines.forEach((line,i)=>{line.geometry.setDrawRange(0,phase===4?Math.max(0,Math.ceil((t*1.5-i*0.13)*weldPath.length)):weldPath.length);});
      tube.visible=phase===5||phase===4&&t>0.75;tube.geometry.setDrawRange(0,Math.floor(t*40)*8*6);
      torch.visible=phase===5&&t>0.12;contact.visible=torch.visible;
      const at=Math.max(0,Math.min(1,(t-0.12)/0.88));const z=-135+570*at;torch.position.set(weldPath[0][0],weldPath[0][1],z);contact.position.copy(torch.position);contact.scale.setScalar(1+Math.sin(time*0.008)*0.14);
      transfer.visible=phase===6;packets.forEach((packet,i)=>{const a=(t*2+i/7)%1;packet.visible=t>0.05&&t<0.97;packet.position.set(440+a*350,60-Math.sin(a*Math.PI)*180,180);packet.rotation.set(a*4,a*5,a*3);});
      orbit.update();renderer.render(scene,camera);
    };raf=requestAnimationFrame(draw);
    return()=>{cancelAnimationFrame(raf);observer.disconnect();orbit.dispose();fitView.current=null;
      const disposedGeometries=new Set<THREE.BufferGeometry>(),disposedMaterials=new Set<THREE.Material>();scene.traverse(o=>{const item=o as THREE.Mesh;if(item.geometry&&!disposedGeometries.has(item.geometry)){item.geometry.dispose();disposedGeometries.add(item.geometry);}if(item.material){for(const m of Array.isArray(item.material)?item.material:[item.material])if(!disposedMaterials.has(m)){m.dispose();disposedMaterials.add(m);}}});renderer.dispose();renderer.domElement.remove();};
  }, []);
  return <div className="sample-cloud" ref={host} aria-label="三维流程示意，可拖动旋转和滚轮缩放">{failed&&<div className="sample-webgl-error">浏览器无法启用三维渲染，请启用硬件加速后刷新。</div>}</div>;
}
