// 지형 청크를 백그라운드에서 만드는 워커
import { buildChunk } from './terrain-mesher.js';
import { setPads, setRuralBlocks } from './heightfield.js';

self.onmessage = (e) => {
  if (e.data.pads) { setPads(e.data.pads); return; } // 시골 집터 (메인의 도시가 건물을 놓은 뒤)
  if (e.data.rural) { setRuralBlocks(e.data.rural); return; } // 시골 블록 단 (메인의 도시가 쓰임을 정한 뒤)
  const { id, x0, z0, size, res, detail } = e.data;
  const r = buildChunk(x0, z0, size, res, detail);
  self.postMessage({ id, ...r }, [r.pos.buffer, r.nor.buffer, r.col.buffer, r.glw.buffer]);
};
