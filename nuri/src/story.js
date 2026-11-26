// Story — Chapter 1: the forest. Chapter 2: the giant's home in the city.
// Tone: a small survey machine alone in a world built at another scale. Field-log voice, dry, observant; the
// mystery is carried by recovered memory records, not by exposition. Nothing ends — each region opens the next.
//   Survey unit SV-7 "Seven" was being carried by the transport drone D-1 "Rotor" when a storm brought it down in a forest.
//   Its core memory is damaged. What it carries, and who it was sent to, comes back one record at a time.

export const INTRO = [
  '수송 드론 D-1 「로터」. 비행 기록 마지막 줄: 강풍. 고도 상실. 화물칸 개방.',
  '소형 탐사 유닛 SV-7 「세븐」. 키 35센티미터. 주 기억 장치 손상.',
  '그리고 아침. 세븐은 자기 몸보다 열 배는 큰 고사리 아래에서 다시 켜졌다.',
];

// field log: Nuri's own notes as each objective comes up
export const LOG = {
  first: '탐사 기록 001. 착륙 지점 불명. 주변 물체가 모두 비정상적으로 크다. …아니, 내가 작은 것이다. 근처에 로터의 동력 결정 반응.',
  toto: '탐사 기록 002. 북서쪽 거목 뿌리 부근에서 기록 유닛 R-2 셔터의 식별 신호. 신호가 약하다.',
  gate: '탐사 기록 003. 녹슨 철문. 거인들이 세운 구조물. 압력판으로 여닫는 방식으로 보인다. 내 무게로는 부족하다.',
  booster: '탐사 기록 004. 그루터기 위에서 미확인 추진 장치 반응. 사람이 만든 물건은 아니다. 우리 쪽 규격이다.',
  bori: '탐사 기록 005. 조명 유닛 L-4 랜턴의 마지막 위치는 바위산 아래 동굴. 어두운 곳을 피하도록 설계된 유닛이 왜 그쪽으로 갔는지는 모르겠다.',
  cell: '탐사 기록 006. 바위산 옆 승강 장치. 전원 없음. 랜턴이 속 빈 통나무 안에서 동력 셀을 봤다고 했다.',
  mina: '탐사 기록 007. 전망 바위 정상에서 로터의 비콘. 기체는 살아 있다.',
  charge: '탐사 기록 008. 로터의 비행에 필요한 결정은 서른 개. 기억이 돌아올 때마다, 결정 하나의 무게가 달라진다.',
  garden: '탐사 기록 009. 울타리 너머는 거인들이 다니는 길이다. 로터가 여기서 출발하자고 한다.',
};

const N = '세븐';
// first: the first meeting. again: later lines — each may carry a condition on the progress (when)
export const TALK = {
  toto: {
    first: [
      ['셔터', '…SV-7? 다행이다. 바퀴가 뿌리에 물려서 이틀째 같은 하늘만 찍고 있었어.'],
      [N, '이틀? 내 기록엔 하룻밤뿐인데.'],
      ['셔터', '네 시계가 틀린 거야. 넌 이틀 동안 꺼져 있었어. 고사리 아래서.'],
      ['셔터', '추락 직전 영상이 남아 있어. 화물칸이 열릴 때 로터가 끝까지 붙잡고 있던 건 네가 실린 상자였어. 다른 건 다 놓쳤는데.'],
      [N, '…왜 나지?'],
      ['셔터', '그건 로터한테 물어봐. 전망 바위 쪽으로 떨어졌어. 가는 길에 녹슨 문이 하나 있는데, 그 너머에 우리 규격의 장비 반응이 있어.'],
    ],
    again: [
      { lines: [['셔터', '관찰 기록. 다람쥐라는 생물이 결정 하나를 물고 갔다. 먹을 수 없다는 걸 알게 되면 어딘가 높은 곳에 버리겠지.']] },
      { when: (g) => !g.save.gateOpen, lines: [['셔터', '그 문, 거인들이 몇 년은 손대지 않은 것 같아. 녹이 경첩을 다 먹었어.']] },
      { when: (g) => g.save.booster, lines: [['셔터', '그 추진기, 연구소 규격이야. 이 숲에 우리 말고 누가 또 왔었다는 뜻이지.']] },
      { lines: [['셔터', '배터리 12퍼센트. 기록은 계속한다. 누군가는 이걸 봐야 하니까.']] },
    ],
  },
  bori: {
    first: [
      ['랜턴', '…불 끄지 마. 거기 서 있어 줘. 그래, 거기.'],
      ['랜턴', '여기 반딧불이들이 내 램프를 동족으로 아는 것 같아. 쫓아낼 수가 없더라. 덕분에 버텼지만.'],
      [N, '랜턴, 넌 어두운 데를 피하도록 만들어졌잖아. 왜 여기로 왔어?'],
      ['랜턴', '추락하는 동안 로터의 화물 목록을 봤어. 네 항목만 「기밀」로 잠겨 있었어. …겁이 났어. 그래서 숨었어.'],
      ['랜턴', '승강기를 쓰면 로터한테 갈 수 있어. 전원은 속 빈 통나무 안 동력 셀. 내가 거기까지는 비춰 봤어.'],
    ],
    again: [
      { lines: [['랜턴', '반딧불이는 짝을 찾으려고 빛을 낸대. 나도 비슷한 이유로 켜져 있는 것 같아.']] },
      { when: (g) => g.save.liftPowered, lines: [['랜턴', '승강기 소리가 여기까지 들려. …세븐, 로터가 기밀을 말해 주면 나한테도 알려 줘.']] },
      { lines: [['랜턴', '동굴 끝에 물 떨어지는 소리가 있어. 거기까지는 아직 못 가 봤어.']] },
    ],
  },
  mina: {
    first: [
      ['로터', 'SV-7. 위치 확인. 화물 상태… 외장 긁힘, 기억 장치 손상. 그래도 작동하는군.'],
      ['로터', '회전익은 멀쩡해. 동력 결정이 숲에 흩어졌어. 서른 개를 모으면 다시 뜰 수 있다.'],
      [N, '셔터 말로는, 네가 끝까지 붙잡은 게 나였다고 하던데.'],
      ['로터', '…배송 지시서 1순위였으니까. 「SV-7과 탑재물 C를 수취인에게. 경로 기록 금지.」'],
      [N, '탑재물 C가 뭔데?'],
      ['로터', '네 몸 안에 있어. 그 이상은 나도 몰라. 수취인 주소는 숲 건너편 도시야.'],
    ],
    again: [
      { lines: [['로터', '결정 {n} / 30. 해가 지기 전에 최대한 모아.']] },
      { lines: [['로터', '다람쥐가 가져간 결정은 보통 높은 곳에 있어. 저 녀석들은 위에서 내려다보는 걸 좋아하거든.']] },
      { when: (g) => (g.save.memories || []).length > 0, lines: [['로터', '기억이 돌아오고 있다고? …좋아. 하지만 들은 걸 아무한테나 말하진 마.']] },
      { when: (g) => g.save.charged, lines: [['로터', '울타리 틈 앞에서 기다린다. 이번엔 놓치지 않아.']] },
    ],
  },
};

