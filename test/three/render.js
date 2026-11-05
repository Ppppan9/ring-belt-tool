// three.js 无头渲染检查：加载导出的 glb，斜俯视透视相机 + 环境光照渲染，返回统计
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
window.renderGLB = async (b64, t = 1.0) => {
  const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
  const gl = await new GLTFLoader().parseAsync(buf, '');
  const W = 900, H = 1100, r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(W, H); r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace; r.toneMappingExposure = 1.25; document.body.appendChild(r.domElement);
  const scene = gl.scene; scene.background = null; r.setClearColor(0x2b3a36, 1);
  const pm = new THREE.PMREMGenerator(r); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 1.6; scene.add(new THREE.HemisphereLight(0xe8fff4, 0x29463c, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(-0.4, 1.5, -0.6); scene.add(sun);
  const mixer = new THREE.AnimationMixer(scene); if (gl.animations[0]) { mixer.clipAction(gl.animations[0]).play(); mixer.setTime(t); }
  scene.updateMatrixWorld(true);
  // 只看场景里“可见”的环/球/夹扣，框住它们
  const box = new THREE.Box3(), info = { rings: [], balls: 0, clips: 0, mats: {} };
  scene.traverse(o => { if (!o.isMesh) return; const m = o.material, ws = new THREE.Vector3(); o.getWorldScale(ws); let vis = true; for (let p = o; p; p = p.parent) if (p.scale.x === 0) vis = false;
    info.mats[m.name] = { type: m.type, transmission: m.transmission ?? 0, metalness: m.metalness, clearcoat: m.clearcoat ?? 0, ior: m.ior, map: !!m.map };
    if (!vis) return; if (/^mat_(ring|ball|clip)_/.test(m.name)) { box.expandByObject(o); }
    if (/^mat_ring_/.test(m.name)) { o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox; info.rings.push({ name: o.name, h: (bb.max.y - bb.min.y) * ws.y, w: (bb.max.x - bb.min.x) * ws.x }); }
    if (/^mat_ball_/.test(m.name)) info.balls++; if (/^mat_clip_/.test(m.name)) info.clips++; });
  const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3()), d = Math.max(sz.x, sz.z) * 1.25;
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.001, 50); cam.position.set(c.x, c.y + d * 1.6, c.z + d * 1.1); cam.lookAt(c);
  // 隐藏平铺贴图层（背景/界面），只看 3D 网格
  scene.traverse(o => { if (o.isMesh && !/^mat_(ring|ball|clip)_/.test(o.material.name)) o.visible = false; });
  r.render(scene, cam);
  const px = new Uint8Array(W * H * 4), ctx = r.getContext(); ctx.readPixels(0, 0, W, H, ctx.RGBA, ctx.UNSIGNED_BYTE, px);
  let non = 0; for (let i = 0; i < px.length; i += 4) if (Math.abs(px[i] - 43) + Math.abs(px[i + 1] - 58) + Math.abs(px[i + 2] - 54) > 30) non++;
  info.nonBg = non / (W * H); return info;
};
