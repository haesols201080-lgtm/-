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
| `node tools/facilities.mjs [shots]` | 시설 9종의 기능(카드·탐지기·책·지도·쉼터 이동·온실·합창·소포·날씨·연락선·나룻배·저장)을 차례로 눌러 확인 |
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
           ── 쓰임이 있는 건물 (v0.3) ──
           facilities(시설 9종 모델·자리·간판·움직임) boats(나룻배·연락선 모델)
           ── 도시의 살 (v0.4) ──
           cityfabric(구역 격자·필지·건물·기단·공중다리·거리·소품·광장·공원·문·인스턴스 그리기)
           city-arch(건물 모양 27가지 hi/lo + 문 + 거리 소품 모델) streams(호버 차·걷는 아웬, GPU 차선)
           ── 땅의 쓰임과 주민 (v0.5) ──
           cityplan(블록 나누기·쓰임 배정·쓰임별 배치 템플릿·locate) city-ground(계획 텍스처 → 지형 셰이더가 그리는 도시 바닥)
           crowd(주민 인스턴스 그리기: 자세 속성, 그리기 1회)
  player/  player(이동 상태기계) avatar(모델·절차 애니메이션) camera-rig
  interior/ (v0.9 건물 속) volume program core layout recipes furnish render building store ids catalog material geom props
           ops ops-types agents nav econ apps guide find
  game/    game(중심·모드·입력·저장) state(저장 형식) quests dialogue actions language npcs resonance discovery
           services(시설의 쓰임: 시설지기 카드·연락선·나룻배·온실·날씨·탐지기)
           interiors(건물 들어가기: 로딩 → 바깥과 떨어진 실내 공간(POCKET_Y)·사람·빛 승강기·하늘 전망대) tips(처음 해 보는 일 안내 카드)
           citizens(도시 주민: 자리·일과·걷기·말 걸기·함께 놀기·집 안 사람들)
           venues(건물의 일 — 실내 쓰임마다 시설·돈·물건·기운·일거리) outdoors(바깥 조작대·승강판·하늘배·드론·충전·부탁함)
           world-events(일식·별비·축제·부탁) director(연출 카메라)
  ui/      ui(HUD·대화·카드·메뉴·타이틀·터치) map(지도·안개) imap(건물 안 지도) journal settings
  data/    places(장소·평탄화) currents(해류 경로) story(인물·대사·대화·퀘스트·메아리·글자돌·도감·모아) lexicon(아웬어 사전)
           facilities(시설 목록·종류·옛 책) city(도시 구역·쓰임 USE·비율 MIX·양식·색조)
           citizens(주민 이름·역할 ROLES·실내 역할 INDOOR·대사·장터 물건)
           venues(물건 ITEMS·기운 BUFFS·진열대·차림표·전시·기록·바깥 조작대 OUTDOOR·주민 부탁 WISHES)
```
- 좌표: 1 = 1 m, Y 위, **−Z 가 북쪽**(우르 방향), +X 동쪽. 플레이어 yaw 는 `atan2(dx, dz)`, 카메라 yaw 0 은 북쪽을 봄.
- 모든 지형 높이는 `heightAt(x, z)` 하나에서 나옵니다(렌더·충돌·배치·지도 공통). 지형을 바꾸면 `node tools/heightmap.mjs` 로 확인하세요. 장소 주변은 `places.js` 의 `flat` 으로 평탄화됩니다. 도시 구역은 `LEVEL`(구역별 땅 맞추기)로 높이를 맞춥니다 — 평평한 단(수도·구역·지방 도시: 중앙값 한 높이 + 바깥 둑), 시골(`isRural`: 교외·마을 — 자연 지형 그대로, 고리길·큰길·골목만 길 단면으로 고르고 건물마다 집터 `setPads`; 집터는 일꾼에도 보냄 `terrain.setPads`, 첫 조각 요청 전에), 높이 창(`grade: false`·`water`: 바닥 ±35 m 만). 계단 단(방식 2)은 지금 쓰지 않습니다. 구역을 옮기거나 키우면 지형도 바뀝니다. 계획(`cityplan.buildPlan`)은 둑 범위까지를 덮인 곳으로 봅니다(heightfield 와 같은 수치).
- 하늘은 별도 장면(카메라 원점, 하늘 단위 = 0.05 m)을 먼저 그리고 깊이를 지운 뒤 세계를 그립니다.
- 모든 세계 셰이더는 `shaders.js` 의 `applyFog`(높이 안개 = 하늘색)와 `curveWorld`(행성 곡률)를 씁니다. 새 셰이더도 같은 걸 써야 공기 속에 섞입니다.
- 셰이더 마지막에 `#include <tonemapping_fragment>`, `#include <colorspace_fragment>` 를 넣으세요. engine.js 가 이 조각에 NaN/무한대 방지를 끼워 넣습니다(블룸이 검게 번지는 문제 예방).

