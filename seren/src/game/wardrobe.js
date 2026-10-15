// 옷장 (v24 「옷 갈아입기 장소」): 가진 옷은 아무 데서나 갈아입지 않는다 — 우리 집·묵는 방의 옷장(옷 고치) 앞에서만.
//  화면은 옷장 문 두 짝(ui/devices/dressing 의 wardrobeView): 왼문 = 부위, 오른문 = 그 부위의 옷걸이, 가운데 = 내 모습.
import { wardrobeView } from '../ui/devices/dressing.js';

export function openWardrobe(game, where = '옷장') { return wardrobeView(game, { where }); }
