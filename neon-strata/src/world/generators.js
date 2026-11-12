// Ordered list of world generators: [label, fn(ctx), id]
import { buildPlan } from './plan.js';
import { buildDistricts } from './districts.js';
import { buildSpire, buildCorePlaza, buildBulwark, reserveGiants, buildGiants, buildSprawl } from './megas.js';

export const GENERATORS = [
  ['도시 계획 — 블록과 필지', buildPlan, 'plan'],
  ['초거대 구조물 부지 지정', reserveGiants, 'plan'],
  ['스파이어 축조', buildSpire, 'spire'],
  ['스파이어 광장', buildCorePlaza, 'spire'],
  ['방벽과 바다', buildBulwark, 'bulwark'],
  ['구역 건설', buildDistricts, 'districts'],
  ['구름을 뚫는 거인들', buildGiants, 'giants'],
  ['외곽 지대', buildSprawl, 'sprawl'],
];
