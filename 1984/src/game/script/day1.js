// Part One, Tuesday 4 April 1984. "It was a bright cold day in April, and
// the clocks were striking thirteen."
import * as THREE from 'three';

export const SLIPS_DAY1 = [
  {
    slip: 'times 17.3.84 bb speech malreported africa rectify', date: '17 MARCH 1984',
    gloss: '빅 브라더의 연설이 잘못 보도되었다. 아프리카. 바로잡을 것.',
    original: '빅 브라더는 어제 연설에서 남인도 전선은 조용할 것이며, 유라시아군의 공세가 곧 북아프리카에서 시작될 것이라고 예언했다.',
    options: [
      { text: '…유라시아군의 공세가 곧 남인도에서 시작될 것이라고 예언했다.', ok: true },
      { text: '…북아프리카에서 시작될 것이라고 예언했다. (그대로 둔다)', ok: false, note: '실제 공세는 남인도에서 일어났다. 기록이 사실과 어긋난 채 남았다.' },
    ],
  },
  {
    slip: 'times 14.2.84 miniplenty malquoted chocolate rectify', date: '14 FEBRUARY 1984',
    gloss: '풍요부의 발표가 잘못 인용되었다. 초콜릿. 바로잡을 것.',
    original: '풍요부는 1984년 중에 초콜릿 배급량을 줄이는 일은 없을 것이라고 확약했다.',
    options: [
      { text: '…4월 중 초콜릿 배급량을 조정해야 할 수도 있다고 경고했다.', ok: true },
      { text: '…배급량을 30그램에서 20그램으로 줄인다고 발표했다.', ok: false, note: '"줄인다"는 말은 쓰지 않는다. 배급은 언제나 늘어난다.' },
    ],
  },
  {
    slip: 'times 19.12.83 forecasts 3 yp 4th quarter 83 misprints verify current issue', date: '19 DECEMBER 1983',
    gloss: '제9차 3개년 계획, 83년 4분기 예측치 오식. 최신 호와 대조할 것.',
    original: '구두 생산 예측치: 1억 4천 5백만 켤레. (실제 생산량: 6천 2백만 켤레)',
    options: [
      { text: '구두 생산 예측치: 5천 7백만 켤레.', ok: true },
      { text: '구두 생산 예측치: 1억 4천 5백만 켤레. (고치지 않는다)', ok: false, note: '예측보다 적게 만들었다는 기록은 남을 수 없다.' },
    ],
  },
  {
    slip: 'times 3.12.83 reporting bb dayorder doubleplusungood refs unpersons rewrite fullwise upsub antefiling', date: '3 DECEMBER 1983',
    gloss: '빅 브라더의 일일 명령 보도. 비인간에 대한 언급, 더없이 나쁨. 완전히 다시 쓰고, 보관 전에 상신할 것.',
    original: '빅 브라더는 오늘 일일 명령에서 FFCC의 위더스 동무에게 이등 뛰어난 공훈 훈장을 수여했다.',
    options: [
      { text: '빅 브라더는 오늘 전사한 오길비 동무를 기렸다. 그는 세 살에 장난감을 거부하고 북만을 원했으며, 평생 담배도 술도 입에 대지 않았다.', ok: true },
      { text: '위더스 동무는 원래 없던 사람이다. 문단을 지운다.', ok: false, note: '빈자리는 의심을 부른다. 비인간의 자리는 다른 이야기로 채워야 한다.' },
    ],
  },
];

