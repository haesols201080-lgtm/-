// The duvet's simulation off the main thread (src/clothsim.js; driven by src/quilt.js): 'init' lays it out and lets
// it settle over him; each 'step' brings his pose (bone matrices, arm capsules) and the robot, and returns where the
// cloth is now.
import { ClothSim, BodyField, prepBoxes } from './clothsim.js';

let sim = null, field = null;
function send(type) {
  const pos = sim.x.slice(), nrm = sim.normals().slice();
  postMessage({ type, pos, nrm }, [pos.buffer, nrm.buffer]);
}
onmessage = (e) => {
  const m = e.data;
  if (m.type === 'init') {
    sim = new ClothSim(m.cloth); sim.boxes = prepBoxes(m.boxes); sim.floor = m.floor;
    field = new BodyField(m.field); field.update(m.bones); sim.field = field;
    sim.caps = m.caps; sim.spheres = m.spheres || new Float32Array(0);
    sim.settle(m.settle || 3);
    send('ready');
  } else if (m.type === 'step' && sim) {
    field.update(m.bones); sim.caps = m.caps; sim.spheres = m.spheres || sim.spheres;
    sim.step(m.dt);
    send('state');
  }
};
