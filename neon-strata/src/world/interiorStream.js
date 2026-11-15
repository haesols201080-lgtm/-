// Interiors are streamed: the floors above a lobby are fitted out (walls, ceilings, lift core, furniture, people)
// only for the buildings the player is standing in or right next to, and dropped again when they walk away.
import * as THREE from 'three';
import { Batch, Pen } from './builder.js';
import { PROPS } from './props.js';
import { furnishFloors } from './interiors.js';

export function createInteriorStream(city, scene, crowd) {
  const specs = city.ctx.towers || []; const live = new Map(); let tick = 0;
  const build = (s) => {
    const b = new Batch(16384); const pen = new Pen(b); const res = furnishFloors(s, pen, PROPS);
    const mesh = new THREE.Mesh(b.build(), city.mat); mesh.matrixAutoUpdate = false; mesh.frustumCulled = false; scene.add(mesh);
    if (!s.peopled) { s.peopled = true; crowd.addSpots(res.spots); crowd.addWalkways(res.walks); }
    live.set(s, mesh);
  };
  return {
    specs,
    update(p, force = false) {
      if (!force && (tick++ % 12)) return;
      for (const s of specs) { const d = Math.hypot(s.wx - p.x, s.wz - p.z); if (d < 48 && !live.has(s)) build(s); }
      for (const [s, m] of live) if (Math.hypot(s.wx - p.x, s.wz - p.z) > 85) { scene.remove(m); m.geometry.dispose(); live.delete(s); }
    },
    get count() { return live.size; },
  };
}
