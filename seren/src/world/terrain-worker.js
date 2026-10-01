// 지형 청크를 백그라운드에서 만드는 워커
import { buildChunk } from './terrain-mesher.js';

self.onmessage = (e) => {
  const { id, x0, z0, size, res, detail } = e.data;
  const r = buildChunk(x0, z0, size, res, detail);
  self.postMessage({ id, ...r }, [r.pos.buffer, r.nor.buffer, r.col.buffer, r.glw.buffer]);
};
