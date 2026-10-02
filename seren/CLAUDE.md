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
  game/    game(중심·모드·입력·저장) state(저장 형식) quests dialogue actions language npcs resonance discovery
           services(시설의 쓰임: 시설지기 카드·연락선·나룻배·온실·날씨·탐지기)
           interiors(건물 들어가기: 로비·사람·빛 승강기·하늘 전망대, 충돌체 갈아 끼우기)
           citizens(도시 주민: 자리·일과·걷기·말 걸기·함께 놀기·집 안 사람들)
           world-events(일식·별비·축제·부탁) director(연출 카메라)
  ui/      ui(HUD·대화·카드·메뉴·타이틀·터치) map(지도·안개) journal settings
  data/    places(장소·평탄화) currents(해류 경로) story(인물·대사·대화·퀘스트·메아리·글자돌·도감·모아) lexicon(아웬어 사전)
           facilities(시설 목록·종류·옛 책) city(도시 구역·쓰임 USE·비율 MIX·양식·색조)
           citizens(주민 이름·역할 ROLES·실내 역할 INDOOR·대사·장터 물건)
```
- 좌표: 1 = 1 m, Y 위, **−Z 가 북쪽**(우르 방향), +X 동쪽. 플레이어 yaw 는 `atan2(dx, dz)`, 카메라 yaw 0 은 북쪽을 봄.
- 모든 지형 높이는 `heightAt(x, z)` 하나에서 나옵니다(렌더·충돌·배치·지도 공통). 지형을 바꾸면 `node tools/heightmap.mjs` 로 확인하세요. 장소 주변은 `places.js` 의 `flat` 으로 평탄화됩니다. 도시 구역은 `LEVEL`(구역별 땅 맞추기)로 높이를 맞춥니다 — 평평한 단(수도·구역·지방 도시: 중앙값 한 높이 + 바깥 둑), 계단 단(교외: 블록마다 평평, 길은 경사로, 이웃 차는 길 폭 × 0.3 까지), 높이 창(`grade: false`·`water`: 바닥 ±35 m 만). 구역을 옮기거나 키우면 지형도 바뀝니다. 계획(`cityplan.buildPlan`)은 둑 범위까지를 덮인 곳으로 봅니다(heightfield 와 같은 수치).
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
- **시설**: `data/facilities.js` 의 `FACILITIES` 에 한 줄(`at` 장소 + `off`/`polar`/`toward`). 자리에 다른 구조물이 있으면 빌더가 나선으로 밀어서 빈 곳을 찾습니다. 새 종류는 `FACILITY_TYPES` + `world/facilities.js` 의 `_종류` 모델 + `game/services.js` 의 `_종류` 카드. 시설지기는 `npcs` 에 `service` 가 붙은 인물(`fac-시설id`)이라 `_findTarget` 이 「시설지기 · 하는 일」로 보여 줍니다.
- **옛 책**: `data/facilities.js` 의 `BOOKS` (`at` = 서고 id, `word` = 읽으면 배우는 단어).
- **도시 구역**: `data/city.js` 의 `ZONES` 에 한 줄(머리 주석에 항목 설명). `sectors` 는 부채꼴마다의 쓰임 비율, `mix` 는 `MIX` 의 비율 묶음.
- **쓰임(토지 이용)**: `data/city.js` 의 `USE` 에 번호 + `world/cityplan.js` 의 `SCORE`(어디에 오기 좋은가) + `T[U.이름]` 템플릿(블록 좌표 u·v 미터로 `P.bldg`·`P.prop`·`P.spot`) + `world/city-ground.js` 의 `cityBlock()` 에 바닥 무늬 + `ui/map.js` 의 `USE_COL`.
- **건물 모양**: `city-arch.js` 의 `cityArchetypes()` 에 `A.이름 = { hi, lo }`(단위 상자 −1..1 × 0..1, `loft`/`cap`/`solid`) + `SPEC.이름`(`plan` 땅 평면, `enter` 들어갈 수 있음, `low` 낮은 건물, `cols` 겹친 충돌체) + 키와 상관없는 미터 부속은 `kit('이름', [...])`(`pin` 으로 높이 고정). 양식별 후보는 `data/city.js` 의 `STYLE_KINDS`.
- **거리 소품**: `city-arch.js` 의 `propArchetypes()`(미터 단위) + `PROPCOL`(충돌체 모양). 템플릿에서 `P.prop(B, '이름', u, v, face)` 로 놓는다.
- **주민 역할**: `data/citizens.js` 의 `ROLES`(자리 종류 → 일하는 시각·사람 수·함께 할 것) + `CIT_LINES` 대사. 템플릿에서 `P.spot(B, '역할', u, v, face)` 로 자리를 놓는다. 실내는 `INDOOR` + `game/interiors.js` 의 가구 `anchors`. 새 놀이는 `game/citizens.js` 의 `_playOption`.
- **실내 쓰임**: `game/interiors.js` 의 `PURPOSE`(가구·사람·안내지기 대사)와 `BY_STYLE`(양식 → 쓰임).

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
- 도시 충돌체에는 `city: true`. 들어간 건물은 `openShell` 이 문 뚫린 모델로 바꾸고 `interiors` 가 충돌체를 바닥·벽·승강기로 갈아 끼우며, 나오면 되돌린다.
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

## 지켜야 할 것
- 기존 저장 파일이 깨지지 않게: 저장 형식을 바꾸면 `state.js` 의 `migrate()` 를 손보세요.
- 본편 흐름이 끊기지 않았는지 `node tools/flow.mjs` 로 확인하세요(마지막 줄까지 퀘스트가 진행되어야 함).
- 큰 변경 뒤에는 `docs/DEVLOG.md` 에 무엇을 왜 바꿨는지 적어 주세요.
