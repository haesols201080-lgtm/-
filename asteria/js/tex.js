// 아스테리아 1부 — 절차적 PBR 재질 라이브러리 (TEX)
// 모든 텍스처는 코드로 만든다: 이음매 없는(tileable) 높이·색·거칠기 → 노멀/AO/ORM 으로 굽는다.
// 생성은 게으르게(처음 요청할 때) 하고, 가능하면 Web Worker 에서 병렬로 돌린다.
'use strict';

// =====================================================================================
//  생성기 — 이 함수 전체가 문자열로 워커에 보내진다. 바깥 변수는 절대 쓰지 말 것.
// =====================================================================================
function TEX_GEN() {
  // ---------- 해시 / 난수 ----------
  function ih(x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
  }
  const hf = (x, y, s) => ih(x, y, s) / 4294967296;
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const GX = new Float64Array(16), GY = new Float64Array(16);
  for (let k = 0; k < 16; k++) { const a = (k + 0.5) / 16 * Math.PI * 2; GX[k] = Math.cos(a); GY[k] = Math.sin(a); }
  // 주기적 그래디언트 노이즈: x∈[0,px) 에서 반복 (px, py 는 정수)
  function pn(x, y, px, py, s) {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    let x0 = xi % px; if (x0 < 0) x0 += px; const x1 = x0 + 1 >= px ? 0 : x0 + 1;
    let y0 = yi % py; if (y0 < 0) y0 += py; const y1 = y0 + 1 >= py ? 0 : y0 + 1;
    const a = ih(x0, y0, s) & 15, b = ih(x1, y0, s) & 15, c = ih(x0, y1, s) & 15, d = ih(x1, y1, s) & 15;
    const fx1 = fx - 1, fy1 = fy - 1;
    const va = GX[a] * fx + GY[a] * fy, vb = GX[b] * fx1 + GY[b] * fy, vc = GX[c] * fx + GY[c] * fy1, vd = GX[d] * fx1 + GY[d] * fy1;
    const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const ab = va + (vb - va) * u, cd = vc + (vd - vc) * u;
    return (ab + (cd - ab) * v) * 1.5;
  }
  function fbm(x, y, px, py, oct, s, gain) {
    let a = 0, amp = 1, n = 0;
    for (let o = 0; o < oct; o++) { a += pn(x, y, px, py, s + o * 7919) * amp; n += amp; amp *= gain; x *= 2; y *= 2; px *= 2; py *= 2; }
    return a / n;
  }
  function ridgef(x, y, px, py, oct, s) {
    let a = 0, amp = 1, n = 0;
    for (let o = 0; o < oct; o++) { const r = 1 - Math.abs(pn(x, y, px, py, s + o * 7919)); a += r * r * amp; n += amp; amp *= 0.5; x *= 2; y *= 2; px *= 2; py *= 2; }
    return a / n;
  }

  // ---------- 작은 도구 ----------
  const sat = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const mix = (a, b, t) => a + (b - a) * t;
  const sm = (a, b, v) => { let t = (v - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
  function pickW(R, list) { let t = 0; for (const e of list) t += e[1]; let r = R() * t; for (const e of list) { r -= e[1]; if (r <= 0) return e[0]; } return list[0][0]; }
  // 밝기 ±v, 따뜻함/차가움 ±w 로 흔든 색
  function jit(c, R, v, w) { const k = 1 + (R() * 2 - 1) * v, t = (R() * 2 - 1) * w; return [c[0] * k * (1 + t), c[1] * k * (1 + t * 0.25), c[2] * k * (1 - t)]; }
  const lerp3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

  // ---------- 작업 판 ----------
  class Ctx {
    constructor(d) {
      this.W = d.W; this.H = d.H; this.mw = d.mw; this.mh = d.mh; this.N = d.W * d.H;
      this.dx = d.mw / d.W; this.dy = d.mh / d.H; this.seed = d.seed | 0;
      this.h = new Float32Array(this.N);            // 높이 (m)
      this.col = new Float32Array(this.N * 3);      // 알베도 (sRGB 0..1)
      this.rgh = new Float32Array(this.N).fill(0.85);
      this.met = null;                              // 금속 마스크
      this.em = null;                               // 발광 (sRGB)
      this.ley = null;                              // 레이 빛 마스크 (ORM.a)
      this.vid = null;                              // 조각(돌·널빤지)마다 다른 값 0..1 (albedo.a) — 셰이더가 타일마다 섞어 반복을 숨긴다
      this.nk = 1;                                  // 노멀 세기 배율
      this.aoR = [0.008, 0.04];                     // AO 반경 (m)
      this.aoD = 0.012;                             // AO 깊이 기준 (m)
      this.aoK = 0.85;
      this.cavDirt = 0.35;                          // 오목한 곳에 때
    }
    cx(m) { return Math.max(1, Math.round(this.mw / m)); }
    cy(m) { return Math.max(1, Math.round(this.mh / m)); }
    // 크기 m (미터) 의 fbm 노이즈 장 (가로세로 비율 ax, ay 로 늘일 수 있음)
    noise(m, oct, s, gain = 0.5, ax = 1, ay = 1) {
      const fx = this.cx(m * ax), fy = this.cy(m * ay);
      return this.noiseC(fx, fy, oct, s, gain);
    }
    noiseC(fx, fy, oct, s, gain = 0.5) {
      const { W, H } = this, out = new Float32Array(this.N);
      const xs = new Float64Array(W); for (let i = 0; i < W; i++) xs[i] = (i + 0.5) / W * fx;
      for (let j = 0; j < H; j++) {
        const y = (j + 0.5) / H * fy, o = j * W;
        for (let i = 0; i < W; i++) out[o + i] = fbm(xs[i], y, fx, fy, oct, s, gain);
      }
      return out;
    }
    ridge(m, oct, s, ax = 1, ay = 1) {
      const { W, H } = this, out = new Float32Array(this.N), fx = this.cx(m * ax), fy = this.cy(m * ay);
      for (let j = 0; j < H; j++) { const y = (j + 0.5) / H * fy; for (let i = 0; i < W; i++) out[j * W + i] = ridgef((i + 0.5) / W * fx, y, fx, fy, oct, s); }
      return out;
    }
    setC(i, c, k = 1) { const o = i * 3; this.col[o] = c[0] * k; this.col[o + 1] = c[1] * k; this.col[o + 2] = c[2] * k; }
    setRGB(i, r, g, b) { const o = i * 3; this.col[o] = r; this.col[o + 1] = g; this.col[o + 2] = b; }
    mulC(i, k) { const o = i * 3; this.col[o] *= k; this.col[o + 1] *= k; this.col[o + 2] *= k; }
    mixC(i, c, t) { const o = i * 3, C = this.col; C[o] += (c[0] - C[o]) * t; C[o + 1] += (c[1] - C[o + 1]) * t; C[o + 2] += (c[2] - C[o + 2]) * t; }
    // 이음매 없는 박스 블러 (r 픽셀, it 회)
    blur(src, r, it = 2) {
      const { W, H } = this; let a = Float32Array.from(src), b = new Float32Array(this.N);
      r = Math.max(1, Math.round(r));
      const inv = 1 / (2 * r + 1);
      for (let n = 0; n < it; n++) {
        for (let j = 0; j < H; j++) {
          const o = j * W; let s = 0;
          for (let k = -r; k <= r; k++) s += a[o + ((k % W) + W) % W];
          for (let i = 0; i < W; i++) { b[o + i] = s * inv; s += a[o + (i + r + 1) % W] - a[o + ((i - r) % W + W) % W]; }
        }
        for (let i = 0; i < W; i++) {
          let s = 0;
          for (let k = -r; k <= r; k++) s += b[(((k % H) + H) % H) * W + i];
          for (let j = 0; j < H; j++) { a[j * W + i] = s * inv; s += b[((j + r + 1) % H) * W + i] - b[(((j - r) % H + H) % H) * W + i]; }
        }
      }
      return a;
    }
    // 원 도장 (이음매 감김)
    stamp(cx, cy, r, fn) {
      const { W, H, dx, dy } = this;
      const i0 = Math.floor((cx - r) / dx), i1 = Math.ceil((cx + r) / dx), j0 = Math.floor((cy - r) / dy), j1 = Math.ceil((cy + r) / dy);
      for (let j = j0; j <= j1; j++) {
        const jj = ((j % H) + H) % H, yy = (j + 0.5) * dy - cy;
        for (let i = i0; i <= i1; i++) {
          const ii = ((i % W) + W) % W, xx = (i + 0.5) * dx - cx, d = Math.sqrt(xx * xx + yy * yy);
          if (d < r) fn(jj * W + ii, d / r, xx, yy);
        }
      }
    }
    // 선분 따라 칠하기
    line(x0, y0, x1, y1, fn) {
      const { W, H, dx, dy } = this;
      const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(L / Math.min(dx, dy) * 1.5));
      for (let k = 0; k <= n; k++) {
        const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        const i = ((Math.floor(x / dx) % W) + W) % W, j = ((Math.floor(y / dy) % H) + H) % H;
        fn(j * W + i, t);
      }
    }
    // 주기적 파워-보로노이: 칸 id, 경계까지 거리(m), 씨앗점 기준 오프셋(m)
    voronoi(nx, ny, o = {}) {
      const { W, H, mw, mh, N } = this, jit = o.jitter ?? 0.8, seed = o.seed || 1, wgt = o.weight || 0, stag = o.stagger ? 0.5 : 0;
      if (stag && ny % 2) ny++;
      const cw = mw / nx, ch = mh / ny;
      const PX = new Float32Array(nx * ny), PY = new Float32Array(nx * ny), PW = new Float32Array(nx * ny);
      for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
        const k = y * nx + x;
        PX[k] = 0.5 + (hf(x, y, seed) - 0.5) * jit; PY[k] = 0.5 + (hf(x, y, seed + 1) - 0.5) * jit;
        PW[k] = wgt * (hf(x, y, seed + 2) * 2 - 1) * cw * ch * 0.5;
      }
      const id = new Int32Array(N), bd = new Float32Array(N), ox = new Float32Array(N), oy = new Float32Array(N);
      const cX = new Float64Array(25), cY = new Float64Array(25), cW = new Float64Array(25), cK = new Int32Array(25);
      for (let j = 0; j < H; j++) {
        const gy = (j + 0.5) / H * ny, iy = Math.floor(gy);
        for (let i = 0; i < W; i++) {
          const gx = (i + 0.5) / W * nx;
          let n = 0, best = 1e9, bk = 0;
          for (let dj = -1; dj <= 1; dj++) {
            const yy = iy + dj, wy = ((yy % ny) + ny) % ny, sh = (wy & 1) ? stag : 0;
            const ix = Math.floor(gx - sh);
            for (let di = -1; di <= 1; di++) {
              const xx = ix + di, wx = ((xx % nx) + nx) % nx, k = wy * nx + wx;
              const px = (xx + sh + PX[k]) * cw, py = (yy + PY[k]) * ch;
              const ddx = px - gx * cw, ddy = py - gy * ch, d = ddx * ddx + ddy * ddy - PW[k];
              cX[n] = px; cY[n] = py; cW[n] = PW[k]; cK[n] = k;
              if (d < best) { best = d; bk = n; }
              n++;
            }
          }
          const ax = cX[bk], ay = cY[bk], aw = cW[bk], qx = gx * cw, qy = gy * ch;
          let bmin = 1e9;
          const fa = (qx - ax) * (qx - ax) + (qy - ay) * (qy - ay) - aw;
          for (let k = 0; k < n; k++) {
            if (k === bk) continue;
            const bx = cX[k], by = cY[k], L = Math.hypot(bx - ax, by - ay);
            if (L < 1e-6) continue;
            const fb = (qx - bx) * (qx - bx) + (qy - by) * (qy - by) - cW[k];
            const dd = (fb - fa) / (2 * L);
            if (dd < bmin) bmin = dd;
          }
          const p = j * W + i;
          id[p] = cK[bk]; bd[p] = bmin; ox[p] = qx - ax; oy[p] = qy - ay;
        }
      }
      return { id, bd, ox, oy, cw, ch, nx, ny };
    }
    // id 경계까지의 거리 (픽셀, 챔퍼 변환, 이음매 감김)
    edgeDist(ids) {
      const { W, H, N } = this, d = new Float32Array(N).fill(1e6);
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const p = j * W + i, r = j * W + (i + 1) % W, u = ((j + 1) % H) * W + i;
        if (ids[p] !== ids[r]) { d[p] = Math.min(d[p], 0.5); d[r] = Math.min(d[r], 0.5); }
        if (ids[p] !== ids[u]) { d[p] = Math.min(d[p], 0.5); d[u] = Math.min(d[u], 0.5); }
      }
      const S2 = Math.SQRT2;
      for (let pass = 0; pass < 2; pass++) {
        for (let j = 0; j < H; j++) {
          const jm = ((j - 1 + H) % H) * W, o = j * W;
          for (let i = 0; i < W; i++) {
            const im = (i - 1 + W) % W, ip = (i + 1) % W; let v = d[o + i];
            v = Math.min(v, d[o + im] + 1, d[jm + i] + 1, d[jm + im] + S2, d[jm + ip] + S2);
            d[o + i] = v;
          }
        }
        for (let j = H - 1; j >= 0; j--) {
          const jp = ((j + 1) % H) * W, o = j * W;
          for (let i = W - 1; i >= 0; i--) {
            const im = (i - 1 + W) % W, ip = (i + 1) % W; let v = d[o + i];
            v = Math.min(v, d[o + ip] + 1, d[jp + i] + 1, d[jp + ip] + S2, d[jp + im] + S2);
            d[o + i] = v;
          }
        }
      }
      return d;
    }
    // 줄 배치 (돌 쌓기, 판석, 슬레이트, 널빤지). vertical 이면 줄이 세로(널빤지).
    rows(R, o) {
      const { W, H, mw, mh, dx, dy, N } = this, vert = !!o.vertical;
      const AL = vert ? mh : mw, AC = vert ? mw : mh;
      const n = Math.max(1, Math.round(AC / o.row));
      const hs = []; let sum = 0;
      for (let k = 0; k < n; k++) { const v = 1 + (R() * 2 - 1) * (o.rowJ || 0); hs.push(v); sum += v; }
      const rows = []; let p = 0;
      for (let k = 0; k < n; k++) { const s = hs[k] / sum * AC; rows.push({ p0: p, s, br: [] }); p += s; }
      const wd = (a, b) => { const d = Math.abs(a - b) % AL; return Math.min(d, AL - d); };
      for (let k = 0; k < n; k++) {
        const r = rows[k], sc = o.scale ? r.s / o.row : 1;
        let br = null;
        for (let t = 0; t < 60; t++) {
          const cand = []; let x = o.full ? 0 : R() * AL, rem = AL;
          if (o.full) cand.push(0);
          else while (rem > 1e-6) {
            let L = (o.lmin + R() * (o.lmax - o.lmin)) * sc;
            if (rem - L < o.lmin * sc * 0.75) L = rem;
            cand.push(x % AL); x += L; rem -= L;
          }
          let ok = true;
          if (!o.full && o.stag) {
            const nb = []; if (k > 0) nb.push(rows[k - 1].br); if (k === n - 1 && n > 1) nb.push(rows[0].br);
            for (const q of nb) for (const a of cand) for (const b of q) if (wd(a, b) < o.stag) ok = false;
          }
          if (ok || t === 59) { br = cand; break; }
        }
        r.br = br.slice().sort((a, b) => a - b);
      }
      const segs = [];
      for (let k = 0; k < n; k++) {
        const r = rows[k], br = r.br; r.seg0 = segs.length;
        for (let b = 0; b < br.length; b++) {
          const a0 = br[b], a1 = b + 1 < br.length ? br[b + 1] : br[0] + AL;
          segs.push({ row: k, a0, len: a1 - a0, p0: r.p0, s: r.s, i: segs.length });
        }
      }
      // 픽셀 → 줄, 줄+위치 → 조각
      const nA = vert ? H : W, nC = vert ? W : H, dA = vert ? dy : dx, dC = vert ? dx : dy;
      const rowOf = new Int32Array(nC);
      for (let q = 0; q < nC; q++) { const c = (q + 0.5) * dC; let k = 0; while (k < n - 1 && c >= rows[k + 1].p0) k++; rowOf[q] = k; }
      const segAt = rows.map(r => {
        const t = new Int32Array(nA), br = r.br;
        for (let q = 0; q < nA; q++) {
          const a = (q + 0.5) * dA; let b = br.length - 1;
          for (let z = 0; z < br.length; z++) if (a >= br[z]) b = z;
          if (a < br[0]) b = br.length - 1;
          t[q] = r.seg0 + b;
        }
        return t;
      });
      const id = new Int32Array(N), la = new Float32Array(N), lc = new Float32Array(N);
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const qa = vert ? j : i, qc = vert ? i : j, k = rowOf[qc], s = segs[segAt[k][qa]];
        let a = (qa + 0.5) * dA - s.a0; if (a < 0) a += AL; if (a >= AL) a -= AL;
        const p = j * W + i; id[p] = s.i; la[p] = a; lc[p] = (qc + 0.5) * dC - s.p0;
      }
      return { rows, segs, id, la, lc };
    }
    // 마무리: 노멀, AO, ORM 굽기
    pack() {
      const { W, H, N, dx, dy, h } = this;
      const nk = this.nk;
      const normal = new Uint8Array(N * 4);
      // normal.a = 높이 (0..1 로 늘림) — 지형 층을 높이로 섞을 때 쓴다
      let h0 = 1e9, h1 = -1e9;
      for (let p = 0; p < N; p++) { const v = h[p]; if (v < h0) h0 = v; if (v > h1) h1 = v; }
      const hs = h1 > h0 ? 255 / (h1 - h0) : 0;
      for (let j = 0; j < H; j++) {
        const jd = ((j - 1 + H) % H) * W, ju = ((j + 1) % H) * W, o = j * W;
        for (let i = 0; i < W; i++) {
          const il = (i - 1 + W) % W, ir = (i + 1) % W;
          // 소벨
          const hx = (h[jd + ir] + 2 * h[o + ir] + h[ju + ir] - h[jd + il] - 2 * h[o + il] - h[ju + il]) / (8 * dx);
          const hy = (h[ju + il] + 2 * h[ju + i] + h[ju + ir] - h[jd + il] - 2 * h[jd + i] - h[jd + ir]) / (8 * dy);
          let nx = -hx * nk, ny = -hy * nk, nz = 1;
          const l = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz); nx *= l; ny *= l; nz *= l;
          const p = (o + i) * 4;
          normal[p] = Math.round((nx * 0.5 + 0.5) * 255); normal[p + 1] = Math.round((ny * 0.5 + 0.5) * 255); normal[p + 2] = Math.round((nz * 0.5 + 0.5) * 255); normal[p + 3] = hs ? Math.round((h[o + i] - h0) * hs) : 128;
        }
      }
      // AO: 두 반경의 오목함
      const b1 = this.blur(h, this.aoR[0] / dx, 2), b2 = this.blur(h, this.aoR[1] / dx, 2);
      const ao = new Float32Array(N), D = this.aoD;
      for (let p = 0; p < N; p++) {
        const c = Math.max(0, b1[p] - h[p]) * 0.55 + Math.max(0, b2[p] - h[p]) * 0.45;
        ao[p] = 1 - this.aoK * sat(c / D);
      }
      this.ao = ao;
      if (this.post) this.post(ao);
      const albedo = new Uint8Array(N * 4), orm = new Uint8Array(N * 4), C = this.col, cd = this.cavDirt, V = this.vid;
      let sr = 0, sg = 0, sb = 0;
      for (let p = 0; p < N; p++) {
        const k = 1 - cd * (1 - ao[p]);
        const r = sat(C[p * 3] * k), g = sat(C[p * 3 + 1] * k), b = sat(C[p * 3 + 2] * k);
        albedo[p * 4] = Math.round(r * 255); albedo[p * 4 + 1] = Math.round(g * 255); albedo[p * 4 + 2] = Math.round(b * 255); albedo[p * 4 + 3] = V ? Math.round(sat(V[p]) * 255) : 255;
        sr += r; sg += g; sb += b;
        orm[p * 4] = Math.round(sat(ao[p]) * 255);
        orm[p * 4 + 1] = Math.round(sat(this.rgh[p]) * 255);
        orm[p * 4 + 2] = this.met ? Math.round(sat(this.met[p]) * 255) : 0;
        orm[p * 4 + 3] = this.ley ? Math.round((1 - sat(this.ley[p])) * 255) : 255;
      }
      let emissive = null;
      if (this.em) {
        emissive = new Uint8Array(N * 4); const E = this.em;
        for (let p = 0; p < N; p++) { emissive[p * 4] = Math.round(sat(E[p * 3]) * 255); emissive[p * 4 + 1] = Math.round(sat(E[p * 3 + 1]) * 255); emissive[p * 4 + 2] = Math.round(sat(E[p * 3 + 2]) * 255); emissive[p * 4 + 3] = 255; }
      }
      return { W, H, albedo, normal, orm, emissive, avg: [sr / N, sg / N, sb / N] };
    }
  }

  const B = {};

  // ================================ 돌 ================================
  // 성벽 석회암 마름돌. p.era: 'high'(꿀빛 고딕, 기본) | 'ancient'(창백한 큰 돌, 황동 이음새, 틈의 레이 빛) | 'early'(작고 거친 옛 돌)
  // p.dark: 그을리고 이끼 낀 판. 줄 0.32~0.45 m, 돌 0.6~1.4 m, 엇갈린 이음, 1.5~2.5 cm 들어간 줄눈, 닳은 모서리, 떨어진 표면, 층리, 철 얼룩 고리
  B.ashlar = function (c, p) {
    const { W, H, N } = c, R = rng(c.seed), dark = !!p.dark, era = p.era || 'high';
    const anc = era === 'ancient', early = era === 'early';
    const E = anc ? { row: 0.74, rowJ: 0.12, lmin: 1.2, lmax: 2.0, stag: 0.35, jw: 0.0016, jwv: 0.0006, rc: 0.003, er: [0.0004, 0.002], ce: 0.006, chip: 0.25, spall: 0.05, pil: 0.0025, ring: 0, lam: 0.25 }
      : early ? { row: 0.27, rowJ: 0.3, lmin: 0.28, lmax: 0.75, stag: 0.08, jw: 0.011, jwv: 0.006, rc: 0.014, er: [0.008, 0.026], ce: 0.045, chip: 0.85, spall: 0.4, pil: 0.007, ring: 0.1, lam: 0.3 }
        : { row: 0.4, rowJ: 0.13, lmin: 0.6, lmax: 1.4, stag: 0.22, jw: 0.0075, jwv: 0.004, rc: 0.009, er: [0.003, 0.013], ce: 0.022, chip: 0.6, spall: 0.2, pil: 0.005, ring: 0.18, lam: 0.45 };
    const pal = anc ? [['#e8e1d1', 4], ['#ded6c4', 3], ['#ece6d8', 2], ['#d9d0bc', 2], ['#e3d9c4', 2], ['#d4cab4', 1], ['#e6dccb', 1.5]]
      : early ? [['#a88f6b', 3], ['#9b8465', 3], ['#b19a77', 2], ['#8e795d', 2], ['#a39480', 1.5], ['#937f68', 1.5], ['#b8a17b', 1], ['#857463', 1]]
        : dark ? [['#8e7d64', 3], ['#7d6e5a', 3], ['#877766', 2], ['#6f6455', 2], ['#998970', 1], ['#675c4f', 1.2]]
          : [['#d0b088', 4], ['#c5a47a', 3], ['#d8bc95', 2], ['#bf9d72', 2], ['#cbaa82', 2], ['#b9986e', 1.5], ['#dec49f', 1], ['#c3a782', 1.5], ['#b29a79', 1], ['#c2b096', 0.8]];
    const L = c.rows(R, { row: E.row, rowJ: E.rowJ, lmin: E.lmin, lmax: E.lmax, scale: 1, stag: E.stag });
    const bl = L.segs.map(s => {
      const nch = R() < E.chip ? 1 + (R() * 3 | 0) : 0, chips = [];
      for (let k = 0; k < nch; k++) {
        const side = R() * 4 | 0, t = R() < 0.55 ? (R() < 0.5 ? R() * 0.12 : 1 - R() * 0.12) : R();
        const x = side === 0 || side === 2 ? t * s.len : side === 1 ? s.len : 0, y = side === 1 || side === 3 ? t * s.s : side === 2 ? s.s : 0;
        chips.push({ x, y, r: 0.025 + R() * (early ? 0.09 : 0.06), d: 0.01 + R() * 0.03 });
      }
      return {
        col: jit(hex(pickW(R, pal)), R, anc ? 0.025 : 0.045, anc ? 0.015 : 0.035), tx: R() * 2 - 1, ty: R() * 2 - 1, pil: 0.4 + R() * 0.6,
        er: E.er[0] + R() * (E.er[1] - E.er[0]) * (dark ? 1.4 : 1), ce: R() * E.ce, chips,
        spall: R() < E.spall * (dark ? 1.6 : 1) ? 0.5 + R() * 0.5 : 0, so: [R() * c.W | 0, R() * c.H | 0],
        lam: R() < E.lam ? 0.3 + R() * 0.7 : 0, lf: 5 + R() * 9, lt: (R() - 0.5) * 0.15, lp: R() * 6.28,
        ring: R() < E.ring ? 1 : 0, rcx: R() * s.len, rcy: R() * s.s, rf: 9 + R() * 8,
        pat: 0.15 + R() * 0.5, soot: R() < (dark ? 0.6 : 0.2) ? R() * 0.25 : 0, vid: R(),
      };
    });
    const nA = c.noise(0.3, 4, 11), nB = c.noise(0.07, 3, 12), nF = c.noise(0.012, 2, 13), nL = c.noise(1.2, 3, 14);
    const mortar = hex(anc ? '#b9b09f' : early ? '#8f8471' : dark ? '#6f6659' : '#9c8a6d');
    const grey = hex(anc ? '#cfcac0' : dark ? '#6c6860' : '#a59c8e'), ochre = hex('#9a6c3e'), fresh = hex(anc ? '#efe9dc' : dark ? '#9a8a70' : early ? '#bca684' : '#dcc29b');
    const brass = hex('#b8893e'), brassD = hex('#6a4a22'), verd = hex('#4f7f6a');
    const stone = new Uint8Array(N);
    c.vid = new Float32Array(N).fill(0.5);
    if (anc) c.ley = new Float32Array(N), c.met = new Float32Array(N);
    const AL = c.mw, seam = 0.0075;
    const { W: Wd, H: Hd } = c;
    for (let j = 0; j < Hd; j++) for (let i = 0; i < Wd; i++) {
      const q = j * Wd + i, s = L.segs[L.id[q]], b = bl[s.i];
      const lx = L.la[q], ly = L.lc[q], bw = s.len, bh = s.s;
      const a = nA[q], bb = nB[q], f = nF[q];
      const jw = E.jw + E.jwv * (bb * 0.5 + 0.5), rc = E.rc;
      const qx = Math.abs(lx - bw * 0.5) - (bw * 0.5 - jw - rc), qy = Math.abs(ly - bh * 0.5) - (bh * 0.5 - jw - rc);
      const d = -(Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rc);
      // 고대층: 줄(가로 이음)마다 황동 띠
      if (anc && Math.min(ly, bh - ly) < seam) {
        const t = Math.min(ly, bh - ly) / seam;
        c.h[q] = 0.0215 + 0.0008 * Math.sqrt(1 - t * t) + f * 0.0001;
        const tn = sm(0.0, 0.5, nL[q] + a * 0.5) * 0.55, vg = sm(0.42, 0.62, nB[(q + 5003) % N] + nL[q] * 0.3) * 0.8;
        let col = lerp3(brass, brassD, tn); col = lerp3(col, verd, vg);
        c.setC(q, col, 1 + f * 0.05); c.met[q] = 1 - vg * 0.8; c.rgh[q] = 0.36 + tn * 0.2 + vg * 0.4 + f * 0.03;
        continue;
      }
      let e = b.er * sat(0.2 + 0.8 * (a * 0.8 + bb * 0.6 + 0.5));
      const ex = Math.min(lx, bw - lx), ey = Math.min(ly, bh - ly);
      e += b.ce * Math.max(0, 1 - Math.hypot(ex, ey) / 0.15);
      for (const ch of b.chips) { const r = Math.hypot(lx - ch.x, ly - ch.y) + bb * 0.014 + f * 0.004; if (r < ch.r) e += ch.d * sm(ch.r, ch.r * 0.3, r); }
      const de = d - e + f * 0.0015;
      if (d > 0) {
        stone[q] = 1; c.vid[q] = b.vid;
        const u = lx / bw - 0.5, v = ly / bh - 0.5;
        // 볼록한 면 (가장자리로 갈수록 기운다)
        let fh = 0.024 + b.tx * u * 0.003 + b.ty * v * 0.002 + b.pil * (1 - 4 * u * u) * (1 - 4 * v * v) * E.pil;
        fh += a * 0.0016 + bb * 0.0009 + f * 0.00045;
        const lam = b.lam ? Math.sin((ly + lx * b.lt) * 6.2832 * b.lf + bb * 2.4 + a * 1.5 + b.lp) : 0;
        fh += lam * b.lam * 0.0003;
        let sp = 0;
        if (b.spall) {
          const sq = (((j + b.so[1]) % Hd) * Wd + (i + b.so[0]) % Wd);
          sp = sm(0.1, 0.16, nA[sq] + nB[sq] * 0.25) * b.spall;
          fh -= sp * 0.004;
        }
        const t = de <= 0 ? 0 : Math.min(1, de / (anc ? 0.008 : 0.02)), prof = 1 - (1 - t) * (1 - t);
        const fl = 0.011 + bb * 0.002 + f * 0.0008;
        c.h[q] = fl + (fh - fl) * prof;
        // 색
        let col = b.col;
        const pt = b.pat * sm(-0.35, 0.55, nL[q] + a * 0.6);
        col = lerp3(col, grey, pt * (anc ? 0.25 : 0.35));
        if (b.ring) {
          const rr = Math.hypot(lx - b.rcx, (ly - b.rcy) * 1.5) + a * 0.12 + bb * 0.03;
          const ra = sm(0.55, 0.95, Math.sin(rr * 6.2832 * b.rf)) * 0.12 * sm(0.6, 0.1, rr);
          col = lerp3(col, ochre, ra);
        }
        if (sp > 0) col = lerp3(col, fresh, sp * 0.35);
        col = lerp3(col, fresh, (1 - prof) * 0.22);
        let lum = 1 + a * 0.05 + bb * 0.04 + f * 0.045 + lam * b.lam * 0.02;
        if (f > 0.42) lum *= 1 - (f - 0.42) * 0.5;
        if (f < -0.5) lum *= 1 + (-0.5 - f) * 0.2;
        lum *= 1 - b.soot * sm(-0.4, 0.5, a + nL[q]);
        // 고대층: 옅은 결 (대리석처럼)
        if (anc) lum *= 1 - sm(0.02, 0, Math.abs(nL[q] * 0.8 + a * 0.4 - 0.12)) * 0.07;
        c.setC(q, col, lum);
        c.rgh[q] = (anc ? 0.62 : early ? 0.9 : 0.85) + bb * 0.04 + sp * 0.05 + (1 - prof) * 0.04 + f * 0.02;
      } else {
        c.h[q] = 0.0065 + bb * 0.0016 + f * 0.0009 + a * 0.0008;
        c.setC(q, mortar, 0.9 + 0.1 * f + 0.06 * a);
        c.rgh[q] = 0.96;
        // 고대층: 세로 이음 속 레이 빛 (이음 위치로 정해서 양쪽이 같다)
        if (anc) {
          const jx = lx < bw * 0.5 ? s.a0 : (s.a0 + bw) % AL;
          if ((ih(Math.round(jx * 100), s.row, c.seed) & 3) < 2 && ex < ey) {
            const m = sm(jw + 0.001, 0, ex) * (0.6 + 0.4 * sm(-0.3, 0.3, nL[q] + 0.1));
            c.ley[q] = Math.max(c.ley[q], m);
            c.mixC(q, [0.55, 0.75, 0.75], m * 0.4);
          }
        }
      }
    }
    // 지의류(연녹회색, 드물게 주황) 와 어두운 판에는 이끼
    // 지의류: 작은 덩이 몇 개가 모인 무리 (둥근 점이 되지 않게 노이즈로 가장자리를 먹는다)
    const lichens = anc ? 4 : dark ? 18 : early ? 14 : 8, lc = [hex('#a8ac94'), hex('#b4b39a'), hex('#9ea58a'), hex('#b89a55')];
    for (let k = 0; k < lichens; k++) {
      const cx = R() * c.mw, cy = R() * c.mh, col = lc[R() < 0.15 ? 3 : (R() * 3 | 0)], al = 0.25 + R() * 0.35, nb = 3 + (R() * 5 | 0);
      for (let s2 = 0; s2 < nb; s2++) {
        const r = 0.006 + R() * 0.02, ox = (R() - 0.5) * 0.08, oy = (R() - 0.5) * 0.05;
        c.stamp(cx + ox, cy + oy, r * 1.6, (q, t) => {
          if (!stone[q]) return;
          const m = sm(0.9, 0.4, t + nB[q] * 0.6 + nF[q] * 0.5) * al;
          if (m <= 0) return;
          c.mixC(q, col, m); c.h[q] += m * 0.0003; c.rgh[q] = mix(c.rgh[q], 0.95, m);
        });
      }
    }
    if (dark || early) {
      const moss = hex('#5f7a3a'), moss2 = hex('#46602c'), mk = dark ? 0 : 0.25;
      for (let q = 0; q < N; q++) {
        const m = sm(0.15 + mk, 0.45 + mk, nL[q] * 0.8 + nB[q] * 0.5 + (stone[q] ? -0.35 : 0.2));
        if (m > 0) { c.mixC(q, lerp3(moss2, moss, sat(0.5 + nF[q])), m * 0.85); c.h[q] += m * 0.002 * (0.5 + 0.5 * nF[q]); c.rgh[q] = mix(c.rgh[q], 0.97, m); }
      }
    }
    // 고대층: 레이 빛이 지나는 가는 실금 몇 개
    if (anc) {
      for (let k = 0; k < 3; k++) {
        let x = R() * c.mw, y = R() * c.mh, ang = R() * 6.28;
        for (let n = 0; n < 9; n++) {
          const L2 = 0.05 + R() * 0.12, x1 = x + Math.cos(ang) * L2, y1 = y + Math.sin(ang) * L2;
          c.line(x, y, x1, y1, q => { if (stone[q]) { c.h[q] -= 0.0012; c.ley[q] = Math.max(c.ley[q], 0.8); c.mulC(q, 0.8); } });
          x = x1; y = y1; ang += (R() - 0.5) * 1.4;
        }
      }
    }
    c.nk = anc ? 1.0 : 1.25; c.aoR = [0.01, 0.05]; c.aoD = anc ? 0.008 : 0.012; c.aoK = 0.8; c.cavDirt = dark ? 0.5 : anc ? 0.3 : 0.42;
  };

  // 막돌 쌓기: 크기 제각각, 각진 면, 두꺼운 회반죽
  B.rubble = function (c) {
    const { N } = c, R = rng(c.seed);
    const V = c.voronoi(c.cx(0.34), c.cy(0.22), { jitter: 0.75, seed: c.seed, weight: 0.5, stagger: true });
    const pal = [['#a39373', 3], ['#8f8270', 3], ['#9a9488', 2], ['#7d7566', 2], ['#b0a07e', 1.5], ['#6f675b', 1.2], ['#a89a84', 1.5]];
    const cell = new Map();
    const getCell = k => {
      let o = cell.get(k); if (o) return o;
      const r = rng(k * 7 + c.seed);
      o = { col: jit(hex(pickW(r, pal)), r, 0.07, 0.04), hgt: 0.035 + r() * 0.025, pl: [0, 1, 2].map(() => [(r() - 0.5) * 0.35, (r() - 0.5) * 0.35, r() * 0.012]), rg: 0.82 + r() * 0.1, vid: r() };
      cell.set(k, o); return o;
    };
    const nA = c.noise(0.25, 4, 21), nB = c.noise(0.05, 3, 22), nF = c.noise(0.012, 2, 23), nR = c.ridge(0.12, 3, 24);
    const mortar = hex('#9c937f');
    c.vid = new Float32Array(N).fill(0.5);
    for (let q = 0; q < N; q++) {
      const s = getCell(V.id[q]), a = nA[q], b = nB[q], f = nF[q];
      const gap = 0.012 + 0.008 * (b * 0.5 + 0.5) + Math.max(0, a) * 0.01;
      const de = V.bd[q] - gap + f * 0.002;
      if (de > 0) {
        const ox = V.ox[q], oy = V.oy[q];
        let top = 1e9; for (const P of s.pl) top = Math.min(top, s.hgt + P[0] * ox + P[1] * oy + P[2]);
        top += nR[q] * 0.006 + b * 0.002 + f * 0.0008;
        const t = Math.min(1, de / 0.035), prof = Math.sqrt(t) * (1 - (1 - t) * (1 - t)) ** 0.5;
        const fl = 0.012;
        c.h[q] = fl + (top - fl) * prof;
        let lum = 1 + a * 0.06 + b * 0.05 + f * 0.05 + (nR[q] - 0.5) * 0.1;
        if (f > 0.45) lum *= 0.88;
        c.setC(q, s.col, lum * (0.93 + 0.07 * prof));
        c.rgh[q] = s.rg + b * 0.04; c.vid[q] = s.vid;
      } else {
        c.h[q] = 0.006 + b * 0.002 + f * 0.0012 + a * 0.001;
        c.setC(q, mortar, 0.88 + 0.12 * f + 0.05 * a);
        c.rgh[q] = 0.96;
      }
    }
    c.nk = 1.2; c.aoR = [0.012, 0.06]; c.aoD = 0.02; c.aoK = 0.85; c.cavDirt = 0.5;
  };

  // 둥근 돌 포장 (안뜰): 반들반들 닳은 윗면, 흙과 이끼 낀 틈, 선택적으로 레이 빛 실금
  function stonesField(c, o) {
    const { N } = c;
    const V = c.voronoi(c.cx(o.cell), c.cy(o.cell * (o.aspect || 1)), { jitter: o.jit ?? 0.8, seed: c.seed, weight: o.weight ?? 0.3, stagger: o.stagger });
    const cache = new Map();
    const getCell = k => {
      let s = cache.get(k); if (s) return s;
      const r = rng(k * 13 + c.seed * 3);
      s = { col: jit(hex(pickW(r, o.pal)), r, o.cv ?? 0.08, 0.04), hgt: o.dome * (0.75 + r() * 0.5), tilt: [(r() - 0.5) * 0.12, (r() - 0.5) * 0.12], sp: r(), wr: r(), vid: r() };
      cache.set(k, s); return s;
    };
    const nA = c.noise(o.cell * 3, 4, c.seed + 1), nB = c.noise(o.cell * 0.5, 3, c.seed + 2), nF = c.noise(o.cell * 0.09, 2, c.seed + 3), nL = c.noise(o.cell * 10, 3, c.seed + 4);
    const gapC = hex(o.gapCol), moss = hex('#5c7638'), moss2 = hex('#3f5427');
    const R0 = o.cell * 0.42;
    const stone = new Uint8Array(N);
    c.vid = new Float32Array(N).fill(0.5);
    for (let q = 0; q < N; q++) {
      const s = getCell(V.id[q]), a = nA[q], b = nB[q], f = nF[q];
      const gap = o.gap * (1 + 0.6 * b) ;
      const de = V.bd[q] - gap + f * o.gap * 0.15;
      if (de > 0) {
        stone[q] = 1; c.vid[q] = s.vid;
        const ox = V.ox[q], oy = V.oy[q], rr = (ox * ox + oy * oy) / (R0 * R0);
        const t = Math.min(1, de / o.round), prof = Math.sqrt(1 - (1 - t) * (1 - t));
        let top = s.hgt * (1 - 0.35 * Math.min(1, rr)) + s.tilt[0] * ox + s.tilt[1] * oy + b * o.dome * 0.06 + f * o.dome * 0.025;
        c.h[q] = o.dome * 0.15 + (top - o.dome * 0.15) * prof;
        let lum = 1 + a * 0.05 + b * 0.05 + f * 0.04;
        if (o.speck) { if (f > 0.5) lum *= 0.82; else if (f < -0.55) lum *= 1.12; }
        c.setC(q, s.col, lum * (0.9 + 0.1 * prof));
        const wear = Math.pow(prof, 3) * sm(-0.2, 0.6, nL[q] + 0.3);
        c.rgh[q] = mix(o.rough, o.polish, wear) + b * 0.03;
        if (o.wearLight) c.mixC(q, [1, 0.97, 0.92], wear * o.wearLight);
      } else {
        c.h[q] = b * o.dome * 0.05 + f * o.dome * 0.05;
        c.setC(q, gapC, 0.8 + 0.25 * f + 0.1 * a);
        c.rgh[q] = 0.95;
        const m = sm(0.0, 0.35, nL[q] * 0.8 + b * 0.5 + (o.moss || 0));
        if (m > 0) { c.mixC(q, lerp3(moss2, moss, sat(0.5 + f)), m); c.h[q] += m * o.dome * 0.2 * (0.6 + 0.4 * f); }
      }
    }
    // 레이 빛: 구불구불한 노이즈 등고선이 틈을 지나갈 때만
    if (o.ley) {
      const nW = c.noise(o.cell * 9, 3, c.seed + 9);
      c.ley = new Float32Array(N);
      for (let q = 0; q < N; q++) {
        if (stone[q]) continue;
        const m = sm(0.07, 0.015, Math.abs(nW[q])) * sm(-0.2, 0.3, nL[q] + 0.2);
        c.ley[q] = m;
      }
    }
    return { V, stone };
  }
  B.cobble = function (c) {
    stonesField(c, {
      cell: 0.135, aspect: 0.85, jit: 0.7, weight: 0.3, stagger: true, gap: 0.009, round: 0.035, dome: 0.03, rough: 0.82, polish: 0.42, wearLight: 0.06, speck: 1, ley: 1,
      pal: [['#8d8579', 3], ['#7a7266', 3], ['#9b917f', 2], ['#6c665e', 2], ['#a39a88', 1.5], ['#7f8288', 1.5], ['#8a7a68', 1.5]], gapCol: '#4f4638', moss: -0.15,
    });
    c.nk = 1.15; c.aoR = [0.008, 0.035]; c.aoD = 0.018; c.aoK = 0.9; c.cavDirt = 0.45;
  };
  B.gravel = function (c) {
    stonesField(c, {
      cell: 0.03, jit: 0.9, weight: 0.6, gap: 0.0025, round: 0.008, dome: 0.008, rough: 0.85, polish: 0.7, speck: 0, cv: 0.14,
      pal: [['#8f877a', 3], ['#a59c8b', 2], ['#77706a', 2], ['#b4aa96', 1.5], ['#6a6158', 1.2], ['#9a8f7d', 2]], gapCol: '#4a4136', moss: -0.6,
    });
    c.nk = 1; c.aoR = [0.003, 0.012]; c.aoD = 0.004; c.aoK = 0.9; c.cavDirt = 0.45;
  };

  // 넓은 바닥 판석: 발길에 닳아 오목하고 반들한 면, 금, 깨진 모서리
  B.flagstone = function (c) {
    const { N, W, H } = c, R = rng(c.seed);
    const L = c.rows(R, { row: 0.8, rowJ: 0.25, lmin: 0.7, lmax: 1.4, stag: 0.15 });
    const pal = [['#9c9381', 3], ['#8a8172', 3], ['#a8a08c', 2], ['#918a7e', 2], ['#7f786c', 1.5], ['#a39682', 1.5]];
    const sl = L.segs.map(s => {
      const cracks = [];
      if (R() < 0.45) {
        let x = R() * s.len, y = R() < 0.5 ? 0 : s.s, ang = y === 0 ? Math.PI / 2 : -Math.PI / 2; ang += (R() - 0.5) * 1.2;
        const pts = [[x, y]];
        const n = 3 + (R() * 4 | 0), st = Math.max(s.len, s.s) / n;
        for (let k = 0; k < n; k++) { ang += (R() - 0.5) * 0.9; x += Math.cos(ang) * st; y += Math.sin(ang) * st; pts.push([x, y]); }
        cracks.push(pts);
      }
      return { col: jit(hex(pickW(R, pal)), R, 0.05, 0.03), tx: (R() - 0.5), ty: (R() - 0.5), dish: 0.5 + R() * 0.5, cracks, ce: R() * 0.025, wr: R(), vid: R() };
    });
    const nA = c.noise(0.4, 4, 31), nB = c.noise(0.08, 3, 32), nF = c.noise(0.012, 2, 33), nL = c.noise(1.4, 3, 34);
    const joint = hex('#5d5649');
    const crackM = new Float32Array(N);
    c.vid = new Float32Array(N).fill(0.5);
    for (let q = 0; q < N; q++) {
      const s = L.segs[L.id[q]], b = sl[s.i], lx = L.la[q], ly = L.lc[q], bw = s.len, bh = s.s;
      const a = nA[q], bb = nB[q], f = nF[q];
      const jw = 0.003, rc = 0.01;
      const qx = Math.abs(lx - bw * 0.5) - (bw * 0.5 - jw - rc), qy = Math.abs(ly - bh * 0.5) - (bh * 0.5 - jw - rc);
      const d = -(Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rc);
      const ex = Math.min(lx, bw - lx), ey = Math.min(ly, bh - ly);
      const e = 0.003 + 0.006 * sat(a + 0.5) + b.ce * Math.max(0, 1 - Math.hypot(ex, ey) / 0.12);
      const de = d - e;
      if (d > 0) {
        c.vid[q] = b.vid;
        const u = lx / bw - 0.5, v = ly / bh - 0.5;
        let fh = 0.02 + b.tx * u * 0.002 + b.ty * v * 0.002 - b.dish * (1 - 4 * u * u) * (1 - 4 * v * v) * 0.003;
        fh += a * 0.0012 + bb * 0.0005 + f * 0.0002;
        let cm = 0;
        for (const pts of b.cracks) for (let k = 0; k < pts.length - 1; k++) {
          const [x0, y0] = pts[k], [x1, y1] = pts[k + 1], ddx = x1 - x0, ddy = y1 - y0, l2 = ddx * ddx + ddy * ddy;
          const t = sat(((lx - x0) * ddx + (ly - y0) * ddy) / l2), dd = Math.hypot(lx - x0 - ddx * t, ly - y0 - ddy * t) + bb * 0.002;
          cm = Math.max(cm, sm(0.003, 0.0006, dd));
        }
        crackM[q] = cm;
        fh -= cm * 0.004;
        const t = de <= 0 ? 0 : Math.min(1, de / 0.015), prof = Math.sqrt(1 - (1 - t) * (1 - t));
        c.h[q] = 0.012 + (fh - 0.012) * prof;
        let lum = 1 + a * 0.05 + bb * 0.04 + f * 0.035;
        c.setC(q, b.col, lum * (1 - cm * 0.35));
        const worn = sm(-0.3, 0.5, nL[q] + 0.2) * prof;
        c.rgh[q] = mix(0.8, 0.5, worn) + bb * 0.04 + cm * 0.2;
        c.mixC(q, [0.78, 0.75, 0.7], worn * 0.08);
      } else {
        c.h[q] = 0.008 + bb * 0.001 + f * 0.0006;
        c.setC(q, joint, 0.85 + 0.15 * f); c.rgh[q] = 0.95; crackM[q] = 1;
      }
    }
    const nW = c.noise(3, 3, 39); c.ley = new Float32Array(N);
    for (let q = 0; q < N; q++) if (crackM[q] > 0.3) c.ley[q] = sm(0.06, 0.012, Math.abs(nW[q])) * crackM[q];
    c.nk = 1.2; c.aoR = [0.006, 0.04]; c.aoD = 0.008; c.aoK = 0.75; c.cavDirt = 0.4;
  };

  // 지붕 슬레이트: 엇갈린 줄, 아래 모서리 깨짐, 푸른 회색 변주
  B.slate = function (c) {
    const { N } = c, R = rng(c.seed);
    const L = c.rows(R, { row: 0.168, rowJ: 0.0, lmin: 0.17, lmax: 0.3, stag: 0.05 });
    const pal = [['#4a5566', 3], ['#3c4553', 3], ['#525d6c', 2], ['#444c58', 2], ['#3a414b', 1.5], ['#56606b', 1.2], ['#4b4a58', 0.8], ['#47524e', 0.7]];
    const sl = L.segs.map(s => ({
      col: jit(hex(pickW(R, pal)), R, 0.06, 0.03), rg: 0.5 + R() * 0.25, tilt: (R() - 0.5) * 0.012, th: 0.005 + R() * 0.003,
      cl: R() < 0.5 ? R() * 0.02 : 0, cr: R() < 0.5 ? R() * 0.02 : 0, bow: (R() - 0.5) * 0.004, vid: R(),
    }));
    const nA = c.noise(0.3, 3, 41), nB = c.noise(0.04, 3, 42), nF = c.noise(0.01, 2, 43, 0.5, 0.25, 1), nC = c.noise(0.06, 2, 44, 0.5, 0.3, 1);
    const under = hex('#1e2329');
    c.vid = new Float32Array(N).fill(0.5);
    for (let q = 0; q < N; q++) {
      const s = L.segs[L.id[q]], b = sl[s.i], lx = L.la[q], ly = L.lc[q], w = s.len, rh = s.s;
      const a = nA[q], bb = nB[q], f = nF[q];
      // 아래 모서리: 살짝 기울고 들쭉날쭉, 모서리 둥글게 깎임
      const u = lx / w;
      let bot = 0.002 + b.tilt * (u - 0.5) + b.bow * (4 * (u - 0.5) * (u - 0.5)) + bb * 0.0015;
      const cl = b.cl * sm(0.15, 0, u) + b.cr * sm(0.85, 1, u);
      bot += cl * 0.8;
      const side = Math.min(lx, w - lx) - 0.0018 - Math.abs(bb) * 0.0008;
      const yb = ly - bot;
      if (side > 0 && yb > 0) {
        const t = sat(yb / rh);
        const edge = sm(0, 0.0025, yb) * sm(0, 0.002, side);
        c.h[q] = (0.0015 + b.th * (1 - t) + nC[q] * 0.0004 + f * 0.00025 + a * 0.0006) * edge;
        let lum = 1 + a * 0.05 + nC[q] * 0.06 + f * 0.04;
        lum *= 1 + sm(0.012, 0, yb) * 0.08; // 닳은 아래 테두리가 조금 밝다
        c.setC(q, b.col, lum); c.vid[q] = b.vid;
        c.rgh[q] = b.rg + nC[q] * 0.08 + a * 0.05;
      } else {
        c.h[q] = -0.002 + f * 0.0002;
        c.setC(q, under, 0.9 + 0.2 * bb);
        c.rgh[q] = 0.8;
      }
    }
    // 지의류 점: 아주 드물게
    const lc = [hex('#8c947a'), hex('#a7a07a'), hex('#b08a48')];
    for (let k = 0; k < 22; k++) {
      const col = lc[R() < 0.2 ? 2 : (R() * 2 | 0)], r = 0.006 + R() * 0.018, al = 0.4 + R() * 0.4;
      c.stamp(R() * c.mw, R() * c.mh, r * 1.5, (q, t) => { const m = sm(1, 0.5, t + nB[q] * 0.4) * al; if (m > 0 && c.h[q] > 0) { c.mixC(q, col, m); c.rgh[q] = mix(c.rgh[q], 0.95, m); } });
    }
    c.nk = 1.3; c.aoR = [0.004, 0.02]; c.aoD = 0.006; c.aoK = 0.8; c.cavDirt = 0.35;
  };

  // 거친 절벽 바위: 층리, 수직 절리, 깎인 면, 지의류, 물때 줄
  B.rock = function (c) {
    const { N, W, H, dy } = c, R = rng(c.seed);
    const nA = c.noise(1.2, 5, 51), nB = c.noise(0.25, 4, 52), nF = c.noise(0.03, 2, 53), nR = c.ridge(0.8, 4, 54), nS = c.noise(0.5, 3, 55, 0.5, 0.3, 3);
    const V = c.voronoi(c.cx(1.4), c.cy(2.2), { jitter: 0.9, seed: c.seed + 5, weight: 0.4 });
    const pal = [hex('#8a8378'), hex('#7a7369'), hex('#958c7e'), hex('#6f6a62'), hex('#a0947f'), hex('#837a6c')];
    const nL = c.cy(0.45);
    const layers = []; for (let k = 0; k < nL; k++) layers.push({ off: (R() - 0.5) * 0.06, col: jit(pal[R() * pal.length | 0], R, 0.05, 0.04), hard: R() });
    const lich = [hex('#9da38a'), hex('#aaa678'), hex('#c2b48a'), hex('#7d8a5a')];
    for (let q = 0; q < N; q++) {
      const j = (q / W) | 0, y = (j + 0.5) * dy;
      const a = nA[q], b = nB[q], f = nF[q];
      const ly = (y / c.mh * nL + a * 0.6 + b * 0.15 + nL * 4) % nL, li = Math.floor(ly) % nL, lf = ly - Math.floor(ly);
      const La = layers[li];
      const step = sm(0.0, 0.08, lf) * sm(1.0, 0.9, lf);
      const crack = sm(0.06, 0.005, V.bd[q] + b * 0.03);
      let h = La.off + nR[q] * 0.08 + a * 0.05 + b * 0.02 + f * 0.004;
      h += (step - 1) * 0.03 * (0.5 + La.hard);
      h -= crack * 0.07;
      c.h[q] = h;
      let col = La.col;
      col = lerp3(col, pal[(V.id[q] * 7) % pal.length], 0.25);
      let lum = 1 + a * 0.08 + b * 0.06 + f * 0.05 + (nR[q] - 0.5) * 0.12;
      const streak = sm(0.2, 0.7, nS[q]) * 0.25;
      lum *= 1 - streak - crack * 0.4;
      c.setC(q, col, lum);
      c.rgh[q] = 0.86 + b * 0.05 + crack * 0.08;
      // 지의류 반점
      const lm = sm(0.35, 0.55, nB[(q + 3331) % N] * 0.7 + a * 0.6) * (1 - crack);
      if (lm > 0) { c.mixC(q, lich[(V.id[q] + li) % 4], lm * 0.6); c.rgh[q] = mix(c.rgh[q], 0.96, lm); }
    }
    c.nk = 1.1; c.aoR = [0.02, 0.12]; c.aoD = 0.05; c.aoK = 0.85; c.cavDirt = 0.45;
  };

  // ================================ 나무 ================================
  // 나뭇결: across(결에 수직, m), along(결 방향, m), 판 오프셋 → {dark, pore, ray}
  function woodGrain(c, o) {
    // 결 방향으로 길게 늘인 휨 노이즈와 기공 노이즈 (세로 결 기준; horiz 면 가로 결)
    const hz = !!o.horiz;
    const fAc = Math.max(1, Math.round((hz ? c.mh : c.mw) / o.warpAcross)), fAl = Math.max(1, Math.round((hz ? c.mw : c.mh) / o.warpAlong));
    const pAc = Math.max(1, Math.round((hz ? c.mh : c.mw) / o.poreAcross)), pAl = Math.max(1, Math.round((hz ? c.mw : c.mh) / o.poreAlong));
    const warp = hz ? c.noiseC(fAl, fAc, 3, o.seed) : c.noiseC(fAc, fAl, 3, o.seed);
    const pore = hz ? c.noiseC(pAl, pAc, 2, o.seed + 1) : c.noiseC(pAc, pAl, 2, o.seed + 1);
    const fine = hz ? c.noiseC(pAl * 2, pAc * 0.5 | 0 || 1, 2, o.seed + 2) : c.noiseC(pAc * 0.5 | 0 || 1, pAl * 2, 2, o.seed + 2);
    return { warp, pore, fine };
  }
  function grainAt(G, q, across, off, ringF, wk) {
    const w = G.warp[q];
    const r = (across + off) * ringF + w * wk;
    const fr = r - Math.floor(r);
    const late = Math.pow(0.5 + 0.5 * Math.cos(fr * 6.2832), 5);   // 늦은 나이테 선
    const band = 0.5 + 0.5 * Math.sin(r * 0.37 + w * 2);            // 넓은 색 띠
    const pore = sm(0.35, 0.75, G.pore[q]) ;
    return { late, band, pore, fr };
  }

  // 어두운 참나무 널빤지 (세로 결, 문짝용)
  B.oak = function (c, p) {
    const { N, W, H, dx, dy } = c, R = rng(c.seed);
    const light = !!p.light, joints = light || !!p.joints;
    const L = c.rows(R, joints ? { row: light ? 0.15 : 0.17, rowJ: 0.25, lmin: 0.55, lmax: light ? 1.0 : 1.6, stag: 0.12, vertical: 1 } : { row: 0.19, rowJ: 0.3, full: 1, vertical: 1, lmin: 1, lmax: 1 });
    const pal = light ? [['#a07850', 3], ['#b08a5e', 2], ['#8f6a45', 2], ['#a88058', 2], ['#97704a', 1.5]] : [['#5a3a24', 3], ['#4e3220', 3], ['#63422a', 2], ['#553723', 2], ['#47301f', 1.5]];
    const pl = L.segs.map(s => ({ col: jit(hex(pickW(R, pal)), R, 0.06, 0.04), off: R() * 10, rf: (light ? 160 : 140) + R() * 120, wk: 1.5 + R() * 3, ray: !light && R() < 0.45 ? 1 : 0, rg: (light ? 0.5 : 0.55) + R() * 0.12, cup: R() * 0.001, vid: R() }));
    const G = woodGrain(c, { warpAcross: 0.05, warpAlong: 0.7, poreAcross: 0.0025, poreAlong: 0.035, seed: c.seed + 3 });
    const nA = c.noise(0.4, 3, 61), nB = c.noise(0.06, 2, 62), nRay = c.noise(0.004, 2, 63, 0.5, 3, 0.6);
    const knots = []; for (let k = 0; k < (light ? 3 : 2); k++) knots.push({ x: R() * c.mw, y: R() * c.mh, r: 0.012 + R() * 0.012 });
    c.vid = new Float32Array(N);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const q = j * W + i, s = L.segs[L.id[q]], b = pl[s.i];
      const along = L.la[q], across = L.lc[q], wpl = s.s;
      const x = (i + 0.5) * dx, y = (j + 0.5) * dy;
      // 결 왜곡 (옹이)
      let kw = 0, kd = 0;
      for (const K of knots) {
        let ddx = x - K.x, ddy = y - K.y; ddx -= Math.round(ddx / c.mw) * c.mw; ddy -= Math.round(ddy / c.mh) * c.mh;
        const e = (ddx * ddx) / (K.r * K.r) + (ddy * ddy) / (K.r * K.r * 9);
        kw += Math.exp(-e * 0.5) * 2.5 * Math.sign(ddx || 1); kd = Math.max(kd, sm(1.2, 0.5, Math.sqrt((ddx * ddx + ddy * ddy * 0.3) / (K.r * K.r))));
      }
      const g = grainAt(G, q, across, b.off, b.rf * 0.01 * 0 + b.rf, b.wk + kw * 0);
      const r2 = (across + b.off) * b.rf + G.warp[q] * b.wk + kw;
      const fr = r2 - Math.floor(r2), late = Math.pow(0.5 + 0.5 * Math.cos(fr * 6.2832), 5);
      // 홈 (널빤지 사이)
      const ed = Math.min(across, wpl - across);
      const groove = sm(0.0005, 0.0035, ed);
      let endg = 1;
      if (joints) endg = sm(0.0005, 0.002, Math.min(along, s.len - along));
      c.vid[q] = b.vid;
      let h = 0.004 * groove * endg - b.cup * (1 - 4 * Math.pow(across / wpl - 0.5, 2)) ;
      h += -late * 0.00025 - g.pore * 0.0003 + nB[q] * 0.0003;
      c.h[q] = h;
      let lum = (1 - 0.28 * late) * (1 - 0.22 * g.pore) * (0.92 + 0.16 * g.band) * (1 + nA[q] * 0.08);
      if (b.ray) { const rm = sm(0.45, 0.75, nRay[q]) * 0.18; lum *= 1 + rm; }
      lum *= 1 - kd * 0.45;
      lum *= 0.55 + 0.45 * groove * endg;
      c.setC(q, b.col, lum);
      c.rgh[q] = b.rg + late * 0.06 + g.pore * 0.12 + (1 - groove) * 0.25 + nA[q] * 0.05;
    }
    c.nk = 1.2; c.aoR = [0.003, 0.015]; c.aoD = 0.003; c.aoK = 0.7; c.cavDirt = 0.35;
  };
  B.wood = function (c) { B.oak(c, { light: 1 }); };

  // 조각된 벽 판넬: 틀(세로 결 기둥, 가로 결 가로대) + 리넨폴드(주름천) 판
  B.oakPanel = function (c) {
    const { N, W, H, dx, dy, mw, mh } = c, R = rng(c.seed);
    const cols = 2, rowsN = 2, sw = 0.085, rw = 0.085;
    const pw = mw / cols, ph = mh / rowsN;
    const Gv = woodGrain(c, { warpAcross: 0.04, warpAlong: 0.5, poreAcross: 0.002, poreAlong: 0.03, seed: c.seed + 5 });
    const Gh = woodGrain(c, { warpAcross: 0.04, warpAlong: 0.5, poreAcross: 0.002, poreAlong: 0.03, seed: c.seed + 7, horiz: 1 });
    const nA = c.noise(0.3, 3, 71), nB = c.noise(0.05, 2, 72);
    const base = hex('#5b3a22'), pv = [];
    for (let k = 0; k < cols * rowsN; k++) pv.push({ col: jit(base, R, 0.06, 0.04), off: R() * 5, folds: 4 + (R() * 2 | 0) });
    const frameC = jit(base, R, 0.04, 0.03);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const q = j * W + i, x = (i + 0.5) * dx, y = (j + 0.5) * dy;
      const ci = Math.floor(x / pw), ri = Math.floor(y / ph), P = pv[ri * cols + ci];
      const lx = x - ci * pw, ly = y - ri * ph;
      // 판 안쪽 좌표
      const ix = lx - sw * 0.5, iy = ly - rw * 0.5, iw = pw - sw, ih = ph - rw;
      const inX = Math.min(ix, iw - ix), inY = Math.min(iy, ih - iy), din = Math.min(inX, inY);
      let h, lum = 1, g, rg = 0.42, col = P.col;
      if (din < 0) {
        // 틀: 세로 기둥은 세로 결, 가로대는 가로 결
        const vertical = inX < inY;
        const G = vertical ? Gv : Gh;
        const across = vertical ? x : y;
        g = grainAt(G, q, across, vertical ? 3.3 : 7.1, 180, 3);
        // 틀 안쪽 둥근 쇠시리 (ovolo)
        const m = -din; // 틀 안쪽 가장자리에서 거리
        const mould = m < 0.012 ? 0.004 + 0.006 * Math.sqrt(sat(m / 0.012)) : 0.01;
        h = 0.02 - (0.01 - mould);
        // 틀 사이 이음
        const jx = Math.min(Math.abs(lx), Math.abs(pw - lx)), jy = Math.min(Math.abs(ly), Math.abs(ph - ly));
        if (!vertical && jx < 0.0012 + 0.0) h -= 0.002;
        if (vertical && jy < 0.0012) h -= 0.002;
        col = frameC;
        lum = (1 - 0.25 * g.late) * (1 - 0.2 * g.pore) * (0.93 + 0.14 * g.band);
      } else {
        g = grainAt(Gv, q, x, P.off, 200, 2.5);
        // 리넨폴드: 가로로 주름, 위아래 끝이 물결 모양으로 접혀 끝난다
        const bev = 0.035;
        const rise = sm(0, bev, din);
        const fu = (ix / iw) * P.folds;
        const ff = fu - Math.floor(fu);
        const prof = Math.pow(Math.abs(Math.sin(ff * Math.PI)), 0.6) * 0.007 + Math.pow(Math.abs(Math.sin(ff * Math.PI * 2)), 2) * 0.0015;
        const endMargin = 0.06 + 0.03 * Math.abs(Math.cos(ff * Math.PI));
        const vEnd = Math.min(iy, ih - iy);
        const foldOn = sm(endMargin - 0.008, endMargin + 0.004, vEnd) * sm(0.03, 0.045, inX);
        h = 0.004 + 0.006 * rise + prof * foldOn;
        // 접힌 끝의 가장자리 음각선
        const edgeLine = sm(0.003, 0, Math.abs(vEnd - endMargin)) * sm(0.03, 0.045, inX);
        h -= edgeLine * 0.0015;
        lum = (1 - 0.22 * g.late) * (1 - 0.18 * g.pore) * (0.93 + 0.14 * g.band);
        lum *= 0.85 + 0.15 * (foldOn > 0.5 ? (0.6 + prof / 0.0085 * 0.4) : 1);
        rg = 0.38;
      }
      h += nB[q] * 0.0002;
      c.h[q] = h;
      c.setC(q, col, lum * (1 + nA[q] * 0.07));
      c.rgh[q] = rg + g.pore * 0.12 + nA[q] * 0.06 + nB[q] * 0.03;
    }
    c.nk = 1.35; c.aoR = [0.004, 0.025]; c.aoD = 0.005; c.aoK = 0.85; c.cavDirt = 0.55;
  };

  // ================================ 벽 / 바닥 ================================
  B.plaster = function (c) {
    const { N } = c, R = rng(c.seed);
    const nL = c.noise(1.2, 4, 81), nA = c.noise(0.3, 4, 82), nT = c.noise(0.12, 3, 83, 0.5, 2.5, 0.6), nF = c.noise(0.008, 2, 84), nCr = c.ridge(0.5, 4, 85);
    const base = hex('#d8c8a6'), lite = hex('#e3d6b8'), warm = hex('#c8b38c'), stain = hex('#b8a27a');
    for (let q = 0; q < N; q++) {
      const crack = sm(0.955, 0.985, nCr[q]) * sm(0.0, 0.3, nL[q] + 0.2);
      c.h[q] = nL[q] * 0.003 + nA[q] * 0.0012 + nT[q] * 0.0007 + nF[q] * 0.00018 - crack * 0.0008;
      let col = lerp3(base, lite, sm(-0.2, 0.6, nA[q]) * 0.6);
      col = lerp3(col, warm, sm(0.1, 0.7, nL[q]) * 0.5);
      col = lerp3(col, stain, sm(0.45, 0.8, nL[(q + 9973) % N] + nA[q] * 0.3) * 0.35);
      c.setC(q, col, (1 + nF[q] * 0.025 + nT[q] * 0.02) * (1 - crack * 0.35));
      c.rgh[q] = 0.88 + nA[q] * 0.04 + crack * 0.06;
    }
    c.nk = 1; c.aoR = [0.006, 0.05]; c.aoD = 0.004; c.aoK = 0.5; c.cavDirt = 0.3;
  };

  // 대리석 결: 비틀린 사인 띠의 0 근처가 맥이 된다 (u,v 는 타일 정규 좌표)
  function marbleField(c, o) {
    const { N, W, H } = c;
    const w1 = c.noise(c.mw / 2, 5, o.seed, 0.55), w2 = c.noise(c.mw / 6, 4, o.seed + 1, 0.5), cl = c.noise(c.mw / 3, 4, o.seed + 2);
    const veinA = new Float32Array(N), veinB = new Float32Array(N);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const q = j * W + i, u = (i + 0.5) / W, v = (j + 0.5) / H;
      const t1 = (u * o.k1[0] + v * o.k1[1]) * 6.2832 + w1[q] * o.warp + w2[q] * o.warp * 0.35;
      const t2 = (u * o.k2[0] + v * o.k2[1]) * 6.2832 + w2[q] * o.warp * 1.2 + w1[q] * 2;
      veinA[q] = sm(o.wA, 0, Math.abs(Math.sin(t1))) * sm(-0.3, 0.3, cl[q] + 0.2);
      veinB[q] = sm(o.wB, 0, Math.abs(Math.sin(t2))) * sm(-0.1, 0.5, w2[(q + 7919) % N] + 0.1);
    }
    return { veinA, veinB, cl };
  }
  B.marble = function (c) {
    const { N } = c;
    const M = marbleField(c, { seed: 91, k1: [1, 2], k2: [3, -1], warp: 5.5, wA: 0.06, wB: 0.03 });
    const nF = c.noise(0.01, 2, 95), nS = c.noise(0.3, 3, 96);
    const base = hex('#efe6d5'), cloud = hex('#e1d4be'), vein = hex('#8f877b'), gold = hex('#b8975f'), vein2 = hex('#a9a094');
    for (let q = 0; q < N; q++) {
      let col = lerp3(base, cloud, sm(-0.4, 0.6, M.cl[q]) * 0.7);
      col = lerp3(col, gold, sm(0.2, 0.9, M.veinA[q] * 1.4) * 0.35 * sm(0.1, 0.6, nS[q] + 0.3));
      col = lerp3(col, vein, M.veinA[q] * 0.75);
      col = lerp3(col, vein2, M.veinB[q] * 0.5);
      c.setC(q, col, 1 + nF[q] * 0.012);
      c.h[q] = -M.veinA[q] * 0.00015 + nF[q] * 0.00002;
      c.rgh[q] = 0.1 + M.veinA[q] * 0.08 + sm(0.2, 0.7, nS[q]) * 0.07;
    }
    c.nk = 0.6; c.aoR = [0.003, 0.02]; c.aoD = 0.002; c.aoK = 0.2; c.cavDirt = 0.1;
  };

  // 흑백 대리석 바둑판 (0.6m 칸), 얇은 줄눈, 칸마다 살짝 다른 높이 → 반사가 깨진다
  B.checker = function (c) {
    const { N, W, H, dx, dy } = c, R = rng(c.seed);
    const n = Math.max(2, Math.round(c.mw / 0.6)); const cs = c.mw / n;
    const Mw = marbleField(c, { seed: 101, k1: [1, 2], k2: [2, -1], warp: 5, wA: 0.05, wB: 0.025 });
    const Mb = marbleField(c, { seed: 111, k1: [2, 1], k2: [1, -3], warp: 6, wA: 0.03, wB: 0.02 });
    const nF = c.noise(0.01, 2, 105), nS = c.noise(0.5, 4, 106), nB = c.noise(0.05, 2, 107);
    const tiles = []; for (let k = 0; k < n * n; k++) tiles.push({ k: 1 + (R() - 0.5) * 0.06, tx: (R() - 0.5) * 0.0012, ty: (R() - 0.5) * 0.0012 });
    const W0 = hex('#ece4d4'), Wc = hex('#ddd2c0'), Wv = hex('#97907f'), Bk = hex('#1c1b1f'), Bc = hex('#2a282c'), Bv = hex('#a8a396'), grout = hex('#6a645a');
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const q = j * W + i, x = (i + 0.5) * dx, y = (j + 0.5) * dy;
      const ti = Math.floor(x / cs), tj = Math.floor(y / cs), T = tiles[tj * n + ti];
      const lx = x - ti * cs, ly = y - tj * cs, ed = Math.min(lx, cs - lx, ly, cs - ly);
      const white = (ti + tj) % 2 === 0;
      if (ed < 0.0012) { c.h[q] = -0.0006; c.setC(q, grout, 0.9 + 0.1 * nF[q]); c.rgh[q] = 0.85; continue; }
      const bev = sm(0.0012, 0.003, ed);
      let col;
      if (white) { col = lerp3(W0, Wc, sm(-0.4, 0.6, Mw.cl[q]) * 0.6); col = lerp3(col, Wv, Mw.veinA[q] * 0.7); col = lerp3(col, Wv, Mw.veinB[q] * 0.35); }
      else { col = lerp3(Bk, Bc, sm(-0.3, 0.6, Mb.cl[q]) * 0.7); col = lerp3(col, Bv, Mb.veinA[q] * 0.55); col = lerp3(col, Bv, Mb.veinB[q] * 0.3); }
      c.setC(q, col, T.k * (1 + nF[q] * 0.012));
      c.h[q] = (T.tx * (lx / cs - 0.5) + T.ty * (ly / cs - 0.5)) * bev + 0.0002 * bev;
      const scuff = sm(0.1, 0.6, nS[q]) * 0.18 + sm(0.3, 0.7, nB[q]) * 0.05;
      c.rgh[q] = 0.08 + scuff + (white ? Mw.veinA[q] : Mb.veinA[q]) * 0.05;
    }
    c.nk = 0.8; c.aoR = [0.002, 0.01]; c.aoD = 0.0012; c.aoK = 0.5; c.cavDirt = 0.2;
  };

  // ================================ 금속 ================================
  function metalBase(c, o) {
    const { N } = c;
    c.met = new Float32Array(N).fill(1);
    const nL = c.noise(0.12, 4, o.seed), nA = c.noise(0.04, 3, o.seed + 1), nBr = c.noise(0.02, 2, o.seed + 2, 0.5, 6, 0.25), nF = c.noise(0.004, 2, o.seed + 3);
    const V = c.voronoi(c.cx(o.dent), c.cy(o.dent), { jitter: 0.9, seed: o.seed + 4, weight: 0.4 });
    const base = hex(o.col), tarn = hex(o.tarn);
    for (let q = 0; q < N; q++) {
      const dent = -Math.pow(1 - sat(V.bd[q] / (V.cw * 0.5)), 2) * o.dentH;
      c.h[q] = dent + nA[q] * o.dentH * 0.3 + nBr[q] * 0.00003;
      const tn = sm(o.tarnT, o.tarnT + 0.35, nL[q] + nA[q] * 0.3) * o.tarnA;
      c.setC(q, lerp3(base, tarn, tn), 1 + nBr[q] * 0.03 + nA[q] * 0.03);
      const smudge = sm(0.0, 0.6, nA[(q + 4099) % N] + nL[q] * 0.5);
      c.rgh[q] = o.r0 + (o.r1 - o.r0) * smudge + nBr[q] * 0.04 + tn * 0.15 + nF[q] * 0.02;
    }
    return { nL, nA, nF };
  }
  B.brass = function (c) {
    metalBase(c, { seed: 121, col: '#c8a04a', tarn: '#7d6230', tarnT: 0.25, tarnA: 0.6, r0: 0.3, r1: 0.46, dent: 0.03, dentH: 0.00025 });
    c.nk = 1; c.aoR = [0.003, 0.02]; c.aoD = 0.0004; c.aoK = 0.6; c.cavDirt = 0.3;
  };
  B.gold = function (c) {
    metalBase(c, { seed: 131, col: '#e2bc63', tarn: '#a8813a', tarnT: 0.35, tarnA: 0.4, r0: 0.2, r1: 0.34, dent: 0.05, dentH: 0.00015 });
    c.nk = 1; c.aoR = [0.003, 0.02]; c.aoD = 0.0004; c.aoK = 0.6; c.cavDirt = 0.35;
  };
  B.iron = function (c) {
    const { N } = c;
    const n = metalBase(c, { seed: 141, col: '#323238', tarn: '#26262b', tarnT: -0.2, tarnA: 0.7, r0: 0.55, r1: 0.72, dent: 0.025, dentH: 0.0006 });
    const rust = hex('#5e3b25'), rust2 = hex('#7a4a2a');
    const nR = c.noise(0.03, 3, 147);
    for (let q = 0; q < N; q++) {
      const m = sm(0.3, 0.55, nR[q] + n.nL[q] * 0.5);
      if (m > 0) { c.mixC(q, lerp3(rust, rust2, sat(0.5 + n.nF[q])), m); c.met[q] = 1 - m; c.rgh[q] = mix(c.rgh[q], 0.92, m); c.h[q] += m * 0.0003 * (1 + n.nF[q]); }
    }
    c.nk = 1.2; c.aoR = [0.003, 0.02]; c.aoD = 0.0006; c.aoK = 0.6; c.cavDirt = 0.3;
  };

  // ================================ 유리 ================================
  // 납 테두리 마름모 창유리 (밤에 안쪽에서 호박빛)
  B.glassWarm = function (c) {
    const { N, W, H, dx, dy, mw, mh } = c, R = rng(c.seed);
    const nx = Math.max(1, Math.round(mw / 0.12)), ny = Math.max(1, Math.round(mh / 0.16));
    const a = mw / nx, b = mh / ny, gl = Math.hypot(1 / a, 1 / b);
    const nW = c.noise(0.05, 3, 151), nF = c.noise(0.01, 2, 152), nL = c.noise(0.2, 3, 153);
    c.met = new Float32Array(N); c.em = new Float32Array(N * 3);
    const lead = hex('#3a3a3e'), patina = hex('#5c5d5e'), amberA = hex('#4a3016');
    const panes = new Map();
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const q = j * W + i, x = (i + 0.5) * dx, y = (j + 0.5) * dy;
      const U = x / a + y / b, Vv = x / a - y / b;
      const du = Math.abs(U - Math.round(U)) / gl, dv = Math.abs(Vv - Math.round(Vv)) / gl, d = Math.min(du, dv);
      const hw = 0.0045;
      if (d < hw) {
        const t = d / hw;
        c.h[q] = 0.003 * Math.sqrt(1 - t * t) + 0.0005;
        c.setC(q, lerp3(lead, patina, sm(0.1, 0.6, nL[q]) * 0.6), 0.9 + 0.2 * nF[q]);
        c.rgh[q] = 0.5 + nF[q] * 0.08; c.met[q] = 0.35;
        const o = q * 3; c.em[o] = c.em[o + 1] = c.em[o + 2] = 0;
      } else {
        const key = ((Math.floor(U) % (nx + ny) + (nx + ny)) % (nx + ny)) * 1000 + ((Math.floor(Vv) % (nx + ny) + (nx + ny)) % (nx + ny));
        let P = panes.get(key);
        if (!P) { const r = rng(key * 31 + 7); P = { k: 0.75 + r() * 0.45, hue: (r() - 0.5) * 0.12, tl: [(r() - 0.5) * 0.004, (r() - 0.5) * 0.004] }; panes.set(key, P); }
        c.h[q] = nW[q] * 0.0005 + P.tl[0] * x * 0 + nF[q] * 0.00004;
        c.setC(q, amberA, 0.9 + 0.2 * nW[q]);
        c.rgh[q] = 0.06 + sm(0.3, 0.7, nL[q]) * 0.06;
        const k = P.k * (0.85 + 0.25 * nW[q] + 0.1 * nL[q]) * sm(0, 0.004, d - hw);
        const o = q * 3; c.em[o] = sat(k * (1 + P.hue)); c.em[o + 1] = k * 0.93; c.em[o + 2] = k * (0.82 - P.hue * 1.5); // 색은 재질의 emissive(#FFB866)가 준다
      }
    }
    // 기포
    for (let k = 0; k < 90; k++) c.stamp(R() * mw, R() * mh, 0.0012 + R() * 0.0015, (q, t) => { if (c.met[q] === 0) { c.h[q] += 0.0002 * (1 - t); const o = q * 3; c.em[o] = sat(c.em[o] * 1.15); c.em[o + 1] *= 1.15; c.em[o + 2] *= 1.15; } });
    c.nk = 1.2; c.aoR = [0.002, 0.01]; c.aoD = 0.002; c.aoK = 0.5; c.cavDirt = 0.2;
  };

  // 스테인드글라스: 가운데 원형 메달리온(여덟 잎 장미) + 모서리 반원 + 보로노이 바탕, 납 선, 그리자유 붓질
  B.glassStained = function (c) {
    const { N, W, H, dx, dy, mw, mh } = c;
    const V = c.voronoi(c.cx(0.075), c.cy(0.075), { jitter: 0.85, seed: c.seed + 1, weight: 0.3 });
    const ids = new Int32Array(N), kind = new Uint8Array(N);
    const TAU = Math.PI * 2;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const q = j * W + i, x = (i + 0.5) * dx / mw, y = (j + 0.5) * dy / mh;
      const ux = x - 0.5, uy = y - 0.5, r = Math.hypot(ux, uy), th = Math.atan2(uy, ux);
      const cxw = x < 0.5 ? x : x - 1, cyw = y < 0.5 ? y : y - 1, rc = Math.hypot(cxw, cyw), thc = Math.atan2(cyw, cxw);
      let id, k;
      if (r < 0.065) { id = 1; k = 1; }
      else if (r < 0.27) {
        const pet = 0.27 * (0.5 + 0.5 * Math.pow(Math.abs(Math.cos(th * 4)), 0.8));
        const sec = Math.floor(((th + Math.PI / 8) / TAU + 1) * 8) % 8;
        if (r < pet) { id = 10 + sec; k = 2; } else { id = 20 + Math.floor(((th) / TAU + 1) * 8) % 8; k = 3; }
      } else if (r < 0.3) { id = 30 + Math.floor(((th / TAU) + 1) * 16) % 16; k = 4; }
      else if (r < 0.318) {
        const n = 36, sec = ((th / TAU) + 1) * n, fs = sec - Math.floor(sec), pr = Math.hypot((fs - 0.5) * TAU * 0.309 / n, r - 0.309);
        if (pr < 0.0075) { id = 60 + Math.floor(sec) % n; k = 5; } else { id = 59; k = 6; }
      } else if (r < 0.36) { id = 100 + Math.floor(((th / TAU) + 1) * 24) % 24; k = 7; }
      else if (rc < 0.17) {
        const leaf = 0.17 * (0.45 + 0.55 * Math.pow(Math.abs(Math.sin(thc * 2)), 1.5));
        if (rc < 0.04) { id = 200; k = 8; }
        else if (rc < leaf) { id = 210 + Math.floor(((thc / TAU) + 1) * 4 + 0.5) % 4; k = 9; }
        else { id = 220 + Math.floor(((thc / TAU) + 1) * 8) % 8; k = 10; }
      } else { id = 1000 + V.id[q]; k = 11; }
      ids[q] = id; kind[q] = k;
    }
    const ed = c.edgeDist(ids);
    const nW = c.noise(0.08, 3, 161), nS = c.noise(0.02, 2, 162, 0.5, 0.3, 1), nF = c.noise(0.006, 2, 163), nP = c.noise(0.05, 3, 164);
    const PAL = {
      1: [['#2f8a4e', 1]], 2: [['#e2a238', 3], ['#d88f2a', 2]], 3: [['#24408f', 2], ['#3a2a7a', 1]], 4: [['#a3182c', 1]], 5: [['#efe6c8', 1]], 6: [['#24408f', 1]],
      7: [['#1d3f8c', 2], ['#20509a', 1]], 8: [['#e2a238', 1]], 9: [['#2f7a46', 2], ['#3b8a3a', 1]], 10: [['#a3182c', 2], ['#8a1530', 1]],
      11: [['#1d3a86', 5], ['#26489a', 3], ['#9b1b2a', 1.2], ['#d9cfae', 0.8], ['#5a2d7a', 0.8], ['#2a6a5a', 0.5]],
    };
    c.met = new Float32Array(N); c.em = new Float32Array(N * 3);
    const lead = hex('#2c2c30'), pieceCol = new Map();
    const hwPx = 0.0035 / dx;
    for (let q = 0; q < N; q++) {
      const d = ed[q];
      if (d < hwPx) {
        const t = d / hwPx;
        c.h[q] = 0.0025 * Math.sqrt(1 - t * t) + 0.0005;
        c.setC(q, lead, 0.9 + 0.15 * nF[q]); c.rgh[q] = 0.55; c.met[q] = 0.35;
        continue;
      }
      let P = pieceCol.get(ids[q]);
      if (!P) { const r = rng(ids[q] * 17 + 5); const pc = hex(pickW(r, PAL[kind[q]])); P = { c: jit(pc, r, 0.18, 0.06), paint: r() < 0.35 }; pieceCol.set(ids[q], P); }
      const streak = 0.82 + 0.3 * (nS[q] * 0.5 + 0.5) + nW[q] * 0.12;
      // 그리자유: 노이즈 등고선을 따라 그린 어두운 붓선
      let paint = 0;
      if (P.paint || kind[q] === 2 || kind[q] === 9) {
        paint = sm(0.04, 0.012, Math.abs(nP[q] - 0.1)) * 0.75;
        if (kind[q] === 2) { const ux = (q % W + 0.5) / W - 0.5, uy = (((q / W) | 0) + 0.5) / H - 0.5, th = Math.atan2(uy, ux); paint = Math.max(paint * 0.4, sm(0.012, 0.003, Math.abs(Math.sin((th + Math.PI / 8) * 4 - Math.PI / 2)) * Math.hypot(ux, uy)) * 0.8); }
      }
      const edgeDark = sm(hwPx, hwPx + 4, d);
      const k = streak * (1 - paint) * (0.65 + 0.35 * edgeDark);
      const o = q * 3;
      c.em[o] = P.c[0] * k; c.em[o + 1] = P.c[1] * k; c.em[o + 2] = P.c[2] * k;
      c.setC(q, P.c, 0.28 * k);
      c.h[q] = nW[q] * 0.0004 + nF[q] * 0.00005;
      c.rgh[q] = 0.08 + paint * 0.3 + sm(0.2, 0.6, nW[q]) * 0.05;
    }
    c.nk = 1.1; c.aoR = [0.002, 0.008]; c.aoD = 0.0015; c.aoK = 0.5; c.cavDirt = 0.2;
  };

  // ================================ 천 / 종이 / 가죽 ================================
  // 깊은 붉은 카펫: u 가 폭 전체 (양쪽 끝에 금빛 테두리), v 로 반복
  B.carpet = function (c) {
    const { N, W, H, dx, dy, mw, mh } = c;
    const nF = c.noise(0.004, 2, 171), nP = c.noise(0.06, 2, 172, 0.5, 1, 0.4), nL = c.noise(0.4, 3, 173), nM = c.noise(0.02, 2, 174);
    const red = hex('#6e1a1e'), red2 = hex('#561417'), dark = hex('#3a0e10'), gold = hex('#b8913e'), gold2 = hex('#8f6c2c'), ivory = hex('#d6c69c'), navy = hex('#1e2340');
    const per = mh / Math.max(1, Math.round(mh / 0.16)), fper = mh / Math.max(1, Math.round(mh / 0.4));
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const q = j * W + i, x = (i + 0.5) * dx, y = (j + 0.5) * dy;
      const e = Math.min(x, mw - x);   // 가장자리에서 거리
      let col;
      if (e < 0.025) col = dark;
      else if (e < 0.11) {
        // 금빛 띠 안에 사엽(四葉) 무늬 사슬
        const bx = (e - 0.0675) / 0.04, by = ((y % per) / per - 0.5) * 2 * (per / 0.08);
        const r = Math.hypot(bx, by), th = Math.atan2(by, bx);
        const quat = 0.55 + 0.25 * Math.abs(Math.cos(th * 2));
        const inner = r < quat * 0.9 ? 1 : 0;
        const ring = sm(0.1, 0.0, Math.abs(r - quat * 0.9));
        col = gold;
        if (inner) col = r < 0.22 ? gold : red;
        col = lerp3(col, gold2, ring * 0.9);
        if (e < 0.031 || e > 0.104) col = gold2;
      } else if (e < 0.118) col = dark;
      else if (e < 0.126) col = gold;
      else {
        // 바탕: 마름모 격자의 다마스크 무늬
        const fx = x - mw / 2, fy = y;
        const cw = 0.2, ch = fper;
        let u = fx / cw, v = fy / ch;
        const gu = u - Math.round(u), gv = v - Math.round(v);
        const hu = u - Math.floor(u) - 0.5, hv = v - Math.floor(v) - 0.5;
        // 주 메달리온 (격자점) 과 보조 장식 (칸 중심)
        const m1 = Math.abs(gu) * 1.0 + Math.abs(gv) * 1.0;
        const r1 = Math.hypot(gu, gv * 0.9), a1 = Math.atan2(gv, gu);
        const lobe = 0.32 + 0.08 * Math.cos(a1 * 4);
        const med = r1 < lobe ? 1 : 0, medEdge = sm(0.03, 0, Math.abs(r1 - lobe));
        const dia = sm(0.03, 0, Math.abs(m1 - 0.48));
        const r2 = Math.hypot(hu, hv), small = sm(0.03, 0, Math.abs(r2 - 0.1)) + (r2 < 0.04 ? 1 : 0);
        col = red;
        if (med) col = lerp3(red2, red, sm(0.05, 0.25, r1));
        col = lerp3(col, gold2, Math.max(medEdge * 0.8, dia * 0.35));
        if (r1 < 0.06) col = gold;
        if (r1 < 0.025) col = navy;
        col = lerp3(col, gold2, sat(small) * 0.7);
        if (Math.abs(r2 - 0.1) < 0.012 && Math.abs(Math.cos(Math.atan2(hv, hu) * 4)) > 0.9) col = ivory;
      }
      // 털 (파일) 결과 닳음
      const wear = sm(0.35, 0.05, Math.abs(x - mw / 2) / mw) * sm(-0.3, 0.5, nL[q]) * 0.18;
      let lum = (1 + nF[q] * 0.07 + nP[q] * 0.05 + nM[q] * 0.03);
      col = lerp3(col, [0.55, 0.42, 0.36], wear * 0.6);
      c.setC(q, col, lum);
      c.h[q] = nF[q] * 0.0004 + nP[q] * 0.0002 - wear * 0.0005;
      c.rgh[q] = 0.93 + nF[q] * 0.03;
    }
    c.nk = 1.0; c.aoR = [0.002, 0.01]; c.aoD = 0.0006; c.aoK = 0.4; c.cavDirt = 0.2;
  };

  B.velvet = function (c) {
    const { N } = c;
    const nC = c.noise(0.12, 4, 181, 0.5, 2.2, 0.5), nF = c.noise(0.003, 2, 182), nL = c.noise(0.3, 3, 183);
    const base = hex('#1d2752'), deep = hex('#141b3c');
    for (let q = 0; q < N; q++) {
      const cr = sm(-0.5, 0.6, nC[q] + nL[q] * 0.4);
      c.setC(q, lerp3(deep, base, cr), 1 + nF[q] * 0.05);
      c.h[q] = nC[q] * 0.0004 + nF[q] * 0.00004;
      c.rgh[q] = 0.7 + (1 - cr) * 0.12 + nF[q] * 0.03;
    }
    c.nk = 0.8; c.aoK = 0.3; c.cavDirt = 0.1; c.aoD = 0.0004;
  };

  B.parchment = function (c) {
    const { N } = c, R = rng(c.seed);
    const nL = c.noise(0.3, 5, 191), nA = c.noise(0.08, 3, 192), nFib = c.noise(0.01, 2, 193, 0.5, 4, 0.5), nF = c.noise(0.003, 2, 194);
    const base = hex('#e5d5ac'), blot = hex('#c9b27c'), lite = hex('#efe3c2');
    for (let q = 0; q < N; q++) {
      let col = lerp3(base, blot, sm(0.05, 0.7, nL[q]) * 0.55);
      col = lerp3(col, lite, sm(0.1, 0.6, -nA[q]) * 0.4);
      c.setC(q, col, 1 + nFib[q] * 0.04 + nF[q] * 0.025);
      c.h[q] = nL[q] * 0.0008 + nA[q] * 0.0003 + nFib[q] * 0.00004;
      c.rgh[q] = 0.82 + nA[q] * 0.05;
    }
    const fox = hex('#9a6a3a');
    for (let k = 0; k < 18; k++) { const r = 0.001 + R() * 0.004, al = 0.3 + R() * 0.4; c.stamp(R() * c.mw, R() * c.mh, r * 2, (q, t) => c.mixC(q, fox, sm(1, 0.3, t + nF[q] * 0.4) * al)); }
    c.nk = 0.8; c.aoR = [0.004, 0.03]; c.aoD = 0.0008; c.aoK = 0.3; c.cavDirt = 0.15;
  };

  B.leather = function (c) {
    const { N } = c;
    const V = c.voronoi(c.cx(0.0032), c.cy(0.0032), { jitter: 0.9, seed: c.seed, weight: 0.4 });
    const nCr = c.ridge(0.05, 3, 201), nL = c.noise(0.08, 4, 202), nF = c.noise(0.002, 2, 203);
    const base = hex('#6b4528'), dark = hex('#4a2e1a'), worn = hex('#86593a');
    for (let q = 0; q < N; q++) {
      const peb = sat(V.bd[q] / (V.cw * 0.45));
      const crease = sm(0.9, 0.98, nCr[q]);
      const h = Math.sqrt(peb) * 0.0002 - crease * 0.0004 + nL[q] * 0.0006;
      c.h[q] = h;
      let col = lerp3(base, worn, sm(0.1, 0.6, nL[q]) * 0.6);
      col = lerp3(col, dark, crease * 0.6 + (1 - peb) * 0.2);
      c.setC(q, col, 1 + nF[q] * 0.04);
      c.rgh[q] = 0.52 + (1 - peb) * 0.12 + crease * 0.12 - sm(0.2, 0.7, nL[q]) * 0.1;
    }
    c.nk = 1; c.aoR = [0.0008, 0.006]; c.aoD = 0.0003; c.aoK = 0.6; c.cavDirt = 0.3;
  };

  // 책장 한 칸: 높이 v 0..1 = 한 칸 (책은 v=0 에 선다), 금박 띠, 가죽 갈비, 제목 딱지
  B.bookSpines = function (c) {
    const { N, W, H, dx, dy, mw, mh } = c, R = rng(c.seed);
    const pal = [['#5e1d1c', 3], ['#7a2522', 2], ['#23402c', 2.5], ['#1f2a44', 2.5], ['#5a3a22', 3], ['#8a6a44', 1.5], ['#1d1b1a', 1.5], ['#4a2338', 1.2], ['#8a6a2c', 1], ['#284a4a', 1], ['#cbbb94', 0.7], ['#3d2b1c', 2]];
    const books = []; let x = 0;
    while (x < mw) {
      let w = 0.02 + Math.pow(R(), 1.6) * 0.055; if (R() < 0.07) w = 0.07 + R() * 0.03;
      const gap = R() < 0.1 ? 0.006 + R() * 0.03 : 0.0008 + R() * 0.0015;
      books.push({ w, gap }); x += w + gap;
    }
    const sc = mw / x; let p = 0;
    for (const b of books) {
      b.w *= sc; b.gap *= sc; b.x0 = p; p += b.w + b.gap;
      b.h = mh * (0.55 + Math.pow(R(), 0.7) * 0.38);
      const hexc = pickW(R, pal); b.col = jit(hex(hexc), R, 0.12, 0.04); b.vellum = hexc === '#cbbb94';
      b.leather = !b.vellum && R() < 0.6;
      const nb = b.leather ? 3 + (R() * 3 | 0) : 0; b.ribs = [];
      for (let k = 0; k < nb; k++) b.ribs.push(0.12 + (k + 0.5) / nb * 0.76);
      b.gold = !b.vellum && R() < 0.8; b.lbl = R() < 0.4 ? (R() < 0.5 ? hex('#2a1a12') : hex('#7a2522')) : null;
      b.ty = 0.62 + R() * 0.16; b.th = 0.07 + R() * 0.06; b.rg = 0.5 + R() * 0.25; b.seed = R() * 1e6 | 0;
      b.lean = 0;
    }
    const nF = c.noise(0.002, 2, 211), nA = c.noise(0.03, 3, 212), nL = c.noise(0.15, 3, 213);
    const back = hex('#1a130d'), gold = hex('#caa24e');
    c.met = new Float32Array(N);
    const col4 = new Int32Array(W);
    for (let i = 0; i < W; i++) { const xx = (i + 0.5) * dx; let k = 0; while (k < books.length - 1 && xx >= books[k + 1].x0) k++; col4[i] = k; }
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const q = j * W + i, xx = (i + 0.5) * dx, y = (j + 0.5) * dy, b = books[col4[i]];
      const lx = xx - b.x0;
      if (lx > b.w || y > b.h) {
        // 책 뒤 그늘 (깊을수록 어둡다)
        c.setC(q, back, 0.6 + 0.4 * sm(mh, mh * 0.3, y) * (0.8 + 0.2 * nA[q]));
        c.h[q] = -0.01; c.rgh[q] = 0.9; continue;
      }
      const u = lx / b.w, v = y / b.h;
      const round = Math.sqrt(Math.max(0, 1 - Math.pow(u * 2 - 1, 2)));
      let h = round * 0.004, col = b.col, rg = b.rg, met = 0;
      let lum = 0.8 + 0.2 * round;
      // 위아래 닳은 가장자리
      const capE = Math.min(v * b.h, (1 - v) * b.h);
      lum *= 1 + sm(0.012, 0.0, capE) * 0.25 + sm(0.006, 0, Math.min(lx, b.w - lx)) * 0.15;
      for (const rb of b.ribs) { const dd = Math.abs(v - rb) * b.h; if (dd < 0.005) { h += 0.0012 * Math.cos(dd / 0.005 * Math.PI / 2); lum *= 1 + 0.12 * (1 - dd / 0.005); } }
      // 금박 선
      if (b.gold) {
        const lines = b.ribs.length ? b.ribs.flatMap(r => [r - 0.012 / b.h * 1.2, r + 0.012 / b.h * 1.2]) : [0.06, 0.08, 0.92, 0.94];
        for (const ln of lines) if (Math.abs(v - ln) * b.h < 0.0011) { col = gold; met = 1; rg = 0.32; }
      }
      // 제목 딱지 / 글자
      if (Math.abs(v - b.ty) * b.h < b.th * b.h * 0.25 && u > 0.12 && u < 0.88) {
        if (b.lbl) { col = b.lbl; h -= 0.0003; }
        const tr = (v - b.ty) * b.h / 0.006, row = Math.round(tr);
        if (Math.abs(tr - row) < 0.32 && Math.abs(row) <= 1) {
          const ch = Math.floor((u - 0.12) / 0.76 * 6), hv = (Math.abs(ih(b.seed, ch * 7 + row, 3)) % 100) / 100;
          if (hv < 0.75 && b.w > 0.018) { col = b.vellum ? hex('#3a2a1e') : gold; met = b.vellum ? 0 : 1; rg = 0.35; h += 0.0002; }
        }
      }
      h += nF[q] * 0.00012 + nA[q] * 0.0002;
      c.h[q] = h;
      c.setC(q, col, lum * (1 + nF[q] * 0.05 + nL[q] * 0.06));
      c.rgh[q] = rg + nA[q] * 0.06; c.met[q] = met;
    }
    c.nk = 1.3; c.aoR = [0.002, 0.015]; c.aoD = 0.004; c.aoK = 0.8; c.cavDirt = 0.35;
  };

  B.rope = function (c) {
    const { N, W, H } = c;
    const kx = 4, ky = 3;
    const nF = c.noise(0.004, 2, 221);
    const base = hex('#a08a5e'), dark = hex('#6e5a38');
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const q = j * W + i, u = (i + 0.5) / W, v = (j + 0.5) / H;
      const t = kx * u + ky * v, s = -ky * u + kx * v;
      const ft = t - Math.floor(t);
      const prof = Math.pow(Math.sin(ft * Math.PI), 0.6);
      const fib = pn(t * 14, s * 2, 14 * 1, 2, 225) * 0.5 + pn(t * 40, s * 5, 40, 5, 226) * 0.5;
      c.h[q] = prof * 0.004 + fib * 0.0004 + nF[q] * 0.0001;
      c.setC(q, lerp3(dark, base, 0.4 + 0.6 * prof), 1 + fib * 0.12 + nF[q] * 0.05);
      c.rgh[q] = 0.88 + fib * 0.04;
    }
    c.nk = 1; c.aoR = [0.002, 0.008]; c.aoD = 0.002; c.aoK = 0.8; c.cavDirt = 0.3;
  };

  // ================================ 땅 ================================
  B.grass = function (c) {
    const { N, W, H, dx, dy, mw, mh } = c, R = rng(c.seed);
    const nL = c.noise(1.6, 4, 231), nA = c.noise(0.4, 3, 232), nF = c.noise(0.02, 2, 233), nD = c.noise(0.8, 3, 234);
    const soil = hex('#3b3224');
    for (let q = 0; q < N; q++) { c.setC(q, soil, 0.85 + 0.25 * nF[q]); c.h[q] = nF[q] * 0.002; c.rgh[q] = 0.95; }
    const greens = [hex('#5d7a32'), hex('#6f8a3a'), hex('#4b6428'), hex('#7f9442'), hex('#566f2e'), hex('#3f5622')], dry = [hex('#9a9455'), hex('#a39a62'), hex('#8a8048')];
    const nBl = Math.round(mw * mh * 3200);
    const top = new Float32Array(N).fill(-1);
    for (let k = 0; k < nBl; k++) {
      const x = R() * mw, y = R() * mh;
      const qi = (Math.floor(y / dy) % H) * W + (Math.floor(x / dx) % W);
      const dr = sm(0.0, 0.6, nD[qi] + nA[qi] * 0.3) * 0.7, lush = sm(-0.4, 0.4, nL[qi]);
      const ang = R() * Math.PI * 2, len = (0.025 + R() * 0.05) * (0.7 + 0.6 * lush);
      const x1 = x + Math.cos(ang) * len, y1 = y + Math.sin(ang) * len;
      const g = R() < dr ? dry[R() * 3 | 0] : greens[R() * greens.length | 0];
      const kb = (0.7 + R() * 0.5) * (0.85 + 0.25 * lush), base = R() * 0.004, rise = 0.01 + R() * 0.01;
      c.line(x, y, x1, y1, (q, t) => {
        const hh = base + t * rise;
        if (hh > top[q]) { top[q] = hh; c.h[q] = 0.004 + hh; c.setC(q, g, kb * (0.65 + 0.5 * t)); c.rgh[q] = 0.85 + 0.1 * (1 - t); }
      });
    }
    // 작은 꽃 (드물게)
    const fl = [hex('#efe9d2'), hex('#e6c33c'), hex('#c8b6d8')];
    for (let k = 0; k < Math.round(mw * mh * 3); k++) {
      const col = fl[R() < 0.6 ? 0 : R() < 0.8 ? 1 : 2], r = 0.004 + R() * 0.003;
      c.stamp(R() * mw, R() * mh, r, (q, t) => { c.setC(q, t < 0.35 && col === fl[0] ? fl[1] : col, 0.95); c.h[q] += 0.003; });
    }
    for (let q = 0; q < N; q++) {
      const lush = sm(-0.5, 0.5, nL[q]);
      c.mulC(q, 0.88 + 0.22 * lush + nA[q] * 0.06);
    }
    c.nk = 0.8; c.aoR = [0.006, 0.03]; c.aoD = 0.012; c.aoK = 0.8; c.cavDirt = 0.35;
  };

  B.dirt = function (c) {
    const { N, mw, mh } = c, R = rng(c.seed);
    const nL = c.noise(1.0, 4, 241), nA = c.noise(0.25, 4, 242), nB = c.noise(0.05, 3, 243), nF = c.noise(0.01, 2, 244), nCr = c.ridge(0.3, 3, 245);
    const V = c.voronoi(c.cx(0.04), c.cy(0.04), { jitter: 0.9, seed: c.seed, weight: 0.5 });
    const base = hex('#6b5841'), damp = hex('#544332'), dryc = hex('#806c52');
    for (let q = 0; q < N; q++) {
      const clod = Math.sqrt(sat(V.bd[q] / 0.008));
      const crack = sm(0.93, 0.98, nCr[q]) * sm(0, 0.4, nL[q] + 0.3);
      c.h[q] = nL[q] * 0.01 + nA[q] * 0.004 + clod * 0.002 + nB[q] * 0.001 + nF[q] * 0.0005 - crack * 0.004;
      let col = lerp3(base, damp, sm(0, -0.6, nL[q]) * 0.7);
      col = lerp3(col, dryc, sm(0.1, 0.6, nA[q] + nL[q] * 0.3) * 0.6);
      c.setC(q, col, (1 + nB[q] * 0.06 + nF[q] * 0.06) * (1 - crack * 0.3) * (0.92 + 0.08 * clod));
      c.rgh[q] = 0.9 + nB[q] * 0.04;
    }
    const pc = [hex('#8f877a'), hex('#a59c8b'), hex('#77706a'), hex('#9a8a70')];
    for (let k = 0; k < Math.round(mw * mh * 60); k++) {
      const r = 0.003 + Math.pow(R(), 2) * 0.012, col = jit(pc[R() * 4 | 0], R, 0.1, 0.03);
      c.stamp(R() * mw, R() * mh, r, (q, t) => { const dh = Math.sqrt(1 - t * t) * r * 0.6; if (0.004 + dh > c.h[q] - nL[q] * 0.01) { c.h[q] += dh * 0.8; c.setC(q, col, 0.9 + 0.15 * nF[q]); c.rgh[q] = 0.8; } });
    }
    const tw = hex('#3e2e1e');
    for (let k = 0; k < Math.round(mw * mh * 4); k++) {
      const x = R() * mw, y = R() * mh, a = R() * 6.28, L = 0.02 + R() * 0.06;
      c.line(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, q => { c.setC(q, tw, 0.9); c.h[q] += 0.0015; });
    }
    c.nk = 1; c.aoR = [0.006, 0.03]; c.aoD = 0.006; c.aoK = 0.8; c.cavDirt = 0.35;
  };

  B.moss = function (c) {
    const { N } = c;
    const V = c.voronoi(c.cx(0.06), c.cy(0.06), { jitter: 0.9, seed: c.seed, weight: 0.6 });
    const nF = c.noise(0.004, 2, 251), nA = c.noise(0.2, 3, 252), nB = c.noise(0.015, 2, 253);
    const base = hex('#4a6330'), tip = hex('#7a9444'), deep = hex('#2e3a1c'), yel = hex('#8a9a48');
    for (let q = 0; q < N; q++) {
      const cush = Math.sqrt(sat(V.bd[q] / (V.cw * 0.35)));
      const fib = nF[q] * 0.5 + nB[q] * 0.5;
      c.h[q] = cush * 0.008 + fib * 0.0015 + nA[q] * 0.003;
      let col = lerp3(deep, base, cush);
      col = lerp3(col, tip, sm(0.1, 0.7, fib + cush * 0.3) * 0.7);
      col = lerp3(col, yel, sm(0.2, 0.7, nA[q]) * 0.35);
      c.setC(q, col, 1 + nF[q] * 0.08);
      c.rgh[q] = 0.95;
    }
    c.nk = 0.9; c.aoR = [0.003, 0.02]; c.aoD = 0.004; c.aoK = 0.85; c.cavDirt = 0.3;
  };

  B.snow = function (c) {
    const { N } = c, R = rng(c.seed);
    const nL = c.noise(1.5, 4, 261), nA = c.noise(0.3, 3, 262), nF = c.noise(0.01, 2, 263);
    const base = hex('#f3f6fa'), blue = hex('#dde6f2');
    for (let q = 0; q < N; q++) {
      c.h[q] = nL[q] * 0.02 + nA[q] * 0.004 + nF[q] * 0.0003;
      c.setC(q, lerp3(base, blue, sm(0.0, -0.6, nA[q]) * 0.5), 1 + nF[q] * 0.02);
      c.rgh[q] = 0.68 + nA[q] * 0.06;
    }
    for (let k = 0; k < c.N / 260; k++) { const q = (R() * N) | 0; c.rgh[q] = 0.15; c.mulC(q, 1.05); }
    c.nk = 0.7; c.aoR = [0.01, 0.06]; c.aoD = 0.006; c.aoK = 0.25; c.cavDirt = 0.08;
  };

  // ================================ 다듬은 돌 · 지붕 금속 · 들보 · 낮의 유리 · 껍질 · 잎 · 물 ================================
  // 다듬은 석회암 (몰딩·창틀·기둥·물끊기): 줄눈 없음, 고운 결, 끌 자국 다발, 옅은 층리, 작은 구멍
  B.trim = function (c, p) {
    const { N, W, H, dx, dy, mw, mh } = c, R = rng(c.seed);
    const nL = c.noise(0.9, 4, 301), nA = c.noise(0.22, 4, 302), nB = c.noise(0.05, 3, 303), nF = c.noise(0.008, 2, 304), nP = c.noise(0.4, 3, 306);
    const base = hex(p.col || '#d4b78e'), warm = hex('#c29f72'), pale = hex('#e0caa6'), grey = hex('#ab9f8c');
    // 끌 자국: 비스듬한 가는 줄 (이음매 없게 정수 주기)
    const ang = 1.15 + (R() - 0.5) * 0.3, kx = Math.round(80 * mw * Math.cos(ang)), ky = Math.round(80 * mh * Math.sin(ang)), kb = Math.max(1, Math.round(6 * mh));
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const q = j * W + i, x = (i + 0.5) * dx, y = (j + 0.5) * dy;
      const a = nA[q], b = nB[q], f = nF[q];
      const bed = Math.sin((y / mh * kb + nL[q] * 1.2 + a * 0.4) * 6.2832);
      const tz = sm(0.0, 0.35, nP[q]);
      const tl = Math.sin((x / mw * kx + y / mh * ky + b * 3) * 6.2832) * tz;
      c.h[q] = nL[q] * 0.002 + a * 0.0009 + b * 0.0003 + f * 0.00012 + tl * 0.00012 + bed * 0.0001;
      let col = lerp3(base, warm, sm(0.05, 0.7, nL[q]) * 0.45);
      col = lerp3(col, pale, sm(0.1, 0.6, a) * 0.35);
      col = lerp3(col, grey, sm(0.35, 0.75, nP[(q + 7777) % N] + nL[q] * 0.3) * 0.3);
      c.setC(q, col, 1 + f * 0.035 + b * 0.025 + bed * 0.012 + tl * 0.015);
      c.rgh[q] = 0.8 + a * 0.04 + f * 0.02;
    }
    for (let k = 0; k < Math.round(mw * mh * 40); k++) {
      const r = 0.0015 + Math.pow(R(), 2) * 0.004;
      c.stamp(R() * mw, R() * mh, r, (q, t) => { c.h[q] -= (1 - t * t) * r * 0.5; c.mulC(q, 0.85 + 0.1 * t); });
    }
    c.nk = 1.1; c.aoR = [0.003, 0.025]; c.aoD = 0.002; c.aoK = 0.6; c.cavDirt = 0.35;
  };

  // 녹청 구리 (첨탑·돔): u 로 0.5 m 마다 세운 이음, 판마다 엇갈린 가로 이음, 이음 아래로 흘러내린 어두운 줄, 이음 등과 얼룩엔 갈색 구리
  B.copper = function (c) {
    const { N, W, H, dx, dy, mw, mh } = c, R = rng(c.seed);
    const ns = Math.max(1, Math.round(mw / 0.5)), pw = mw / ns, nr = Math.max(1, Math.round(mh / 1.0)), ph = mh / nr;
    const off = []; for (let k = 0; k < ns; k++) off.push(R() * ph);
    const pv = []; for (let k = 0; k < ns * nr; k++) pv.push({ k: 0.92 + R() * 0.16, bul: (R() - 0.5) * 0.004 });
    const nL = c.noise(0.8, 4, 311), nA = c.noise(0.15, 3, 312), nF = c.noise(0.01, 2, 313), nS = c.noise(0.05, 3, 314, 0.5, 1, 10), nP = c.noise(0.03, 2, 315);
    const verd = hex('#5e9c8c'), verdL = hex('#8cbcaa'), verdD = hex('#3f6b60'), brown = hex('#8a5a3a'), brownD = hex('#5a3a26');
    c.met = new Float32Array(N); c.vid = new Float32Array(N);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const q = j * W + i, x = (i + 0.5) * dx, y = (j + 0.5) * dy;
      const k = Math.min(ns - 1, Math.floor(x / pw)), lx = x - k * pw, sd = Math.min(lx, pw - lx);
      let yy = (y - off[k]) % ph; if (yy < 0) yy += ph;
      let rr = Math.floor((y - off[k]) / ph); rr = ((rr % nr) + nr) % nr;
      const P = pv[rr * ns + k], a = nA[q], f = nF[q];
      const sw = 0.011, ridge = sd < sw ? Math.sqrt(1 - (sd / sw) * (sd / sw)) : 0;
      const cs = Math.min(yy, ph - yy), fold = sm(0.004, 0.0, cs);
      const bul = P.bul * Math.sin(Math.PI * lx / pw) * Math.sin(Math.PI * yy / ph);
      c.h[q] = ridge * 0.016 + fold * 0.0012 + bul + nL[q] * 0.0015 + a * 0.0004 + nP[q] * 0.0002 + f * 0.0001;
      let col = lerp3(verd, verdL, sm(0.0, 0.5, nP[q] * 0.7 + a * 0.6) * 0.6);
      // 이음 아래로 흘러내린 줄 (물은 v 가 줄어드는 쪽으로 흐른다)
      const streak = sm(0.15, 0.6, nS[q]) * (0.35 + 0.65 * Math.exp(-(ph - yy) / 0.35)) + sm(0.03, 0.0, sd - sw) * 0.5 * sm(-0.2, 0.4, nS[q]);
      col = lerp3(col, verdD, sat(streak) * 0.75);
      const br = sat(ridge * sm(-0.1, 0.4, a + nL[q] * 0.5) + sm(0.42, 0.62, nL[(q + 4441) % N] + a * 0.3) * 0.8);
      col = lerp3(col, lerp3(brown, brownD, sm(0, 0.6, f + 0.3)), br);
      c.setC(q, col, P.k * (1 + f * 0.05 + a * 0.04));
      c.met[q] = 0.12 + br * 0.55;
      c.rgh[q] = 0.62 + nP[q] * 0.08 - br * 0.2 + streak * 0.05;
      c.vid[q] = (P.k - 0.92) / 0.16;
    }
    c.nk = 1.1; c.aoR = [0.004, 0.03]; c.aoD = 0.004; c.aoK = 0.7; c.cavDirt = 0.3;
  };

  // 납판 (마루덮개·물받이·낮은 지붕): u 로 0.6 m 마다 둥근 말이 이음, v 로 2 m 마다 턱, 흰 산화 얼룩, 부드러운 우그러짐
  B.lead = function (c) {
    const { N, W, H, dx, dy, mw, mh } = c;
    const ns = Math.max(1, Math.round(mw / 0.6)), pw = mw / ns, nd = Math.max(1, Math.round(mh / 2)), pd = mh / nd;
    const nL = c.noise(0.6, 4, 321), nA = c.noise(0.12, 3, 322), nF = c.noise(0.008, 2, 323), nS = c.noise(0.04, 3, 324, 0.5, 1, 8);
    const V = c.voronoi(c.cx(0.25), c.cy(0.25), { jitter: 0.9, seed: c.seed + 3, weight: 0.4 });
    const base = hex('#5d6269'), lite = hex('#7a7f86'), oxide = hex('#a9aca9'), dark = hex('#3e4248');
    c.met = new Float32Array(N);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const q = j * W + i, x = (i + 0.5) * dx, y = (j + 0.5) * dy;
      const lx = x % pw, sd = Math.min(lx, pw - lx), ry = y % pd, a = nA[q], f = nF[q];
      const rw = 0.022, roll = sd < rw ? Math.sqrt(1 - (sd / rw) * (sd / rw)) : 0;
      const drip = sm(0.012, 0.0, ry) * 0.004;
      const dent = -Math.pow(1 - sat(V.bd[q] / (V.cw * 0.5)), 2) * 0.0015;
      c.h[q] = roll * 0.026 + drip + dent + nL[q] * 0.003 + a * 0.0005 + f * 0.0001;
      let col = lerp3(base, lite, sm(-0.2, 0.5, nL[q]) * 0.5);
      const ox = sm(0.25, 0.6, a + nL[q] * 0.4 + nS[q] * 0.3);
      col = lerp3(col, oxide, ox * 0.55);
      col = lerp3(col, dark, sm(0.2, 0.7, nS[q]) * 0.35 * (1 - ox));
      c.setC(q, col, 1 + f * 0.04);
      c.met[q] = 0.45 - ox * 0.35;
      c.rgh[q] = 0.52 + ox * 0.3 + a * 0.05;
    }
    c.nk = 1; c.aoR = [0.006, 0.04]; c.aoD = 0.006; c.aoK = 0.7; c.cavDirt = 0.3;
  };

  // 바랜 들보·기둥 (반목조, 지붕 다리): 결은 u 방향, 깊은 갈라짐, 자귀로 깎은 얕은 오목, 비바람 맞은 곳은 회색
  B.timber = function (c) {
    const { N, W, H, dx, dy, mw, mh } = c, R = rng(c.seed);
    const G = woodGrain(c, { warpAcross: 0.06, warpAlong: 0.9, poreAcross: 0.003, poreAlong: 0.05, seed: c.seed + 3, horiz: 1 });
    const nL = c.noise(0.7, 4, 351), nA = c.noise(0.12, 3, 352), nF = c.noise(0.006, 2, 353);
    const base = hex('#5e4a35'), dark = hex('#3f3022'), grey = hex('#7d746a'), greyD = hex('#5c554e');
    const checks = [];
    for (let k = 0; k < Math.round(mw * mh * 5); k++) checks.push({ x: R() * mw, y: R() * mh, L: 0.2 + R() * 0.8, w: 0.0015 + R() * 0.004 });
    const nAdz = Math.max(1, Math.round(mw / 0.085)), ringF = Math.round(110 * mh) / mh;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const q = j * W + i, x = (i + 0.5) * dx, y = (j + 0.5) * dy;
      const g = grainAt(G, q, y, 2.7, ringF, 2.5);
      let ck = 0;
      for (const C of checks) {
        let ddx = x - C.x; ddx -= Math.floor(ddx / mw) * mw;
        if (ddx > C.L) continue;
        let ddy = y - C.y + G.warp[q] * 0.004; ddy -= Math.round(ddy / mh) * mh;
        const t = ddx / C.L, w = C.w * Math.pow(Math.sin(Math.PI * t), 0.7);
        if (Math.abs(ddy) < w) ck = Math.max(ck, 1 - Math.abs(ddy) / w);
      }
      let adz = x / mw * nAdz + nA[q] * 0.4; adz -= Math.floor(adz);
      const sc = (adz - 0.5) * (adz - 0.5) * 4;
      c.h[q] = sc * 0.0015 - g.late * 0.0003 - g.pore * 0.0002 + nL[q] * 0.002 + nA[q] * 0.0006 + nF[q] * 0.0001 - ck * 0.006;
      const wt = sm(-0.4, 0.6, nL[q] + nA[q] * 0.2);
      let col = lerp3(base, grey, wt * 0.4);
      col = lerp3(col, lerp3(dark, greyD, wt), g.late * 0.55 + g.pore * 0.25);
      c.setC(q, col, (1 + nF[q] * 0.05 + nA[q] * 0.05) * (1 - ck * 0.7));
      c.rgh[q] = 0.82 + wt * 0.08 + ck * 0.1 + g.pore * 0.05;
    }
    c.nk = 1.2; c.aoR = [0.003, 0.02]; c.aoD = 0.003; c.aoK = 0.8; c.cavDirt = 0.4;
  };

  // 낮의 창: 어두운 유리 마름모 + 납 창살. 판마다 살짝 기울고 부풀어 비친 하늘이 조각난다. 창살 가에 먼지
  B.glassDark = function (c) {
    const { N, W, H, dx, dy, mw, mh } = c;
    const nx = Math.max(1, Math.round(mw / 0.14)), ny = Math.max(1, Math.round(mh / 0.2));
    const a = mw / nx, b = mh / ny, gl = Math.hypot(1 / a, 1 / b), M = nx + ny;
    const nW = c.noise(0.04, 3, 361), nF = c.noise(0.01, 2, 362), nL = c.noise(0.25, 3, 363);
    c.met = new Float32Array(N);
    const lead = hex('#36373b'), patina = hex('#5d5f61'), glass = hex('#1e2430');
    const panes = new Map(), hw = 0.0055;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const q = j * W + i, x = (i + 0.5) * dx, y = (j + 0.5) * dy;
      const U = x / a + y / b, Vv = x / a - y / b;
      const du = Math.abs(U - Math.round(U)) / gl, dv = Math.abs(Vv - Math.round(Vv)) / gl, d = Math.min(du, dv);
      if (d < hw) {
        const t = d / hw;
        c.h[q] = 0.004 * Math.sqrt(1 - t * t) + 0.001;
        c.setC(q, lerp3(lead, patina, sm(0.1, 0.6, nL[q]) * 0.5), 0.9 + 0.2 * nF[q]);
        c.rgh[q] = 0.5 + nF[q] * 0.08; c.met[q] = 0.3;
        continue;
      }
      const fu = U - Math.floor(U), fv = Vv - Math.floor(Vv);
      const key = ((Math.floor(U) % M + M) % M) * 1000 + ((Math.floor(Vv) % M + M) % M);
      let P = panes.get(key);
      if (!P) { const r = rng(key * 31 + 11); P = { k: 0.85 + r() * 0.3, hue: (r() - 0.5) * 0.25, tu: (r() - 0.5) * 0.004, tv: (r() - 0.5) * 0.004, rg: r() * 0.05 }; panes.set(key, P); }
      const bul = (1 - Math.pow(2 * fu - 1, 2)) * (1 - Math.pow(2 * fv - 1, 2));
      c.h[q] = 0.001 + P.tu * (fu - 0.5) + P.tv * (fv - 0.5) + bul * 0.0008 + nW[q] * 0.0003 + nF[q] * 0.00003;
      const dust = sm(hw + 0.006, hw, d);
      c.setC(q, [glass[0] * (1 + P.hue * 0.3), glass[1] * (1 + P.hue * 0.6), glass[2] * (1 - P.hue * 0.2)], P.k * (0.95 + 0.1 * nW[q]) * (1 + dust * 0.35));
      c.rgh[q] = 0.07 + P.rg + dust * 0.25 + sm(0.3, 0.7, nL[q]) * 0.05;
    }
    c.nk = 1.2; c.aoR = [0.002, 0.01]; c.aoD = 0.002; c.aoK = 0.5; c.cavDirt = 0.2;
  };

  // 나무껍질 (줄기 u = 둘레, v = 위): 세로로 긴 등과 골, 판처럼 갈라진 겉, 골 속은 어둡고 등은 회갈색, 지의류
  B.bark = function (c, p) {
    const { N } = c;
    const nR = c.ridge(0.11, 4, 371, 1, 6), nW = c.noise(0.3, 3, 372, 0.5, 1, 3), nA = c.noise(0.06, 3, 373), nF = c.noise(0.006, 2, 374), nL = c.noise(0.4, 3, 375);
    const V = c.voronoi(c.cx(0.06), c.cy(0.22), { jitter: 0.9, seed: c.seed + 7, weight: 0.4 });
    const base = hex(p.col || '#4a3a2c'), top = hex('#6e604e'), deep = hex('#211a14'), lich = hex('#7f8c6c'), lich2 = hex('#a3a67e');
    for (let q = 0; q < N; q++) {
      const plate = sat(V.bd[q] / 0.012), a = nA[q], f = nF[q];
      const ridge = sm(0.12, 0.5, nR[q] + nW[q] * 0.2);
      c.h[q] = ridge * 0.012 + Math.sqrt(plate) * 0.002 * ridge + a * 0.002 + f * 0.0003;
      let col = lerp3(deep, base, sm(0.1, 0.5, ridge));
      col = lerp3(col, top, sm(0.55, 0.95, ridge) * 0.6 * (0.6 + 0.4 * plate));
      const lm = sm(0.35, 0.6, nL[q] + a * 0.5) * ridge;
      col = lerp3(col, a > 0.1 ? lich2 : lich, lm * 0.7);
      c.setC(q, col, (1 + f * 0.08 + a * 0.05) * (1 - (1 - plate) * 0.2 * ridge));
      c.rgh[q] = 0.9 + f * 0.04;
    }
    c.nk = 1.2; c.aoR = [0.006, 0.03]; c.aoD = 0.008; c.aoK = 0.85; c.cavDirt = 0.4;
  };

  // 잎 덩어리 겉면 (덤불·나무 잎 뭉치): 수천 장의 잎을 뒤에서 앞으로 겹쳐 찍는다, 틈은 어둡다. p.autumn 이면 단풍
  B.leaf = function (c, p) {
    const { N, mw, mh } = c, R = rng(c.seed), autumn = !!p.autumn;
    const nF = c.noise(0.005, 2, 382);
    const pal = autumn ? [['#b8652a', 3], ['#c98a2a', 3], ['#8a3a1e', 2], ['#d9a640', 2], ['#a04a22', 2], ['#6a7a34', 1], ['#7a5a26', 1]]
      : [['#3f5a2e', 3], ['#4d6a32', 3], ['#5a7034', 3], ['#6f8a3a', 2], ['#36502a', 2], ['#7d9442', 1], ['#556b38', 2]];
    const gap = hex(autumn ? '#24180e' : '#141c0e');
    for (let q = 0; q < N; q++) { c.setC(q, gap, 0.8 + 0.3 * nF[q]); c.h[q] = -0.004; c.rgh[q] = 0.95; }
    const n = Math.round(mw * mh * 1500);
    for (let k = 0; k < n; k++) {
      const z = k / n, cx = R() * mw, cy = R() * mh, ang = R() * 6.2832, L = 0.035 + R() * 0.045, Wd = L * (0.38 + R() * 0.15);
      const col = jit(hex(pickW(R, pal)), R, 0.12, 0.05), ca = Math.cos(ang), sa = Math.sin(ang), cup = 0.0015 + R() * 0.002, shade = 0.55 + 0.45 * z;
      c.stamp(cx, cy, L * 0.5, (q, t, xx, yy) => {
        const u = (xx * ca + yy * sa) / L, v = (-xx * sa + yy * ca) / (Wd * 0.5);
        const env = Math.pow(Math.max(0, Math.cos(u * Math.PI)), 0.7);
        if (Math.abs(v) >= env) return;
        const vv = v / env, rib = sm(0.12, 0.0, Math.abs(vv)) * 0.18;
        c.h[q] = z * 0.012 + cup * (1 - vv * vv) + u * 0.002;
        c.setC(q, col, shade * (0.9 + 0.2 * (u + 0.5)) * (1 - rib + nF[q] * 0.04) * (1 - 0.15 * Math.abs(vv)));
        c.rgh[q] = 0.6 + rib * 0.2;
      });
    }
    c.nk = 0.9; c.aoR = [0.004, 0.02]; c.aoD = 0.008; c.aoK = 0.8; c.cavDirt = 0.3;
  };

  // 물결 (강·호수·분수): 여러 크기의 주기 노이즈 높이. 셰이더가 두 번 다른 방향으로 흘려 겹친다
  B.water = function (c) {
    const { N } = c;
    const nA = c.noise(0.8, 4, 391), nB = c.noise(0.2, 3, 392), nF = c.noise(0.05, 2, 393);
    const deep = hex('#1f3a46'), lite = hex('#2f5560');
    for (let q = 0; q < N; q++) {
      c.h[q] = nA[q] * 0.025 + nB[q] * 0.008 + nF[q] * 0.002;
      c.setC(q, lerp3(deep, lite, sm(-0.4, 0.5, nA[q]) * 0.6), 1);
      c.rgh[q] = 0.04 + sm(0.2, 0.6, nB[q]) * 0.03;
    }
    c.nk = 1; c.aoK = 0; c.cavDirt = 0;
  };

  // ---------- 진입점 ----------
  function build(job) {
    const c = new Ctx(job);
    const fn = B[job.kind];
    if (!fn) throw new Error('TEX: unknown material ' + job.kind);
    fn(c, job.p || {});
    return c.pack();
  }
  return { build, kinds: Object.keys(B), pn, fbm };
}
