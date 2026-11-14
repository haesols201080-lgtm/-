// Procedural PBR material library, baked on the GPU at load into two mip-mapped texture arrays:
//   A: rgb = albedo detail multiplier (0.5 = neutral, sRGB-ish), a = height
//   B: rg = tangent normal, b = roughness, a = cavity / mask
// Layers are tileable so they can be mapped in world metres on any surface.
import * as THREE from 'three';

export const MAT = { CONCRETE: 0, PLASTER: 1, METAL: 2, RUST: 3, ASPHALT: 4, RIBBED: 5, COMPOSITE: 6, PAVERS: 7, GRUNGE: 8, FABRIC: 9, FOLIAGE: 10, ASHLAR: 11, COUNT: 12 };

const FRAG = /* glsl */ `
precision highp float;
uniform int uLayer; uniform int uPass; uniform float uTexel;
varying vec2 vUv;
float h21(vec2 p){ p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.y); }
vec2 h22(vec2 p){ vec3 a = fract(p.xyx * vec3(0.1031, 0.1030, 0.0973)); a += dot(a, a.yzx + 33.33); return fract((a.xx + a.yz) * a.zy); }
float vn(vec2 p, vec2 per){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = h21(mod(i, per)), b = h21(mod(i + vec2(1.0, 0.0), per)), c = h21(mod(i + vec2(0.0, 1.0), per)), d = h21(mod(i + vec2(1.0, 1.0), per));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
float fbm(vec2 uv, vec2 per, int oct){ float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 9; i++) { if (i >= oct) break; s += a * vn(uv * per + float(i) * 17.3, per); n += a; per *= 2.0; a *= 0.5; }
  return s / n; }
vec3 voro(vec2 uv, vec2 per){ vec2 p = uv * per, i = floor(p), f = fract(p); float f1 = 9.0, f2 = 9.0, id = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)); vec2 c = mod(i + g, per); vec2 o = h22(c); float d = length(g + o - f);
    if (d < f1) { f2 = f1; f1 = d; id = h21(c + 7.0); } else if (d < f2) f2 = d; }
  return vec3(f1, f2, id); }
float ridge(vec2 uv, vec2 per, int oct){ float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 7; i++) { if (i >= oct) break; s += a * (1.0 - abs(vn(uv * per + float(i) * 9.1, per) * 2.0 - 1.0)); n += a; per *= 2.0; a *= 0.5; }
  return s / n; }

// returns albedo multiplier (linear, 1 = neutral), height (0..1), roughness, cavity/mask
void mat(int L, vec2 uv, out vec3 alb, out float h, out float rough, out float cav){
  alb = vec3(1.0); h = 0.5; rough = 0.7; cav = 1.0;
  if (L == 0) { // board-formed concrete (tile = 4 m)
    float boards = 8.0; float by = uv.y * boards; float bi = floor(by), bf = fract(by);
    float tone = h21(vec2(bi, 3.0));
    float grain = fbm(uv + tone, vec2(3.0, 96.0), 4);
    float blot = fbm(uv, vec2(3.0), 6); float fine = fbm(uv, vec2(48.0), 4);
    float seam = smoothstep(0.0, 0.035, bf) * smoothstep(1.0, 0.965, bf);
    vec3 v = voro(uv, vec2(56.0)); float pit = smoothstep(0.16, 0.05, v.x) * step(0.72, v.z);
    vec2 tg = fract(uv * vec2(4.0, 2.0)) - 0.5; float tie = smoothstep(0.03, 0.022, length(tg * vec2(1.0, 2.0)));
    float drip = fbm(uv, vec2(40.0, 2.0), 4); float stain = smoothstep(0.42, 0.75, drip) * smoothstep(0.3, 0.7, fbm(uv + 0.3, vec2(4.0), 4));
    float v0 = 0.78 + 0.34 * blot + 0.1 * (tone - 0.5) + 0.08 * (grain - 0.5) + 0.07 * (fine - 0.5);
    v0 *= mix(0.72, 1.0, seam) * (1.0 - 0.45 * pit) * (1.0 - 0.5 * tie) * (1.0 - 0.3 * stain);
    alb = v0 * mix(vec3(1.0, 0.98, 0.94), vec3(0.93, 0.97, 1.0), blot);
    alb = mix(alb, alb * vec3(0.78, 0.74, 0.62), stain * 0.6);
    h = 0.55 + 0.12 * (grain - 0.5) + 0.06 * (fine - 0.5) - 0.3 * (1.0 - seam) - 0.35 * pit - 0.4 * tie + 0.05 * (tone - 0.5);
    rough = 0.86 - 0.12 * stain + 0.08 * (fine - 0.5); cav = mix(0.55, 1.0, seam) * (1.0 - 0.5 * pit);
  } else if (L == 1) { // plaster / smooth precast with hairline cracks (4 m)
    float blot = fbm(uv, vec2(2.0), 6); float fine = fbm(uv, vec2(64.0), 4);
    vec2 w = uv + (vec2(fbm(uv, vec2(6.0), 3), fbm(uv + 0.5, vec2(6.0), 3)) - 0.5) * 0.12;
    vec3 v = voro(w, vec2(5.0)); float crack = smoothstep(0.007, 0.0, v.y - v.x) * smoothstep(0.66, 0.8, fbm(uv + 0.7, vec2(3.0), 3)) * 0.5;
    float patchM = smoothstep(0.58, 0.6, fbm(uv + 0.21, vec2(3.0), 3));
    float trowel = fbm(uv, vec2(10.0, 30.0), 3);
    float drip = smoothstep(0.5, 0.8, fbm(uv, vec2(36.0, 2.0), 4));
    float v0 = 0.86 + 0.26 * blot + 0.05 * (fine - 0.5) + 0.05 * (trowel - 0.5);
    v0 *= (1.0 - 0.55 * crack) * mix(1.0, 0.86, patchM) * (1.0 - 0.22 * drip);
    alb = vec3(v0) * mix(vec3(1.0), vec3(0.92, 0.9, 0.84), drip * 0.7);
    h = 0.55 + 0.05 * (fine - 0.5) + 0.05 * (trowel - 0.5) - 0.45 * crack - 0.06 * patchM;
    rough = 0.8 + 0.1 * (fine - 0.5) + 0.06 * patchM; cav = 1.0 - 0.6 * crack;
  } else if (L == 2) { // brushed metal sheet with scratches + dents (3 m)
    float brush = fbm(uv, vec2(2.0, 180.0), 4); float brush2 = fbm(uv + 0.37, vec2(6.0, 320.0), 3);
    float dent = fbm(uv, vec2(3.0), 4); float smudge = fbm(uv + 0.11, vec2(5.0), 5);
    vec2 sc = uv * vec2(1.0, 40.0); float scr = smoothstep(0.985, 1.0, vn(vec2(sc.x * 3.0 + vn(sc, vec2(1.0, 40.0)) * 0.5, sc.y), vec2(3.0, 40.0)));
    vec3 v = voro(uv, vec2(24.0)); float spot = smoothstep(0.12, 0.02, v.x) * step(0.82, v.z);
    float v0 = 0.92 + 0.14 * (brush - 0.5) + 0.1 * (brush2 - 0.5) + 0.16 * (smudge - 0.5);
    alb = vec3(v0) * (1.0 + 0.25 * scr) * (1.0 - 0.35 * spot);
    alb = mix(alb, alb * vec3(0.8, 0.7, 0.55), spot * 0.8);
    h = 0.5 + 0.1 * (dent - 0.5) + 0.03 * (brush - 0.5) - 0.1 * scr;
    rough = clamp(0.34 + 0.22 * (brush - 0.5) + 0.3 * (smudge - 0.45) + 0.4 * spot, 0.08, 1.0); cav = 1.0 - 0.3 * spot;
  } else if (L == 3) { // peeling paint over rust (3 m). cav = paint mask
    float n = fbm(uv, vec2(4.0), 7); float n2 = ridge(uv + 0.2, vec2(6.0), 5); float fine = fbm(uv, vec2(60.0), 4);
    float drip = fbm(uv, vec2(30.0, 2.5), 4);
    float mask = smoothstep(0.50, 0.56, n * 0.62 + n2 * 0.3 + drip * 0.16 + (fine - 0.5) * 0.1);
    vec3 rustC = mix(vec3(0.62, 0.26, 0.10), vec3(0.30, 0.12, 0.06), fbm(uv + 0.6, vec2(14.0), 4));
    rustC = mix(rustC, vec3(0.85, 0.48, 0.18), smoothstep(0.6, 0.8, fbm(uv + 0.4, vec2(28.0), 3)) * 0.5) * (0.7 + 0.6 * fine);
    vec3 paint = vec3(0.95 + 0.12 * (fbm(uv, vec2(9.0), 4) - 0.5));
    float edge = smoothstep(0.50, 0.53, n * 0.62 + n2 * 0.3 + drip * 0.16 + (fine - 0.5) * 0.1) - smoothstep(0.56, 0.6, n * 0.62 + n2 * 0.3 + drip * 0.16 + (fine - 0.5) * 0.1);
    alb = mix(rustC * 1.9, paint * (1.0 - 0.25 * edge), mask);
    h = mix(0.35 + 0.2 * (fine - 0.5), 0.62, mask); rough = mix(0.95, 0.5 + 0.1 * (fine - 0.5), mask); cav = mask;
  } else if (L == 4) { // asphalt (5 m)
    vec3 ag = voro(uv, vec2(110.0)); vec3 ag2 = voro(uv + 0.31, vec2(46.0));
    float blot = fbm(uv, vec2(3.0), 6); float fine = fbm(uv, vec2(90.0), 3);
    vec2 w = uv + (vec2(fbm(uv, vec2(8.0), 3), fbm(uv + 0.5, vec2(8.0), 3)) - 0.5) * 0.1;
    vec3 cr = voro(w, vec2(4.0)); float crack = smoothstep(0.009, 0.0, cr.y - cr.x) * smoothstep(0.58, 0.74, fbm(uv + 0.9, vec2(3.0), 3)) * 0.7;
    float tar = smoothstep(0.012, 0.004, abs(fbm(uv + 0.13, vec2(3.0), 2) - 0.5)) ;
    float spk = smoothstep(0.3, 0.05, ag.x) * step(0.55, ag.z); float spk2 = smoothstep(0.25, 0.05, ag2.x) * step(0.8, ag2.z);
    float v0 = 0.85 + 0.35 * (blot - 0.5) + 0.25 * spk * (ag.z - 0.3) + 0.3 * spk2 + 0.1 * (fine - 0.5);
    alb = vec3(v0) * (1.0 - 0.6 * crack) * (1.0 - 0.45 * tar);
    h = 0.5 + 0.18 * spk * ag.z + 0.1 * spk2 + 0.05 * (fine - 0.5) - 0.5 * crack + 0.04 * tar;
    rough = mix(0.88 - 0.1 * spk, 0.35, tar); cav = 1.0 - 0.6 * crack;
  } else if (L == 5) { // ribbed / corrugated cladding (2 m): 10 ribs
    float r = fract(uv.x * 10.0); float prof = smoothstep(0.08, 0.3, r) * smoothstep(0.92, 0.7, r);
    float fine = fbm(uv, vec2(40.0), 4); float streak = fbm(uv, vec2(20.0, 2.0), 4); float blot = fbm(uv, vec2(3.0), 5);
    float screw = smoothstep(0.05, 0.03, length((fract(uv * vec2(10.0, 2.0)) - vec2(0.5, 0.5)) * vec2(1.0, 5.0)));
    alb = vec3(0.92 + 0.14 * (blot - 0.5) + 0.06 * (fine - 0.5)) * (0.82 + 0.18 * prof) * (1.0 - 0.25 * smoothstep(0.5, 0.85, streak)) * (1.0 - 0.3 * screw);
    h = 0.3 + 0.5 * prof + 0.03 * (fine - 0.5) + 0.08 * screw; rough = 0.5 + 0.25 * (blot - 0.5) + 0.2 * smoothstep(0.5, 0.85, streak); cav = 0.6 + 0.4 * prof;
  } else if (L == 6) { // tech composite: fine weave + panel micro-seams + fingerprints (2 m)
    vec2 q = uv * 96.0; float weave = 0.5 + 0.5 * sin(q.x * 6.2832) * sin(q.y * 6.2832);
    float twill = 0.5 + 0.5 * sin((q.x + floor(q.y) * 0.5) * 6.2832);
    float smudge = fbm(uv, vec2(4.0), 6); float fine = fbm(uv, vec2(70.0), 3);
    vec2 pg = fract(uv * vec2(4.0, 8.0)); float seam = min(min(pg.x, 1.0 - pg.x) * 0.25, min(pg.y, 1.0 - pg.y) * 0.125); float sm = smoothstep(0.004, 0.0015, seam);
    float pid = h21(floor(uv * vec2(4.0, 8.0)));
    alb = vec3(0.92 + 0.08 * (weave - 0.5) + 0.05 * (twill - 0.5) + 0.2 * (smudge - 0.5) + 0.14 * (pid - 0.5)) * (1.0 - 0.6 * sm);
    h = 0.5 + 0.03 * (weave - 0.5) - 0.4 * sm + 0.05 * (pid - 0.5); rough = clamp(0.3 + 0.3 * (smudge - 0.45) + 0.1 * (fine - 0.5) + 0.15 * (pid - 0.5), 0.06, 1.0); cav = 1.0 - 0.7 * sm;
  } else if (L == 7) { // stone setts / pavers (2.4 m): 8 rows
    float rows = 8.0; float ry = uv.y * rows; float ri = floor(ry);
    float off = mod(ri, 2.0) * 0.5; vec2 q = vec2(uv.x * 6.0 + off, ry); vec2 qi = floor(q), qf = fract(q);
    float id = h21(vec2(mod(qi.x, 6.0), qi.y)); vec2 ed = min(qf, 1.0 - qf) * vec2(1.0 / 6.0, 1.0 / 8.0) * 2.4;
    float joint = smoothstep(0.0, 0.016, min(ed.x, ed.y));
    float bulge = smoothstep(0.0, 0.06, min(ed.x, ed.y)); float fine = fbm(uv, vec2(60.0), 4); float blot = fbm(uv, vec2(3.0), 5);
    alb = vec3(0.82 + 0.3 * (id - 0.5) + 0.2 * (blot - 0.5) + 0.1 * (fine - 0.5)) * mix(0.45, 1.0, joint);
    alb *= mix(vec3(1.0), vec3(0.95, 1.0, 0.92), smoothstep(0.6, 0.8, blot));
    h = mix(0.2, 0.5 + 0.12 * bulge + 0.06 * (fine - 0.5) + 0.06 * (id - 0.5), joint); rough = mix(0.95, 0.72 + 0.15 * (id - 0.5), joint); cav = mix(0.4, 1.0, joint);
  } else if (L == 8) { // grunge masks: r = leak streaks, g = blotchy dirt, b = scratches / speckle, (cav) = edge wear
    float s1 = fbm(uv, vec2(48.0, 1.0), 5); float s2 = fbm(uv + 0.3, vec2(14.0, 1.0), 4); float env = fbm(uv + 0.6, vec2(3.0, 2.0), 4);
    float streak = smoothstep(0.45, 0.8, s1 * 0.6 + s2 * 0.4) * smoothstep(0.3, 0.6, env);
    float dirt = fbm(uv, vec2(4.0), 7);
    float scr = max(smoothstep(0.97, 1.0, vn(uv * vec2(200.0, 6.0), vec2(200.0, 6.0))), smoothstep(0.985, 1.0, vn(uv * vec2(8.0, 240.0), vec2(8.0, 240.0))));
    alb = vec3(streak, dirt, scr); h = fbm(uv, vec2(24.0), 5); rough = 0.5; cav = ridge(uv, vec2(10.0), 5);
  } else if (L == 9) { // woven fabric / tarp (1.5 m)
    vec2 q = uv * 120.0; float wv = 0.5 + 0.25 * sin(q.x * 6.2832) + 0.25 * sin(q.y * 6.2832);
    float wr = fbm(uv, vec2(5.0, 3.0), 5); float stain = fbm(uv + 0.4, vec2(4.0), 5);
    alb = vec3(0.9 + 0.08 * (wv - 0.5) + 0.2 * (wr - 0.5)) * (1.0 - 0.25 * smoothstep(0.55, 0.8, stain));
    h = 0.5 + 0.35 * (wr - 0.5) + 0.04 * (wv - 0.5); rough = 0.9; cav = 0.8 + 0.2 * wr;
  } else if (L == 10) { // foliage canopy (3 m)
    vec3 v = voro(uv, vec2(26.0)); vec3 v2 = voro(uv + 0.37, vec2(70.0)); float blot = fbm(uv, vec2(4.0), 5);
    float leaf = smoothstep(0.75, 0.1, v.x); float leaf2 = smoothstep(0.6, 0.1, v2.x);
    alb = mix(vec3(0.45, 0.62, 0.3), vec3(1.25, 1.35, 0.7), leaf * (0.4 + 0.6 * v.z)) * (0.6 + 0.5 * leaf2) * (0.7 + 0.6 * blot);
    h = 0.2 + 0.5 * leaf + 0.25 * leaf2; rough = 0.72 - 0.15 * leaf2; cav = 0.35 + 0.65 * leaf;
  } else { // ashlar stone blocks (3 m): 5 courses
    float rows = 5.0; float ry = uv.y * rows; float ri = floor(ry);
    float nb = 3.0; float off = h21(vec2(ri, 1.0)); vec2 q = vec2(uv.x * nb + off, ry); vec2 qi = floor(q), qf = fract(q);
    float id = h21(vec2(mod(qi.x, nb), qi.y) + 3.0); vec2 ed = min(qf, 1.0 - qf) * vec2(1.0, 0.6);
    float joint = smoothstep(0.0, 0.018, min(ed.x, ed.y)); float chis = fbm(uv, vec2(40.0), 5); float blot = fbm(uv, vec2(3.0), 6);
    float chip = smoothstep(0.62, 0.7, fbm(uv + id, vec2(18.0), 3)) * smoothstep(0.08, 0.0, min(ed.x, ed.y));
    float drip = smoothstep(0.5, 0.8, fbm(uv, vec2(30.0, 2.0), 4));
    alb = vec3(0.84 + 0.26 * (id - 0.5) + 0.2 * (blot - 0.5) + 0.12 * (chis - 0.5)) * mix(0.5, 1.0, joint) * (1.0 - 0.2 * drip);
    alb *= mix(vec3(1.0, 0.97, 0.9), vec3(0.9, 0.95, 1.0), id);
    h = mix(0.2, 0.55 + 0.14 * (chis - 0.5) + 0.06 * (id - 0.5), joint) - 0.2 * chip; rough = mix(0.95, 0.78 + 0.1 * (chis - 0.5), joint); cav = mix(0.45, 1.0, joint);
  }
}
void main(){
  vec3 alb; float h, rough, cav;
  mat(uLayer, vUv, alb, h, rough, cav);
  if (uPass == 0) { gl_FragColor = vec4(sqrt(clamp(alb * 0.25, 0.0, 1.0)), clamp(h, 0.0, 1.0)); return; }
  vec3 a2; float hx0, hx1, hy0, hy1, r2, c2; float e = uTexel;
  mat(uLayer, fract(vUv + vec2(e, 0.0)), a2, hx1, r2, c2); mat(uLayer, fract(vUv - vec2(e, 0.0)), a2, hx0, r2, c2);
  mat(uLayer, fract(vUv + vec2(0.0, e)), a2, hy1, r2, c2); mat(uLayer, fract(vUv - vec2(0.0, e)), a2, hy0, r2, c2);
  vec2 n = clamp(vec2(hx0 - hx1, hy0 - hy1) * 1.6, -1.0, 1.0);
  gl_FragColor = vec4(n * 0.5 + 0.5, clamp(rough, 0.0, 1.0), clamp(cav, 0.0, 1.0));
}`;

export function bakeMaterials(renderer, size = 512, aniso = 8) {
  const mk = () => {
    const rt = new THREE.WebGLArrayRenderTarget(size, size, MAT.COUNT, { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
    rt.texture.wrapS = rt.texture.wrapT = THREE.RepeatWrapping; rt.texture.anisotropy = Math.min(aniso, renderer.capabilities.getMaxAnisotropy());
    return rt;
  };
  const A = mk(), B = mk();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  const mat = new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: FRAG, depthTest: false, depthWrite: false,
    uniforms: { uLayer: { value: 0 }, uPass: { value: 0 }, uTexel: { value: 1 / size } },
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(mesh);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const prev = renderer.getRenderTarget();
  for (let pass = 0; pass < 2; pass++) for (let l = 0; l < MAT.COUNT; l++) {
    mat.uniforms.uLayer.value = l; mat.uniforms.uPass.value = pass;
    renderer.setRenderTarget(pass === 0 ? A : B, l); renderer.render(scene, cam);
  }
  renderer.setRenderTarget(prev);
  geo.dispose(); mat.dispose();
  return { A: A.texture, B: B.texture };
}
