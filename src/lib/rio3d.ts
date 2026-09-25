/**
 * RIO 3D engine (three.js) — kiến trúc "1 renderer dùng chung cho cả trang".
 *
 * Vì sao: nếu mỗi khung 3D (mỗi card sản phẩm, cụm Hero) tự tạo WebGLRenderer/canvas riêng, mỗi cái chiếm
 * 1 "WebGL context" — trình duyệt chỉ cho phép một số lượng context hữu hạn chạy đồng thời (thường 8–16,
 * ít hơn trên di động); trang có 12+ sản phẩm dễ vượt giới hạn, buộc phải "xếp hàng" tạo/huỷ liên tục và
 * có thể bị trình duyệt thu hồi context giữa chừng — nhìn giống như ảnh 3D "chạy được vài chục giây rồi
 * đứng hình / rơi về ảnh tĩnh".
 *
 * Cách khắc phục tận gốc: toàn trang chỉ có ĐÚNG MỘT <canvas>/WebGLRenderer (`getShared()` bên dưới), phủ
 * cố định (position:fixed) lên toàn bộ viewport. Mỗi sản phẩm chỉ đăng ký một "slot" — Scene + Camera +
 * entity riêng — với bộ quản lý dùng chung; mỗi khung hình, bộ quản lý lặp qua các slot đang hiển thị,
 * dùng renderer.setScissor/setViewport để "khoanh vùng" đúng vị trí trên màn hình của slot đó rồi render
 * scene của riêng slot vào đúng vùng đó. Slot ở ngoài màn hình chỉ tạm dừng vẽ (không tốn GPU) chứ không bị
 * huỷ/tạo lại, nên khi cuộn qua lại, hoạt ảnh vẫn liên tục — không có khoảnh khắc quay về ảnh tĩnh.
 *
 * Bên trong mỗi slot: đường viền ảnh đã tách nền (public/3d/profile/*.json) dựng thành khối tròn xoay
 * (LatheGeometry) đúng dáng chai/lon; chính ảnh sản phẩm được chiếu từ phía trước lên khối đó (giữ nguyên
 * màu thương hiệu); vật liệu chỉ *cộng thêm* phản xạ môi trường dùng chung, highlight, viền fresnel theo
 * màu vị, giọt nước ngưng tụ — không nhân lại ánh sáng lên màu ảnh. Sàn có bóng đổ + phản chiếu mờ dần và
 * bọt khí nổi lên (đều tính theo một đồng hồ chung nên các sản phẩm trên trang lắc lư đồng bộ, tự nhiên).
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { FRAME, type Kind } from "./product3d-assets";

/* ------------------------------------------------------------------ types */

export interface ProductSpec {
  kind: Kind;
  /** đường dẫn texture (public/3d/tex/*.webp) */
  tex: string;
  /** màu chủ đạo của vị (hex) — dùng cho viền sáng fresnel và bọt khí */
  glow: string;
  /** [x, dy, z] — dy là độ nâng thêm so với mặt sàn */
  pos?: [number, number, number];
  scale?: number;
  roll?: number;
  yaw0?: number;
  /** biên độ lắc (rad) khi đứng yên */
  swing?: number;
  swingSpeed?: number;
  /** thời điểm bắt đầu hiệu ứng xuất hiện (giây, tính theo đồng hồ chung của trang) */
  delay?: number;
}

export interface SlotOptions {
  /** vùng trên màn hình (toạ độ CSS px, gốc top-left) nơi slot này được vẽ; trả về null nếu chưa gắn DOM */
  getRect: () => DOMRect | null;
  layout: "card" | "hero";
  products: ProductSpec[];
  reduceMotion: boolean;
  bubbles: number;
  onFirstFrame?: () => void;
}

export interface RioSlot {
  setScroll(p: number): void;
  pointerMove(clientX: number, clientY: number): void;
  pointerDown(clientX: number, clientY: number): void;
  pointerUp(): void;
  pointerEnter(): void;
  pointerLeave(): void;
  dispose(): void;
}

interface Profile {
  w: number;
  h: number;
  cx: number;
  top: number;
  bottom: number;
  pts: [number, number][];
}