## 콘텐츠 추가하는 법
- **장소**: `data/places.js` 에 항목 추가 → `type` 에 맞는 빌더(`structures.js` 의 `_타입`)가 만듭니다. 새 타입이면 빌더 메서드를 추가.
- **해류**: `data/currents.js` (점 = [x, 높이, z, 절대?]). `unlock: 탑id` 면 그 탑을 깨울 때 흐름.
- **대사**: `data/story.js` 의 `LINES` (단어 id 배열 + 한국어). 새 단어는 `data/lexicon.js` 에 (음 모티프가 겹치지 않게).
- **대화**: `CONVOS` — `{s: 인물id, line}` / `{s:'moa', t}` / `{choice:[...]}`, `act` 로 동작 실행.
- **모아 부르기** (`game/moa-ai.js`, T·HUD 빛 구슬): 대화창. 모아는 궤도의 라르크 호에 남은 함선 지능(땅 위에 함께 있지 않다). Claude 사용은 설정 `moaClaude` 로 끄고 켜며, `rate_limited` 면 15분 동안 기본 모드. claude.ai 아티팩트에서는 `claude.use('sample')`(아티팩트 capabilities `{sample: {}}` 로 발행)로 Claude 가 모아 역(RULES)을 맡고, 매 질문에 `context()`(목표·자리·때·가진 것·음·말·둘레 건물·아는 이·조작)를 붙인다. 도구 `mark_place`(나침반 표식, `find()` 로 시설 종류·장소·인물·집·목표를 찾음). Claude 가 없거나 허락이 없으면 `local()` 이 게임 상태로 바로 답한다. 모아 창이 열린 동안 `game.mode = 'moa'`(입력은 창이 받음). `ui.moa()` 혼잣말은 `moaAI.note()` 로 기록된다. 대화창의 말풍선은 `.mp-msg.from-moa/.from-me`(`.moa` 는 아래 자막 이름이라 쓰지 말 것).
- **처음 해 보는 일 안내**: `data/tips.js` 의 `TIPS[id]`(제목·한 줄·순서) + 그 일을 시작하는 함수 첫 줄에 `if (this.game.tips && this.game.tips.first('id', () => 이함수(인자))) return;`. 본 것은 `state.tips`, 설정 「도움말」 끄면 안 띄움, 일지 → 도움말에서 다시 보기.
- **공명 음을 요구하는 놀이**: 고를 수 있는 음 = `state.tones`(아는 음)뿐. 아는 음이 모자라면 듣기만 하는 판으로 바꾸거나(연구동 「같다/다르다」), 버튼을 막고 이유를 적는다(주민 「함께 고요해지기」).
- **퀘스트**: `QUESTS` — 단계 type 은 `game/quests.js` 머리 주석 참고. 동작은 `game/actions.js` 의 `HANDLERS`. 도시의 삶을 본편에 엮을 때는 `stat`(예: `venue.worked`) 단계나 `flag` 단계 + 코드에서 `game.setFlag(k)` 를 씁니다(지금 깃발: `helpedNeighbor`·`rodeSky`·`liftTop`·`homeVisit`). 줄거리: 탐사선 「라르크」가 신호를 따라와 스스로 착륙 → 이웃이 되기 → 이름 노래로 시민(집 `state.home`) → 듣던 탑들이 다시 노래 → 온 하늘에 대답. 탑은 「잠든」 게 아니라 「듣는 쪽」입니다(쇠락한 문명이 아님).
- **부탁(날마다)**: `game/world-events.js` 의 `TEMPLATES` 에 함수 추가.
- **메아리·글자돌·도감**: `story.js` 의 `ECHOES`, `GLYPH_STONES`, `CODEX`.
- **저장 항목**: `game/state.js` 의 `defaultState()` 에 추가(불러올 때 빠진 항목은 기본값으로 채워짐).
- **시설**: `data/facilities.js` 의 `FACILITIES` 에 한 줄(`at` 장소 + `off`/`polar`/`toward`). 자리에 다른 구조물이 있으면 빌더가 나선으로 밀어서 빈 곳을 찾습니다. 새 종류는 `FACILITY_TYPES` + `world/facilities.js` 의 `_종류` 모델 + `game/services.js` 의 `_종류` 카드. 시설지기는 `npcs` 에 `service` 가 붙은 인물(`fac-시설id`)이라 `_findTarget` 이 「시설지기 · 하는 일」로 보여 줍니다.
- **옛 책**: `data/facilities.js` 의 `BOOKS` (`at` = 서고 id, `word` = 읽으면 배우는 단어).
- **도시 구역**: `data/city.js` 의 `ZONES` 에 한 줄(머리 주석에 항목 설명). `sectors` 는 부채꼴마다의 쓰임 비율, `mix` 는 `MIX` 의 비율 묶음.
- **쓰임(토지 이용)**: `data/city.js` 의 `USE` 에 번호 + `world/cityplan.js` 의 `SCORE`(어디에 오기 좋은가) + `T[U.이름]` 템플릿(블록 좌표 u·v 미터로 `P.bldg`·`P.prop`·`P.spot`) + `world/city-ground.js` 의 `cityBlock()` 에 바닥 무늬 + `ui/map.js` 의 `USE_COL`.
- **건물 모양**: `city-arch.js` 의 `cityArchetypes()` 에 `A.이름 = { hi, lo }`(단위 상자 −1..1 × 0..1, `loft`/`cap`/`solid`) + `SPEC.이름`(`plan` 땅 평면, `enter` 들어갈 수 있음, `low` 낮은 건물, `cols` 겹친 충돌체) + 키와 상관없는 미터 부속은 `kit('이름', [...])`(`pin` 으로 높이 고정). 양식별 후보는 `data/city.js` 의 `STYLE_KINDS`.
- **거리 소품**: `city-arch.js` 의 `propArchetypes()`(미터 단위) + `PROPCOL`(충돌체 모양). 템플릿에서 `P.prop(B, '이름', u, v, face)` 로 놓는다.
- **주민 역할**: `data/citizens.js` 의 `ROLES`(자리 종류 → 일하는 시각·사람 수·함께 할 것) + `CIT_LINES` 대사. 템플릿에서 `P.spot(B, '역할', u, v, face)` 로 자리를 놓는다. 실내는 `INDOOR` + `game/interiors.js` 의 가구 `anchors`. 새 놀이는 `game/citizens.js` 의 `_playOption`.
- **실내 쓰임**: `game/interiors.js` 의 `PURPOSE`(가구·사람·안내지기 대사)와 `BY_STYLE`(양식 → 쓰임).
- **건물의 일(실내 시설)**: `game/venues.js` 의 `_b_쓰임id(cur, K)` 가 실내가 열릴 때 시설을 놓는다 — `this._station({ x, z, r, label, short, use })`(다가가면 E), 모양은 `K.put`·`this._glow`, 움직임은 `this._anim(t => …)`, 실내 사람 자리는 `K.anchor`. 돈(울)은 `_pay`/`_wage`, 물건은 `_add`, 기운은 `buff(id)`(`data/venues.js` 의 `BUFFS`). 새 물건은 `ITEMS` + `BAG_ORDER` + `state.inv` 기본값.
- **바깥 조작대(들어갈 수 없는 건물)**: `data/venues.js` 의 `OUTDOOR[모양] = { fn, name, label, short }` + `game/outdoors.js` 의 `_fn(c)`(`c.rec` 건물 기록, `c.x/z/y` 조작대 자리, `c.nx/nz` 바깥 방향, `c.key` 하루 한 번 열쇠 — `_doneToday`/`_markToday`). 자리는 `cityfabric.consolePos`(블록이 깨어날 때 소품 `console`).
- **카드**: 한 번에 하나(`ui._card` 가 앞 카드를 닫는다). E·스페이스·엔터를 쓰는 놀이는 `_card(html, onClose, { keys: false })`, 놀이가 끝나면 `wrap.close()`(남의 카드를 닫지 않게). 시간은 `performance.now()` 벽시계로.

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
- `?debug=1` 로 calls/tris 를 보며 작업하세요. v0.2 기준 낮음 품질 약 63~83만 삼각형, 330~560 그리기 (도시·배·먼 땅이 늘어남). v0.3 시설을 더한 뒤 하모네아 지상 360~390 그리기·74~89만 삼각형, 이슬터 280 그리기.
- 시설(`facilities.js`)은 4.5 km 밖에서 숨기고, 1.4 km 밖에서는 합친 본체만(움직이는 장치·유리·배는 가까이서만), 간판은 900 m 안에서만. 매 프레임 44곳 거리만 계산합니다.
- v0.4 도시를 더한 뒤 보통 품질 하모네아 거리 높이에서 그리기 290~420회·삼각형 200~230만. 도시 생성 약 3초, 충돌체 약 4만. 품질은 `cityfabric` 의 `nearR`·`farR`·`propR`·`density`, `streams` 의 `cap`·`wcap` 으로 조절.
- v0.6(보통 품질): 하모네아 거리·중간 높이에서 그리기 300~460회, 삼각형 200~270만. 도시 생성 약 2.7초(계획 0.6 · 배치 1.7), 건물 약 2만 9천, 충돌체 약 7만 5천(소품 충돌체는 둘레 블록만 따로). 흐름은 무리마다 그리기 1회(차·전차·드론·사람 = 4회).
- 배·돌보미·다리는 모두 인스턴스(그리기 1회). 하모네아 구역은 THREE.LOD(4.2 km 밖은 단순 모델), 큰 탑·안쪽 탑만 움직이는 관/홀로그램을 따로 그리고 나머지는 합친 모델에 굳혀 둡니다.

