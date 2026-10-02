# 세렌 개발 안내 (다음 작업자를 위해)

이 폴더는 3D 오픈월드 게임 「세렌 — 울림이 남는 별」입니다. 저장소 루트의 다른 게임(빌더즈 팩토리)과는 별개입니다.
사용자와의 대화·문서·UI 텍스트는 한국어로 씁니다.

## 빌드와 실행
```bash
cd seren
npm install          # three, esbuild (처음 한 번)
npm run build        # src/ → index.html 한 파일 (three.js 포함, 약 1 MB)
npm run watch        # 저장할 때마다 다시 빌드
```
- **`index.html` 은 빌드 결과물이지만 커밋합니다** — 사용자가 파일 하나로 바로 열어 플레이하기 때문입니다. 소스를 고쳤으면 반드시 빌드해서 함께 커밋하세요.
- 템플릿은 `src/index.html`, 스타일은 `src/style.css`, 진입점은 `src/main.js`.
- 지형 워커는 `worker:` 접두사 import 로 별도 번들되어 문자열로 들어갑니다(tools/build.mjs 의 플러그인). 워커가 막힌 환경에서는 자동으로 메인 스레드에서 지형을 만듭니다.

## 확인 도구 (헤드리스 Chromium + SwiftShader, 느리니 인내심)
| 명령 | 용도 |
|---|---|
| `node tools/shot.mjs 이름 "쿼리" 1280x720 대기ms "페이지JS"` | 스크린샷 1장 (`shots/이름.png`) |
| `node tools/tour.mjs 1280x720 medium [필터]` | 주요 장소를 돌며 스크린샷 |
| `node tools/flow.mjs` | 본편 전체를 자동으로 진행하며 오류 확인 |
| `node tools/check.mjs move` | 이동 물리(걷기·활공·썰매) 수치 확인 |
| `node tools/heightmap.mjs 900 20000 shots/map.png` | 지형 전체 지도(2 km 격자) |
| `node tools/survey.mjs` | 지역별 높은 곳·평지 찾기 (장소 배치용) |
| `node tools/views.mjs '[{"name":"a","pos":[x,y,z],"look":[x,y,z],"t":0.7,"rel":true}]'` | 카메라를 원하는 자리에 두고 여러 장 (`rel`: 지면 기준 높이, `after`: 지형이 다 그려진 뒤 실행할 JS) |

유용한 쿼리: `play=new`(타이틀 건너뜀) · `play=continue` · `nowake=1`(오프닝 연출 생략) · `q=low|medium|high|ultra` · `bloom=0` · `debug=1`(FPS 표시) · `t=0.9`(시각).
페이지 안에서는 `SEREN.game` 으로 모든 시스템에 접근할 수 있습니다 (예: `SEREN.game.player.teleport(x, undefined, z)`, `SEREN.game.world.clock.time = 0.9`).

## 구조
```
src/
  core/    engine(렌더러·블룸·하늘→세계 2단 그리기) input(키·마우스·터치·패드) audio(합성 소리) music(생성 음악)
           noise(시드 노이즈) quality(품질 단계) events(버스)
  world/   heightfield(지형 함수: 모든 것의 기준) regions(지역 정의) terrain(+mesher, worker: 쿼드트리 LOD)
           sky(돔·우르·고리·궤도 고리·승강줄 윗부분) sky-clock(해·계절·일식) atmosphere(팔레트·공용 uniform)
           shaders(공용 GLSL: 안개·곡률·조명) materials(litMaterial/glowMaterial) water flora(+flora-geo: 3층 흩뿌리기)
           structures(+arch: 장소 빌더) currents(해류) clouds creatures(고래·긴다리·빛나방) awen(아웬 모델) colliders(2.5D 충돌)
           ── 고등 문명·스케일 (v0.2) ──
           megacity(하모네아 구역·울림탑·하늘바퀴·하늘고리·빛다리·별항구) traffic(하늘배·하늘길·왕복선)
           transit(빛길 철도·역·캡슐 타기) landmarks(지방 기술 시설) drones(돌보미) anchor(하늘닻·승강차)
           farlands(먼 땅의 구조물) colossus(걷는 도시 거신) hologram(글자 홀로그램) lights(점광원 무리)
  player/  player(이동 상태기계) avatar(모델·절차 애니메이션) camera-rig
  game/    game(중심·모드·입력·저장) state(저장 형식) quests dialogue actions language npcs resonance discovery
           world-events(일식·별비·축제·부탁) director(연출 카메라)
  ui/      ui(HUD·대화·카드·메뉴·타이틀·터치) map(지도·안개) journal settings
  data/    places(장소·평탄화) currents(해류 경로) story(인물·대사·대화·퀘스트·메아리·글자돌·도감·모아) lexicon(아웬어 사전)
```
- 좌표: 1 = 1 m, Y 위, **−Z 가 북쪽**(우르 방향), +X 동쪽. 플레이어 yaw 는 `atan2(dx, dz)`, 카메라 yaw 0 은 북쪽을 봄.
- 모든 지형 높이는 `heightAt(x, z)` 하나에서 나옵니다(렌더·충돌·배치·지도 공통). 지형을 바꾸면 `node tools/heightmap.mjs` 로 확인하세요. 장소 주변은 `places.js` 의 `flat` 으로 평탄화됩니다.
- 하늘은 별도 장면(카메라 원점, 하늘 단위 = 0.05 m)을 먼저 그리고 깊이를 지운 뒤 세계를 그립니다.
- 모든 세계 셰이더는 `shaders.js` 의 `applyFog`(높이 안개 = 하늘색)와 `curveWorld`(행성 곡률)를 씁니다. 새 셰이더도 같은 걸 써야 공기 속에 섞입니다.
- 셰이더 마지막에 `#include <tonemapping_fragment>`, `#include <colorspace_fragment>` 를 넣으세요. engine.js 가 이 조각에 NaN/무한대 방지를 끼워 넣습니다(블룸이 검게 번지는 문제 예방).

