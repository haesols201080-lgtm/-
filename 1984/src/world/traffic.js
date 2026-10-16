// Traffic on the main streets: Party lorries and vans, keeping to the left,
// slowing for anyone in the road. No private motor-cars: those belong to the
// Inner Party and are seldom seen.
import * as THREE from 'three';
import { rng } from './city_util.js';

export function setupTraffic(G) {
  const city = G.locations.get('city');
  const plan = G.world && G.world.plan;
  if (!city || !plan) return;
  const r = rng(77);
  const mains = plan.streets.filter((s) => s.kind === 'main' && s.line.length > 1);
  // routes: main street lines longer than 120 m, walked end to end
  const routes = [];
  for (const s of mains) {
    let L = 0;
    for (let i = 0; i < s.line.length - 1; i++) L += Math.hypot(s.line[i + 1][0] - s.line[i][0], s.line[i + 1][1] - s.line[i][1]);
    if (L > 120) routes.push({ s, L });
  }
  if (!routes.length) return;
  const N = Math.min(28, routes.length * 2);
  const cars = [];
  for (let i = 0; i < N; i++) {
    const model = r() < 0.6 ? 'truck' : 'van';
    let obj;
    try { obj = G.assets.instance(model); } catch (e) { continue; }
    G.mats.apply(obj, { cast: true, receive: true });
    city.root.add(obj);
    const route = routes[Math.floor(r() * routes.length)];
    cars.push({ obj, route, t: r() * route.L, dir: r() < 0.5 ? 1 : -1, v: 7 + r() * 3, speed: 0 });
  }
  const at = (route, t, dir) => {
    const line = route.s.line;
    let d = dir > 0 ? t : route.L - t;
    for (let i = 0; i < line.length - 1; i++) {
      const [ax, az] = line[i], [bx, bz] = line[i + 1];
      const L = Math.hypot(bx - ax, bz - az);
      if (d <= L || i === line.length - 2) {
        const k = Math.min(1, d / (L || 1));
        let ux = (bx - ax) / (L || 1), uz = (bz - az) / (L || 1);
        if (dir < 0) { ux = -ux; uz = -uz; }
        // keep to the left of the direction of travel
        const off = route.s.w / 4;
        return { x: ax + (bx - ax) * k + uz * off, z: az + (bz - az) * k - ux * off, ux, uz };
      }
      d -= L;
    }
    return null;
  };
  const tmp = new THREE.Vector3();
  G.onUpdate((dt) => {
    if (G.state.location !== 'city') return;
    const cam = G.camera.position;
    const pl = G.player.pos;
    for (const c of cars) {
      const p = at(c.route, c.t, c.dir);
      if (!p) continue;
      // slow and stop for the player or anyone close ahead in the road
      const ax = p.x + p.ux * 7, az = p.z + p.uz * 7;
      let block = Math.hypot(pl.x - ax, pl.z - az) < 4.5;
      if (!block && G.npcs) for (const n of G.npcs.list) { if (n.root.visible && Math.hypot(n.pos.x - ax, n.pos.z - az) < 3) { block = true; break; } }
      c.speed += ((block ? 0 : c.v) - c.speed) * Math.min(1, dt * (block ? 3 : 0.8));
      c.t += c.speed * dt;
      if (c.t > c.route.L) {
        // out of the window: start again on another main road, out of sight
        c.route = routes[Math.floor(r() * routes.length)];
        c.t = 0; c.dir = r() < 0.5 ? 1 : -1;
        continue;
      }
      c.obj.position.set(p.x, 0.0, p.z);
      c.obj.rotation.y = Math.atan2(p.ux, p.uz);
      c.obj.visible = Math.hypot(p.x - cam.x, p.z - cam.z) < 260;
      // push the player out of the lorry's way
      tmp.set(pl.x - p.x, 0, pl.z - p.z);
      const along = tmp.x * p.ux + tmp.z * p.uz, side = -tmp.x * p.uz + tmp.z * p.ux;
      if (Math.abs(along) < 4 && Math.abs(side) < 1.4) {
        const s = side >= 0 ? 1 : -1;
        pl.x += -p.uz * s * (1.45 - Math.abs(side)); pl.z += p.ux * s * (1.45 - Math.abs(side));
      }
    }
  });
}