// recovered memory records: they surface as the crystals come back (a warm, faded flashback)
export const MEMORY = {
  10: ['[복구된 기록 · 일부]', '형광등 아래 작업대. 누군가 세븐의 안테나를 조이며 혼잣말을 한다.', '"너는 작아야 해. 작은 건, 아무도 찾지 않으니까."'],
  20: ['[복구된 기록 · 일부]', '같은 목소리. 이번엔 숨이 가쁘다. 멀리서 경보음.', '"SV-7, 코어는 네 안에 있어. 우리 집으로 가. 그리고… 아무도 믿지 마."'],
};

// the turn of the chapter (not an ending): Rotor flies up to wait at the fence gap
export const CHAPTER = [
  '서른 번째 결정이 연결되자, 로터의 회전익이 낮게 울리기 시작했다.',
  '로터가 저장해 둔 배송 지시서의 잠금이 풀린다. 수취인: 한서윤 박사. 주소: 숲 건너편 도시.',
  '발신처는 3년 전 폐쇄된 연구소였다.',
  '"울타리 틈에서 만나. 거기서부터는 내가 너를 들고 난다." 로터가 먼저 날아올랐다.',
];

// the fence gap: a stranger out for a walk in the forest sees a little robot and simply takes it home
export const CAPTURE = {
  see: [['낯선 사람', '어? …이게 뭐야?']],
  look: [['낯선 사람', '장난감인가? 와, 되게 정교하네. 눈이 움직여.']],
  take: [['낯선 사람', '누가 버리고 갔나 보다. …같이 가자, 꼬마야.']],
};
export const CAPTURE_END = [
  '바구니 뚜껑이 닫혔다. 엮은 틈으로 빛이 조각조각 들어온다.',
  '거인의 걸음에 맞춰 세계가 흔들린다. 로터의 신호가 점점 멀어진다.',
  '탐사 기록 010. 미확인 거인에게 포획됨. 의도 불명. …무섭다.',
];

// chapter 2: the car ride to New York, then the stranger's house (a detached house in the outer boroughs) at night
export const CAR = {
  title: '2장 · 거인의 집',
  lines: [
    [2.5, '탐사 기록 011. 바구니째 거인의 이동 장치에 실렸다. 엔진 소리. 진동.'],
    [10, '창밖으로 나무가 흘러간다. 내가 있던 숲이 멀어진다.'],
    [17, ['낯선 사람', '집에 가면 깨끗이 닦아 줄게. 흙투성이네.']],
    [23, '거대한 다리를 건넌다. 물 건너편에 불빛의 숲이 솟아 있다. 표지판에 거인들의 글자. NEW YORK.'],
    [29.5, '불빛이 줄어든다. 나무와 낮은 집들. 거인의 집이 가까워진다.'],
  ],
};
export const HOUSE = {
  arrive: [['낯선 사람', '자, 여기가 이제 네 집이야.'], ['낯선 사람', '내일 제대로 봐 줄게. 잘 자, 꼬마야.']],
  wake: '탐사 기록 012. 거인의 집. 위층. 불이 꺼졌다. 거인은 잠들었다. …여기서 나가야 한다.',
  room: '탐사 기록 013. 방문이 조금 열려 있다. 거인이 깨지 않게, 조용히.',
  stairs: '탐사 기록 014. 계단. 한 칸이 내 키의 절반이 넘는다. 거인의 집은 위아래로도 크다.',
  living: '탐사 기록 015. 아래층. 창밖으로 거인들의 길과 다른 집들. 부엌 쪽에서 바깥 공기 냄새가 난다.',
  yard: '탐사 기록 016. 바깥. 젖은 풀 냄새. 울타리 너머로 끝없는 불빛.',
};
export const CHAPTER2 = [
  '고양이 문을 빠져나오자 밤공기가 몸을 감쌌다. 울타리 너머, 물 건너편에 거대한 불빛의 숲이 서 있었다.',
  '뉴욕. 거인들의 도시. 로터의 지도에도 없는 크기.',
  '어딘가에 로터가 있다. 셔터와 랜턴도. 그리고 한서윤 박사도.',
  '세븐은 처음으로 자기가 얼마나 작은지 알았다. 그래도 가야 한다는 것도.',
];
