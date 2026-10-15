// 개발용: 세계 지형을 위에서 내려다본 음영 지도로 PNG 저장 + 높이 함수 성능 측정
//   node tools/heightmap.mjs [크기=512] [범위m=24000] [출력=shots/heightmap.png]
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { heightAt, regionWeights, RC } from '../src/world/heightfield.js';
import { REGIONS } from '../src/world/regions.js';

const N = +(process.argv[2] || 512);
const R = +(process.argv[3] || 24000);
const out = process.argv[4] || 'shots/heightmap.png';
mkdirSync('shots', { recursive: true });

const t0 = performance.now();
let cnt = 0;
for (let i = 0; i < 20000; i++) { heightAt(Math.random() * 30000 - 15000, Math.random() * 30000 - 15000); cnt++; }
console.log(`heightAt: ${((performance.now() - t0) * 1000 / cnt).toFixed(2)} µs/샘플`);

const H = new Float32Array(N * N);
const dom = new Uint8Array(N * N);
const w = new Float32Array(RC);
let hmin = 1e9, hmax = -1e9;
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const x = (i / (N - 1) * 2 - 1) * R, z = (j / (N - 1) * 2 - 1) * R;
  const h = heightAt(x, z, 1, w);
  H[j * N + i] = h;
  let b = 0; for (let k = 1; k < RC; k++) if (w[k] > w[b]) b = k;
  dom[j * N + i] = b;
  hmin = Math.min(hmin, h); hmax = Math.max(hmax, h);
}
console.log(`높이 범위 ${hmin.toFixed(0)} .. ${hmax.toFixed(0)} m`);

const hex = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const px = Buffer.alloc(N * (N * 3 + 1));
const cell = (2 * R) / (N - 1);
for (let j = 0; j < N; j++) {
  px[j * (N * 3 + 1)] = 0;
  for (let i = 0; i < N; i++) {
    const h = H[j * N + i];
    const hx = H[j * N + Math.min(N - 1, i + 1)] - H[j * N + Math.max(0, i - 1)];
    const hz = H[Math.min(N - 1, j + 1) * N + i] - H[Math.max(0, j - 1) * N + i];
    let nx = -hx, ny = 2 * cell, nz = -hz; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const shade = Math.max(0.25, nx * -0.5 + ny * 0.7 + nz * -0.5);
    let c;
    if (h < 0) {
      const d = Math.min(1, -h / 150);
      c = [40 * (1 - d) + 10 * d + 30, 150 * (1 - d) + 40 * d, 170 * (1 - d) + 90 * d];
    } else {
      const pal = REGIONS[dom[j * N + i]].pal;
      const base = hex(ny < 0.8 ? pal.rock : pal.grass);
      c = base.map((v) => v * shade * 1.2);
      if (h > 1100 && ny > 0.6) c = [235 * shade, 240 * shade, 250 * shade];
    }
    const o = j * (N * 3 + 1) + 1 + i * 3;
    px[o] = Math.min(255, c[0]); px[o + 1] = Math.min(255, c[1]); px[o + 2] = Math.min(255, c[2]);
  }
}
// 2 km 격자 (10 km 마다 진하게)
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const x = (i / (N - 1) * 2 - 1) * R, z = (j / (N - 1) * 2 - 1) * R;
  const gx = Math.abs(((x % 2000) + 2000) % 2000) < cell, gz = Math.abs(((z % 2000) + 2000) % 2000) < cell;
  if (gx || gz) {
    const o = j * (N * 3 + 1) + 1 + i * 3;
    const strong = (gx && Math.abs(((x % 10000) + 10000) % 10000) < cell) || (gz && Math.abs(((z % 10000) + 10000) % 10000) < cell);
    const k = strong ? 0.45 : 0.78;
    px[o] *= k; px[o + 1] *= k; px[o + 2] *= k;
  }
}
// 지역 중심 표시
for (const r of REGIONS) {
  const ci = Math.round((r.center[0] / R + 1) / 2 * (N - 1)), cj = Math.round((r.center[1] / R + 1) / 2 * (N - 1));
  for (let d = -3; d <= 3; d++) for (const [a, b] of [[ci + d, cj], [ci, cj + d]]) {
    if (a < 0 || b < 0 || a >= N || b >= N) continue;
    const o = b * (N * 3 + 1) + 1 + a * 3; px[o] = 255; px[o + 1] = 40; px[o + 2] = 40;
  }
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(px)), chunk('IEND', Buffer.alloc(0))]);
writeFileSync(out, png);
console.log('저장:', out);
