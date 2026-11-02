"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { toDisplay } from "../lib/blob";
import type { CloudData, Seam, Vec3, PointPair } from "../lib/types";
export interface TcpPose {
  position: Vec3;
  wpr: Vec3;
  distance: number;
  hold: boolean;
  index: number;
}
interface Props {
  cloud: CloudData;
  seams: Seam[];
  selected: number | null;
  light: boolean;
  mode: "语义" | "实例";
  size: number;
  reset: number;
  grid?: boolean;
  interactive?: boolean;
  tcp?: TcpPose | null;
  tcpPath?: Vec3[];
  interaction?: "orbit" | "pan";
  zoom?: number;
  calibrationPairs?: PointPair[];
  hidden?: boolean;
  bounds?: boolean;
  projection?: "perspective" | "orthographic";
  measuring?: boolean;
  onPointPick?: (point: Vec3) => void;
}
interface Controls {
  update: (props: Props) => void;
  fit: () => void;
}
export default function PointCloud(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    controller = useRef<Controls | null>(null);
  const [failed, setFailed] = useState(false);
  const { cloud, seams, interactive = true, reset } = props;
  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      queueMicrotask(() => setFailed(true));
      return;
    }
    const scene = new THREE.Scene(),
      root = new THREE.Group();
    root.scale.set(1, -1, 1);
    scene.add(root);
    const perspective = new THREE.PerspectiveCamera(38, 1, 0.1, 100000);
    const orthographic = new THREE.OrthographicCamera(
      -1,
      1,
      1,
      -1,
      0.1,
      100000,
    );
    let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera =
      perspective;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.enabled = interactive;
    orbit.enablePan = interactive;
    orbit.enableZoom = interactive;
    const center = new THREE.Vector3(...toDisplay(cloud.header.center));
    const extent = cloud.header.extent;
    const radius = Math.max(
      1,
      Math.hypot(
        extent[3] - extent[0],
        extent[4] - extent[1],
        extent[5] - extent[2],
      ) / 2,
    );
    const fit = () => {
      const fov = THREE.MathUtils.degToRad(perspective.fov);
      const distance =
        (radius /
          Math.sin(
            Math.min(
              fov,
              2 * Math.atan(Math.tan(fov / 2) * perspective.aspect),
            ) / 2,
          )) *
        (interactive ? 0.68 : 0.58);
      const target = center.clone();
      target.y -= radius * 0.12;
      camera.position
        .copy(target)
        .add(
          new THREE.Vector3(0.62, 0.5, 0.72)
            .normalize()
            .multiplyScalar(distance),
        );
      orbit.target.copy(target);
      camera.near = Math.max(0.1, radius / 10000);
      camera.far = radius * 100;
      camera.updateProjectionMatrix();
      orbit.minDistance = radius * 0.25;
      orbit.maxDistance = radius * 8;
      orbit.update();
    };
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(cloud.xyz, 3));
    const semantic = new THREE.BufferAttribute(cloud.rgb, 3, true),
      instances = new THREE.BufferAttribute(cloud.instanceColors, 3, true);
    geometry.setAttribute("color", semantic);
    const surfaceShade = new Float32Array(cloud.header.n).fill(1);
    if (cloud.header.source === "demo")
      for (let i = 0; i < cloud.header.n; i++) {
        const id = cloud.instance[i],
          x = cloud.xyz[i * 3] - cloud.header.center[0],
          y = -(cloud.xyz[i * 3 + 1] - cloud.header.center[1]),
          z = cloud.xyz[i * 3 + 2] - cloud.header.center[2];
        if (id >= 1 && id <= 3) {
          const dx = x - (id - 2) * 160,
            dy = y - 12,
            r = Math.hypot(dx, dy);
          surfaceShade[i] =
            r < 46
              ? 0.07
              : Math.abs(z) > 309
                ? 0.6
                : 0.16 + 0.84 * Math.max(0, (-dx * 0.35 + dy * 0.86) / r);
        } else if (id >= 4 && id <= 7) {
          const dx = x - (id - 5.5) * 160,
            dy = y + 12,
            r = Math.hypot(dx, dy);
          surfaceShade[i] =
            0.18 +
            0.82 * Math.max(0, (-dx * 0.35 + dy * 0.86) / Math.max(r, 1));
        } else surfaceShade[i] = id === 0 ? 0.43 : 0.7;
      }
    geometry.setAttribute(
      "surfaceShade",
      new THREE.BufferAttribute(surfaceShade, 1),
    );
    const material = new THREE.PointsMaterial({
      size: 2,
      vertexColors: true,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.84,
    });
    // The protocol RGB bytes are sRGB. Decode in the shader without copying the payload.
    material.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "attribute float surfaceShade; varying float vSurfaceShade;\n" +
        shader.vertexShader.replace(
          "#include <color_vertex>",
          "#include <color_vertex>\nvSurfaceShade=surfaceShade;",
        );
      shader.fragmentShader =
        "varying float vSurfaceShade;\n" +
        shader.fragmentShader.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
       vec2 dotOffset=gl_PointCoord-vec2(0.5);if(dot(dotOffset,dotOffset)>0.25)discard;
       diffuseColor.rgb=mix(pow((diffuseColor.rgb+vec3(0.055))/1.055,vec3(2.4)),diffuseColor.rgb/12.92,lessThanEqual(diffuseColor.rgb,vec3(0.04045)))*vSurfaceShade;
      `,
        );
    };
    const points = new THREE.Points(geometry, material);
    root.add(points);
    const gridSize = Math.ceil((radius * 1.8) / 10) * 10;
    const grid = new THREE.GridHelper(
      gridSize,
      gridSize / 10,
      0x43556a,
      0x2d4053,
    );
    grid.position.set(center.x, -extent[4] - 10, center.z);
    grid.material.transparent = true;
    grid.material.opacity = 0.35;
    scene.add(grid);
    const lines = new Map<number, Line2>(),
      dots = new Map<number, THREE.InstancedMesh>();
    for (const seam of seams) {
      if (seam.trajectory_mm.length < 2) continue;
      const g = new LineGeometry();
      g.setPositions(seam.trajectory_mm.flat());
      const m = new LineMaterial({
        color: 0x2bd9cf,
        side: THREE.DoubleSide,
        linewidth: 1.5,
        worldUnits: false,
        depthTest: false,
        transparent: true,
        opacity: 0.85,
      });
      const line = new Line2(g, m);
      line.renderOrder = 2;
      root.add(line);
      lines.set(seam.id, line);
      const marker = new THREE.InstancedMesh(
        new THREE.SphereGeometry(4, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }),
        seam.trajectory_mm.length,
      );
      const transform = new THREE.Matrix4();
      seam.trajectory_mm.forEach((p, i) => {
        transform.makeTranslation(...p);
        marker.setMatrixAt(i, transform);
      });
      marker.renderOrder = 3;
      marker.instanceMatrix.needsUpdate = true;
      root.add(marker);
      dots.set(seam.id, marker);
    }
    const tool = new THREE.Group();
    // Enlarge the visual model around the TCP origin; poses and paths stay in mm.
    tool.scale.setScalar(3);
    // Smooth, lit copper nozzle; its sharp endpoint remains exactly at local TCP (0,0,0).
    scene.add(new THREE.HemisphereLight(0xffffff, 0x33465d, 2));
    const toolLight = new THREE.DirectionalLight(0xffffff, 2.5);
    toolLight.position.set(1, 2, 3);
    scene.add(toolLight);
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(9, 30, 64),
      new THREE.MeshStandardMaterial({
        color: 0xf5a13c,
        metalness: 0.35,
        roughness: 0.28,
      }),
    );
    tip.rotation.x = Math.PI / 2;
    tip.position.z = -15;
    tool.add(tip);
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(10, 10, 4, 64),
      new THREE.MeshStandardMaterial({
        color: 0x164c64,
        metalness: 0.45,
        roughness: 0.3,
      }),
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.z = -30;
    tool.add(collar);
    const contact = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 20, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff3ce }),
    );
    tool.add(contact);
    tool.visible = false;
    tool.traverse((object) => {
      object.renderOrder = 5;
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((material) => {
          material.transparent = true;
          material.depthTest = false;
          material.depthWrite = false;
        });
      }
    });
    root.add(tool);
    let travelledGeometry = new LineGeometry();
    let travelledCapacity = 1;
    travelledGeometry.setPositions([0, 0, 0, 0, 0, 0]);
    const travelled = new Line2(
      travelledGeometry,
      new LineMaterial({
        color: 0xf39a42,
        side: THREE.DoubleSide,
        linewidth: 4,
        worldUnits: false,
        depthTest: false,
      }),
    );
    travelled.visible = false;
    travelled.renderOrder = 4;
    root.add(travelled);
    const annotations = new THREE.Group();
    scene.add(annotations);
    let previousPairs: PointPair[] | undefined,
      annotationLight: boolean | undefined;
    const clearAnnotations = () => {
      annotations.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((m) => m.dispose());
        }
        if (object instanceof THREE.Sprite) {
          object.material.map?.dispose();
          object.material.dispose();
        }
      });
      annotations.clear();
    };
    let lastMode = "语义",
      lastZoom = 0,
      lastSelected: number | null = null;
    let boundsHelper: THREE.BoxHelper | undefined;
    let pickHandler: Props["onPointPick"];
    let measuring = false;
    let dragStart = { x: 0, y: 0 };
    const pointerDown = (event: PointerEvent) => {
      dragStart = { x: event.clientX, y: event.clientY };
    };
    const pick = (event: MouseEvent) => {
      if (
        !measuring ||
        !pickHandler ||
        !points.visible ||
        Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y) > 5
      )
        return;
      const rect = renderer.domElement.getBoundingClientRect();
      const ray = new THREE.Raycaster();
      ray.params.Points.threshold = radius * 0.014;
      ray.setFromCamera(
        new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          (-(event.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      const hit = ray.intersectObject(points, false)[0];
      if (hit?.index !== undefined)
        pickHandler(
          Array.from(
            cloud.xyz.subarray(hit.index * 3, hit.index * 3 + 3),
          ) as Vec3,
        );
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("click", pick);
    const update = (p: Props) => {
      const nextCamera =
        p.projection === "orthographic" ? orthographic : perspective;
      if (nextCamera !== camera) {
        nextCamera.position.copy(camera.position);
        nextCamera.quaternion.copy(camera.quaternion);
        nextCamera.near = camera.near;
        nextCamera.far = camera.far;
        camera = nextCamera;
        orbit.object = camera;
        camera.updateProjectionMatrix();
        orbit.update();
      }
      root.visible = !p.hidden;
      points.visible = !p.hidden;
      if (p.bounds && !boundsHelper) {
        boundsHelper = new THREE.BoxHelper(points, 0x637587);
        scene.add(boundsHelper);
      }
      if (boundsHelper) boundsHelper.visible = Boolean(p.bounds && !p.hidden);
      pickHandler = p.onPointPick;
      measuring = Boolean(p.measuring);
      orbit.enabled = interactive && !measuring;

      if (previousPairs !== p.calibrationPairs || annotationLight !== p.light) {
        clearAnnotations();
        previousPairs = p.calibrationPairs;
        annotationLight = p.light;
        p.calibrationPairs?.forEach((pair, index) => {
          if (!pair.cam.every(Number.isFinite)) return;
          const color = [0xe9ad23, 0x3479e4, 0x28aa60][index % 3],
            point = new THREE.Vector3(...toDisplay(pair.cam)),
            top = point.clone().add(new THREE.Vector3(0, 130 + index * 18, 0));
          const dot = new THREE.Mesh(
            new THREE.SphereGeometry(5, 10, 10),
            new THREE.MeshBasicMaterial({ color, depthTest: false }),
          );
          dot.position.copy(point);
          dot.renderOrder = 6;
          annotations.add(dot);
          const leader = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([point, top]),
            new THREE.LineDashedMaterial({
              color,
              dashSize: 6,
              gapSize: 3,
              depthTest: false,
            }),
          );
          leader.computeLineDistances();
          leader.renderOrder = 6;
          annotations.add(leader);
          const canvas = document.createElement("canvas");
          canvas.width = 512;
          canvas.height = 140;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = p.light ? "#eaf0f3ee" : "#1e2b35ee";
            ctx.fillRect(0, 0, 512, 140);
            ctx.fillStyle = new THREE.Color(color).getStyle();
            ctx.font = "bold 29px sans-serif";
            ctx.fillText(`${index + 1}  点对 ${index + 1}`, 12, 39);
            ctx.fillStyle = p.light ? "#24343f" : "#e1e7e9";
            ctx.font = "21px monospace";
            ctx.fillText(
              `C (${pair.cam.map((v) => v.toFixed(1)).join(", ")})`,
              12,
              80,
            );
            ctx.fillText(
              `R (${pair.base.map((v) => v.toFixed(1)).join(", ")})`,
              12,
              115,
            );
          }
          const texture = new THREE.CanvasTexture(canvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          const label = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: texture,
              depthTest: false,
              transparent: true,
            }),
          );
          label.scale.set(190, 52, 1);
          label.position.copy(top).add(new THREE.Vector3(65, 25, 0));
          label.renderOrder = 7;
          annotations.add(label);
        });
      }

      orbit.mouseButtons.LEFT =
        p.interaction === "pan" ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
      const zoom = p.zoom ?? 0;
      if (zoom !== lastZoom) {
        const offset = camera.position.clone().sub(orbit.target),
          distance = Math.max(
            orbit.minDistance,
            Math.min(
              orbit.maxDistance,
              offset.length() * Math.pow(0.84, zoom - lastZoom),
            ),
          );
        camera.position.copy(orbit.target).add(offset.setLength(distance));
        lastZoom = zoom;
      }

      if (p.mode !== lastMode) {
        geometry.setAttribute(
          "color",
          p.mode === "实例" ? instances : semantic,
        );
        lastMode = p.mode;
      }
      material.size = p.size;
      grid.visible = p.grid ?? true;
      grid.material.opacity = p.light ? 0.12 : 0.2;
      if (lastSelected !== p.selected) {
        for (const [id, line] of lines) {
          const chosen = id === p.selected;
          line.material.color.set(chosen ? 0xffc449 : 0x28d9d4);
          line.material.linewidth = chosen ? 5 : 1.5;
          dots.get(id)!.visible = chosen;
        }
        lastSelected = p.selected;
      }
      tool.visible = Boolean(p.tcp);
      travelled.visible = false;
      if (p.tcp) {
        tool.position.set(...p.tcp.position);
        const [w, pi, r] = p.tcp.wpr.map(THREE.MathUtils.degToRad);
        tool.rotation.set(w, pi, r, "ZYX");
        const path = p.tcpPath ?? [];
        if (path.length > 1 && p.tcp.distance > 0) {
          if (path.length > travelledCapacity) {
            travelledGeometry.dispose();
            travelledGeometry = new LineGeometry();
            travelledGeometry.setPositions(
              new Float32Array((path.length + 1) * 3),
            );
            travelled.geometry = travelledGeometry;
            travelledCapacity = path.length;
          }
          const attribute = travelledGeometry.attributes
            .instanceStart as THREE.InterleavedBufferAttribute;
          const values = attribute.data.array as Float32Array;
          let count = 0;
          for (let i = 0; i <= p.tcp.index && i < path.length; i++) {
            const from = path[i],
              to = i === p.tcp.index ? p.tcp.position : path[i + 1];
            if (!to || from.every((v, j) => v === to[j])) continue;
            values.set(from, count * 6);
            values.set(to, count * 6 + 3);
            count++;
          }
          attribute.data.needsUpdate = true;
          travelledGeometry.instanceCount = count;
          travelled.frustumCulled = false;
          travelled.visible = count > 0;
        }
      }
    };
    let viewportWidth = 0, viewportHeight = 0;
    let drawable = false;
    const resize = () => {
      const width = el.clientWidth,
        height = el.clientHeight;
      drawable = width > 0 && height > 0;
      if (!drawable) return;
      if (width === viewportWidth && height === viewportHeight) {
        renderer.render(scene, camera);
        return;
      }
      const firstSize = !viewportWidth || !viewportHeight;
      viewportWidth = width;
      viewportHeight = height;
      renderer.setSize(width, height);
      perspective.aspect = width / height;
      const halfHeight = radius * 0.68;
      orthographic.left = -halfHeight * perspective.aspect;
      orthographic.right = halfHeight * perspective.aspect;
      orthographic.top = halfHeight;
      orthographic.bottom = -halfHeight;
      camera.updateProjectionMatrix();
      for (const l of lines.values()) l.material.resolution.set(width, height);
      travelled.material.resolution.set(width, height);
      if (firstSize) fit();
      // Resizing clears the WebGL buffer. Paint before the browser presents it.
      renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    fit();
    controller.current = { update, fit };
    let raf = 0;
    function render() {
      raf = requestAnimationFrame(render);
      if (document.hidden || !drawable) return;
      orbit.update();
      renderer.render(scene, camera);
    }
    render();
    const contextLost = (e: Event) => {
      e.preventDefault();
      setFailed(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    return () => {
      cancelAnimationFrame(raf);
      controller.current = null;
      observer.disconnect();
      orbit.dispose();
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("click", pick);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      clearAnnotations();
      scene.traverse((object) => {
        if (
          object instanceof THREE.Mesh ||
          object instanceof THREE.Points ||
          object instanceof THREE.Line ||
          object instanceof Line2
        ) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [cloud, seams, interactive]);
  useEffect(() => {
    controller.current?.update(props);
  }, [props]);
  useEffect(() => {
    controller.current?.fit();
  }, [reset]);
  return (
    <div
      className={`cloud-canvas ${interactive ? "" : "static-cloud"}`}
      ref={host}
      aria-label={
        interactive ? "三维点云视图，拖动旋转，滚轮缩放" : "焊缝三维点云展示"
      }
    >
      {failed && (
        <div className="cloud-loading" role="alert">
          WebGL 不可用或显卡上下文丢失，请启用硬件加速并刷新页面。
        </div>
      )}
    </div>
  );
}