const TAU = Math.PI * 2;
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const damp = (a: number, b: number, lambda: number, dt: number) => a + (b - a) * (1 - Math.exp(-lambda * dt));
const easeOutBack = (t: number) => {
  const c1 = 1.25;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/* ---------------------------------------------------------- asset loading */

const profileCache = new Map<Kind, Promise<Profile>>();
function loadProfile(kind: Kind): Promise<Profile> {
  let p = profileCache.get(kind);
  if (!p) {
    p = fetch(`/3d/profile/${kind}.json`).then((r) => {
      if (!r.ok) throw new Error(`profile ${kind}: ${r.status}`);
      return r.json() as Promise<Profile>;
    });
    profileCache.set(kind, p);
  }
  return p;
}

/** Khối tròn xoay (chiều cao = 1, tâm ở gốc toạ độ) dựng từ silhouette của ảnh đã tách nền. */
function buildGeometry(p: Profile, segments: number): THREE.LatheGeometry {
  const s = 1 / p.h;
  const yOf = (row: number) => (p.h / 2 - row) * s;
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, yOf(p.bottom + 1))];
  // LatheGeometry cần điểm đi từ dưới lên trên để pháp tuyến hướng ra ngoài
  for (let i = p.pts.length - 1; i >= 0; i--) {
    const [hw, row] = p.pts[i];
    pts.push(new THREE.Vector2(hw * s, yOf(row + 0.5)));
  }
  pts.push(new THREE.Vector2(0, yOf(p.top)));
  const g = new THREE.LatheGeometry(pts, segments);
  // UV cho bump map giọt nước: u quanh thân, v theo chiều cao đều
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, pos.getY(i) + 0.5);
  return g;
}

/* ------------------------------------------------------ procedural textures */

function radialTexture(size: number, stops: [number, string][]) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Height map giọt nước ngưng tụ (tile được) — chỉ dùng làm bump map nên chỉ cần độ xám. */
function dropletTexture() {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = "lighter";
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 46; i++) {
    const r = 3 + rnd() * rnd() * 12 + rnd() * 3;
    const x = rnd() * S;
    const y = rnd() * S;
    for (const ox of [-S, 0, S]) {
      for (const oy of [-S, 0, S]) {
        const cx = x + ox;
        const cy = y + oy;
        if (cx < -r || cx > S + r || cy < -r || cy > S + r) continue;
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
        gr.addColorStop(0, "rgba(255,255,255,0.95)");
        gr.addColorStop(0.55, "rgba(255,255,255,0.5)");
        gr.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = gr;
        g.beginPath();
        g.arc(cx, cy, r, 0, TAU);
        g.fill();
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* ------------------------------------------------------------ shader chunks */

const VERT_HEAD = /* glsl */ `
varying vec3 vObj;
varying float vWorldY;
`;
const VERT_BODY = /* glsl */ `
vObj = position;
vWorldY = (modelMatrix * vec4(position, 1.0)).y;
`;
const FRAG_HEAD = /* glsl */ `
varying vec3 vObj;
varying float vWorldY;
uniform float uCx;
uniform float uSx;
uniform float uSweep;
uniform float uSweepAmt;
uniform float uRimAmt;
uniform vec3 uRim;
uniform float uFloorY;
uniform float uReflLen;
uniform float uReflAmt;
`;
const FRAG_ALPHA = /* glsl */ `
#ifdef REFLECTION
  diffuseColor.a *= uReflAmt * smoothstep(uFloorY - uReflLen, uFloorY, vWorldY);
#endif
`;
const FRAG_EMISSIVE = /* glsl */ `
{
  // chiếu ảnh sản phẩm từ phía trước (theo trục X); nửa sau dùng bản lật để chữ không bị ngược
  float nzr = vObj.z / max(length(vObj.xz), 1e-4);
  float fb = smoothstep(-0.12, 0.12, nzr);
  vec2 uvF = vec2(uCx + vObj.x * uSx, 0.5 + vObj.y);
  vec2 uvB = vec2(uCx - vObj.x * uSx, 0.5 + vObj.y);
  vec3 texF = texture2D(emissiveMap, uvF).rgb;
  vec3 texB = texture2D(emissiveMap, uvB).rgb;
  totalEmissiveRadiance *= mix(texB, texF, fb);

  // viền sáng fresnel theo màu của vị
  float fres = pow(1.0 - saturate(dot(normalize(vViewPosition), normal)), 3.0);
  totalEmissiveRadiance += uRim * fres * uRimAmt;

  // vệt sáng quét chéo (glint)
  float diag = vObj.x * 1.6 + vObj.y * 0.55;
  float band = exp(-pow((diag - uSweep) * 9.0, 2.0));
  totalEmissiveRadiance += vec3(1.0, 0.97, 0.9) * band * uSweepAmt * (0.25 + 0.75 * fb);
}
`;

interface ProductUniforms {
  uCx: THREE.IUniform<number>;
  uSx: THREE.IUniform<number>;
  uSweep: THREE.IUniform<number>;
  uSweepAmt: THREE.IUniform<number>;
  uRimAmt: THREE.IUniform<number>;
  uRim: THREE.IUniform<THREE.Color>;
  uFloorY: THREE.IUniform<number>;
  uReflLen: THREE.IUniform<number>;
  uReflAmt: THREE.IUniform<number>;
}

function makeMaterial(opts: {
  kind: Kind;
  tex: THREE.Texture;
  drops: THREE.Texture;
  uniforms: ProductUniforms;
  reflection: boolean;
  circumference: number;
}) {
  const { kind, tex, drops, uniforms, reflection, circumference } = opts;
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x000000, // không có thành phần khuếch tán — màu đến từ ảnh (emissive) nên giữ nguyên thương hiệu
    emissive: 0xffffff,
    emissiveMap: tex,
    roughness: kind === "can" ? 0.3 : 0.14,
    metalness: 0,
    clearcoat: reflection ? 0 : 1,
    clearcoatRoughness: 0.07,
    envMapIntensity: reflection ? 0.35 : kind === "can" ? 0.8 : 1.0,
    transparent: reflection,
    depthWrite: !reflection,
  });
  if (!reflection) {
    const d = drops.clone();
    d.needsUpdate = true;
    d.repeat.set(Math.max(1, Math.round(circumference * 2.4)), 2);
    mat.bumpMap = d;
    mat.bumpScale = 0.0035;
  }
  if (reflection) mat.defines = { REFLECTION: "" };
  mat.customProgramCacheKey = () => `rio-product-${reflection ? "r" : "f"}-${reflection ? "n" : "d"}`;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VERT_HEAD}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${VERT_BODY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAG_HEAD}`)
      .replace("#include <alphatest_fragment>", `#include <alphatest_fragment>\n${FRAG_ALPHA}`)
      .replace("#include <emissivemap_fragment>", FRAG_EMISSIVE);
  };
  return mat;
}