## 도시 (v0.4)에서 알아 둘 것
- 건물은 모양마다 그리기 2회: `hi`(카메라 둘레 `nearR` 안, 카메라가 45 m 움직이면 다시 고름) + `lo`(모든 인스턴스, 정점 셰이더 `USE_CUT` 이 `nearR` 안·`farR` 밖을 접어 버림). 두 경계의 중심은 같은 점(`_last`)이어야 틈이 생기지 않는다.
- 건물 외벽은 `litMaterial({ facade: true, tech })` — 정점 `fac` = [단면 둘레 길이, 외벽 종류(0 없음 1 커튼월 2 띠창 3 점창 4 첨탑 5 발코니 6 유리 격자 7 수직 농장)], `base`(땅 높이), `anc`(미터 부속의 고정: 켜짐·기준 위 높이·바깥 거리). 창은 실내 매핑(방 들여다보기)으로 그린다. 문양 빛은 유리 위에 그리지 않는다(`glassMaskF`).
- 모든 `litMaterial` 은 반사광의 밝기가 0.72 를 넘으면 부드럽게 누른다(블룸 문턱 1.1 아래). 빛나야 하는 것은 em(emissive·정점 emit·창 불빛)으로 넣을 것.
- 피할 곳: 장소·인물·글자돌·메아리·시설·빛길 역은 `_excl`(원), 빛길 관·낮은 해류 밑은 `_corr`(높이 제한 통로, `_under(x, z, R)` = 그 아래로만 지을 수 있는 높이).
- 도시 충돌체에는 `city: true`. **실내는 바깥 건물 속이 아니다**: 문에서 E → 로딩 화면 → 건물 바로 위 하늘 높이(`interiors.POCKET_Y` = 8000 m)에 쓰임별 크기의 닫힌 방을 짓고(`sky: true` 충돌체: 바닥·벽·천장), 들어가 있는 동안 `engine.isolate` 로 바깥 세계를 숨기고(실내에 보일 것은 `userData.indoor = true`), `world.viewProxy` 로 땅·도시 세부 단계를 문 앞 거리 기준으로, `engine.altOffset` 으로 하늘빛·고도 효과를 땅 높이 기준으로 둔다. 카메라는 `rig.floorLock`(점프해도 거의 안 오름) + `clampCamera`(벽에서 1.3 m 안). 바깥 건물 모델·충돌체는 손대지 않는다(`openShell` 은 이제 쓰지 않음).
- **문 자리**: `cityfabric.fixDoor(r)` 가 실제 건물 모델에 광선을 쏘아 바깥벽 0.17 m 앞에 붙인다 — 문 너비±여유가 고른 벽으로 옆으로 밀어 보고(기둥·모서리 피하기), 상가 기단 위의 탑은 기단 바깥벽에, 다른 건물에 막히거나 문 앞에 설 수 없는 쪽은 건너뛴다. 처음 쓸 때 한 번(뒤에서 가까운 것부터 조금씩, `nearestDoor` 는 둘레 60 m 를 바로). 문을 웨이포인트로 쓸 때는 먼저 `city.fixDoor(r)`. 문 앞 3.4 m 에는 소품·조작대를 두지 않는다(`_doorBlocked`). 검사: 스크래치 `doors4.mjs` 류(광선으로 문-벽 틈·문 앞 높이·막힘).
- 도시 바닥은 지형 셰이더의 `cityGround()`(city-ground.js)가 계획 텍스처(`uPlan`, 구역마다 한 줄: 고리 표 + 블록 쓰임·변형·플래그)를 읽어 그린다. JS(`cityplan.js`)와 GLSL 의 블록 좌표식이 같아야 템플릿과 바닥이 맞는다.

