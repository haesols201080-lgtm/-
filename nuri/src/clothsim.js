// A cloth, simulated: a grid of particles joined by stretch, shear and bend constraints (XPBD in small steps:
// many substeps of one projection each, Macklin et al. 2019), under gravity, with friction, against the things it
// lies on: rounded boxes turned about y (the mattress, the pillows, the bed's frame), capsules (his arms), spheres
// (the robot), the floor, and a body height field (his trunk and legs as they lie, from his skinned mesh). Plain
// numbers in typed arrays: it runs in a worker (src/cloth.worker.js) or, where there are no workers, here.

const NONE = -1e9;

// his trunk and legs as a height field over the bed: each frame the sampled vertices of his body and clothes are
// skinned with the bone matrices (bone world x inverse bind, as three.js does) and the highest kept per cell; cells
// the samples missed are filled from their neighbours
export class BodyField {
  constructor({ x0, z0, x1, z1, C, p0, si, sw }) {
    this.x0 = x0; this.z0 = z0; this.C = C;
    this.nx = Math.ceil((x1 - x0) / C) + 1; this.nz = Math.ceil((z1 - z0) / C) + 1;
    this.H = new Float32Array(this.nx * this.nz); this.T = new Float32Array(this.nx * this.nz);
    this.p0 = p0; this.si = si; this.sw = sw; this.n = p0.length / 3;
    this.H.fill(NONE);
  }
  update(B) {
    const { H, T, p0, si, sw, nx, nz, C, x0, z0 } = this;
    H.fill(NONE);
    for (let s = 0; s < this.n; s++) {
      const X = p0[s * 3], Y = p0[s * 3 + 1], Z = p0[s * 3 + 2];
      let x = 0, y = 0, z = 0;
      for (let k = 0; k < 4; k++) {
        const w = sw[s * 4 + k]; if (w === 0) continue;
        const o = si[s * 4 + k] * 16;
        x += w * (B[o] * X + B[o + 4] * Y + B[o + 8] * Z + B[o + 12]);
        y += w * (B[o + 1] * X + B[o + 5] * Y + B[o + 9] * Z + B[o + 13]);
        z += w * (B[o + 2] * X + B[o + 6] * Y + B[o + 10] * Z + B[o + 14]);
      }
      const i = Math.round((x - x0) / C), k = Math.round((z - z0) / C);
      if (i < 0 || k < 0 || i >= nx || k >= nz) continue;
      const c = k * nx + i; if (y > H[c]) H[c] = y;
    }
    // (holes: a cell with three or more filled neighbours takes their mean)
    T.set(H);
    for (let k = 1; k < nz - 1; k++) for (let i = 1; i < nx - 1; i++) {
      const c = k * nx + i; if (H[c] !== NONE) continue;
      let s = 0, m = 0;
      for (let dk = -1; dk <= 1; dk++) for (let di = -1; di <= 1; di++) { const h = H[c + dk * nx + di]; if (h !== NONE) { s += h; m++; } }
      if (m >= 3) T[c] = s / m;
    }
    H.set(T);
  }
  // the height at (x, z): bilinear over the filled corners; NONE off his body
  at(x, z) {
    const fx = (x - this.x0) / this.C, fz = (z - this.z0) / this.C, i = Math.floor(fx), k = Math.floor(fz);
    if (i < 0 || k < 0 || i >= this.nx - 1 || k >= this.nz - 1) return NONE;
    const u = fx - i, v = fz - k, H = this.H, c = k * this.nx + i;
    let s = 0, w = 0, h;
    if ((h = H[c]) !== NONE) { const q = (1 - u) * (1 - v); s += h * q; w += q; }
    if ((h = H[c + 1]) !== NONE) { const q = u * (1 - v); s += h * q; w += q; }
    if ((h = H[c + this.nx]) !== NONE) { const q = (1 - u) * v; s += h * q; w += q; }
    if ((h = H[c + this.nx + 1]) !== NONE) { const q = u * v; s += h * q; w += q; }
    return w > 0.35 ? s / w : NONE;
  }
}

