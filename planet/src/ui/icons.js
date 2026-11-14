// Item & UI icons as inline SVG, drawn in one consistent style.
import { ITEMS, PARAMS } from '../sim/data.js';

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, ((n >> 16) & 255) * k)), g = Math.min(255, Math.max(0, ((n >> 8) & 255) * k)), b = Math.min(255, Math.max(0, (n & 255) * k));
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

const SHAPES = {
  ore: (c) => `<path d="M6 21 L11 9 L17 6 L25 11 L27 20 L19 27 L9 26 Z" fill="${shade(c, 0.55)}"/><path d="M11 9 L17 6 L25 11 L18 15 Z" fill="${shade(c, 1.25)}"/><path d="M18 15 L25 11 L27 20 L19 27 Z" fill="${c}"/><path d="M6 21 L11 9 L18 15 L19 27 L9 26 Z" fill="${shade(c, 0.8)}"/>`,
  plate: (c) => `<rect x="5" y="17" width="22" height="5" rx="1" fill="${shade(c, 0.7)}"/><rect x="5" y="12" width="22" height="5" rx="1" fill="${shade(c, 0.9)}"/><rect x="5" y="7" width="22" height="5" rx="1" fill="${shade(c, 1.15)}"/>`,
  glass: (c) => `<rect x="7" y="5" width="18" height="22" rx="2" fill="${c}" fill-opacity=".45" stroke="${shade(c, 1.3)}" stroke-width="1.6"/><path d="M11 10 L16 8 M11 14 L20 10" stroke="#fff" stroke-opacity=".8" stroke-width="1.4"/>`,
  ingot: (c) => `<path d="M5 20 L10 11 L27 11 L22 20 Z" fill="${shade(c, 1.15)}"/><path d="M5 20 L22 20 L22 25 L5 25 Z" fill="${shade(c, 0.75)}"/><path d="M22 20 L27 11 L27 16 L22 25 Z" fill="${shade(c, 0.55)}"/>`,
  chip: (c) => `<rect x="8" y="8" width="16" height="16" rx="2" fill="${shade(c, 0.6)}"/><rect x="11" y="11" width="10" height="10" fill="${c}"/>${[10, 14, 18, 22].map((v) => `<rect x="${v - 1}" y="4" width="2" height="4" fill="#cfd6dc"/><rect x="${v - 1}" y="24" width="2" height="4" fill="#cfd6dc"/>`).join('')}`,
  chip2: (c) => `<rect x="6" y="9" width="20" height="14" rx="2" fill="#2b3036"/><rect x="8" y="11" width="16" height="10" rx="1" fill="${c}"/><rect x="13" y="23" width="6" height="4" fill="#666"/>`,
  drop: (c) => `<path d="M16 4 C11 12 8 16 8 20 A8 8 0 0 0 24 20 C24 16 21 12 16 4 Z" fill="${c}"/><path d="M12 19 A4 4 0 0 0 15 24" stroke="#fff" stroke-opacity=".7" stroke-width="1.6" fill="none"/>`,
  leaf: (c) => `<rect x="7" y="14" width="18" height="12" rx="2" fill="#8a6a4a"/><path d="M16 15 C10 13 9 6 16 4 C23 6 22 13 16 15 Z" fill="${c}"/><path d="M16 15 L16 7" stroke="${shade(c, 0.6)}" stroke-width="1.2"/>`,
  box: (c) => `<path d="M16 5 L27 10 L27 22 L16 27 L5 22 L5 10 Z" fill="${shade(c, 0.8)}"/><path d="M16 5 L27 10 L16 15 L5 10 Z" fill="${shade(c, 1.15)}"/><path d="M16 15 L16 27" stroke="${shade(c, 0.5)}" stroke-width="1.2"/>`,
  rod: (c) => `<rect x="12" y="4" width="8" height="24" rx="4" fill="#9aa3ab"/><rect x="13.5" y="7" width="5" height="18" rx="2.5" fill="${c}"/>`,
  coil: (c) => `<ellipse cx="16" cy="16" rx="11" ry="11" fill="${shade(c, 0.6)}"/>${[10.5, 8.5, 6.5].map((r, i) => `<circle cx="16" cy="16" r="${r}" fill="none" stroke="${shade(c, 1.1 - i * 0.12)}" stroke-width="1.8"/>`).join('')}<circle cx="16" cy="16" r="4" fill="#3a3f45"/>`,
  cell: (c) => `<rect x="10" y="4" width="12" height="3" rx="1" fill="#8d959c"/><rect x="7" y="6" width="18" height="22" rx="3" fill="#2f353b"/><rect x="9" y="9" width="14" height="16" rx="2" fill="${c}"/><path d="M17 11 L13 18 L16 18 L15 23 L19 15 L16 15 Z" fill="#fff" fill-opacity=".85"/>`,
  sack: (c) => `<path d="M10 9 L22 9 L26 26 Q16 29 6 26 Z" fill="${shade(c, 0.85)}"/><path d="M10 9 Q16 5 22 9 L21 12 Q16 9 11 12 Z" fill="${shade(c, 1.2)}"/><rect x="11" y="16" width="10" height="6" rx="1" fill="${shade(c, 0.6)}"/>`,
  vial: (c) => `<rect x="12" y="3" width="8" height="4" rx="1" fill="#d6dbe0"/><path d="M12 7 L20 7 L20 12 L25 22 Q26 28 16 28 Q6 28 7 22 L12 12 Z" fill="#e8eef2" fill-opacity=".5" stroke="#cfd6dc" stroke-width="1.2"/><path d="M9 21 L23 21 Q24 27 16 27 Q8 27 9 21 Z" fill="${c}"/>`,
  cloth: (c) => `<path d="M11 5 L16 8 L21 5 L28 10 L25 15 L22 13 L22 27 L10 27 L10 13 L7 15 L4 10 Z" fill="${c}"/><path d="M16 8 L16 27" stroke="${shade(c, 0.7)}" stroke-width="1.1"/><path d="M11 5 L16 8 L21 5" stroke="${shade(c, 1.3)}" stroke-width="1.4" fill="none"/>`,
  fruit: (c) => `<circle cx="12" cy="19" r="7" fill="${c}"/><circle cx="21" cy="18" r="6.5" fill="${shade(c, 0.82)}"/><path d="M16 11 C16 8 18 6 20 5" stroke="#6a4a2a" stroke-width="1.6" fill="none"/><path d="M17 9 C20 6 24 7 25 9 C22 11 19 11 17 9 Z" fill="#5aa04a"/><circle cx="10" cy="17" r="2" fill="#fff" fill-opacity=".35"/>`,
  canister: (c) => `<rect x="10" y="6" width="12" height="21" rx="5" fill="${shade(c, 0.85)}"/><rect x="10" y="12" width="12" height="4" fill="${shade(c, 0.55)}"/><rect x="14" y="3" width="4" height="4" rx="1" fill="#9aa3ab"/><rect x="12.5" y="8" width="2" height="16" rx="1" fill="#fff" fill-opacity=".35"/>`,
  pellets: (c) => `${[[10, 20, 5], [19, 22, 4.5], [15, 13, 4.5], [22, 14, 3.5], [8, 12, 3.5]].map(([x, y, r], i) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.8}" fill="${shade(c, 0.75 + i * 0.1)}"/>`).join('')}`,
  seed: (c) => `<ellipse cx="12" cy="18" rx="5" ry="7" transform="rotate(-25 12 18)" fill="${c}"/><ellipse cx="20" cy="15" rx="4.5" ry="6.5" transform="rotate(20 20 15)" fill="${shade(c, 0.8)}"/>`,
};

export function itemIcon(id, size = 32) {
  const it = ITEMS[id];
  if (!it) return '';
  return `<svg viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true">${SHAPES[it.shape](it.color)}</svg>`;
}

