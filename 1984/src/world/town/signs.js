// Painted fascia boards for shops and pubs, drawn into one canvas atlas:
// gilt or cream letters on dark paint, faded, chipped and streaked. Party
// depots and the few named places of the story are in it too.
import * as THREE from 'three';

export const SHOPS = [
  'J. HARRIS & SON  ·  BUTCHER', 'DAIRY', 'GREENGROCER', 'TOBACCONIST', 'PAWNBROKER', 'IRONMONGER',
  'W. COOPER  ·  BOOT REPAIRS', 'FRIED FISH', 'EEL PIE & MASH', 'OIL & COLOUR', 'CHEMIST', 'NEWSAGENT',
  'HABERDASHER', 'BAKER', 'COAL ORDERS TAKEN', 'SECOND-HAND FURNITURE', 'LAUNDRY', 'HAIRDRESSER',
  'CORN CHANDLER', 'CYCLE REPAIRS', 'RAGS · BONES · BOTTLES', 'GENERAL STORES', 'WIRELESS REPAIRS', 'DINING ROOMS',
];
export const PUBS = ['THE WHITE HART', 'THE GRAPES', 'THE BLACK DOG', 'THE BELL', 'THE RED LION', 'THE THREE TUNS', 'THE PLOUGH', 'THE FEATHERS'];
export const PARTY = ['MINISTRY OF PLENTY  ·  DISTRIBUTION DEPOT', 'VICTORY CAFÉ', 'PARTY SECTOR OFFICE  ·  NO ADMITTANCE', 'MINISTRY OF PLENTY  ·  RATION POINT'];
export const NAMED = ['CHARRINGTON  ·  ANTIQUES', 'THE CHESTNUT TREE CAFÉ', 'COMMUNITY CENTRE  ·  SECTOR 7', 'UNDERGROUND', 'VICTORY MANSIONS'];

const COLS = 2, ROWS = 22, W = 2048, H = 2464;
const SW = W / COLS, SH = H / ROWS;

let atlas = null;

export function signAtlas() {
  if (atlas) return atlas;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const all = [...SHOPS, ...PUBS, ...PARTY, ...NAMED];
  const index = new Map();
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  all.forEach((name, i) => {
    const x = (i % COLS) * SW, y = Math.floor(i / COLS) * SH;
    const pub = PUBS.includes(name), party = PARTY.includes(name);
    const bgs = pub ? ['#1d2a20', '#3a1612', '#14161a'] : party ? ['#5b5a55', '#3d3c38'] : ['#1f2a22', '#2a1d18', '#1a1d24', '#3b3328', '#2c2c2a', '#4a3a28'];
    const bg = bgs[Math.floor(rnd() * bgs.length)];
    g.fillStyle = bg; g.fillRect(x, y, SW, SH);
    // moulded border
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 6; g.strokeRect(x + 6, y + 6, SW - 12, SH - 12);
    g.strokeStyle = 'rgba(255,240,200,.12)'; g.lineWidth = 2; g.strokeRect(x + 12, y + 12, SW - 24, SH - 24);
    // lettering
    const gilt = pub || rnd() < 0.5;
    const size = Math.min(SH * 0.56, (SW * 0.86) / (name.length * 0.62));
    g.font = `${party ? '600' : '700'} ${size}px ${party ? 'Arial, Helvetica, sans-serif' : 'Georgia, "Times New Roman", serif'}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const cx = x + SW / 2, cy = y + SH / 2 + 2;
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillText(name, cx + 3, cy + 3);
    g.fillStyle = party ? '#e8e4d8' : gilt ? '#c9a55a' : '#e3d9bf';
    g.fillText(name, cx, cy);
    // wear: faded patches, chips, rain streaks
    for (let k = 0; k < 40; k++) {
      g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '200,190,170'},${0.04 + rnd() * 0.1})`;
      g.fillRect(x + rnd() * SW, y + rnd() * SH, 4 + rnd() * 60, 2 + rnd() * 10);
    }
    for (let k = 0; k < 14; k++) {
      g.fillStyle = 'rgba(0,0,0,.18)';
      g.fillRect(x + rnd() * SW, y + SH * 0.5, 2 + rnd() * 3, SH * 0.5);
    }
    index.set(name, i);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  // u, v, du, dv of a board (v from the bottom of the canvas)
  const rect = (name) => {
    const i = index.has(name) ? index.get(name) : 0;
    const x = (i % COLS) * SW, y = Math.floor(i / COLS) * SH;
    return [x / W, 1 - (y + SH) / H, SW / W, SH / H];
  };
  atlas = { tex, rect, names: all };
  return atlas;
}
