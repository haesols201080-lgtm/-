// The story: the days of Part One and Part Two, then the Ministry of Love.
// Each day is an async script (src/game/script/dayN.js) that uses the kit
// below; between beats the player is free to roam. Saves after each day.
import * as THREE from 'three';
import { DAYS } from './script/index.js';
import { store } from '../core/store.js';

const DOW = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();

export function setupStory(G) {
  const S = G.state;
  let dayDef = null;
  const story = {
    running: false,
    date() {
      const d = dayDef || DAYS[S.day] || DAYS[1];
      const [y, m, dd] = d.date;
      return { y, m, d: dd, w: DOW(y, m, dd) };
    },
    // the living range for the hour (docs/design.md)
    allowedZones() {
      const m = S.minutes % 1440;
      const f = S.flags;
      const z = new Set();
      if (S.part === 3) return new Set(['!interior']);
      if (m < 7 * 60 || m >= 23 * 60) return z;
      if (f.sunday) ['mansions', 'avenue', 'square', 'station', 'community', 'cafe'].forEach((k) => z.add(k));
      else if (m < 8 * 60 + 30) ['mansions', 'avenue', 'square', 'minitrue'].forEach((k) => z.add(k));
      else if (m < 18 * 60) ['minitrue', 'square'].forEach((k) => z.add(k));
      else ['mansions', 'avenue', 'square', 'minitrue', 'community', 'cafe'].forEach((k) => z.add(k));
      if (f.invited_obrien && m >= 18 * 60) z.add('inner');
      return z;
    },
    canEnter(id) { return id === 'station' ? !!S.flags.sunday : true; },
    save() {
      const data = { day: S.day, suspicion: S.suspicion, record: S.record, flags: S.flags, inventory: S.inventory, money: S.money };
      store.set('1984.save', JSON.stringify(data));
    },
    load() {
      try { const d = JSON.parse(store.get('1984.save')); if (d) Object.assign(S, d); return !!d; } catch (e) { return false; }
    },
    async start(newGame) {
      if (!newGame) story.load();
      else { S.day = 1; S.flags = {}; S.suspicion = 0; S.record = 0; S.inventory = []; }
      story.running = true;
      while (story.running && !S.ending) {
        dayDef = DAYS[S.day];
        if (!dayDef) break;
        G.weather.set(dayDef.weather);
        G.atmos.setWeather(dayDef.weather, true);
        try { await dayDef.run(G, kit); }
        catch (e) { if (e && e.ending) break; console.error(e); break; }
        if (S.ending) break;
        S.record = Math.max(S.record, S.suspicion * 0.35);
        S.day++;
        story.save();
      }
    },
  };

  // ------------------------------------------------------------ the kit

  const ui = () => G.ui;
  const kit = {
    G, S, ui: () => G.ui,
    say: (who, text, o) => G.ui.say(who, text, o),
    narrate: (text, o) => G.ui.say('', text, o),
    choose: (opts, o) => G.ui.choice(opts, o),
    objective: (m, opt) => G.ui.objective(m, opt),
    toast: (t) => G.ui.toast(t),
    flag: (k, v = true) => { S.flags[k] = v; },
    has: (k) => !!S.flags[k],
    give: (item) => { if (!S.inventory.includes(item)) S.inventory.push(item); },
    time: (h, m = 0) => G.setTime(h * 60 + m),
    clock: (scale) => { G.clock.scale = scale; },
    wait: (s) => G.wait(s),
    async cut(fn) { G.cutscene++; try { return await fn(); } finally { G.cutscene--; } },
    // put the player somewhere, with a fade
    go: (loc, spawn, o) => G.teleport(loc, spawn, o),
    // wait for the player to enter a location
    enter: (loc) => (G.state.location === loc ? Promise.resolve() : new Promise((res) => { const off = G.events.on('enter', (id) => { if (id === loc) { off(); res(); } }); })),
    // wait until a minute of the day
    until: (h, m = 0) => G.until(() => (S.minutes % 1440) >= h * 60 + m),
    // an action at a place, resolved when used
    use(o) {
      return new Promise((res) => {
        const off = G.interact({ ...o, use: () => { if (o.once !== false) off(); res(); } });
        kit._offs.push(off);
      });
    },
    _offs: [],
    // the player reaching an area
    reach(o) {
      return new Promise((res) => { G.trigger({ ...o, once: true, enter: res }); });
    },
    actor(o) {
      const loc = o.location;
      const pts = (G.interiors && G.interiors.points[loc]) || {};
      const p = o.at ? (pts[o.at] || (G.world && G.world.points[o.at]) || (G.country && G.country.points[o.at])) : null;
      const x = p ? p.x : o.x, z = p ? p.z : o.z;
      const n = G.npcs.spawn({ ...o, x: x + (o.dx || 0), z: z + (o.dz || 0) });
      if (n && o.sit) n.setAnim('sit', 0);
      return n;
    },
    point(loc, name) {
      const pts = (G.interiors && G.interiors.points[loc]) || {};
      return pts[name] || (G.world && G.world.points[name]) || (G.country && G.country.points[name]);
    },
    // the player seated at a point, looking somewhere
    seat(loc, name, lookAt) {
      const p = kit.point(loc, name);
      if (p) G.player.place(p.x, 0, p.z, G.player.yaw);
      G.player.seated = 1;
      if (lookAt) G.player.lookTarget = lookAt;
    },
    stand() { G.player.seated = 0; G.player.lookTarget = null; },
    chapter: (big, small, sec) => G.ui.title(big, small, sec),
    async ending(id) {
      S.ending = id;
      story.running = false;
      await ENDINGS[id](G, kit);
      throw { ending: id };
    },
    crowd(on) { if (G.npcs) G.npcs.setCrowdDensity('city', on); },
  };
  // crowds follow the hour: busy at the commute, thin in the evening, gone at night
  G.events.on('minute', (m) => {
    if (!G.npcs) return;
    const h = (m % 1440) / 60;
    const d = h < 6.5 || h >= 23 ? 0.04 : (h < 9 || (h >= 17.8 && h < 19.5)) ? 1 : 0.55;
    G.npcs.setCrowdDensity('city', d);
    const out = h >= 6.5 && h < 22.5;
    for (const n of G.npcs.list) if (n.ambient) n.visible = out;
  });

  G.events.on('arrest', async (reason) => {
    if (S.part === 3 || S.ending || kit._arresting) return;
    kit._arresting = true;
    try { await kit.ending('vaporized'); } catch (e) { /* ended */ }
  });

  G.story = story;
  G.kit = kit;
  return story;
}

