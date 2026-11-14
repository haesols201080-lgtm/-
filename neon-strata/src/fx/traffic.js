// Living traffic, entirely on the GPU: thousands of hover vehicles streaming along stacked air lanes
// above the arterials, ground traffic on the roads, and maglev trains on the viaduct.
// Every vehicle is positioned in the vertex shader from a float path texture (zero CPU per frame).
import * as THREE from 'three';
import { U, NS_COMMON } from '../render/env.js';
import { Batch, Pen, M, rectPts } from '../world/builder.js';
import { ST } from '../render/cityMaterial.js';
import * as K from '../world/kit.js';
import { PROPS } from '../world/props.js';
import { RNG, TAU } from '../core/rng.js';

const SAMPLES = 128;

function resample(pts, closed, n = SAMPLES) {
  const P = closed ? [...pts, pts[0]] : pts; const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]));
  const L = cum[cum.length - 1]; const out = []; let j = 0;
  for (let i = 0; i < n; i++) { const d = (i / n) * L; while (j < cum.length - 2 && cum[j + 1] < d) j++; const t = (d - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]); out.push([P[j][0] + (P[j + 1][0] - P[j][0]) * t, P[j][1] + (P[j + 1][1] - P[j][1]) * t, P[j][2] + (P[j + 1][2] - P[j][2]) * t]); }
  return { pts: out, len: L };
}
// out-and-back loop along an open polyline, with lateral offset so the two directions sit side by side
function loopOf(pts, off, y) {
  const n = pts.length; const side = (i, s) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; return [pts[i][0] - (tz / l) * off * s, y, pts[i][1] + (tx / l) * off * s]; };
  const out = []; for (let i = 0; i < n; i++) out.push(side(i, 1)); for (let i = n - 1; i >= 0; i--) out.push(side(i, -1));
  return out;
}

export function buildLanes(ctx) {
  const lanes = []; const rng = new RNG(ctx.seed + 77);
  // air corridors stacked above the arterials
  for (const r of ctx.roads) {
    const levels = r.kind === 'ring' ? [84, 136, 196, 268] : [78, 128, 186, 250];
    levels.forEach((y, li) => {
      if (r.closed) { for (const s of [1, -1]) { const pts = r.pts.map((p, i) => [p[0] + r.fr[i][2] * 7 * s, y + (s > 0 ? 0 : 9), p[1] + r.fr[i][3] * 7 * s]); lanes.push({ ...resample(s > 0 ? pts : pts.reverse(), true), speed: 34 + li * 9, kind: 'air', w: 1 }); } }
      else lanes.push({ ...resample(loopOf(r.pts, 7, y), true), speed: 32 + li * 9, kind: 'air', w: 1 });
    });
    // ground hover traffic
    if (r.closed) { for (const s of [1, -1]) { const pts = r.pts.map((p, i) => [p[0] + r.fr[i][2] * r.w * 0.2 * s, 1.0, p[1] + r.fr[i][3] * r.w * 0.2 * s]); lanes.push({ ...resample(s > 0 ? pts : pts.reverse(), true), speed: 17, kind: 'ground', w: 1.3 }); } }
    else lanes.push({ ...resample(loopOf(r.pts, r.w * 0.2, 1.0), true), speed: 16, kind: 'ground', w: 1.3 });
  }
  // low corridors above a selection of wide local streets
  const wide = ctx.streets.filter((s) => s.w >= 18); rng.shuffle(wide);
  for (const s of wide.slice(0, 46)) { const y = rng.pick([34, 48, 62]); lanes.push({ ...resample(loopOf(s.pts, 4.5, y), true), speed: 22, kind: 'air', w: 0.5 }); if (rng.chance(0.6)) lanes.push({ ...resample(loopOf(s.pts, s.w * 0.2, 1.0), true), speed: 12, kind: 'ground', w: 0.8 }); }
  // helix around the Spire + luxury ring above the clouds
  { const pts = []; const turns = 5; const n = 160; for (let i = 0; i < n; i++) { const t = i / n; const up = t < 0.5 ? t * 2 : 2 - t * 2; const a = t * turns * TAU * (t < 0.5 ? 1 : 1); const r = t < 0.5 ? 430 : 520; pts.push([Math.cos(a) * r, 110 + up * 720, Math.sin(a) * r]); } lanes.push({ ...resample(pts, true), speed: 46, kind: 'air', w: 1.2 }); }
  for (const [r, y] of [[840, 1590], [700, 1640]]) { const pts = []; for (let i = 0; i < 96; i++) { const a = (i / 96) * TAU; pts.push([Math.cos(a) * r, y, Math.sin(a) * r]); } lanes.push({ ...resample(pts, true), speed: 60, kind: 'air', w: 0.35, high: true }); }
  // courier drones thread the local streets just above the awnings
  { const loc = (ctx.streets || []).filter((s) => s.w >= 7 && ['sump', 'lumina', 'oldq', 'hive', 'meridian'].includes(s.district)); rng.shuffle(loc);
    for (const s of loc.slice(0, 170)) lanes.push({ ...resample(loopOf(s.pts, 1.7, rng.f(5.5, 13)), true), speed: rng.f(6, 10), kind: 'drone', w: 0 }); }
  // maglev
  if (ctx.maglev) lanes.push({ ...resample(ctx.maglev.pts, true), speed: 58, kind: 'train', w: 0 });
  return lanes;
}