/* ---------------------------------------------------------------- bubbles */

function createBubbles(count: number, palette: THREE.Color[], box: [number, number, number, number]) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count * 4);
  const col = new Float32Array(count * 3);
  let s = 13;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  for (let i = 0; i < count; i++) {
    seed.set([rnd(), rnd(), rnd(), rnd()], i * 4);
    const c = palette[i % palette.length];
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
  geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50); // vị trí tính trong shader -> tắt culling theo bounds

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPx: { value: 500 },
      uBox: { value: new THREE.Vector4(...box) },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uPx;
      uniform vec4 uBox; // halfW, yMin, yMax, halfZ
      attribute vec4 aSeed;
      attribute vec3 aColor;
      varying float vA;
      varying vec3 vC;
      void main() {
        float speed = 0.045 + aSeed.z * 0.07;
        float life = fract(aSeed.w + uTime * speed);
        float x = (aSeed.x * 2.0 - 1.0) * uBox.x + sin(uTime * (0.8 + aSeed.z * 1.2) + aSeed.w * 40.0) * 0.02 * (0.3 + life);
        float y = mix(uBox.y, uBox.z, life);
        float z = (aSeed.y * 2.0 - 1.0) * uBox.w;
        vec4 mv = modelViewMatrix * vec4(x, y, z, 1.0);
        gl_Position = projectionMatrix * mv;
        float size = mix(0.011, 0.03, aSeed.z * aSeed.z);
        gl_PointSize = max(2.0, size * uPx / -mv.z);
        vA = smoothstep(0.0, 0.1, life) * smoothstep(1.0, 0.7, life);
        vC = aColor;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vA;
      varying vec3 vC;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c) * 2.0;
        if (d > 1.0) discard;
        float rim = smoothstep(0.6, 0.94, d) * (1.0 - smoothstep(0.94, 1.0, d));
        float hl = smoothstep(0.3, 0.0, length(c - vec2(-0.17, 0.19)));
        float a = (rim * 0.7 + hl * 0.95 + 0.09) * vA;
        vec3 col = mix(vC, vec3(1.0), 0.6);
        gl_FragColor = vec4(col, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.renderOrder = 3;
  points.frustumCulled = false;
  return { points, mat, geo };
}

/* ----------------------------------------------------- shared (per trang) */