## 콘텐츠 추가하는 법
- **장소**: `data/places.js` 에 항목 추가 → `type` 에 맞는 빌더(`structures.js` 의 `_타입`)가 만듭니다. 새 타입이면 빌더 메서드를 추가.
- **해류**: `data/currents.js` (점 = [x, 높이, z, 절대?]). `unlock: 탑id` 면 그 탑을 깨울 때 흐름.
- **대사**: `data/story.js` 의 `LINES` (단어 id 배열 + 한국어). 새 단어는 `data/lexicon.js` 에 (음 모티프가 겹치지 않게).
- **대화**: `CONVOS` — `{s: 인물id, line}` / `{s:'moa', t}` / `{choice:[...]}`, `act` 로 동작 실행.
- **퀘스트**: `QUESTS` — 단계 type 은 `game/quests.js` 머리 주석 참고. 동작은 `game/actions.js` 의 `HANDLERS`.
- **부탁(날마다)**: `game/world-events.js` 의 `TEMPLATES` 에 함수 추가.
- **메아리·글자돌·도감**: `story.js` 의 `ECHOES`, `GLYPH_STONES`, `CODEX`.
- **저장 항목**: `game/state.js` 의 `defaultState()` 에 추가(불러올 때 빠진 항목은 기본값으로 채워짐).

## 큰 세계에서 알아 둘 것 (v0.2)
- 세계는 ±60 km (지형 쿼드트리 뿌리 131 km). 먼 땅은 `regions.js` 의 `far: true` 지역 + `heightfield.js` 의 `farMask` 로 바다 위에 올라옵니다.
- 카메라가 2.5 km 보다 높으면 `engine._drawScenes` 가 깊이 범위를 둘로 나눠 두 번 그립니다(먼 곳 / 가까운 곳). 30 km 에서도 깊이 정밀도가 유지됩니다.
- `atmosUniforms.uAlt` 로 높이에 따라 하늘이 검어지고 환경광이 줄어듭니다. 공기 밀도 `airDensity(y)`(player.js)가 낙하·활공 속도를 정합니다.
- 하늘 높이의 충돌체에는 `sky: true` 를 붙이세요. 「그 자리의 맨 위 땅」을 찾는 질의(y=1e5)에서 빠져서, 땅 위의 인물이 30 km 위로 튀어 오르지 않습니다.
- 침묵 구역(`uSilence`)은 10칸. 큰 공명탑(`great: true`)은 반지름 3.6 km, 최대 0.65 로 색을 덜 뺍니다. `mobile: true` 탑(거신 등)은 정적 충돌체 없이 `colossus.js` 가 매 프레임 옮깁니다.
- 움직이는 발판(큰배·짐배·거신 갑판·주조소 섬)은 `colliders` 의 `obj` 충돌체. 옮긴 뒤 `updateDynamic` 을 불러 주고, 플레이어는 `_carry` 로 한 번만 실려 갑니다.
- 퀘스트 `awaken` 단계는 `great: true` 면 큰 공명탑만, 아니면 대륙의 탑만 셉니다.

## 성능 메모
- 가장 무거운 것: 지형 청크(그리기 1회/청크), 거대 식물 인스턴스, 블룸. 품질 단계는 `core/quality.js`.
- 먼 지형 청크(2 km 이상)는 16×16, 가까운 청크는 32×32. 깊은 바다 밑 청크는 멀면 생략.
- 거대 버섯·노래수정은 1.2~1.4 km 너머에서 단순 모델(LOD)로 바뀝니다.
- `engine.adapt()` 가 프레임 시간에 따라 해상도 배율을 0.55~1.0 으로 조절합니다.
- `?debug=1` 로 calls/tris 를 보며 작업하세요. v0.2 기준 낮음 품질 약 63~83만 삼각형, 330~560 그리기 (도시·배·먼 땅이 늘어남).
- 배·돌보미·다리는 모두 인스턴스(그리기 1회). 하모네아 구역은 THREE.LOD(4.2 km 밖은 단순 모델), 큰 탑·안쪽 탑만 움직이는 관/홀로그램을 따로 그리고 나머지는 합친 모델에 굳혀 둡니다.

## 지켜야 할 것
- 기존 저장 파일이 깨지지 않게: 저장 형식을 바꾸면 `state.js` 의 `migrate()` 를 손보세요.
- 본편 흐름이 끊기지 않았는지 `node tools/flow.mjs` 로 확인하세요(마지막 줄까지 퀘스트가 진행되어야 함).
- 큰 변경 뒤에는 `docs/DEVLOG.md` 에 무엇을 왜 바꿨는지 적어 주세요.
