// Guided milestones (Satisfactory/Planet Crafter-style onboarding that then
// opens up into the long terraform + civilization arc).
import { STAGES } from '../sim/data.js';

const stageIdx = (id) => STAGES.findIndex((s) => s.id === id);

export function makeObjectives(game) {
  const g = game;
  const has = (id, n) => g.eco.inv.count(id) + g.eco.store.count(id) >= n;
  const built = (t, n = 1) => g.buildings.count(t) >= n;
  const ship = () => { const b = g.expedition && g.expedition.b; if (!b) return null; const [x, z] = g.expedition.elevatorFoot(); return { x, y: b.y + 1.5, z, label: '탐사선 승강기' }; };
  const ore = (type, label) => { const o = g.props.nearestOre(type, g.player.pos, 260); return o ? { x: o.x, y: o.y + 0.6, z: o.z, label } : null; };
  return [
    { title: '착륙 지점 조사', desc: '탐사선 주변의 광석 덩어리를 조준하고 <b>좌클릭을 누르고 있으면</b> 채집됩니다. 화면의 표시가 가장 가까운 광석을 가리킵니다. 산소는 탐사선 승강기 아래에서 다시 채워집니다.',
      items: () => [{ text: '철 6개', ok: has('iron', 6) || g.flags.platesMade }, { text: '규소 4개', ok: has('silicon', 4) || g.flags.platesMade }],
      step: () => (!has('iron', 6) ? '표시된 철광석(붉은 갈색 덩어리)을 조준하고 좌클릭 유지' : '표시된 규소 광석(회청색 덩어리)을 조준하고 좌클릭 유지'),
      target: () => (!has('iron', 6) ? ore('iron', '철광석') : ore('silicon', '규소 광석')) },
    { title: '첫 부품 제작', desc: '탐사선 승강기 아래로 가서 <b>Tab</b>을 눌러 가방·제작 화면을 열고, 철판과 유리를 만드세요. 제작은 작업대(탐사선·거주 모듈·제작대) 근처에서만 됩니다.',
      items: () => [{ text: '철판 4개', ok: has('plate', 4) || built('solar') }, { text: '유리 2개', ok: has('glass', 2) || built('solar') }],
      step: () => (g.nearCraft() ? '<b>Tab</b> → 제작에서 철판 4개, 유리 2개' : '표시된 탐사선 승강기 아래로 이동'),
      target: () => (g.nearCraft() ? null : ship()) },
    { title: '전력 확보', desc: '<b>B</b>로 건설 메뉴를 열어 태양광 패널을 세우세요. 시설은 가까운 발전기·송전탑과 자동으로 전선이 이어집니다.',
      items: () => [{ text: '태양광 패널', ok: built('solar') }],
      step: () => (g.build.mode === 'place' ? '평평한 땅을 조준하고 좌클릭으로 설치 · R/휠 회전' : '<b>B</b> → 전력 → 태양광 패널 선택') },
    { title: '테라포밍 시작', desc: '히터는 열을, 대기 드릴은 기압을 올립니다. 둘 다 전력이 필요합니다. 수치가 합쳐진 Ti가 행성의 단계를 바꿉니다.',
      items: () => [{ text: '히터', ok: built('heater') }, { text: '대기 드릴', ok: built('drill') }],
      step: () => '<b>B</b> → 테라포밍 → ' + (!built('heater') ? '히터' : '대기 드릴') + ' · 태양광 패널 가까이 세우기' },
    { title: '기지 세우기', desc: '거주 모듈은 들어가면 산소가 채워지고, 침대에서 밤을 넘길 수 있습니다. 문은 다가가면 열립니다.',
      items: () => [{ text: '거주 모듈', ok: built('habitat') }],
      step: () => '<b>B</b> → 기지 → 거주 모듈' },
    { title: '연구의 시작', desc: '연구 단말기를 세우면 연구 점수가 쌓입니다(<b>J</b>). 코발트는 현무암 지대와 결정 평원에서 찾을 수 있습니다.',
      items: () => [{ text: '연구 단말기', ok: built('terminal') }, { text: '「자동 채굴」 연구', ok: g.research.has('r_auto') }],
      step: () => (!built('terminal') ? '<b>B</b> → 기지 → 연구 단말기' : '<b>J</b>로 연구 화면 → 「자동 채굴」 선택'),
      target: () => (!has('cobalt', 2) ? ore('cobalt', '코발트') : null) },
    { title: '자동화', desc: '빛나는 결정이 둘러싼 광맥 위에 자동 채굴기를 세우세요. 이후 정련과 드론 물류를 연구하면 공장이 스스로 돌아갑니다.',
      items: () => [{ text: '자동 채굴기', ok: built('extractor') }, { text: '「드론 물류」 연구', ok: g.research.has('r_logistics') }, { text: '드론 허브', ok: built('dronehub') }] },
    { title: '푸른 하늘', desc: '테라포밍 지수를 1kTi까지 올리면 하늘이 푸르게 변합니다. 히터와 드릴을 늘리세요.',
      items: () => [{ text: '푸른 하늘 단계', ok: g.terra.stage >= stageIdx('bluesky') }] },
    { title: '식민지 건설', desc: '「정착 프로토콜」을 연구하고 식민 본부를 세우세요. 본부를 세우면 근처 평지에 이주선 착륙장이 생깁니다.',
      items: () => [{ text: '「정착 프로토콜」', ok: g.research.has('r_colony') }, { text: '식민 본부', ok: built('hq') }] },
    { title: '사람들을 부르다', desc: '심우주 교신기를 세우고, 하늘에 구름이 생길 만큼 테라포밍한 뒤 <b>E</b>로 교신기를 열어 정착민을 초청하세요. 주거지와 필요(물·식량·배급소·전력)를 먼저 준비해야 맞이할 수 있습니다.',
      items: () => [{ text: '심우주 교신기', ok: built('comms') }, { text: '주거지 3채', ok: built('house', 3) }, { text: '구름 단계', ok: g.terra.stage >= stageIdx('clouds') }, { text: '첫 교신 송신', ok: g.colony.log.some((l) => l.kind === 'out') }] },
    { title: '첫 정착민', desc: '응답한 개척선이 본부 착륙장에 내립니다. 물(정수 펌프)·식량(수경 농장)·배급소·전력을 공급하면 집이 채워집니다. 농장과 펌프에는 일손이 필요합니다.',
      items: () => [{ text: '인구 15명', ok: g.colony.total >= 15 }] },
    { title: '구름과 비', desc: 'T2 히터·드릴로 구름을 만들고 비를 내리게 하세요. 비가 내리면 땅이 젖고, 얼음이 녹아 물이 고입니다.',
      items: () => [{ text: '비 단계', ok: g.terra.stage >= stageIdx('rain') }, { text: '액체 물 단계', ok: g.terra.stage >= stageIdx('water') }] },
    { title: '마을 시대', desc: '「의료와 여가」를 연구해 의료소를 세우면 개척민이 정착민으로 업그레이드됩니다.',
      items: () => [{ text: '인구 25명', ok: g.colony.total >= 25 }, { text: '정착민 8명', ok: g.colony.popOf('settler') >= 8 }, { text: '마을 시대', ok: g.colony.era >= 3 }] },
    { title: '소도시와 공방', desc: '경공업으로 생활용품을 공급해 기술자를 키우고, 비철 야금과 섬유를 연구해 의류를 입히면 숙련공이 됩니다. 구리는 화산대와 층암에서 납니다.',
      items: () => [{ text: '기술자 12명', ok: g.colony.popOf('tech') >= 12 }, { text: '섬유 공방', ok: built('textile') }, { text: '숙련공 계층', ok: g.colony.popOf('artisan') > 0 }, { text: '소도시 시대', ok: g.colony.era >= 4 }] },
    { title: '호수와 이끼', desc: '조류 배양기와 이끼 살포기로 산소와 바이오매스를 늘리세요. 분지가 바다로 차오릅니다.',
      items: () => [{ text: '호수 단계', ok: g.terra.stage >= stageIdx('lakes') }, { text: '이끼 단계', ok: g.terra.stage >= stageIdx('moss') }] },
    { title: '도시 시대', desc: '학교와 전자 공장으로 공학자를 길러 도시로 성장하세요.',
      items: () => [{ text: '인구 140명', ok: g.colony.total >= 140 }, { text: '공학자 20명', ok: g.colony.popOf('engineer') >= 20 }, { text: '도시 시대', ok: g.colony.era >= 6 }] },
    { title: '학술 도시', desc: '제약소의 의약품과 트램 정류장으로 연구원을 맞으세요. 황은 화산 분기공 근처에서, 마그네슘은 소금 평원에서 납니다.',
      items: () => [{ text: '제약소', ok: built('pharma') }, { text: '트램 정류장', ok: built('transit') }, { text: '연구원 24명', ok: g.colony.popOf('scientist') >= 24 }, { text: '학술 도시 시대', ok: g.colony.era >= 7 }] },
    { title: '초록 행성', desc: '나무 살포기와 곤충 사육 돔으로 숲을 키우고, 마침내 숨쉴 수 있는 대기를 만드세요.',
      items: () => [{ text: '숲 단계', ok: g.terra.stage >= stageIdx('trees') }, { text: '숨쉬는 대기', ok: g.terra.stage >= stageIdx('breathable') }] },
    { title: '문명의 탄생', desc: '문화 센터로 시민을, 대학으로 전문직을 키우고 개척자 기념탑을 세워 행성 문명 시대를 여세요.',
      items: () => [{ text: '시민 30명', ok: g.colony.popOf('citizen') >= 30 }, { text: '대학', ok: built('university') }, { text: '전문직 30명', ok: g.colony.popOf('professional') >= 30 }, { text: '개척자 기념탑', ok: built('monument') }, { text: '행성 문명 시대', ok: g.colony.era >= 9 }] },
    { title: '하늘로 이어진 탑', desc: '궤도 공학을 연구하고 궤도 엘리베이터를 세우세요. 행성을 완전히 테라포밍하면 아르케는 새로운 고향이 됩니다.',
      items: () => [{ text: '궤도 엘리베이터', ok: built('elevator') }, { text: '완전한 테라포밍', ok: g.terra.stage >= stageIdx('complete') }] },
    { title: '두 번째 고향', desc: '숨쉬는 대기 아래, 「요람 프로그램」으로 에어록 없는 집을 지으세요. 아르케에서 태어난 세대가 도시를 이끕니다.',
      items: () => [{ text: '「요람 프로그램」', ok: g.research.has('r_native') }, { text: '아르케인 30명', ok: g.colony.popOf('native') >= 30 }, { text: '두 번째 고향 시대', ok: g.colony.era >= 10 }] },
  ];
}

export class Objectives {
  constructor(game) {
    this.game = game;
    this.list = makeObjectives(game);
    this.index = 0;
  }

  current() {
    while (this.index < this.list.length) {
      const o = this.list[this.index];
      const items = o.items();
      if (items.every((i) => i.ok)) {
        this.index++;
        if (this.game.ui && this.game.started) this.game.ui.toast('목표 달성: ' + o.title, 'good', 3);
        this.game.audio && this.game.audio.play('done');
        continue;
      }
      return { index: this.index, total: this.list.length, title: o.title, desc: o.desc, items, step: o.step ? o.step() : '', target: o.target ? o.target() : null };
    }
    return null;
  }
}