interface Shared {
  renderer: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;
  envTexture: THREE.Texture;
  droplet: THREE.Texture;
  shadowMat: THREE.MeshBasicMaterial;
  shadowGeo: THREE.PlaneGeometry;
  hitGeo: THREE.CylinderGeometry;
  hitMat: THREE.MeshBasicMaterial;
  geoByKind: Map<Kind, THREE.LatheGeometry>;
  slots: Set<Slot>;
  clock: { t: number; last: number };
}

let shared: Shared | null = null;
let sharedPromise: Promise<Shared> | null = null;

function buildShared(): Promise<Shared> {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.setAttribute("data-rio-shared", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    maxWidth: "100%",
    maxHeight: "100%",
    pointerEvents: "none",
    zIndex: "30",
  } as CSSStyleDeclaration);
  document.body.appendChild(canvas);

  // iPhone thường có DPR=3. Buffer 2x vẫn đủ sắc nét nhưng nhẹ hơn nhiều;
  // hạ antialias/powerPreference trên mobile để giảm nguy cơ Safari thu hồi
  // WebGL context khi đang cuộn qua nhiều slot.
  const mobileGPU = window.matchMedia("(pointer: coarse)").matches;
  const maxDpr = mobileGPU ? 1.5 : 2;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !mobileGPU,
    alpha: true,
    powerPreference: mobileGPU ? "low-power" : "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  pmrem.dispose();

  const droplet = dropletTexture();
  const shadowTex = radialTexture(128, [
    [0, "rgba(0,0,0,0.62)"],
    [0.45, "rgba(0,0,0,0.28)"],
    [1, "rgba(0,0,0,0)"],
  ]);
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
  const shadowGeo = new THREE.PlaneGeometry(1, 1);
  const hitGeo = new THREE.CylinderGeometry(0.2, 0.2, 1, 8);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });

  const s: Shared = {
    renderer,
    canvas,
    envTexture: envRT.texture,
    droplet,
    shadowMat,
    shadowGeo,
    hitGeo,
    hitMat,
    geoByKind: new Map(),
    slots: new Set(),
    clock: { t: 0, last: performance.now() },
  };

  const onContextLost = (e: Event) => e.preventDefault();
  canvas.addEventListener("webglcontextlost", onContextLost, false);

  const resizeCanvas = () => {
    const canvasRect = canvas.getBoundingClientRect();
    const cw = canvasRect.width || canvas.clientWidth || window.innerWidth;
    const ch = canvasRect.height || canvas.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    renderer.setPixelRatio(dpr);
    renderer.setSize(cw, ch, false);
  };
  resizeCanvas();
  canvas.addEventListener(
    "webglcontextrestored",
    () => {
      resizeCanvas();
      s.clock.last = performance.now();
    },
    false,
  );
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("orientationchange", resizeCanvas);
  if (typeof window !== "undefined" && window.visualViewport) {
    window.visualViewport.addEventListener("resize", resizeCanvas);
  }

  const frame = (now: number) => {
    requestAnimationFrame(frame);
    if (renderer.getContext().isContextLost()) return;
    const dt = Math.min(0.05, (now - s.clock.last) / 1000 || 0.016);
    s.clock.last = now;
    s.clock.t += dt;

    const canvasRect = canvas.getBoundingClientRect();
    const cw = canvasRect.width || canvas.clientWidth || window.innerWidth;
    const ch = canvasRect.height || canvas.clientHeight || window.innerHeight;
    const dpr = renderer.getPixelRatio();

    const expectedW = Math.floor(cw * dpr);
    const expectedH = Math.floor(ch * dpr);
    const drawingSize = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (drawingSize.width !== expectedW || drawingSize.height !== expectedH) {
      renderer.setSize(cw, ch, false);
    }

    renderer.setScissorTest(false);
    renderer.clear();
    renderer.setScissorTest(true);

    // `setViewport`/`setScissor` của Three.js nhận toạ độ CSS (logical pixels).
    // Renderer tự nhân với pixelRatio khi chuyển sang drawing-buffer. Không được
    // nhân DPR ở đây: làm vậy sẽ nhân DPR hai lần, khiến sản phẩm phình to và
    // lệch sang phải đúng như lỗi iPhone (devicePixelRatio = 3).
    s.slots.forEach((slot) => {
      const rect = slot.opts.getRect();
      if (!rect || rect.width < 2 || rect.height < 2) return;

      // Chuyển rect của DOM sang toạ độ canvas (CSS px, gốc dưới-trái).
      // Tất cả phép cắt/tính toạ độ phải dùng cùng một không gian; không trộn
      // rect.client với kích thước drawing-buffer.
      const vx = rect.left - canvasRect.left;
      const vy = canvasRect.bottom - rect.bottom;
      const vw = rect.width;
      const vh = rect.height;

      const sx1 = Math.max(0, vx);
      const sy1 = Math.max(0, vy);
      const sx2 = Math.min(cw, vx + vw);
      const sy2 = Math.min(ch, vy + vh);

      // Intersection cũng đóng vai trò culling: slot ngoài màn hình không cần
      // update animation, nhưng slot chạm mép vẫn giữ nguyên viewport đầy đủ.
      if (sx2 <= sx1 || sy2 <= sy1) return;

      slot.update(dt);

      // Viewport giữ nguyên toàn bộ slot để camera/aspect không bị đổi khi slot
      // chạm mép màn hình; scissor mới giới hạn vùng rasterization.
      renderer.setViewport(vx, vy, vw, vh);
      renderer.setScissor(sx1, sy1, sx2 - sx1, sy2 - sy1);
      slot.syncCamera(rect.width, rect.height);
      renderer.render(slot.scene, slot.camera);
      if (!slot.firstFrameDone) {
        slot.firstFrameDone = true;
        slot.opts.onFirstFrame?.();
      }
    });
  };
  requestAnimationFrame(frame);

  return Promise.resolve(s);
}

