// Hand-authored layout of the first region: "속삭이는 숲" (Whispering Forest).
// x = east, z = south (player starts in the south and heads north, toward -z).
// Paths and the stream are authored as a few control points and turned into natural curves (gentle bends between
// the points, no corners); legs that something is built across (the bridge log, the stepping stones) stay put.
import { naturalCurve } from './util.js';

export const WORLD = { size: 96, res: 320, waterY: -0.32 };

export const START = { x: 0.4, z: 24.5, yaw: Math.PI }; // facing north

// main walking path (dirt) through the forest
export const PATH_CTRL = [[0, 27], [0.5, 22], [-1.5, 17], [-2.6, 12], [-1.8, 7.5], [-2, 4], [-2.2, 0.5], [-4, -4], [-7.5, -8.5], [-11, -12.5], [-12.5, -15.5]];
export const PATH = naturalCurve(PATH_CTRL, { keep: [4, 5], seed: 3, bend: 0.08 });
export const PATH2 = naturalCurve([[-2.2, 0.5], [2, -2], [8, -3.5], [12.5, -4.5]], { seed: 7, bend: 0.08 });
// faint animal tracks (짐승길): trodden lines off the main path that quietly lead somewhere worth finding
export const TRAILS = [
  naturalCurve([[-1.9, 6.9], [0.8, 6.0], [3.6, 6.6], [6.0, 7.3]], { seed: 21, bend: 0.12 }),          // to the sealed hollow
  naturalCurve([[12.2, -4.7], [11.6, -5.9], [11.25, -7.0]], { seed: 23, bend: 0.1 }),                // to the stone-switch on the pond shore
  naturalCurve([[-4.2, -4.6], [-6.2, -2.4], [-6.5, -3.0]], { seed: 25, bend: 0.1 }),                // round the mossy boulders to the old stump
  naturalCurve([[-6.2, -15.5], [-3.6, -17.2], [-1.5, -18.2]], { seed: 27, bend: 0.15 }),             // off the north path to a lone boulder
];
export const PATH3 = naturalCurve([[-7.5, -8.5], [-6, -15], [-3, -22], [0, -29], [0.5, -36]], { seed: 11, bend: 0.09 });

// stream (flows west -> east into the pond)
export const STREAM = naturalCurve([[-46, 9], [-34, 7], [-24, 5.5], [-15, 4.5], [-8, 3.2], [-2, 2.8], [4, 2.2], [9, 0.5], [13, -2.5], [15.5, -5]], { keep: [4, 5], seed: 5, bend: 0.1, maxBend: 1.4 });
export const POND = { x: 17.5, z: -7, r: 5.2 };

// rock outcrop with tunnel cave & waterfall
export const OUTCROP = { x: 22.5, z: -18, yaw: -Math.PI / 2, base: 0.35 };

// rocky earth bank closing the stump glade, from one gate boulder round to the other (the gate is the way in)
export const GLADE_RIDGE = [[-15.6, -14.2], [-20, -13.6], [-25, -16.4], [-27.4, -22], [-25.4, -28], [-19.5, -30.4], [-13.6, -28.4], [-10.6, -23.6], [-9.4, -19], [-10.4, -16.6]];
export const ridgeEnds = (x, z) => Math.min(Math.hypot(x + 15.6, z + 14.2), Math.hypot(x + 10.4, z + 16.6));

export const REGIONS = [
  { id: 'clearing', name: '깨어난 공터', x: 0, z: 23, r: 6 },
  { id: 'roots', name: '뿌리 언덕', x: -4.5, z: 13, r: 5 },
  { id: 'stream', name: '속삭이는 개울', x: -2, z: 3, r: 4.5 },
  { id: 'boulders', name: '이끼 바위 지대', x: -9, z: -5, r: 6 },
  { id: 'gate', name: '녹슨 울타리 문', x: -13, z: -15, r: 4 },
  { id: 'glade', name: '고요한 그루터기 숲', x: -19, z: -22, r: 5 },
  { id: 'pond', name: '폭포 웅덩이', x: 16, z: -6, r: 6 },
  { id: 'cave', name: '반딧불 동굴', x: 22.8, z: -17.6, r: 2.2, maxY: 2.4 },
  { id: 'summit', name: '전망 바위', x: 22.5, z: -18, r: 5, minY: 3.2 },
  { id: 'edge', name: '숲의 끝 — 정원 울타리', x: 0.5, z: -36, r: 5 },
];

// the sealed hollow (puzzle): a ring of boulders; trees keep clear of it
export const HOLLOW = { x: 6.2, z: 9.6 };

// big hand-placed hero trees [x, z, scale, template]
export const HERO_TREES = [
  [-6.2, 12.2, 1.35, 0], [5.5, 16, 1.05, 1], [-8, 21, 1.0, 2], [7, 26, 0.95, 3],
  [3.5, 8.5, 1.0, 4], [-11, 7, 1.1, 1], [-14, -2, 1.0, 2], [-3.5, -12, 1.15, 0],
  [6, -12, 1.0, 3], [-20, -12, 1.0, 4], [-24, -26, 1.2, 0], [11, 12, 1.0, 2],
  [12, 4, 0.9, 5], [-5, 30, 1.0, 5], [9, -22, 1.1, 1], [-9, -27, 1.0, 3],
];

// boulders [x, z, radius, squash, seed]
export const BOULDERS = [
  [-9.5, -4.5, 1.1, 0.7, 1], [-11.6, -6.8, 0.8, 0.8, 2], [-7.2, -6.8, 0.55, 0.9, 3], [-12.8, -3.5, 0.6, 0.75, 4],
  [-10.6, -9.2, 1.4, 0.65, 5], [3.4, 20, 0.45, 0.8, 6], [-3.2, 25.5, 0.5, 0.75, 7], [9.5, 6, 0.9, 0.7, 8],
  [-15.6, -14.2, 1.3, 1.1, 9], [-10.4, -16.6, 1.3, 1.1, 10], [12, -10, 0.8, 0.7, 11], [-17, -6, 0.9, 0.8, 12],
  [4.5, -6, 0.5, 0.8, 13], [-1, -18, 0.7, 0.7, 14], [3, -27, 1.0, 0.75, 15], [-5, -31, 0.8, 0.8, 16],
  [0.9, 3.5, 0.28, 0.6, 17], [2.1, 2.3, 0.26, 0.6, 18], [3.3, 1.6, 0.3, 0.6, 19], [-18, -19, 0.7, 0.9, 20],
];

// fallen logs [x1,z1,x2,z2,radius, hollow]
export const LOGS = [
  [-2.6, 5.4, -1.4, -0.4, 0.28, false], // bridge over stream
  [8.5, 14, 13.5, 15.5, 0.36, true],    // hollow log (crawl through) — power cell inside
  [-14, 12, -10, 15.2, 0.3, false],
  [-4, -20, 1, -22, 0.33, false],
];

// stumps [x, z, radius, height]
export const STUMPS = [
  [-19.5, -22.5, 0.75, 1.15], // ability pedestal stump in the glade
  [-16.8, -24.8, 0.5, 0.5],
  [6.5, 21, 0.45, 0.35],
  [-6.5, -3, 0.42, 0.62],
];
