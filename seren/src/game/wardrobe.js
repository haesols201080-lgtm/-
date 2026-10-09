// 옷장 (v24 「옷 갈아입기 장소」): 가진 옷은 아무 데서나 갈아입지 않는다 — 우리 집·묵는 방의 옷장(옷 고치) 앞에서만.
//  부위마다 지금 입은 옷 · 가진 옷 목록 → 입기/벗기를 누르면 아바타에 바로 보이고 슬롯에 저장된다.
//  수선 전 아웬 치수 옷은 고를 수 없다(너무 커서 끌린다) — 재단사에게 맡기면 내 치수가 된다.
import { CLOTHES, SLOTS, SLOT_NAME, clothName } from '../data/clothes.js';

const hex = (c) => '#' + (c >>> 0).toString(16).padStart(6, '0');
const chip = (c) => `<i class="cl-chip" style="background:${hex(c)}"></i>`;

export function openWardrobe(game, where = '옷장') {
  const W = game.state.wardrobe;
  const rows = [];
  for (const slot of SLOTS) {
    const id = W.worn[slot], cur = W.own.find((o) => o.id === id);
    rows.push({ head: `${SLOT_NAME[slot]} · ${cur ? clothName(cur) : '탐사복 그대로'}` });
    const mine = W.own.filter((o) => CLOTHES[o.item] && CLOTHES[o.item].slot === slot);
    for (const o of mine) {
      const worn = o.id === id, big = o.fit === 'awen', away = !!o.atTailor;
      rows.push({
        label: `${chip(o.color)} ${clothName(o)}${worn ? ' · 입는 중' : ''}`,
        sub: away ? '재단사에게 맡겨 둔 옷' : big ? '아웬 치수 — 수선해야 입을 수 있어요' : o.fit === 'univ' ? '범용 · 끈으로 맞춤' : '내 치수로 고친 옷',
        stay: true, disabled: worn || big || away,
        onClick: () => { W.worn[slot] = o.id; game.dress(); game.save(); openWardrobe(game, where); },
      });
    }
    if (cur) rows.push({ label: `${SLOT_NAME[slot]} 벗기`, sub: '탐사복만', stay: true, onClick: () => { delete W.worn[slot]; game.dress(); game.save(); openWardrobe(game, where); } });
  }
  if (!W.own.length) rows.push({ label: '가진 옷이 없어요', sub: '옷가게에서 입어 보고 사요 (탈의 칸 · 재단사)', disabled: true });
  game.ui.serviceCard(where, '옷 갈아입기', '고르면 바로 입어요. 입은 옷은 저장 슬롯마다 따로 남아요.', rows);
}