function getShared(): Promise<Shared> {
  if (shared) return Promise.resolve(shared);
  if (!sharedPromise) sharedPromise = buildShared().then((s) => (shared = s));
  return sharedPromise;
}

function getSharedGeometry(s: Shared, kind: Kind, profile: Profile): THREE.LatheGeometry {
  let g = s.geoByKind.get(kind);
  if (!g) {
    g = buildGeometry(profile, 80);
    s.geoByKind.set(kind, g);
  }
  return g;
}

/* ----------------------------------------------------------------- entity */

interface Entity {
  spec: Required<Omit<ProductSpec, "kind" | "tex" | "glow">> & Pick<ProductSpec, "kind" | "tex" | "glow">;
  root: THREE.Group;
  spin: THREE.Group;
  reflRoot: THREE.Group;
  reflSpin: THREE.Group;
  hit: THREE.Mesh;
  shadow: THREE.Mesh;
  uniforms: ProductUniforms;
  phase: number;
  bobSpeed: number;
  bobAmp: number;
  hover: boolean;
  hoverW: number;
  dragging: boolean;
  userYaw: number;
  userVel: number;
  lastTouch: number;
  flT: number;
  flDir: number;
  sweepT: number;
}

const ENTER_DUR = 1.15;
const FL_DUR = 1.25;
const LIFT = 0.016;

class Slot {
  opts: SlotOptions;
  shared: Shared;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  entities: Entity[] = [];
  bubbles!: ReturnType<typeof createBubbles>;
  disposables: { dispose(): void }[] = [];
  firstFrameDone = false;
  private isHero: boolean;
  private cfg: { viewH: number; halfW: number; lookY: number; camLift: number; parX: number; parY: number };
  private camBase = new THREE.Vector3();
  private key: THREE.DirectionalLight;
  private ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  private scroll = 0;
  private boostT = 0;
  private boost = 0;
  private birthT: number;
  private lastAspect = 0;
  private mainEntity: Entity;
  private draggingMain = false;
  private dragX = 0;
  private dragT = 0;
  private dragMoved = 0;
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private lastRayT = 0;

  constructor(shared: Shared, opts: SlotOptions, profiles: Map<Kind, Profile>, textures: THREE.Texture[]) {
    this.shared = shared;
    this.opts = opts;
    this.isHero = opts.layout === "hero";
    this.birthT = shared.clock.t;

    const FOV = this.isHero ? 22 : 24;
    this.cfg = this.isHero
      ? { viewH: 1.78, halfW: 0.96, lookY: 0.02, camLift: 0.06, parX: 0.32, parY: 0.12 }
      : {
          viewH: FRAME.viewH,
          halfW: 0.36,
          lookY: -0.5 + FRAME.viewH / 2 - FRAME.bottomPad * FRAME.viewH,
          camLift: 0.1,
          parX: 0.07,
          parY: 0.03,
        };
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 30);
    this.camBase.set(0, this.cfg.lookY + this.cfg.camLift, 3);

    this.scene.environment = shared.envTexture;
    this.scene.environmentIntensity = 1;

    this.key = new THREE.DirectionalLight(0xffffff, 2.6);
    this.key.position.set(-1.6, 1.4, 2.2);
    this.scene.add(this.key);
    const rimLight = new THREE.DirectionalLight(0xfff1d6, 2.0);
    rimLight.position.set(1.8, 0.6, -1.4);
    this.scene.add(rimLight);