export class ClothSim {
  // nx x nz particles over [x0, x1] x [z0, z1] at height y; mass in kg; thick: how far its middle keeps off what it
  // lies on (half the quilt's thickness); compliances in m/N (0: rigid); damping per substep; mu: friction
  constructor({ nx, nz, x0, x1, z0, z1, y, mass = 2.2, thick = 0.026, stretch = 0, shear = 2e-5, bend = 0.01, damping = 0.9993, mu = 0.7, h0 = 1 / 600 }) {
    const N = this.N = nx * nz; this.nx = nx; this.nz = nz; this.thick = thick; this.damping = damping; this.mu = mu; this.h0 = h0;
    this.x = new Float32Array(N * 3); this.p = new Float32Array(N * 3); this.w = N / mass;
    for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
      const c = (k * nx + i) * 3;
      this.x[c] = x0 + (x1 - x0) * i / (nx - 1); this.x[c + 1] = y; this.x[c + 2] = z0 + (z1 - z0) * k / (nz - 1);
    }
    this.p.set(this.x);
    const A = [], Bv = [], L = [], Cm = [];
    const add = (a, b, c) => { A.push(a); Bv.push(b); Cm.push(c); L.push(Math.hypot(this.x[b * 3] - this.x[a * 3], this.x[b * 3 + 2] - this.x[a * 3 + 2])); };
    const id = (i, k) => k * nx + i;
    for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
      if (i < nx - 1) add(id(i, k), id(i + 1, k), stretch);
      if (k < nz - 1) add(id(i, k), id(i, k + 1), stretch);
    }
    for (let k = 0; k < nz - 1; k++) for (let i = 0; i < nx - 1; i++) { add(id(i, k), id(i + 1, k + 1), shear); add(id(i + 1, k), id(i, k + 1), shear); }
    for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
      if (i < nx - 2) add(id(i, k), id(i + 2, k), bend);
      if (k < nz - 2) add(id(i, k), id(i, k + 2), bend);
    }
    this.ca = Int32Array.from(A); this.cb = Int32Array.from(Bv); this.cl = Float32Array.from(L); this.cc = Float32Array.from(Cm);
    this.boxes = []; this.caps = new Float32Array(0); this.spheres = new Float32Array(0); this.floor = NONE; this.field = null;
    this.nrm = new Float32Array(N * 3);
  }
  step(dt) {
    if (!(dt > 0)) return;
    const n = Math.max(1, Math.min(30, Math.ceil(dt / this.h0))), h = dt / n;
    for (let s = 0; s < n; s++) this.substep(h);
  }
  // let it fall and come to rest (a few seconds, a little more damped)
  settle(T) {
    const d = this.damping; this.damping = 0.997;
    for (let t = 0; t < T; t += 1 / 60) { if (t > T * 0.6) this.damping = 0.999; this.step(1 / 60); }
    this.damping = d;
  }
  substep(h) {
    const x = this.x, p = this.p, N = this.N, d = this.damping, gy = -9.81 * h * h;
    for (let i = 0; i < N * 3; i += 3) {
      for (let c = 0; c < 3; c++) { const xi = x[i + c], v = (xi - p[i + c]) * d; p[i + c] = xi; x[i + c] = xi + v; }
      x[i + 1] += gy;
    }
    const ca = this.ca, cb = this.cb, cl = this.cl, cc = this.cc, w = this.w, ih2 = 1 / (h * h), M = ca.length;
    for (let c = 0; c < M; c++) {
      const i = ca[c] * 3, j = cb[c] * 3;
      const dx = x[j] - x[i], dy = x[j + 1] - x[i + 1], dz = x[j + 2] - x[i + 2], len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len < 1e-9) continue;
      const C = len - cl[c], dl = -C / (2 * w + cc[c] * ih2), s = w * dl / len;
      x[i] -= dx * s; x[i + 1] -= dy * s; x[i + 2] -= dz * s;
      x[j] += dx * s; x[j + 1] += dy * s; x[j + 2] += dz * s;
    }
    this.collide();
  }
  // push a particle out along n by pen, with friction against its motion this substep
  contact(i, nx, ny, nz, pen) {
    const x = this.x, p = this.p;
    x[i] += nx * pen; x[i + 1] += ny * pen; x[i + 2] += nz * pen;
    const dx = x[i] - p[i], dy = x[i + 1] - p[i + 1], dz = x[i + 2] - p[i + 2], dn = dx * nx + dy * ny + dz * nz;
    const tx = dx - dn * nx, ty = dy - dn * ny, tz = dz - dn * nz, tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
    if (tl < 1e-12) return;
    const k = tl < this.mu * pen ? 1 : Math.min(1, this.mu * pen / tl);
    x[i] -= tx * k; x[i + 1] -= ty * k; x[i + 2] -= tz * k;
  }
  collide() {
    const x = this.x, p = this.p, N = this.N, T = this.thick, F = this.field, boxes = this.boxes, caps = this.caps, sph = this.spheres;
    for (let i = 0; i < N * 3; i += 3) {
      // the floor
      if (x[i + 1] < this.floor + T) this.contact(i, 0, 1, 0, this.floor + T - x[i + 1]);
      // boxes (rounded; turned about y)
      for (let b = 0; b < boxes.length; b++) {
        const B = boxes[b], ox = x[i] - B.c[0], oy = x[i + 1] - B.c[1], oz = x[i + 2] - B.c[2];
        const lx = ox * B.cos - oz * B.sin, lz = ox * B.sin + oz * B.cos, ly = oy;
        const hx = B.h[0] - B.r, hy = B.h[1] - B.r, hz = B.h[2] - B.r;
        const qx = Math.abs(lx) - hx, qy = Math.abs(ly) - hy, qz = Math.abs(lz) - hz;
        if (qx > B.r + T || qy > B.r + T || qz > B.r + T) continue;
        const mx = Math.max(qx, 0), my = Math.max(qy, 0), mz = Math.max(qz, 0), out = Math.sqrt(mx * mx + my * my + mz * mz);
        const dist = out + Math.min(Math.max(qx, qy, qz), 0) - B.r;
        if (dist >= T) continue;
        let nx, ny, nz;
        if (out > 1e-9) { nx = Math.sign(lx) * mx / out; ny = Math.sign(ly) * my / out; nz = Math.sign(lz) * mz / out; }
        else if (qx >= qy && qx >= qz) { nx = Math.sign(lx) || 1; ny = 0; nz = 0; }
        else if (qy >= qz) { nx = 0; ny = Math.sign(ly) || 1; nz = 0; }
        else { nx = 0; ny = 0; nz = Math.sign(lz) || 1; }
        // (back to the world: the inverse of the turn above)
        const wx = nx * B.cos + nz * B.sin, wz = -nx * B.sin + nz * B.cos;
        this.contact(i, wx, ny, wz, T - dist);
      }
      // his trunk and legs: from above only (what hangs beside him is left be)
      if (F) {
        const hgt = F.at(x[i], x[i + 2]);
        if (hgt !== NONE && x[i + 1] < hgt + T && p[i + 1] > hgt - 0.06) this.contact(i, 0, 1, 0, hgt + T - x[i + 1]);
      }
      // his arms
      for (let c = 0; c < caps.length; c += 7) {
        const ax = caps[c], ay = caps[c + 1], az = caps[c + 2], bx = caps[c + 3] - ax, by = caps[c + 4] - ay, bz = caps[c + 5] - az, R = caps[c + 6] + T;
        const px = x[i] - ax, py = x[i + 1] - ay, pz = x[i + 2] - az, bb = bx * bx + by * by + bz * bz;
        let t = bb > 0 ? (px * bx + py * by + pz * bz) / bb : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const dx = px - bx * t, dy = py - by * t, dz = pz - bz * t, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= R * R || d2 < 1e-12) continue;
        const d = Math.sqrt(d2); this.contact(i, dx / d, dy / d, dz / d, R - d);
      }
      // the robot
      for (let c = 0; c < sph.length; c += 4) {
        const dx = x[i] - sph[c], dy = x[i + 1] - sph[c + 1], dz = x[i + 2] - sph[c + 2], R = sph[c + 3] + T, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= R * R || d2 < 1e-12) continue;
        const d = Math.sqrt(d2); this.contact(i, dx / d, dy / d, dz / d, R - d);
      }
    }
  }
  // the surface normals (up when it lies flat)
  normals() {
    const { x, nrm, nx, nz } = this;
    for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
      const a = (k * nx + Math.max(0, i - 1)) * 3, b = (k * nx + Math.min(nx - 1, i + 1)) * 3, c = (Math.max(0, k - 1) * nx + i) * 3, d = (Math.min(nz - 1, k + 1) * nx + i) * 3;
      const ux = x[b] - x[a], uy = x[b + 1] - x[a + 1], uz = x[b + 2] - x[a + 2], vx = x[d] - x[c], vy = x[d + 1] - x[c + 1], vz = x[d + 2] - x[c + 2];
      let nx_ = vy * uz - vz * uy, ny_ = vz * ux - vx * uz, nz_ = vx * uy - vy * ux; const l = Math.sqrt(nx_ * nx_ + ny_ * ny_ + nz_ * nz_) || 1;
      const o = (k * nx + i) * 3; nrm[o] = nx_ / l; nrm[o + 1] = ny_ / l; nrm[o + 2] = nz_ / l;
    }
    return nrm;
  }
}

export function prepBoxes(boxes) {
  return boxes.map((b) => ({ c: b.c, h: b.h, r: b.r || 0, cos: Math.cos(b.ry || 0), sin: Math.sin(b.ry || 0) }));
}
