// Story — Chapter 1: the forest.
// Tone: a small survey machine alone in a world built at another scale. Field-log voice, dry, observant; the
// mystery is carried by recovered memory records, not by exposition. Nothing ends — each region opens the next.
//   Survey unit N-07 "Nuri" was being carried by the transport drone Mina when a storm brought her down in a forest.
//   Its core memory is damaged. What it carries, and who it was sent to, comes back one record at a time.

export const INTRO = [
  '수송 드론 M-3 「미나」 — 비행 기록 마지막 줄: 강풍. 고도 상실. 화물칸 개방.',
  '소형 탐사 유닛 N-07 「누리」. 키 35센티미터. 주 기억 장치 손상.',
  '그리고 아침. 누리는 자기 몸보다 열 배는 큰 고사리 아래에서 다시 켜졌다.',
];

// field log: Nuri's own notes as each objective comes up
export const LOG = {
  first: '탐사 기록 001. 착륙 지점 불명. 주변 물체가 모두 비정상적으로 크다. …아니, 내가 작은 것이다. 근처에 미나의 동력 결정 반응.',
  toto: '탐사 기록 002. 북서쪽 거목 뿌리 부근에서 기록 유닛 토토의 식별 신호. 신호가 약하다.',
  gate: '탐사 기록 003. 녹슨 철문. 거인들이 세운 구조물. 압력판으로 여닫는 방식으로 보인다. 내 무게로는 부족하다.',
  booster: '탐사 기록 004. 그루터기 위에서 미확인 추진 장치 반응. 사람이 만든 물건은 아니다. 우리 쪽 규격이다.',
  bori: '탐사 기록 005. 조명 유닛 보리의 마지막 위치는 바위산 아래 동굴. 어두운 곳을 피하도록 설계된 유닛이 왜 그쪽으로 갔는지는 모르겠다.',
  cell: '탐사 기록 006. 바위산 옆 승강 장치. 전원 없음. 보리가 속 빈 통나무 안에서 동력 셀을 봤다고 했다.',
  mina: '탐사 기록 007. 전망 바위 정상에서 미나의 비콘. 기체는 살아 있다.',
  charge: '탐사 기록 008. 미나의 비행에 필요한 결정은 서른 개. 기억이 돌아올 때마다, 결정 하나의 무게가 달라진다.',
  garden: '탐사 기록 009. 울타리 너머 거인의 거주지. 기록 속 주소와 일치한다.',
};

