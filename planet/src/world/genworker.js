// Web Worker: runs planet generation jobs off the main thread.
import { WorldGen, genChunk, genProps, genMap } from './chunkgen.js';
import { EditSet } from './edits.js';

const gen = new WorldGen();
const edits = new EditSet();

self.onmessage = (ev) => {
  const m = ev.data;
  if (m.type === 'edit') { for (const e of m.list) edits.add(e); return; }
  if (m.type === 'chunk') {
    const r = genChunk(gen, edits, m.L, m.ix, m.iz);
    r.id = m.id; r.type = 'chunk'; r.gen = m.gen;
    self.postMessage(r, [r.pos.buffer, r.nor.buffer, r.surf.buffer, r.heights.buffer, r.tileSurf.buffer]);
    return;
  }
  if (m.type === 'props') {
    const r = genProps(gen, edits, m.ci, m.cj);
    r.id = m.id; r.type = 'props';
    self.postMessage(r, [r.rocks.buffer, r.trees.buffer, r.crystals.buffer]);
    return;
  }
  if (m.type === 'map') {
    const r = genMap(gen, m.size, m.row0, m.row1);
    r.id = m.id; r.type = 'map';
    self.postMessage(r, [r.H.buffer, r.P.buffer]);
  }
};