const PATH_GLSL = /* glsl */ `
uniform sampler2D uPaths; uniform float uSamples;
vec4 pathAt(float lane, float t){ float x = fract(t) * uSamples; float i0 = floor(x); float f = x - i0; int row = int(lane + 0.5);
  vec4 a = texelFetch(uPaths, ivec2(int(i0), row), 0); vec4 b = texelFetch(uPaths, ivec2(int(mod(i0 + 1.0, uSamples)), row), 0); return mix(a, b, f); }
`;

function trainCarGeometry() {
  const b = new Batch(512); const pen = new Pen(b); pen.at(0, 0, 0, 0);
  const prof = (s) => rectPts(3.2 * s, 21.6, 0, 0, 0.5);
  pen.use(K.metal([0.62, 0.64, 0.68])); pen.loft([{ y: 0.3, pts: prof(0.86) }, { y: 0.9, pts: prof(1) }, { y: 1.5, pts: prof(1) }], { cap: false, capBottom: true });
  pen.use(K.emis([1, 0.86, 0.62], 3.2)); pen.loft([{ y: 1.5, pts: prof(1) }, { y: 2.5, pts: prof(1) }], { cap: false });
  pen.use(K.metal([0.62, 0.64, 0.68])); pen.loft([{ y: 2.5, pts: prof(1) }, { y: 3.3, pts: prof(0.82) }], { roof: K.dark(0.2) });
  pen.use(K.emis([0.3, 0.9, 1], 6)); pen.box(0, 0, 3.3, 21.7, 0.82, 0.94, { roof: null });
  return b.build();
}