const N = '누리';
// first: the first meeting. again: later lines — each may carry a condition on the progress (when)
export const TALK = {
  toto: {
    first: [
      ['토토', '…N-07? 다행이다. 바퀴가 뿌리에 물려서 이틀째 같은 하늘만 찍고 있었어.'],
      [N, '이틀? 내 기록엔 하룻밤뿐인데.'],
      ['토토', '네 시계가 틀린 거야. 넌 이틀 동안 꺼져 있었어. 고사리 아래서.'],
      ['토토', '추락 직전 영상이 남아 있어. 화물칸이 열릴 때 미나가 끝까지 붙잡고 있던 건 네가 실린 상자였어. 다른 건 다 놓쳤는데.'],
      [N, '…왜 나지?'],
      ['토토', '그건 미나한테 물어봐. 전망 바위 쪽으로 떨어졌어. 가는 길에 녹슨 문이 하나 있는데, 그 너머에 우리 규격의 장비 반응이 있어.'],
    ],
    again: [
      { lines: [['토토', '관찰 기록. 다람쥐라는 생물이 결정 하나를 물고 갔다. 먹을 수 없다는 걸 알게 되면 어딘가 높은 곳에 버리겠지.']] },
      { when: (g) => !g.save.gateOpen, lines: [['토토', '그 문, 거인들이 몇 년은 손대지 않은 것 같아. 녹이 경첩을 다 먹었어.']] },
      { when: (g) => g.save.booster, lines: [['토토', '그 추진기, 연구소 규격이야. 이 숲에 우리 말고 누가 또 왔었다는 뜻이지.']] },
      { lines: [['토토', '배터리 12퍼센트. 기록은 계속한다. 누군가는 이걸 봐야 하니까.']] },
    ],
  },
  bori: {
    first: [
      ['보리', '…불 끄지 마. 거기 서 있어 줘. 그래, 거기.'],
      ['보리', '여기 반딧불이들이 내 램프를 동족으로 아는 것 같아. 쫓아낼 수가 없더라. 덕분에 버텼지만.'],
      [N, '보리, 넌 어두운 데를 피하도록 만들어졌잖아. 왜 여기로 왔어?'],
      ['보리', '추락하는 동안 미나 화물 목록을 봤어. 네 항목만 「기밀」로 잠겨 있었어. …겁이 났어. 그래서 숨었어.'],
      ['보리', '승강기를 쓰면 미나한테 갈 수 있어. 전원은 속 빈 통나무 안 동력 셀. 내가 거기까지는 비춰 봤어.'],
    ],
    again: [
      { lines: [['보리', '반딧불이는 짝을 찾으려고 빛을 낸대. 나도 비슷한 이유로 켜져 있는 것 같아.']] },
      { when: (g) => g.save.liftPowered, lines: [['보리', '승강기 소리가 여기까지 들려. …누리, 미나가 기밀을 말해 주면 나한테도 알려 줘.']] },
      { lines: [['보리', '동굴 끝에 물 떨어지는 소리가 있어. 거기까지는 아직 못 가 봤어.']] },
    ],
  },
  mina: {
    first: [
      ['미나', 'N-07. 위치 확인. 화물 상태… 외장 긁힘, 기억 장치 손상. 그래도 작동하는군.'],
      ['미나', '로터는 멀쩡해. 동력 결정이 숲에 흩어졌어. 서른 개를 모으면 다시 뜰 수 있다.'],
      [N, '토토 말로는, 네가 끝까지 붙잡은 게 나였다고 하던데.'],
      ['미나', '…배송 지시서 1순위였으니까. 「N-07과 탑재물 C를 수취인에게. 경로 기록 금지.」'],
      [N, '탑재물 C가 뭔데?'],
      ['미나', '네 몸 안에 있어. 그 이상은 나도 몰라. 수취인 주소는 저 울타리 너머 집이다.'],
    ],
    again: [
      { lines: [['미나', '결정 {n} / 30. 해가 지기 전에 최대한 모아.']] },
      { lines: [['미나', '다람쥐가 가져간 결정은 보통 높은 곳에 있어. 저 녀석들은 위에서 내려다보는 걸 좋아하거든.']] },
      { when: (g) => (g.save.memories || []).length > 0, lines: [['미나', '기억이 돌아오고 있다고? …좋아. 하지만 들은 걸 아무한테나 말하진 마.']] },
      { when: (g) => g.save.charged, lines: [['미나', '울타리 틈 앞에서 기다린다. 이번엔 놓치지 않아.']] },
    ],
  },
};

// recovered memory records: they surface as the crystals come back (a warm, faded flashback)
export const MEMORY = {
  10: ['[복구된 기록 · 일부]', '형광등 아래 작업대. 누군가 누리의 안테나를 조이며 혼잣말을 한다.', '"너는 작아야 해. 작은 건, 아무도 찾지 않으니까."'],
  20: ['[복구된 기록 · 일부]', '같은 목소리. 이번엔 숨이 가쁘다. 멀리서 경보음.', '"N-07, 코어는 네 안에 있어. 우리 집으로 가. 그리고… 아무도 믿지 마."'],
};

// the turn of the chapter (not an ending): Mina flies, the next region opens
export const CHAPTER = [
  '서른 번째 결정이 연결되자, 미나의 로터가 낮게 울리기 시작했다.',
  '미나가 저장해 둔 배송 지시서의 잠금이 풀린다. 수취인: 한서윤 박사. 주소: 울타리 너머 정원이 딸린 주택.',
  '발신처는 3년 전 폐쇄된 연구소였다.',
  '누리는 울타리 아래 좁은 틈을 바라본다. 거인들의 집. 그리고 자기를 만든 사람의 집.',
];