## 땅의 쓰임과 주민 (v0.5)에서 알아 둘 것
- 블록 = 고리 띠 하나 × 대로 사이 부채꼴을 골목으로 나눈 조각. `city.where(x, z)` → `{kind: 'block'|'street'|'avenue'|'lane', B, u, v}`.
- 소품·주민 자리는 블록마다 목록(`B.raw`)만 들고 있다가, 플레이어 둘레 블록에 들어설 때 `_activate` 가 인스턴스·충돌체를 채운다(프레임 예산). 소품 충돌체는 `stream: true`(전역 목록 `all` 에 넣지 않음).
- `city.noFlora(x, z)` 가 참인 곳(자연 블록이 아닌 계획 블록·도로)에는 식생을 흩뿌리지 않는다.
- 주민은 자리 id + 순번에서 결정되고(이름·얼굴·일과), 저장은 `state.cit`(친한 정도·이야기 횟수)뿐. `citizens.pushPlayer` 가 플레이어를 밀어낸다. 테스트: `SEREN.game.citizens.vis`(보이는 사람), `startTag/startGarden/...`.

## 스카이라인 (v0.6)에서 알아 둘 것
- 높이: `ZONES.peaks`(높은 군집) + `cityfabric._height`(묶음별 기본 높이 HB, 군집 영향, 군집 한가운데 블록 `B.peak` 의 초고층 하나). 템플릿은 `P.towerH(B, 배율)` 만 부른다.
- 보조 랜드마크: `ZONES.marks` → `buildPlan` 이 블록을 골라 `B.landmark`, `T.landmark` 가 가운데에 `lm_*`. 모델은 `city-arch.js` 의 `landmarkArchetypes()`(실제 미터), `SPEC.lm_*.fixed` = 높이(배율 1, 충돌체도 미터). 목록은 `city.marks`(지도).
- 중심 광장: `ZONES.core: 'plaza'` → `cityfabric._core` 가 가짜 블록(`B.core`, idx 50000+)을 만들고 `cityplan.layoutCore` 로 채운다. 셰이더(`city-ground.js` 의 중심 광장)와 칸 나눔·자리 종류 식이 같아야 한다.
- 골목 모양: `city-ground.js` 의 `laneStyle(tA, tB, mid)` / `laneSurface` — 양쪽 블록 쓰임에서 정해지므로 JS 쪽 데이터는 없다.
- 흐름: `streams.js` 의 `fleets`(차·하늘배 / 전차 / 드론, 각각 그리기 1회) — 차선 kind 'ground' 'sky' 'tram' 'drone' 'walk'. 새 생활 차선은 `_lifeLanes`.
- 모델의 색·외벽 종류는 삼각형마다 한 값(가운데 점으로 판정)이다(`paint`). 꼭짓점마다 다르게 하고 싶으면 단면을 더 나눌 것.
- 점유 지도를 보고 싶으면 페이지 안에서 `SEREN.game.city.list`(모양 → [x, y, z, sx, sy, sz, rot, r, g, b]…)·`plist`(활성 블록의 소품 → [x, y, z, 배율, 방향, x배율]…)를 읽으면 된다.

## 건물의 일 (v0.7)에서 알아 둘 것
- 실내 15가지 쓰임마다 `venues._b_*` 가 시설을 둔다. 시험: 실내를 열고(`SEREN.game.interiors.open(rec)`) `SEREN.game.venues.stations` 의 `use()`.
- 들어갈 수 없는 건물(약 6800채)은 `city.outRecs` 에 있고, 조작대는 블록이 깨어날 때만 소품으로 놓인다(`B.ext`). `outdoors.target` 이 둘레 블록의 조작대 + 하모네아 거대 탑 20채의 조작대(`outdoors.mega`, `_megaInit`)를 찾는다.
- 승강판·하늘배는 `player.enterRide(ride)`(빛길 캡슐과 같은 틀): `ride.step(dt, player)`·`ride.cam`·`ride.skip()`, `ride.showAvatar` 면 아바타를 보인다. 승강판 길은 구조물 밖(Rs)에서 수직으로 오르고(`_clear` 로 빈 기둥을 찾음), 꼭대기에 닿으면 `outdoors.tops` 에 넣어 「내려가기」 표적이 된다.
- 하늘배 길은 `_route`(거대 탑·척추·별항구를 옆으로 돌아감) + `_cruise`(길 아래 땅·도시의 높은 탑 위, 하늘바퀴 갑판 높이는 비킴).
- 저장: `state.venue`(전시·기록·박물관·기운·하루 한 번 `days`·맡은 일 `job`·번 별씨). 물 위 집(`stilt`)은 깊이와 상관없이 제 키(마루가 물 위 1.2 m).