    const floorY = -0.5;
    const palette: THREE.Color[] = [];

    opts.products.forEach((p, i) => {
      const prof = profiles.get(p.kind)!;
      const geo = getSharedGeometry(shared, p.kind, prof);
      const glow = new THREE.Color(p.glow);
      palette.push(glow);

      const uniforms: ProductUniforms = {
        uCx: { value: prof.cx / prof.w },
        uSx: { value: prof.h / prof.w },
        uSweep: { value: -2 },
        uSweepAmt: { value: 0 },
        uRimAmt: { value: 0.3 },
        uRim: { value: glow },
        uFloorY: { value: floorY },
        uReflLen: { value: 0.34 },
        uReflAmt: { value: this.isHero ? 0.3 : 0.34 },
      };
      const circumference = (prof.pts.reduce((m, q) => Math.max(m, q[0]), 0) / prof.h) * TAU;
      const mat = this.track(
        makeMaterial({ kind: p.kind, tex: textures[i], drops: shared.droplet, uniforms, reflection: false, circumference }),
      );
      const reflMat = this.track(
        makeMaterial({ kind: p.kind, tex: textures[i], drops: shared.droplet, uniforms, reflection: true, circumference }),
      );

      const spec = {
        kind: p.kind,
        tex: p.tex,
        glow: p.glow,
        pos: p.pos ?? [0, 0, 0],
        scale: p.scale ?? 1,
        roll: p.roll ?? 0,
        yaw0: p.yaw0 ?? 0,
        swing: p.swing ?? (this.isHero ? 0.28 : 0.34),
        swingSpeed: p.swingSpeed ?? (this.isHero ? 0.55 : 0.85),
        delay: p.delay ?? 0,
      } as Entity["spec"];

      const root = new THREE.Group();
      const spin = new THREE.Group();
      const mesh = new THREE.Mesh(geo, mat);
      spin.add(mesh);
      root.add(spin);
      root.scale.setScalar(spec.scale);
      const hit = new THREE.Mesh(shared.hitGeo, shared.hitMat);
      root.add(hit);
      this.scene.add(root);

      const reflRoot = new THREE.Group();
      const reflSpin = new THREE.Group();
      const refl = new THREE.Mesh(geo, reflMat);
      refl.renderOrder = 1;
      reflSpin.add(refl);
      reflRoot.add(reflSpin);
      this.scene.add(reflRoot);

      const shadow = new THREE.Mesh(shared.shadowGeo, shared.shadowMat);
      shadow.rotation.x = -Math.PI / 2;
      shadow.renderOrder = 2;
      this.scene.add(shadow);

      const seedPhase = ((i * 2.399 + (p.tex.length % 7)) * 1.7) % TAU;
      this.entities.push({
        spec,
        root,
        spin,
        reflRoot,
        reflSpin,
        hit,
        shadow,
        uniforms,
        phase: seedPhase,
        bobSpeed: 1.15 + (i % 3) * 0.12,
        bobAmp: this.isHero ? 0.012 : 0.009,
        hover: false,
        hoverW: 0,
        dragging: false,
        userYaw: 0,
        userVel: 0,
        lastTouch: -10,
        flT: -1,
        flDir: 1,
        sweepT: 1,
      });
    });
    this.mainEntity = this.entities[0];

