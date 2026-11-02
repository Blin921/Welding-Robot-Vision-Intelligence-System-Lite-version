"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export default function HomeCloud({ light }: { light: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); }
    catch { queueMicrotask(() => setFailed(true)); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, 0.04);
    scene.environment = environment.texture;
    room.dispose(); pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xbceeff, 0x172149, 2.2));
    for (const [color,intensity,x,y,z] of [[0xc9f8ff,55,-4,5,5],[0x655cff,40,4,1,3],[0xffad54,35,0,-3,4]]) {
      const lamp=new THREE.PointLight(color,intensity,25,2);lamp.position.set(x,y,z);scene.add(lamp);
    }
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 80);
    camera.position.set(0, 0.25, 8.6);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.enablePan = false;
    controls.minDistance = 5.8; controls.maxDistance = 14;
    controls.autoRotate = true; controls.autoRotateSpeed = 0.33;
    const globe = new THREE.Group(); globe.rotation.z = -0.16; scene.add(globe);
    let seed = 218;
    const rand = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
    const vertices: THREE.Vector3[] = [];
    const n = 1450, radius = 2.65;
    for (let i = 0; i < n; i++) {
      const y = 1 - 2 * (i + 0.5) / n;
      const angle = i * Math.PI * (3 - Math.sqrt(5)) + (rand() - 0.5) * 0.11;
      const r = radius * (0.91 + rand() * 0.09);
      vertices.push(new THREE.Vector3(Math.cos(angle) * Math.sqrt(1 - y * y), y, Math.sin(angle) * Math.sqrt(1 - y * y)).multiplyScalar(r));
    }
    const links: number[] = [], colors: number[] = [];
    const dark = new THREE.Color(light ? 0x1a4258 : 0x285971), bright = new THREE.Color(light ? 0x407b90 : 0x81c9df);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const d = vertices[i].distanceToSquared(vertices[j]);
      if (d < 0.27 && d > 0.008) {
        links.push(...vertices[i].toArray(), ...vertices[j].toArray());
        const c = dark.clone().lerp(bright, rand()); colors.push(c.r,c.g,c.b,c.r,c.g,c.b);
      }
    }
    // Physical metal struts catch reflections from the studio environment.
    const count=links.length/6;
    const struts=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.007,0.007,1,6),new THREE.MeshPhysicalMaterial({color:0xffffff,metalness:0.86,roughness:0.24,clearcoat:1,clearcoatRoughness:0.12,envMapIntensity:1.7}),count);
    const dummy=new THREE.Object3D(),up=new THREE.Vector3(0,1,0);
    const palette=[0x1c466e,0x2387a6,0x77b8cb,0x3d518c,0xb4d7e2,0x255e80];
    for(let i=0;i<count;i++){
      const from=new THREE.Vector3(...links.slice(i*6,i*6+3) as [number,number,number]);
      const to=new THREE.Vector3(...links.slice(i*6+3,i*6+6) as [number,number,number]);
      const direction=to.clone().sub(from);
      dummy.position.copy(from).add(to).multiplyScalar(0.5);dummy.quaternion.setFromUnitVectors(up,direction.clone().normalize());dummy.scale.set(1,direction.length(),1);dummy.updateMatrix();struts.setMatrixAt(i,dummy.matrix);struts.setColorAt(i,new THREE.Color(palette[i%palette.length]));
    }
    globe.add(struts);
    const pearls=new THREE.InstancedMesh(new THREE.SphereGeometry(0.023,10,8),new THREE.MeshPhysicalMaterial({color:0x9de9ef,metalness:0.65,roughness:0.12,clearcoat:1,emissive:0x065369,emissiveIntensity:0.28}),vertices.length);
    vertices.forEach((v,i)=>{dummy.position.copy(v);dummy.quaternion.identity();dummy.scale.setScalar(i%9===0?1.9:1);dummy.updateMatrix();pearls.setMatrixAt(i,dummy.matrix);});globe.add(pearls);
    const core=new THREE.Mesh(new THREE.SphereGeometry(2.34,64,48),new THREE.MeshPhysicalMaterial({color:0x173955,metalness:0.72,roughness:0.2,clearcoat:1,transparent:true,opacity:0.38,depthWrite:false,envMapIntensity:1.3}));globe.add(core);
    const rim=new THREE.Mesh(new THREE.SphereGeometry(2.68,64,48),new THREE.ShaderMaterial({uniforms:{color:{value:new THREE.Color(0x30cbe5)}},vertexShader:`varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.0);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,fragmentShader:`uniform vec3 color;varying vec3 n;varying vec3 v;void main(){float f=pow(1.0-max(dot(normalize(n),normalize(v)),0.0),3.5);gl_FragColor=vec4(color,f*0.24);}`,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));globe.add(rim);
    const canvas=document.createElement("canvas");canvas.width=128;canvas.height=128;
    const ctx=canvas.getContext("2d")!;
    const gradient=ctx.createRadialGradient(64,64,0,64,64,64);
    gradient.addColorStop(0,"rgba(240,255,255,1)");gradient.addColorStop(0.12,"rgba(115,255,255,1)");gradient.addColorStop(0.28,"rgba(0,225,245,0.8)");gradient.addColorStop(0.6,"rgba(0,195,225,0.16)");gradient.addColorStop(1,"rgba(0,190,220,0)");ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
    const glow=new THREE.CanvasTexture(canvas);
    const nodesGeometry=new THREE.BufferGeometry().setFromPoints(vertices.filter((_,i)=>i%4===0));
    const nodeMaterial=new THREE.PointsMaterial({map:glow,color:0xa3ffff,size:0.20,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0.95});
    globe.add(new THREE.Points(nodesGeometry,nodeMaterial));
    const pinsGeometry=new THREE.BufferGeometry().setFromPoints(vertices);
    const pinsMaterial=new THREE.PointsMaterial({map:glow,color:light?0x126885:0x9defff,size:0.045,transparent:true,depthWrite:false});globe.add(new THREE.Points(pinsGeometry,pinsMaterial));
    const ring=new THREE.Group(); ring.rotation.set(0.28,0,-0.38);scene.add(ring);
    const makePath=(r:number,y:number)=>new THREE.CatmullRomCurve3(Array.from({length:240},(_,i)=>{const a=i/240*Math.PI*2;return new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r);}),true);
    for(const [r,y] of [[2.86,0],[2.89,0.035],[2.83,-0.035]]){
      const path=makePath(r,y);
      for(const [width,opacity,color] of [[0.085,0.10,0xff6300],[0.038,0.28,0xff8c00],[0.014,1,0xffb726],[0.004,1,0xfff4c5]] as const){ring.add(new THREE.Mesh(new THREE.TubeGeometry(path,240,width,8,true),new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false})));}
    }
    const sparkPositions: number[]=[];
    for(let i=0;i<90;i++){const a=rand()*Math.PI*2,r=2.77+rand()*0.25;sparkPositions.push(Math.cos(a)*r,(rand()-0.5)*0.22,Math.sin(a)*r);}
    const sparkGeometry=new THREE.BufferGeometry();sparkGeometry.setAttribute("position",new THREE.Float32BufferAttribute(sparkPositions,3));ring.add(new THREE.Points(sparkGeometry,new THREE.PointsMaterial({map:glow,color:0xffa424,size:0.13,transparent:true,depthWrite:false})));
    let visible=false;
    const resize=()=>{const w=el.clientWidth,h=el.clientHeight;visible=w>0&&h>0;if(!visible)return;renderer.setSize(w,h);camera.aspect=w/h;camera.setViewOffset(w,h,0,h*0.05,w,h);camera.updateProjectionMatrix();renderer.render(scene,camera);};
    const observer=new ResizeObserver(resize);observer.observe(el);resize();
    const reduced=matchMedia("(prefers-reduced-motion: reduce)");
    let frame=0,last=0,elapsed=0;
    const draw=(time:number)=>{frame=requestAnimationFrame(draw);if(document.hidden||!visible){last=0;return;}const dt=last?Math.min((time-last)/1000,0.05):0;last=time;if(!reduced.matches)elapsed+=dt*1.5;controls.autoRotate=!reduced.matches;controls.update(dt);nodeMaterial.opacity=reduced.matches?0.95:0.88+Math.sin(elapsed*0.8)*0.1;renderer.render(scene,camera);};frame=requestAnimationFrame(draw);
    return()=>{cancelAnimationFrame(frame);observer.disconnect();controls.dispose();scene.traverse(object=>{const item=object as THREE.Mesh;item.geometry?.dispose();if(item.material)for(const m of Array.isArray(item.material)?item.material:[item.material])m.dispose();});struts.dispose();pearls.dispose();environment.dispose();glow.dispose();renderer.dispose();renderer.domElement.remove();};
  },[light]);
  return <div className="home-cloud-showcase"><div className="home-cloud-render" ref={host} aria-label="三维网络球，可拖动旋转和滚轮缩放" style={{pointerEvents:"auto",touchAction:"none"}}>{failed&&<p>三维展示需要浏览器硬件加速</p>}</div></div>;
}