export async function day1(G, k) {
  const S = G.state;
  // ---- 07:15, the flat. The whistle, the Physical Jerks.
  k.time(7, 14);
  k.crowd(1);
  G.enter('flat', 'bed');
  G.renderer.u.uFade.value = 1; G.fadeValue = 1;
  G.ui.hudVisible(false);
  await k.cut(async () => {
    await G.ui.fadeText(['1부', '1984년 4월 4일 화요일', '맑고 추운 사월의 어느 날, 시계가 열세 번을 치고 있었다.'], { each: 2.0, hold: 1.0 });
    G.audio.play('whistle');
    G.art.telescreen.set('jerks', 'THIRTY TO FORTY GROUP!');
    await G.fade(0, 2.5);
    G.player.lookTarget = k.point('flat', 'telescreen');
    await k.say('텔레스크린', '서른에서 마흔! 서른에서 마흔 조! 제자리에 서세요. 서른에서 마흔!');
    await k.say('체조 강사', '팔 굽혀 펴기! 제 박자에 맞춰요. 하나, 둘, 셋, 넷! 자, 동무들, 기운 좀 내요!');
    G.player.lookTarget = null;
  });
  G.ui.hudVisible(true);
  const misses = await G.ui.jerks({ beats: 10 });
  G.art.telescreen.set('figures');
  if (misses > 3) await k.say('체조 강사', '6079 스미스 W! 네, 당신 말이에요! 좀 더 숙이세요! 당신은 더 할 수 있어요.');
  else await k.say('체조 강사', '좋아요, 동무들. 바로 그거예요. 말라바르 전선의 우리 병사들을 생각하세요!');
  k.time(7, 32);

  // ---- the commute
  k.clock(0.5);
  k.objective('08:30까지 진리부에 출근한다', ['M: 지도 · 초록색이 지금의 생활 범위']);
  G.ui.toast('텔레스크린의 시야 안에서는 뛰지 않는 편이 좋다.', 6);
  const late = G.events.on('minute', (m) => {
    if (m % 1440 === 8 * 60 + 45 && S.location !== 'records') { G.ui.telescreen('6079 스미스 W. 근무 시간이다.'); G.surv.add(10); }
  });
  await k.enter('records');
  late();
  if (S.minutes % 1440 > 8 * 60 + 40) { G.surv.add(8); G.ui.toast('지각했다. 누군가 그것을 적었을 것이다.'); }

  // ---- the Records Department
  k.clock(0);
  k.time(8, 40);
  k.objective('칸막이 자리에 앉아 업무를 시작한다');
  const room = 'records';
  const fillers = [];
  for (let i = 0; i < 8; i++) {
    const n = k.actor({ model: ['char_party_man', 'char_party_woman', 'char_party_man_b', 'char_syme'][i % 4], location: room, x: G.interiors.rooms.records.ox + (i % 2 ? 4.6 : -4.6) + (i % 2 ? -0.6 : 0.6), z: 8 - Math.floor(i / 2) * 3.2 - (i > 3 ? 3.2 : 0), sit: true, yaw: i % 2 ? -Math.PI / 2 : Math.PI / 2 });
    if (n) fillers.push(n);
  }
  await k.use({ location: room, pos: k.point(room, 'cubicle_seat').clone().setY(1.1), label: '스피크라이트를 당겨 업무를 시작한다' });
  k.seat(room, 'cubicle_seat');
  G.audio.play('tube');
  await k.narrate('기압관에서 쪽지 네 장이 툭툭 떨어졌다. 진리부의 일이란, 과거를 늘 지금과 맞게 고쳐 두는 것이었다.');
  const res = await G.ui.work(SLIPS_DAY1);
  const wrong = res.filter((r) => !r.ok).length;
  if (wrong) G.surv.add(wrong * 6);
  k.stand();
  await k.narrate('바로잡은 원본은 기억 구멍으로 떨어졌다. 따뜻한 공기에 실려, 건물 깊숙이 숨은 거대한 화로로.');

  // ---- 11:00 the Two Minutes Hate
  k.time(10, 58);
  for (const n of fillers) n.remove();
  const crowd = [];
  const R = G.interiors.rooms.records;
  for (let row = 0; row < 3; row++) {
    for (let c = 0; c < 8; c++) {
      const x = R.ox - 3.5 + c, z = -10 + row * 1.4;
      if (row === 2 && c === 3) continue;            // Winston's seat
      if (row === 2 && c === 5) continue;            // O'Brien sits a couple of places away
      const n = k.actor({ model: ['char_party_man', 'char_party_woman', 'char_party_man_b', 'char_parsons', 'char_syme'][(row * 8 + c) % 5], location: room, x, z, yaw: Math.PI, sit: true });
      if (n) { n.look = new THREE.Vector3(R.ox, 2.3, -14.6); crowd.push(n); }
    }
  }
  const julia = k.actor({ id: 'julia', model: 'char_julia', location: room, x: R.ox - 0.5, z: -7.2 + 1.4, yaw: Math.PI, sit: true });
  const obrien = k.actor({ id: 'obrien', model: 'char_obrien', location: room, x: R.ox + 1.5, z: -7.2, yaw: Math.PI, sit: true });
  if (julia) crowd.push(julia);
  if (obrien) crowd.push(obrien);
  await k.cut(async () => {
    await k.narrate('열한 시가 다 되었다. 사람들이 칸막이에서 의자를 끌고 나와 큰 텔레스크린 앞에 모였다. 2분 증오가 시작될 참이었다.');
    G.player.place(R.ox - 0.5, 0, -7.2, 0); G.player.seated = 1;
    G.player.lookTarget = julia ? julia.root.position.clone().setY(1.3) : null;
    await k.narrate('검은 머리의 여자가 바로 뒤에 앉았다. 소설국의 그 여자. 허리에 청년 반섹스 연맹의 진홍 띠를 감은.');
    G.player.lookTarget = obrien ? obrien.root.position.clone().setY(1.3) : null;
    await k.narrate('그리고 오브라이언. 내부당원의 검은 작업복. 그가 손목시계를 보더니, 같은 줄 두어 자리 건너에 앉았다.');
    G.player.lookTarget = k.point(room, 'screen');
  });
  // the Hate itself
  G.art.telescreen.set('hate');
  G.art.telescreen.hate = 0;
  G.audio.play('telescreen_bark');
  const hateLen = 70;
  const t0 = G.time;
  const ramp = G.onUpdate(() => {
    const p = Math.min(1, (G.time - t0) / hateLen);
    G.art.telescreen.hate = p;
    const k2 = p < 0.15 ? p / 0.15 * 0.35 : p < 0.72 ? 0.35 + (p - 0.15) / 0.57 * 0.65 : p < 0.82 ? 1 : Math.max(0, 1 - (p - 0.82) * 6);
    for (const n of crowd) if (n !== obrien) n.hate = k2 * (0.8 + 0.2 * Math.sin(n.hatePhase));
    if (obrien) obrien.hate = k2 * 0.25;
    G.audio.hateCrowd(k2);
  });
  setTimeout(() => { if (julia) julia.say('돼지! 돼지! 돼지!', 3); }, 32000);
  setTimeout(() => { if (julia) julia.say('(무거운 신어 사전을 화면에 던진다)', 3); }, 36000);
  const part = await G.ui.hate(hateLen);
  ramp();
  G.audio.hateCrowd(0);
  for (const n of crowd) n.hate = 0;
  S.flags.hate1 = part;
  await k.cut(async () => {
    await k.narrate('적의 얼굴이 빅 브라더의 얼굴로 녹아들었다. 검은 콧수염, 힘과 신비로운 고요로 가득 찬. 그리고 당의 세 슬로건.');
    await k.say('옆 칸막이의 작은 여자', '나의… 구세주여!');
    G.player.lookTarget = obrien ? obrien.root.position.clone().setY(1.55) : null;
    if (obrien) obrien.look = 'player';
    await G.wait(1.2);
    await k.narrate('그 순간 오브라이언과 눈이 마주쳤다. 한 찰나였지만, 윈스턴은 알 수 있었다. 오브라이언도 같은 생각을 하고 있다는 것을.');
    await k.narrate('「나도 당신과 같은 편이오.」 그 눈이 그렇게 말하는 것 같았다. 그리고 그것으로 끝이었다.');
    if (obrien) obrien.look = null;
    G.player.lookTarget = null; G.player.seated = 0;
  });
  G.art.telescreen.set('figures');
  if (part < 0.35) { G.surv.add(15); G.ui.toast('혼자만 조용했다. 표정죄라는 말이 있다.'); }
  for (const n of crowd) n.remove();

  // ---- lunch: Syme and Parsons
  k.time(12, 10);
  k.objective('지하 식당으로 내려가 점심을 먹는다');
  await k.enter('canteen');
  const syme = k.actor({ id: 'syme', model: 'char_syme', location: 'canteen', at: 'table', dx: 0.6, dz: 0.75, yaw: Math.PI, sit: true });
  const parsons = k.actor({ id: 'parsons', model: 'char_parsons', location: 'canteen', at: 'counter', dx: 2, dz: 0, yaw: Math.PI });
  const eaters = [];
  for (let i = 0; i < 10; i++) {
    const C = G.interiors.rooms.canteen;
    const n = k.actor({ model: ['char_party_man', 'char_party_woman', 'char_party_man_b'][i % 3], location: 'canteen', x: C.ox - 3 + (i % 3) * 4 + (i % 2 ? 0.6 : -0.6), z: -1 + Math.floor(i / 6) * 3.4 + (i % 2 ? 0.75 : -0.75), yaw: i % 2 ? Math.PI : 0, sit: true });
    if (n) eaters.push(n);
  }
  await k.use({ location: 'canteen', pos: syme ? syme.root.position.clone().setY(1.2) : k.point('canteen', 'table'), label: '사임의 맞은편에 앉는다', radius: 2.4 });
  await k.cut(async () => {
    k.seat('canteen', 'table', syme ? syme.root.position.clone().setY(1.2) : null);
    if (syme) { syme.look = 'player'; syme.setAnim('sit'); }
    await k.say('사임', '마침 찾고 있었소. 혹시 면도날 좀 있소?');
    await k.say('윈스턴', '하나도 없네. 나도 6주째 같은 날을 쓰고 있어.');
    await k.say('사임', '신어 사전 11판 작업은 잘되어 가오. 우리는 단어를 만드는 게 아니오. 없애고 있지. 날마다 수십 개씩, 수백 개씩.');
    await k.say('사임', '단어를 없애는 건 아름다운 일이오. 「좋다」가 있는데 「나쁘다」가 왜 필요하오? 「안좋다」면 되지. 「아주 좋다」 대신 「더좋다」, 그보다 더하면 「겹더좋다」.');
    const c = await k.choose(['「흥미롭군.」 (맞장구친다)', '「그러면 결국 생각할 말이 남지 않겠군.」']);
    if (c === 1) {
      await k.say('사임', '바로 그거요! 신어의 목적은 사고의 폭을 좁히는 것이오. 결국 사상죄는 문자 그대로 불가능해질 거요. 그것을 표현할 단어가 없을 테니까.');
      await k.narrate('사임의 눈이 윈스턴의 얼굴을 훑었다. 언젠가 사임은 증발될 것이다. 너무 똑똑하다. 너무 똑똑하게 본다.');
      G.surv.add(3);
    } else {
      await k.say('사임', '2050년쯤이면 우리가 지금 나누는 이런 대화를 알아들을 사람은 하나도 남지 않을 거요.');
    }
    if (parsons) { parsons.walkTo(G.player.pos.x + 1.2, G.player.pos.z + 0.4); await G.wait(1.5); parsons.look = 'player'; parsons.setAnim('talk'); }
    await k.say('파슨스', '아, 여기 있었구먼, 동무! 증오 주간 모금이오. 집집마다 내는 거. 우리 맨션이 제일 많이 내야지, 안 그렇소?');
    const pay = await k.choose(['2달러를 낸다', '「다음에 내지.」']);
    if (pay === 0) { S.money -= 2; S.flags.paid_parsons = true; await k.say('파슨스', '훌륭하오! 우리 애들이 그러는데, 동무 같은 사람이 많아야 한다더군.'); }
    else { G.surv.add(4); await k.say('파슨스', '그래요? …뭐, 그럼 다음에.'); await k.narrate('파슨스는 수첩에 무언가를 적었다.'); }
    if (parsons) parsons.setAnim('idle');
    k.stand();
  });
  for (const n of eaters) n.remove();
  if (syme) syme.remove();
  if (parsons) parsons.remove();

  // ---- the afternoon passes; evening is free
  await k.cut(async () => {
    await G.fade(1, 1);
    await G.ui.fadeText(['오후 내내 쪽지가 떨어졌고, 원본은 기억 구멍으로 사라졌다.'], { each: 2.2, hold: 0.5 });
    k.time(18, 0);
    G.enter('city', 'minitrue_door');
    await G.fade(0, 1.5);
  });
  k.clock(0.6);
  k.objective('집으로 돌아가, 텔레스크린에서 보이지 않는 벽감에서 일기를 쓴다', ['커뮤니티 센터에 얼굴을 비춘다 (의심을 줄인다)', '23:00 통행금지 전에는 집에 있어야 한다']);
  const cc = G.world.points.community_door;
  const off = G.interact({
    location: 'city', pos: cc.clone().setY(1.3), radius: 2.5, label: '커뮤니티 센터에서 저녁 강연을 듣는다',
    enabled: () => !S.flags.cc1,
    use: async () => {
      S.flags.cc1 = true;
      await k.cut(async () => {
        await G.fade(1, 0.8);
        await G.ui.fadeText(['체스 판과 탁구대. 「잉속과 체스」라는 강연. 한 시간이 흘렀다.']);
        G.setTime(S.minutes + 70);
        S.suspicion = Math.max(S.record, S.suspicion - 15);
        await G.fade(0, 1);
      });
      G.ui.toast('공동체 생활에 충실했다. 의심이 조금 줄었다.');
    },
  });

  // the diary, in the alcove
  await k.enter('flat');
  const alcove = k.point('flat', 'alcove_seat');
  await k.use({ location: 'flat', pos: alcove.clone().setY(0.9), label: '서랍에서 일기장을 꺼낸다', radius: 1.6 });
  // seated in the alcove the telescreen cannot see him; anywhere else it can
  G.surv.flag('forbidden', true);
  k.seat('flat', 'alcove_seat');
  G.player.yaw = 0;
  const lines = await G.ui.diary({
    steps: [
      { write: 'April 4th, 1984.' },
      {
        choose: [
          { label: '어젯밤 본 전쟁 영화', text: '어젯밤 영화관. 모두 전쟁 영화. 피난민을 가득 태운 배가 폭격당하는 장면에서 관객들은 웃었다. 프롤 좌석의 한 여자만이 소리쳤다. 애들 앞에서 저런 걸 보여 주면 안 된다고…' },
          { label: '오늘 아침의 2분 증오', text: '오늘 아침 2분 증오 때 오브라이언과 눈이 마주쳤다. 그는 알고 있다. 그는 내 편이다. 아니면 그렇게 믿고 싶은 것인지도.' },
          { label: '누구를 위해 쓰는가', text: '누구를 위해 이것을 쓰는가. 미래를 위해, 아직 태어나지 않은 사람들을 위해. 미래가 지금과 같다면 듣지 않을 것이고, 다르다면 이 고민은 무의미할 것이다.' },
        ],
      },
      { repeat: 'DOWN WITH BIG BROTHER', times: 5, hint: '아무 키나 누를 때마다 펜이 저절로 움직인다…' },
    ],
  });
  G.surv.flag('forbidden', false);
  S.flags.diary = true;
  k.give('diary');
  k.stand();
  await k.narrate('공포가 몸을 훑고 지나갔다. 썼든 안 썼든 마찬가지였다. 사상경찰은 그를 잡을 것이다. 사상죄는 죽음을 수반하지 않는다. 사상죄가 곧 죽음이다.');
  // the knock
  G.audio.play('door');
  await k.narrate('쾅, 쾅. 문 두드리는 소리. 벌써?');
  await k.say('파슨스 부인', '아, 동무. 들어오시는 소리를 들은 것 같아서요. 잠깐 와서 부엌 싱크대 좀 봐 주시겠어요? 막혀 버려서….');
  const help = await k.choose(['파슨스 부인을 따라간다', '「지금은 곤란합니다.」']);
  if (help === 0) {
    await G.teleport('parsons_flat', 'door');
    const kid1 = k.actor({ id: 'kid1', model: 'char_child', location: 'parsons_flat', x: G.interiors.rooms.parsons_flat.ox - 1, z: 0.5, yaw: -1.2 });
    const mrs = k.actor({ id: 'mrsp', model: 'char_party_woman', location: 'parsons_flat', at: 'sink', dx: -0.8, yaw: 1.5 });
    if (kid1) { kid1.look = 'player'; kid1.say('너 반역자지! 사상범! 유라시아 간첩! 쏴 버릴 거야! 소금 광산으로 보내 버릴 거야!', 4); }
    await k.use({ location: 'parsons_flat', pos: k.point('parsons_flat', 'sink').clone().setY(1), label: '배수관에서 엉킨 머리카락을 빼낸다' });
    await k.say('파슨스 부인', '고마워요. 애들이 오늘 교수형 구경을 못 가서 저렇게 난리예요. 유라시아 포로들을 매단다나요.');
    await k.narrate('저 아이들은 언젠가 제 부모를 고발할 것이다. 거의 모든 아이들이 그랬다.');
    if (kid1) kid1.remove();
    if (mrs) mrs.remove();
    await G.teleport('flat', 'bed');
  } else {
    G.surv.add(3);
  }
  // sleep
  k.objective('잠자리에 든다', ['23:00 통행금지 전에']);
  await k.use({ location: 'flat', pos: k.point('flat', 'bed').clone().setY(0.6), label: '잠자리에 든다', radius: 2 });
  off();
  await k.cut(async () => {
    await G.fade(1, 2);
    await G.ui.fadeText(['그는 어머니의 꿈을 꾸었다. 그리고 황금의 나라를.', '「우리는 어둠이 없는 곳에서 만날 것이오.」'], { each: 2.6 });
  });
}