export const CREDIT_ICON = '<svg viewBox="0 0 32 32" width="13" height="13"><circle cx="16" cy="16" r="11" fill="#ffd35a"/><path d="M20 11 A6 6 0 1 0 20 21" stroke="#5a4210" stroke-width="3" fill="none"/></svg>';

export function paramIcon(k) {
  const c = PARAMS[k].color;
  const paths = {
    heat: `<path d="M16 4 C20 10 22 13 22 18 A6 6 0 0 1 10 18 C10 14 13 12 13 8 C15 10 16 12 16 4 Z" fill="${c}"/>`,
    pressure: `<circle cx="16" cy="16" r="10" fill="none" stroke="${c}" stroke-width="2.4"/><path d="M16 16 L22 11" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/>`,
    oxygen: `<circle cx="12" cy="17" r="6" fill="none" stroke="${c}" stroke-width="2.2"/><text x="19" y="25" font-size="9" fill="${c}" font-weight="700">2</text>`,
    biomass: `<path d="M16 27 C16 18 10 16 6 8 C14 8 18 12 16 20 C18 12 22 8 27 7 C26 15 20 17 16 27 Z" fill="${c}"/>`,
  };
  return `<svg viewBox="0 0 32 32" width="18" height="18">${paths[k]}</svg>`;
}