// ------------------------------------------------------------ endings

const CREDITS = ['원작 · 조지 오웰 『1984』 (1949)', '인물 · Microsoft Rocketbox Avatar Library (MIT)', '재질 · ambientCG, Poly Haven (CC0)', 'three.js · Blender'];

export const ENDINGS = {
  async vaporized(G, kit) {
    G.cutscene++;
    G.renderer.u.uAlarm.value = 1;
    G.ui.telescreen('6079 스미스 W. 그 자리에 그대로 있어라.', 5);
    await G.wait(2.5);
    await G.fade(1, 1.5);
    await G.ui.ending('증발', [
      '그들은 밤에 왔다. 언제나 밤이었다.',
      '이튿날 아침, 기록국의 누군가가 몇 장의 쪽지를 받았다.',
      '윈스턴 스미스의 이름은 모든 명부에서 지워졌다. 그가 한 일의 기록도, 그가 존재했다는 기록도.',
      '윈스턴 스미스라는 사람은 존재한 적이 없다.',
    ], CREDITS);
  },
  async loved_bb(G, kit) {
    await G.ui.ending('그는 빅 브라더를 사랑했다', [
      '투쟁은 끝났다.',
      '그는 자기 자신을 이겨 낸 것이다.',
      '그는 빅 브라더를 사랑했다.',
    ], CREDITS);
  },
  async again(G, kit) {
    await G.ui.ending('처음부터 다시', [
      '"그렇다면 처음부터 다시 시작하지." 오브라이언이 말했다.',
      '1984년 4월 4일. 시계가 열세 번을 쳤다.',
      '서랍 속에는 일기장이 없었다.',
    ], CREDITS);
  },
  async informer(G, kit) {
    await G.ui.ending('밀고자', [
      '그녀의 이름은 기록에서 지워졌다. 그 쪽지는 윈스턴의 책상으로 왔다.',
      '그는 스피크라이트에 대고 또박또박 불렀다. 그런 사람은 없었다고.',
      '그날 저녁, 텔레스크린이 그의 근면을 칭찬했다.',
    ], CREDITS);
  },
};
