// Ordered list of world generators: [label, fn(ctx), id]
import { buildSump } from './districts/sump.js';

export const GENERATORS = [
  ['침전층 — 슬럼 적층', buildSump, 'sump'],
];