    const bubbleBox: [number, number, number, number] = this.isHero ? [0.95, -0.52, 0.72, 0.9] : [0.34, -0.5, 0.64, 0.2];
    this.bubbles = createBubbles(opts.bubbles, Array.from(new Set(palette)), bubbleBox);
    this.track(this.bubbles.geo);
    this.track(this.bubbles.mat);
    this.scene.add(this.bubbles.points);
  }

  private track<T extends { dispose(): void }>(o: T) {
    this.disposables.push(o);
    return o;
  }

  syncCamera(cssW: number, cssH: number) {
    const aspect = cssW / Math.max(1, cssH);
    if (Math.abs(aspect - this.lastAspect) < 0.002) return;
    this.lastAspect = aspect;
    this.camera.aspect = aspect;
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const distV = this.cfg.viewH / (2 * tan);
    const distH = this.cfg.halfW / (tan * aspect);
    this.camBase.z = Math.max(distV, distH);
    this.camera.updateProjectionMatrix();
    this.bubbles.mat.uniforms.uPx.value = cssH / (2 * tan);
  }

  update(dt: number) {
    const reduce = this.opts.reduceMotion;
    const time = this.shared.clock.t - this.birthT;
    this.ptr.x = damp(this.ptr.x, this.ptr.tx, 6, dt);
    this.ptr.y = damp(this.ptr.y, this.ptr.ty, 6, dt);
    this.boostT = Math.max(0, this.boostT - dt);
    this.boost = damp(this.boost, this.boostT > 0 || this.entities.some((e) => e.hover) ? 1 : 0, 3, dt);

    this.camera.position.set(
      this.camBase.x + this.ptr.x * this.cfg.parX,
      this.camBase.y + this.ptr.y * this.cfg.parY + this.scroll * 0.12,
      this.camBase.z,
    );
    this.camera.lookAt(0, this.cfg.lookY, 0);
    this.key.position.set(-1.6 + this.ptr.x * 1.1, 1.4 + this.ptr.y * 0.6, 2.2);

    this.bubbles.mat.uniforms.uTime.value += reduce ? 0 : dt * (1 + this.boost * 1.6);

    const floorY = -0.5;
    for (const e of this.entities) {
      const s = e.spec;
      const te = reduce || !this.isHero ? 1 : clamp((time - s.delay) / ENTER_DUR);
      const k = easeOutBack(te);
      const dropY = (1 - k) * (this.isHero ? 1.1 : 0.42);
      const bob = reduce ? 0 : Math.sin(time * e.bobSpeed + e.phase) * e.bobAmp;
      e.hoverW = damp(e.hoverW, e.hover || e.dragging ? 1 : 0, 7, dt);

      if (!e.dragging) {
        e.userYaw += e.userVel * dt;
        e.userVel *= Math.exp(-2.8 * dt);
        if (time - e.lastTouch > 1.6 && Math.abs(e.userVel) < 0.2) {
          e.userYaw = damp(e.userYaw, Math.round(e.userYaw / TAU) * TAU, 2.2, dt);
        }
      }
      let fl = 0;
      if (e.flT >= 0) {
        e.flT += dt;
        const p = clamp(e.flT / FL_DUR);
        fl = easeInOutCubic(p) * TAU * e.flDir;
        if (p >= 1) e.flT = -1;
      }
      if (e.sweepT < 1) e.sweepT = Math.min(1, e.sweepT + dt / 1.0);
      e.uniforms.uSweep.value = -0.6 + 1.2 * easeOutCubic(e.sweepT);
      e.uniforms.uSweepAmt.value = e.sweepT >= 1 ? 0 : Math.sin(Math.PI * e.sweepT) * 0.85;
      e.uniforms.uRimAmt.value = 0.28 + e.hoverW * 0.4;

      const idleW = 1 - e.hoverW * 0.85;
      const swing = reduce ? 0 : Math.sin(time * s.swingSpeed + e.phase) * s.swing * idleW;
      const follow = this.isHero ? 0 : this.ptr.x * 0.55 * e.hoverW;
      const yaw = s.yaw0 + swing + follow + e.userYaw + fl - (1 - k) * 1.2 + this.scroll * (this.isHero ? 0.7 : 0);
      const pitch = this.isHero ? 0 : -this.ptr.y * 0.1 * e.hoverW;

      const px = s.pos[0];
      const pz = s.pos[2];
      const py = floorY + 0.5 * s.scale + s.pos[1] + LIFT * s.scale + e.hoverW * 0.02 + bob + dropY - this.scroll * 0.1;
      e.root.position.set(px, py, pz);
      e.root.rotation.set(pitch, 0, s.roll);
      e.spin.rotation.y = yaw;

      e.reflRoot.position.set(px, 2 * floorY - py, pz);
      e.reflRoot.rotation.set(-pitch, 0, -s.roll);
      e.reflRoot.scale.set(s.scale, -s.scale, s.scale);
      e.reflSpin.rotation.y = yaw;

      const lifted = clamp((py - (floorY + 0.5 * s.scale + s.pos[1])) / 0.12);
      const sh = s.scale * (0.62 - lifted * 0.12);
      e.shadow.position.set(px, floorY + 0.002 + s.pos[1], pz);
      e.shadow.scale.set(sh, sh * 0.62, 1);
      (e.shadow.material as THREE.MeshBasicMaterial).opacity = clamp(k) * (1 - lifted * 0.35);
    }
  }

  private startFlourish(e: Entity) {
    if (this.opts.reduceMotion) return;
    e.flT = 0;
    e.flDir = Math.random() < 0.5 ? 1 : -1;
    e.sweepT = 0;
    this.boostT = 1.6;
  }

  private pick(rect: DOMRect, clientX: number, clientY: number): Entity | null {
    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1));
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.entities.map((e) => e.hit), false);
    if (!hits.length) return null;
    return this.entities.find((e) => e.hit === hits[0].object) ?? null;
  }

  setScroll(p: number) {
    this.scroll = clamp(p);
  }

  pointerMove(clientX: number, clientY: number) {
    const rect = this.opts.getRect();
    if (!rect) return;
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
    if (this.isHero) {
      this.ptr.tx = clamp(x, -1.3, 1.3);
      this.ptr.ty = clamp(y, -1, 1);
      const now = performance.now();
      const inside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
      if (inside && now - this.lastRayT > 50) {
        this.lastRayT = now;
        const hit = this.pick(rect, clientX, clientY);
        for (const e of this.entities) {
          const on = e === hit;
          if (on && !e.hover) e.sweepT = 0;
          e.hover = on;
        }
        this.shared.canvas.style.cursor = hit ? "pointer" : "";
      }
      return;
    }
    this.ptr.tx = clamp(x, -1, 1);
    this.ptr.ty = clamp(y, -1, 1);
    if (this.draggingMain) {
      const dx = clientX - this.dragX;
      const now = performance.now();
      const dtS = Math.max(0.008, (now - this.dragT) / 1000);
      this.dragX = clientX;
      this.dragT = now;
      this.dragMoved += Math.abs(dx);
      const dy = dx * 0.0125;
      this.mainEntity.userYaw += dy;
      this.mainEntity.userVel = this.mainEntity.userVel * 0.7 + (dy / dtS) * 0.3;
      this.mainEntity.lastTouch = this.shared.clock.t - this.birthT;
    }
  }

  pointerEnter() {
    if (this.isHero) return;
    this.mainEntity.hover = true;
    this.mainEntity.sweepT = 0;
  }

  pointerLeave() {
    if (this.isHero) return;
    this.mainEntity.hover = false;
    this.ptr.tx = 0;
    this.ptr.ty = 0;
  }

  pointerDown(clientX: number, clientY: number) {
    const rect = this.opts.getRect();
    if (this.isHero) {
      if (!rect) return;
      const hit = this.pick(rect, clientX, clientY);
      if (hit) this.startFlourish(hit);
      return;
    }
    this.draggingMain = true;
    this.mainEntity.flT = -1;
    this.mainEntity.userVel = 0;
    this.dragX = clientX;
    this.dragT = performance.now();
    this.dragMoved = 0;
  }

  pointerUp() {
    if (this.isHero || !this.draggingMain) return;
    this.draggingMain = false;
    this.mainEntity.lastTouch = this.shared.clock.t - this.birthT;
    if (this.dragMoved < 5) this.startFlourish(this.mainEntity);
  }

  dispose() {
    this.shared.slots.delete(this);
    this.scene.clear();
    for (const d of this.disposables) d.dispose();
  }
}

