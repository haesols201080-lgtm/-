// The expedition ship that brought the first explorer and the rover down:
// the same steel ship as the colony transports, standing where it landed on
// unprepared ground with its cargo elevator lowered. The landing burn left a
// scorched, blasted patch around it.
import * as THREE from 'three';
import { ShipRig } from '../npc/craft.js';

export class Expedition {
  constructor(game) {
    this.game = game;
    this.rig = null;
    this.scorch = null;
    this.b = null;
    this.checkT = 0;
  }

  get site() { const b = this.b; return b ? { x: b.x, y: b.y, z: b.z } : null; }

  // find the pod footprint and stand the ship on it
  attach() {
    const b = this.game.buildings.list.find((q) => q.type === 'pod');
    if (!b) return false;
    this.b = b;
    if (!this.rig) this.rig = new ShipRig(this.game.engine.scene);
    this.rig.group.visible = true;
    this.rig.pose(this.site, b.rot, 0, { elev: 1 });
    this.buildScorch();
    return true;
  }

  buildScorch() {
    const g = this.game, T = g.terrain, b = this.b;
    if (this.scorch) { g.engine.scene.remove(this.scorch); this.scorch.geometry.dispose(); }
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const cx = cv.getContext('2d');
    const gr = cx.createRadialGradient(128, 128, 10, 128, 128, 128);
    gr.addColorStop(0, 'rgba(18,14,12,0.85)'); gr.addColorStop(0.35, 'rgba(28,22,18,0.6)'); gr.addColorStop(0.7, 'rgba(60,45,35,0.22)'); gr.addColorStop(1, 'rgba(60,45,35,0)');
    cx.fillStyle = gr; cx.fillRect(0, 0, 256, 256);
    // blast streaks radiating from the engines
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    cx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 90; i++) {
      const a = rnd() * Math.PI * 2, r0 = 40 + rnd() * 30, r1 = r0 + 30 + rnd() * 60;
      cx.strokeStyle = `rgba(0,0,0,${0.15 + rnd() * 0.3})`; cx.lineWidth = 2 + rnd() * 5;
      cx.beginPath(); cx.moveTo(128 + Math.cos(a) * r0, 128 + Math.sin(a) * r0); cx.lineTo(128 + Math.cos(a) * r1, 128 + Math.sin(a) * r1); cx.stroke();
    }
    const S = 36, N = 28, geo = new THREE.PlaneGeometry(S, S, N, N); geo.rotateX(-Math.PI / 2);
    const P = geo.attributes.position;
    for (let i = 0; i < P.count; i++) P.setY(i, T.height(b.x + P.getX(i), b.z + P.getZ(i)) - b.y + 0.06);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 });
    this.scorch = new THREE.Mesh(geo, mat);
    this.scorch.position.set(b.x, b.y, b.z);
    this.scorch.receiveShadow = true;
    this.scorch.renderOrder = 1;
    g.engine.scene.add(this.scorch);
  }

  update(dt) {
    if (this.b && !this.b.removed) return;
    if ((this.checkT -= dt) > 0) return;
    this.checkT = 1;
    this.attach();
  }
}