## 몸·생물·교신·오프닝 (v0.8)에서 알아 둘 것
- **오프닝** `game/approach.js`: `playApproach(game, onEnd)` 가 연출 하나(`director.run`)로 우주 → 진입 → 들판 착지를 돌린다. 우주 장면 동안은 `engine.space`(먼 장면 km·가까운 장면 m, 깊이를 나눠 두 번 그림)가 세계 대신 그려지고, 세계 카메라는 들판 첫 장면 자리에 둬서 지형이 미리 만들어진다. 들판에서는 진짜 착륙선(`structures.lander.group`)을 숨기고 닫힌 해치 모습(`landerShell({landed:false})`)이 내려앉는다. 넘기기는 `seq.onSkip`(우주 → 들판 → 끝). 시험: `?play=intro&at=초`(`play=new` 는 오프닝을 건너뜀).
- **모아의 교신** `game/comm.js`: `comm.status()`(경로·막대), `badgeHTML()`, `pulse()`(무전 소리+안테나 빛). `ui.moa()` 자막은 늘 신호 표시를 단다. 모아는 함께 있지 않다 — 대사·RULES 에서 「같은 자리에 있다」고 말하지 않게.
- **착륙선** `world/lander.js`: `landerShell()` 이 바깥 모양(로컬 x = 앞, z+ = 해치), `buildLander` 가 선실·충돌체·안테나·쓸 것(`stations` → `structures.landerTarget`, game `landerUse`).
- **생물** `world/fauna.js`: 종 정의 `SPECIES`(모양+움직임 GLSL), 지역 서식 `HAB`, 마을의 자리는 `world.faunaSites`, 앉을 곳 `world.perches`.
- **장소의 일 자리** `world.placeSpots`(dewfold 가 채움) → 주민이 그 자리에서 일한다. 식생을 비울 곳은 `world.clearZones`(`world.cleared(x, z)`).
- **땅 위의 집은 도시의 집으로**: 구조물 빌더가 집을 놓을 때는 돔 모델 대신 `structures._house(x, z, r, {toward, group})`(또는 `world.houseQueue` 에 직접 + 자리 지킴 충돌체) — `cityfabric._extraHouses` 가 들어갈 수 있는 집(빌라·돔·거품 집)으로 짓는다(`_bldgAt` = 세계 좌표 건물). 갑판 위는 `deck: 높이`(땅 대신 그 높이가 바닥, 문 앞이 갑판인 벽에만 문). 움직이는 곳(거신·떠다니는 섬)·하늘바퀴 층은 아직 돔 모델.
- **문**: `_fillDoors` 는 `doorFixed` 문만 그린다. 문 자리를 새로 잡으면(`_fixedN` 증가) 0.3 초 안에 다시 그린다.
- **빛길 관 받침 기둥**: `transit.supportPts` → 충돌체 + 도시 피할 곳(7 m).
- **분수의 물**: `fountainWaterGeo`/`fountainWaterMaterial`(분수 인스턴스 행렬을 나눠 씀), 연못 테 충돌체는 고리 모양 상자 열둘(`PROPCOL` 상자의 8번째 값 = 추가 회전), `city.fountainAt(x, z)` → game `_wading`(플레이어 `wade`).
- **실내 구조**: `interiors.js` 의 `LAYOUTS`(여섯)·`PALETTES`(빛깔) — `layoutOf(r)` 이 씨앗으로 고른다. 구조마다의 건축은 `_build` 의 「구조마다의 건축」 묶음(벽기둥은 `later` 로 가구 뒤 빈 자리에만). 방마다 기억: `state.rooms['구역:모양:번호']`.
- **착륙선 선실**: `game/cabin.js` 의 `buildCabin` + `interiors.enterCabin(lander)`(해치 `lander.hatch` → `structures.landerTarget` → game `landerUse('door')`).
- **장소 빌더가 지은 집을 들어갈 수 있게**: `world.customRecs.push({x, z, gy, r, h, ux, uz(문 바깥 방향), dz(문까지), use, name})` → `cityfabric._customRecs`.
- **판석 질감**: `city-ground.js` 의 `paver(hx, q, fw, fade, 색A, 색B, 이음매폭, 칸크기, spec, seam)` — 육각 바닥은 이걸로.