/**
 * Đăng ký một slot 3D mới với bộ render dùng chung cho toàn trang, và bắt đầu vẽ ngay khi asset tải xong.
 * Slot chạy liên tục theo vòng lặp chung cho tới khi `dispose()` được gọi (khi component unmount) — cuộn
 * ra khỏi màn hình chỉ tạm ngưng phần VẼ (tiết kiệm GPU), animation vẫn tính tiếp nên không có giật/khựng.
 */
export async function registerProductSlot(opts: SlotOptions): Promise<RioSlot> {
  const s = await getShared();
  const loader = new THREE.TextureLoader();
  const kinds = Array.from(new Set(opts.products.map((p) => p.kind)));
  const [profileList, textures] = await Promise.all([
    Promise.all(kinds.map(async (k) => [k, await loadProfile(k)] as const)),
    Promise.all(opts.products.map((p) => loader.loadAsync(p.tex))),
  ]);
  const profiles = new Map(profileList);
  const maxAniso = Math.min(8, s.renderer.capabilities.getMaxAnisotropy());
  textures.forEach((t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
  });

  const slot = new Slot(s, opts, profiles, textures);
  s.slots.add(slot);

  return {
    setScroll: (p) => slot.setScroll(p),
    pointerMove: (x, y) => slot.pointerMove(x, y),
    pointerDown: (x, y) => slot.pointerDown(x, y),
    pointerUp: () => slot.pointerUp(),
    pointerEnter: () => slot.pointerEnter(),
    pointerLeave: () => slot.pointerLeave(),
    dispose: () => {
      slot.dispose();
      textures.forEach((t) => t.dispose());
    },
  };
}
