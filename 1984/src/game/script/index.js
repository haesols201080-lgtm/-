// The calendar of the story: date, weather and script for each day.
import { day1 } from './day1.js';

async function notYet(G, k) {
  await G.ui.fadeText(['(이후의 날들은 준비 중이다.)', '빅 브라더가 당신을 지켜보고 있다.'], { keep: true });
  G.state.ending = 'wip';
}

export const DAYS = {
  1: { date: [1984, 4, 4], weather: 'clear_cold', run: day1 },
  2: { date: [1984, 4, 5], weather: 'overcast', run: notYet },
};