## 건물 속 (v0.9)에서 알아 둘 것
실내는 이제 「쓰임별 방 하나」가 아니라 **바깥 건물의 실제 부피에서 나온 여러 층**이다. 흐름: `interior/` 의
`volume`(SPEC.cols → 부피·외벽 모듈) → `program`(층 쌓기·쓰임·조직·빛깔·전문 건물) → `core`(계단·승강기·관, 중2층 계단 자리) →
`layout`(층 평면: 복도·방·문·출입구) → `recipes`·`furnish`(가구·장비, 0.5 m 점유 격자) → `render`(모양·충돌체) → `building`(층 그리기·문·승강기 문) → `store`(저장).
- **건물 신분**: `ids.uidOf(r)` = `구역/모양/x*2/z*2`, 씨앗 `seedOf(r)`. 짜임(B)은 처음 들어갈 때 만들고 `PlanStore`(localStorage `seren.bld.v1`, RLE)에 저장. 생성 규칙을 바꾸면 `ids.GEN_VERSION` 을 올릴 것(옛 짜임은 버리고 다시 — 움직이는 상태는 `state.bld`·`state.econ` 에 따로 있어 남는다).
- **틀 좌표**: 건물 가운데가 원점, +z = 문 바깥 방향, 칸 1 m. `ind.world(gx, gz)` / `ind.grid(x, z)`. 실내 높이 = `POCKET_Y + (층 y − 1층 바닥)`.
- **쓰임**: `catalog.FUSE`(층 쓰임 → plan·op), `ROOMS`(방 종류: 드나듦·빛·무늬), `FIX`(가구·장비). 층 쓰임을 더하면 `layout.ringProgram` 또는 `openPlan` 의 HALL·뒤쪽 방, `recipes.RECIPE` 에 방 가구, `ops-types.TYPES[op]` 에 운영.
- **섞인 건물 / 전문 건물**: `program.decideUses` — 섞인 건물은 기단(가게)·사무·주거·호텔·설비층·전망층을 차례로(층마다 다른 조직), 전문 건물(`B.special`, 쓰임마다 확률 `SPECIAL_P`)은 한 기관이 건물 전체(종합 치유원·학교·본사·연구원·대형점 본점·물류 센터·공장 단지·교통 거점·농업 단지·호텔).
- **운영** (`ops.js` + `ops-types.js`): 쓰임 묶음(B.zones)마다 세입자(tenant) = 조직 + 살림(`econ.node`). 쓰임마다 `setup`(진열대·기계·밭 채우기 — 구역 재고에서), `act`(가구 앞 E), `people`(그 층 사람의 일과 — `agents.js`, 길은 `nav.js`), `tick`, `roles`(일자리와 과제). 물건 칸은 `out.slots` → InstancedMesh(실제 재고 수만큼).
- **살림** (`econ.js`): 화폐 단위는 「울」(`data/money.js` 의 `CUR`·`won(n)` — 이름을 바꾸려면 거기만, 돈은 `state.inv.starseed` 열쇠 그대로). 「별씨」는 재료(`state.inv.seedstar`: 별비·생명나무 → 온실·장인 온). 구역마다 가구(hh)·회사(firms)·공공(commons) 돈과 창고(depot)·가게(retail) 재고. 돈은 **`transfer` 로만** 옮긴다(플레이어 = `'player'`, 구역 = `'z:구역:hh'`, 건물 = `'n:uid'`). 보상·품삯·값은 `econ.reward/charge`, 가방에 물건을 넣을 때는 `econ.goodsOut`(재고에서), 되팔면 `goodsIn`. `game.giveItem` 도 이 길을 탄다. 검사: `node tools/econ-check.mjs`.
- **단말** (`apps.js`): 일자리(이 건물+둘레 건물) → 지원 → 한 시간 뒤 면접 안내 → 채용 면접실(`apps.ivSpot`)의 면접관 → 채용(`state.work.jobs`). 출근 단말(`tag 'clock'`)에서 교대 → 과제(`ops.startTask`) → 퇴근 때 품삯(그 회사 금고에서).
- **길 안내** (`guide.js`) · **찾기** (`find.js`): `game.guide.to({floor, gx, gz, label})` — 층이 다르면 이음(B.links)으로 층 사이 길을 고르고, 지금 층 바닥에 점선·목적지 빛기둥·나침반 표식. 건물 밖 목적지는 `{ world: {x, z} }`(바깥 표식). 실내 지도 `ui/imap.js`(M — 시설의 지금 상태는 `ops.fixState(층, 가구)`: 진열 남은 수·기계·밭), 모아 `moa-ai.find` 가 `searchBuilding` 을 먼저 쓴다.
- **손에 든 것**: `avatar.setHeld({kind})`(바구니·상자·쟁반·결정·시료·책) · `avatar.act(pose, 초)` · 짐을 들면 `player.carrySlow`.
- **저장**: `state.work`(일자리·지원·교대·과제 수·호텔 방) · `state.bld[uid]`(연구 진척·내 집 칸·맡긴 물건·면접 자리) · `state.econ`(구역 살림·살아 있는 건물의 재고·진열·금고) · `state.inside`(건물 안에서 저장한 층·자리 → 불러오면 다시 들어간다).
- **공중다리**: 바깥 다리(`city.bridgeList`, 탑 기록 `r.bridges = [{bi, y, ux, uz}]`)의 바닥 높이에 `stackSlots(opt.cuts)` 가 층 바닥을 맞추고, 그 층(`F.bridges`)에 `layout` 이 「공중다리 문」(`L.ents.bridge`, 문 `kind 'bridge'`, b −3)과 승강기 홀까지 통로를 낸다. 드나들기는 `interiors.target` 의 `bridge`(안 → 다리) · `bridgein`(다리 끝 → 그 탑, `city.bridgeAt`·`interiors.bridgeEntry`). 다리 높이는 두 탑의 몸통이 굵은 높이만(`city-arch.bridgeBodyAt` — 하늘정원 탑의 정원 층·가는 꼭대기는 피함, 검사기도 같은 함수). 시험: `node tools/bridge-flow.mjs [개수] [shots] [bi=3,17]`.
- **걸어서 닿는가 (한 규칙)**: 오가는 공간(`catalog.flowRoom`: 복도·승강기 홀·로비·넓은 홀)끼리는 벽이 없고(그 줄기는 승강기 홀·승강기와 계단 문 앞 칸·정문에서 시작 — 홀 없는 작은 탑도), 사람이 설 수 있는 곳은 「비어 있는 1 m 창」(0.5 m 칸 2×2, 벽을 넘지 않는)에 드는 칸 — `furnish._reach`·`_keepsFlow`(가구 놓기), `nav.navGrid`(사람·안내선), `interior-gen`(검사)이 모두 같은 규칙을 쓴다. 방은 한 덩어리(`layout` 5a), 심은 층을 가르지 않는 자리(`core.planCore` 의 splits).
- **물건·살림**: 진열 구역 20가지 `data/goods.CATS` · 물건 `GOODS`(desc·eat) · 공정 `RECIPES` · 공장 줄 `LINES` · 한 사람 하루 몫 `PER_CAPITA`(재료까지) — 물건을 더하면 공정과 공장 줄도 더할 것(`node tools/econ-check.mjs` 가 「다 떨어진 물건」으로 잡는다). 가방·먹기는 `data/venues.itemInfo`.
- **작은 건물·방의 규칙**: 건물 전체가 작으면 1층이 본래 쓰임(`program.tinyFloors`), 쓰임마다 최소 층 넓이(`FLOOR_MIN` — 첨탑 끝처럼 그보다 작은 층은 설비층·전망층), 고리형 층 방 목록은 띠 길이에 맞춰 본실부터(`layout.fitRing`·`RING_MAIN`), 본실은 쓰임의 가구가 들어갈 넓이(`MIN_ROOM`)보다 작으면 이웃과 합치고, 폭 1 m 띠 방은 이웃으로(`thinMerge`, 5a 앞뒤), 150 m² 아래 열린 홀 층은 꼭 필요한 뒤쪽 방만(`SMALL_BOH`)·공동 로비 없음. 방마다 「그 쓰임의 일이 일어나는 가구」는 `recipes.ESSENTIAL`(빠지면 벽 → 가운데 → 방 전체를 훑고, 그래도 없으면 장식부터 치워 놓는다 — `Furnisher.remove`). 새 방 종류를 만들면 `ESSENTIAL`·`MIN_ROOM` 에도 한 줄. `interior-gen` 이 「핵심 가구 빠진 것」을 센다.
- **서고의 책**: 책은 `data/books.js`(손으로 쓴 책 `AUTHORED` + 게임 자료에서 엮은 책 + 씨앗 이야기·시 = 목록 `BOOKS`, 목록 너머의 끝없는 책은 `moreOf(분류, n)` → `bookById(id)` 가 짓는다). 서가 배치는 `interior/library.js`(`floorSubjects` 층마다 분류 · `stockFloor` 서가 칸마다 책 id · `libraryIndex`/`locate` 찾기), 읽기·대출은 `ops-types.library` + `ui.reader`/`ui.bookShelf`, 상태는 `state.lib`(빌린 책·읽은 쪽·다 읽은 날). 책을 더하려면 `AUTHORED` 에 `{ id: 'b-…', subject, title, author, word?, pages: [...] }` 한 줄. 서가 모양을 바꾸면 `library.js` 의 `SPINES·SHELF_LEVELS·SHELF_COLS` 도 같이.
- **가구와 벽**: 가구 자리는 0.5 m 칸 장부로 정하고, 다 놓은 뒤 `furnish.nudgeWalls` 가 칸막이 두께(`catalog.PART_T`)·바깥벽 면(부피 거리장)만큼 벽 밖으로 민다(`q.ndx·ndz` — 걸음 칸·장부는 밀기 전 자리로). 지하층의 벽·바닥은 부피가 아니라 바닥 덮개로(`render` 지하층). 겹친 면·바닥은 `node tools/zfight.mjs all 1 4` 로.
- **실내로 옮기기**: 바닥 높이를 정확히 아는 곳은 `player.teleport(x, y, z, 0.1)` — 기본(위로 3 m 까지 찾기)은 층고 3.3 m 아래 층에서 윗층 바닥판에 올라선다.
- **확인 도구**: `node tools/interior-gen.mjs`(모든 모양×쓰임×크기: 갇힌 방·정문·바깥 부피 밖 칸·승강기 칸·쓰임 차례·저장 왕복·중2층 계단·결정성·가짓수), `node tools/interior-gen.mjs show slab office 30 22 120 [층들] [bridge=k]`(층 평면을 글자로, bridge=k 면 일괄 검사의 k 번째처럼 공중다리 하나), `node tools/ops-flow.mjs [쓰임들|all] [shots] [map]`(한 번 불러와 쓰임마다 들어가 시설·사람·일자리·과제·모아·지도·저장 확인 + 별씨 합), `node tools/indoor.mjs 이름 '{"pid":"market"}' '[스크립트…]'`(한 건물 스크린샷), `node tools/zfight.mjs [쓰임들|all] [건물 수] [층 수]`(그린 층의 모든 삼각형에서 같은 평면·같은 쪽으로 넓이가 겹치는 면 = Z-fighting 찾기). 페이지 안: `SEREN.game.interiors.debugView('plan'|'room'|'off')`.