export function createTraffic(ctx, quality) {
  const lanes = buildLanes(ctx); const rows = lanes.length;
  const data = new Float32Array(SAMPLES * rows * 4);
  lanes.forEach((l, r) => l.pts.forEach((p, i) => { const o = (r * SAMPLES + i) * 4; data[o] = p[0]; data[o + 1] = p[1]; data[o + 2] = p[2]; data[o + 3] = l.len; }));
  const tex = new THREE.DataTexture(data, SAMPLES, rows, THREE.RGBAFormat, THREE.FloatType); tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.needsUpdate = true;
  const rng = new RNG(ctx.seed + 991);
  // distribute vehicles by lane length × weight
  const N = quality.traffic; let tw = 0; for (const l of lanes) tw += l.len * l.w;
  const inst = []; // lane, phase, speed, lateral, vertical, seed
  lanes.forEach((l, r) => { if (l.kind === 'train' || l.kind === 'drone') return; const n = Math.round((N * l.len * l.w) / tw); for (let i = 0; i < n; i++) inst.push(r, rng.next(), l.speed * rng.f(0.8, 1.25), rng.f(-2.2, 2.2) * (l.kind === 'ground' ? 0.5 : 1), l.kind === 'ground' ? 0 : rng.f(-3, 3), rng.next()); });
  const count = inst.length / 6;
  const group = new THREE.Group(); group.name = 'traffic';
  const uniforms = { ...U, uPaths: { value: tex }, uSamples: { value: SAMPLES }, uScale: { value: 600 } };

  // --- bodies
  const carB = new Batch(512); const cp = new Pen(carB); cp.at(0, 0, 0, 0); PROPS.hovercar(cp); const carGeo0 = carB.build();
  const mkInst = (geo0, attrs, n) => { const g = new THREE.InstancedBufferGeometry(); g.index = geo0.index; g.setAttribute('position', geo0.getAttribute('position')); g.setAttribute('normal', geo0.getAttribute('normal')); g.setAttribute('aColor', geo0.getAttribute('aColor')); g.setAttribute('aStyle', geo0.getAttribute('aStyle')); g.setAttribute('aStyle2', geo0.getAttribute('aStyle2')); const ib = new THREE.InstancedInterleavedBuffer(new Float32Array(attrs), 6); g.setAttribute('aLane', new THREE.InterleavedBufferAttribute(ib, 4, 0)); g.setAttribute('aOff', new THREE.InterleavedBufferAttribute(ib, 2, 4)); g.instanceCount = n; return g; };
  // interleaved layout: lane, phase, speed, lateral | vertical, seed
  const bodyMat = new THREE.ShaderMaterial({
    uniforms, fog: false,
    vertexShader: /* glsl */ `
      ${NS_COMMON} ${PATH_GLSL}
      attribute vec4 aColor; attribute vec4 aStyle; attribute vec4 aStyle2; attribute vec4 aLane; attribute vec2 aOff;
      varying vec3 vWPos; varying vec3 vN; varying vec3 vCol; varying float vEm; varying float vSeed;
      void main(){
        vec4 p0 = pathAt(aLane.x, aLane.y + uTime * aLane.z / max(1.0, texelFetch(uPaths, ivec2(0, int(aLane.x + 0.5)), 0).w));
        float tt = aLane.y + uTime * aLane.z / p0.w;
        vec3 p = pathAt(aLane.x, tt).xyz; vec3 pa = pathAt(aLane.x, tt + 0.6 / uSamples).xyz; vec3 pb = pathAt(aLane.x, tt - 0.6 / uSamples).xyz;
        vec3 fw = normalize(pa - pb + vec3(1e-4, 0.0, 0.0)); vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0))); vec3 up = cross(rt, fw);
        // bank into turns
        vec3 curve = (pa - p) - (p - pb); float bank = clamp(dot(curve, rt) * 0.08, -0.5, 0.5);
        up = normalize(up + rt * bank); rt = normalize(cross(fw, up));
        p += rt * aLane.w + vec3(0.0, aOff.x + sin(uTime * 1.3 + aOff.y * 40.0) * 0.25, 0.0);
        float sc = 0.9 + fract(aOff.y * 7.3) * 0.5;
        vec3 wp = p + (rt * position.x + up * position.y + fw * position.z) * sc;
        vWPos = wp; vN = normalize(rt * normal.x + up * normal.y + fw * normal.z);
        vCol = aColor.rgb * aColor.rgb; vEm = (aStyle.x > 3.5 && aStyle.x < 4.5) ? aStyle2.w * 0.2 : 0.0; vSeed = aOff.y;
        float d = distance(wp, cameraPosition);
        gl_Position = d > 950.0 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      ${NS_COMMON}
      varying vec3 vWPos; varying vec3 vN; varying vec3 vCol; varying float vEm; varying float vSeed;
      void main(){
        vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vWPos);
        vec3 tint = mix(vec3(0.5, 0.52, 0.56), vec3(0.9, 0.3, 0.2), step(0.86, fract(vSeed * 3.7))); tint = mix(tint, vec3(0.2, 0.3, 0.5), step(0.7, fract(vSeed * 9.1)) * 0.6);
        vec3 alb = vCol * tint * 1.6;
        vec4 lf = nsLightField(vWPos, 1.0); vec3 spill = lf.rgb * exp(-max(vWPos.y - 7.0, 0.0) / 13.0);
        vec3 amb = mix(uAmbGround, uAmbSky, N.y * 0.5 + 0.5) * mix(1.0, 3.0, smoothstep(uCloud.x, uCloud.y, vWPos.y));
        vec3 sun = uSunColor * nsSunVis(vWPos.y) * max(dot(N, uSunDir), 0.0);
        float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        vec3 col = alb * (amb + spill + sun * 0.35) + (uFogLow * 2.0 + spill * 0.5) * fr * 0.6 + sun * pow(max(dot(reflect(-V, N), uSunDir), 0.0), 40.0) * 0.4;
        col += vCol * vEm;
        gl_FragColor = vec4(nsApplyFog(col, cameraPosition, vWPos), 0.0);
      }`,
  });
  const body = new THREE.Mesh(mkInst(carGeo0, inst, count), bodyMat); body.frustumCulled = false; group.add(body);
  { const dinst = []; let dl = 0; for (const l of lanes) if (l.kind === 'drone') dl += l.len; const ND = Math.round(N * 0.2);
    lanes.forEach((l, r) => { if (l.kind !== 'drone') return; const n = Math.max(1, Math.round((ND * l.len) / Math.max(1, dl))); for (let i = 0; i < n; i++) dinst.push(r, rng.next(), l.speed * rng.f(0.8, 1.2), rng.f(-0.7, 0.7), rng.f(-1.4, 1.4), rng.next()); });
    if (dinst.length) { const dB = new Batch(256); const dpn = new Pen(dB); dpn.at(0, 0, 0, 0); PROPS.drone(dpn); const drones = new THREE.Mesh(mkInst(dB.build(), dinst, dinst.length / 6), bodyMat); drones.frustumCulled = false; group.add(drones); } }

  // --- far lights: two points per vehicle (white ahead, red behind)
  const lg = new THREE.BufferGeometry(); const lp = new Float32Array(count * 2 * 3); const la = new Float32Array(count * 2 * 4), lb = new Float32Array(count * 2 * 3);
  for (let i = 0; i < count; i++) for (let k = 0; k < 2; k++) { const o = (i * 2 + k); la[o * 4] = inst[i * 6]; la[o * 4 + 1] = inst[i * 6 + 1]; la[o * 4 + 2] = inst[i * 6 + 2]; la[o * 4 + 3] = inst[i * 6 + 3]; lb[o * 3] = inst[i * 6 + 4]; lb[o * 3 + 1] = inst[i * 6 + 5]; lb[o * 3 + 2] = k; }
  lg.setAttribute('position', new THREE.BufferAttribute(lp, 3)); lg.setAttribute('aLane', new THREE.BufferAttribute(la, 4)); lg.setAttribute('aOff', new THREE.BufferAttribute(lb, 3));
  const lightMat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: /* glsl */ `
      ${NS_COMMON} ${PATH_GLSL}
      attribute vec4 aLane; attribute vec3 aOff; uniform float uScale; varying vec3 vC;
      void main(){
        float len = texelFetch(uPaths, ivec2(0, int(aLane.x + 0.5)), 0).w; float tt = aLane.y + uTime * aLane.z / len;
        vec3 p = pathAt(aLane.x, tt).xyz; vec3 pa = pathAt(aLane.x, tt + 0.6 / uSamples).xyz; vec3 pb = pathAt(aLane.x, tt - 0.6 / uSamples).xyz;
        vec3 fw = normalize(pa - pb + vec3(1e-4, 0.0, 0.0)); vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
        p += rt * aLane.w + vec3(0.0, aOff.x + 0.7, 0.0) + fw * (aOff.z < 0.5 ? 2.4 : -2.4);
        vec4 mv = viewMatrix * vec4(p, 1.0); float d = max(-mv.z, 1.0);
        float px = 1.5 * uScale / d; float sz = clamp(px, 1.6, 22.0); float k = min(1.0, px / 1.6);
        vec3 V = normalize(cameraPosition - p); float facing = dot(V, fw) * (aOff.z < 0.5 ? 1.0 : -1.0);
        vec3 c = aOff.z < 0.5 ? vec3(1.0, 0.95, 0.85) * 2.6 : vec3(1.0, 0.1, 0.05) * 2.0;
        vC = c * k * (0.25 + 0.75 * smoothstep(-0.2, 0.5, facing)) * exp(-nsFogOD(cameraPosition, p)) * smoothstep(20.0, 90.0, d);
        gl_PointSize = sz; gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `varying vec3 vC; void main(){ float r = length(gl_PointCoord - 0.5) * 2.0; float a = max(0.0, 1.0 - r); gl_FragColor = vec4(vC * a * a, 0.0); }`,
  });
  const lights = new THREE.Points(lg, lightMat); lights.frustumCulled = false; lights.renderOrder = 41; group.add(lights);

  // --- maglev trains
  const trainRow = lanes.findIndex((l) => l.kind === 'train');
  if (trainRow >= 0) {
    const L = lanes[trainRow].len; const ti = [];
    for (let t = 0; t < 3; t++) for (let c = 0; c < 7; c++) ti.push(trainRow, t / 3 + (c * 22.6) / L, lanes[trainRow].speed, 0, 0.6, t + c * 0.1);
    const train = new THREE.Mesh(mkInst(trainCarGeometry(), ti, ti.length / 6), bodyMat); train.frustumCulled = false; group.add(train);
  }
  return {
    group, lanes, count,
    update(engine) { uniforms.uScale.value = engine.renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan((engine.camera.fov * Math.PI) / 360)); },
  };
}