## v24 (방·구역 셀 · 최소 방 크기 · 빛길 역)에서 알아 둘 것
- **셀** (`interior/cells.js`): 실내는 실제 문으로 갈리는 방 무리(셀) 단위로 짓는다 — `building.setCell(key)` 가 지금 셀의 벽·가구·사람·충돌체·상호작용만 만든다. 셀 열쇠: `F층:뿌리방`(한 층의 무리), `S부품`(계단실 — 그 계단이 서는 모든 층), 아트리움 `A`, 중2층은 아래 홀과 한 셀. 문턱을 넘으면 `ui.blink` 로 짧게 가리고 옆 셀로. 다른 셀의 것을 고르거나 비추면 안 된다 — 새 상호작용·카메라 코드는 지금 셀(`ind.cellKey`)만 볼 것. 시험: `node tools/cells-check.mjs [쓰임들|all] [건물 수] [층 수]`(문마다 걸어서 넘기 · 계단 오르기 · 안전장치 기록).
- **최소 방 크기** `catalog.MIN_FIT` = [방 안에 들어가야 할 정사각형 한 변, 넓이] — 큰 방 상한은 없다. `layout.minSizeMerge`(좁은 방은 이웃과 합침) → `onePiece`(합친 뒤 방을 다시 한 덩어리로) → 그래도 본실이 좁거나(`narrowMain`) 심이 좁으면(`B.coreTight`) `program.makeBuilding` 이 실내 배율 S 를 키워 다시 짓는다(최대 3). 새 방 종류는 `MIN_FIT` 에도 한 줄.
- **문**: `layout.makeDoors` 는 같은·바로 옆 칸 경계에 문을 겹쳐 내지 않는다(`used`·`near`). 문틀 기둥은 열린 폭 바깥에 선다(1 m 문 = 1 m 지나갈 폭, 몸 지름 0.7 m).
- **나선 계단** (`interior/spiral.js` 의 `spiralPlan`): render·core·검사기가 같은 식. 2×2 칸은 층 사이 `SPIRAL2_MAXH`(3.3 m) 아래만, 3×3 은 한 바퀴로 8 m 까지 오른다. 두 바퀴는 둘째 바퀴가 아래·위 계단참에 머리 공간을 남길 때만. 계단참 난간 틈 0.9 m. 가운데 기둥과 디딤판 둘레 유리 난간(`spiralRail`)은 충돌체가 있다 — 가운데층 계단실(우물)에는 바닥이 없으니 디딤판 밖(기둥 자리·네모난 계단실 귀퉁이)으로 나갈 수 없어야 한다. 모양을 바꾸면 `node tools/spiral-sim.mjs`(실제 충돌체 + 플레이어의 밀기·발밑으로 칸 크기 × 층 높이를 모두 걸어 보고, 디딤판에서 기둥·바깥쪽으로 걸어 떨어지는 자리를 셈, 몇 초)로 먼저.
- **후처리 안전장치**: `engine.sanitize` 가 블룸 입력·최종 출력에 NaN·무한대 → 0 을 끼운다. 셰이더에서 `pow(x, e)` 의 x 가 음수가 될 수 있으면 `clamp` 로 감쌀 것(모바일 GPU 에서 NaN → 블룸이 검은 판으로 번짐). 시험: `node tools/intro-skip.mjs`.
- **빛길 역**: 노선·역 크기·역 자리는 `data/transit-lines.js`(`LINES`·`STATION`·`stationSites()`) 하나 — 지형 평탄화(`heightfield`)와 역 모델(`transit._station`)이 같은 값을 쓴다. 역 터는 이웃 장소의 단이 있으면 그 높이. 거점 역의 갈래 관은 역 끝 너머 고리에서 갈라진다(`_buildSpoke`). 시험: `node tools/passage-check.mjs`(역마다 양 끝·양쪽 걸어 들어가기).
- **거리 소품의 틈** (`cityfabric._propRoom`): 소품끼리·건물과 0.85 m 아래 틈이 생기는 자리에는 놓지 않는다(`force` 는 조작대처럼 꼭 있어야 하는 것만). 시험: `node tools/prop-gaps.mjs`.
- 그 밖의 검사: `node tools/p0-geom.mjs`(착륙지 표지 고리와 기둥), `node tools/cam-check.mjs`(셀마다 걸으며 카메라가 벽을 넘지 않는가), `node tools/act-all.mjs`·`act-out.mjs`(실내·바깥 모든 상호작용).
- **저장 슬롯** (`state.js`): 슬롯마다 `seren.slot.<id>`(상태) + `seren.slotmeta.<id>`(목록 요약). 게임은 `game.slot` 에만 저장한다. 슬롯마다 따로인 것 = `state` 전부(세계·주민 기억·경제·퀘스트·가방·자리·시각·실내·체력·은행). 전역 = 설정(`seren.settings.v1`)·업데이트 내역 본 판(`seren.seenVersion`)·건물 구조 캐시(`seren.bld.v1`, 씨앗으로 같게 만드는 구조뿐). 새 상태는 `defaultState()` 에, 형식이 바뀌면 `SAVE_VERSION` 을 올리고 `migrate()` 에. 바로가기 `?play=new` 는 「바로가기 여정」 슬롯 하나만 다시 쓴다. 검사 `node tools/slots-check.mjs`.
- **퀘스트**: 데이터 `type`(main/side)·`desc`·`start`·`next`·`reward` — 지금 있는 이야기 퀘스트는 main 그대로, 새 선택형만 side. 진행은 `state.quests`(status·step·tracked·log). 추적 `quests.track(id | null 자동 | 'none' 끔 | 'req' 오늘의 부탁)`. 검사 `node tools/quests-check.mjs`, 본편은 `node tools/flow.mjs`.
- **조사**: 이름·값 뒤 조사는 늘 `josa(말, '을')`(`core/josa.js`) — 「을(를)」 병기나 `${이름}을` 처럼 박아 두지 말 것. 검사 `node tools/josa-check.mjs`(소스에 병기가 남으면 실패).
- **은행·치료비**: 돈의 규칙은 `game/bank.js`, 수치는 `data/balance.js` 한 곳. 검사 `node tools/bank-check.mjs`.
- **소리 채널** `music · ambience · sfx · ui · voice` (+ master): 알림·메뉴·발견 소리는 `ui`, 세계의 사건은 `sfx`. **조명 밝기**는 공용 유니폼 `uLightScale` — 새 발광 셰이더는 발광 항에 곱할 것.
- **충돌**: `pushOut` 은 머리 위에 얕게 걸친 것은 옆으로 밀지 않고(천장), 구조 벽(`wall: true`)은 맨 나중에 민다. 실내 가구는 천장까지 1.75 m 이상 남으면 윗면에 설 수 있다(`walk`). 실내에서 달리며 뛰어 벽에 부딪히기 검사 `node tools/wall-stress.mjs [쓰임|all] [층 수]` (TRACE='층 방 각도' 로 프레임 기록).

## 지켜야 할 것
- 기존 저장 파일이 깨지지 않게: 저장 형식을 바꾸면 `state.js` 의 `migrate()` 를 손보세요.
- 본편 흐름이 끊기지 않았는지 `node tools/flow.mjs` 로 확인하세요(마지막 줄까지 퀘스트가 진행되어야 함).
- 이야기를 바꾸면 `state.js` 의 `STORY_VERSION` 을 올리고 `remapStory` 로 옛 저장을 알맞은 장으로 옮기세요.
- 큰 변경 뒤에는 `docs/DEVLOG.md` 에 무엇을 왜 바꿨는지 적어 주세요.
