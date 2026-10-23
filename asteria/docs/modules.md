# 아스테리아 3D — 그래픽 모듈 계약

모든 모듈은 `index.html`이 `<script>`로 순서대로 읽는 전역 스크립트다 (ES 모듈 아님). three.js r147 UMD(`THREE` 전역).
외부 네트워크 없음: 텍스처·모델은 전부 코드로 만든다. 단, `asteria/assets/` 의 CC0 HDRI(EXR)와 구름 텍스처는 쓸 수 있다.
코드 주석은 한국어, 이름은 영어. 기존 코드 스타일(짧은 함수, 2칸 들여쓰기, 세미콜론)을 따른다.

## 읽는 순서 (index.html)
```
vendor/three.min.js, vendor/three-post.js, (atmos 의존 vendor 파일들)
js/core.js      수학·노이즈·입력·소리 (clamp, lerp, smooth, hash2, noise2, fbm, ridged, rand, dist ...)
js/gfx.js       렌더러·장면·카메라·기본 도우미 (GFX, V3, COL, mat(), geo(), mesh(), GLOW(), ADD())
js/atmos.js     하늘·해·안개·IBL·그림자·후처리 (ATMOS)
js/tex.js       절차 PBR 재질 (TEX)
js/batch.js     형상 묶음 (Batch, M4, M4e, boxUV, batchMat, MAT_FALLBACK)
js/gothic.js    고딕 건축 키트 (KIT)
js/flora.js     나무·덤불·담쟁이·꽃·바위 (FLORA)
js/props.js     실내외 소품 (PROPS)
js/hero.js      캐릭터 (makeRig / animRig 교체)
js/field.js ... js/main.js  게임
```

## 공통 약속
- 단위 미터, +y 위, 오른손 좌표. 방향 각 `rot`는 three.js의 `rotation.y`와 같다 (물체를 로컬 x축 방향으로 만든 뒤 rot만큼 돌린다).
- 색은 sRGB 16진수로 적는다 (`0xC9A97E`). 렌더러는 `THREE.ColorManagement.legacyMode = false`, 출력 sRGB.
- 정적 형상은 `Batch`(js/batch.js)에 재질 이름별로 모은 뒤 `build()`로 통마다 메쉬 하나로 합친다. 그리기 호출을 줄이는 것이 성능의 핵심이다 (바깥 장면 전체 300 이하).
- uv는 **미터 단위**다. 텍스처 한 장이 몇 미터인지는 재질(TEX)이 정한다. three.js 기본 형상(BoxGeometry 등)의 0~1 uv를 그대로 넣지 말 것: `batch.add(key, g, mx, { worldUV: true })`로 월드 상자 투영 uv를 만들거나, 직접 미터 uv를 적는다. 돌 벽은 v가 높이를 따라야 줄눈이 수평이다.
- 정점색(`color`)은 곱이다. 밝기 흔들기(±8%), 창마다 불빛 세기, 바닥 근처 때 등을 굽는 데 쓴다. 모든 TEX 재질은 `vertexColors: true`.
- 충돌체 형식 (field.js `addStatic`): 원 `{x,z,r,top,bot}`, 축 상자 `{x0,x1,z0,z1,top,bot}`, 돌린 상자 `{x,z,hw,hd,rot,top,bot}`. `top`/`bot`은 월드 높이. 올라설 수 있으면 `stand:true`, 기어오를 수 있으면 `climb:true`, 사다리는 `ladder:true`.
- 빛 표시 `{x,y,z,c,k,d,flicker}`: 게임이 가까운 것부터 점광원 풀(데스크톱 8개)에 배정한다. 배정 못 받은 빛을 위해 **불꽃·창에는 반드시 발광 형상(헤일로 카드 포함)이 함께 있어야** 한다. 빛만 있고 근원이 안 보이는 것은 금지.

## TEX (js/tex.js) — 재질
```
TEX.lib(name)        → 이름 붙은 기본 재질 (캐시됨). 아래 이름표 참고. 모르는 이름이면 null.
TEX.mat(kind, o)     → MeshStandardMaterial(또는 Physical). kind는 생성기 종류(ashlar, slate, oak ...).
   o.size   텍스처 한 장이 덮는 미터 (기본은 종류마다)
   o.p      생성기 인자 (예: ashlar {era:'ancient'|'early'|'high'})
   o.tint   색 곱 (16진수), o.rough 거칠기 곱, o.tri true면 월드 삼면 투영(uv 불필요: 지형·바위용)
   o.emissive, o.side, o.transparent ...
TEX.ready()          → Promise (요청된 텍스처가 모두 만들어지면)
TEX.setGround(o)     → 모든 TEX 재질이 공유하는 "땅 높이" (지면 근처 때·물 얼룩): {tex, x0, z0, w, d} 또는 {flat: y}
TEX.weather(o)       → 공유 값: {grime 0..1, moss 0..1, wet 0..1, snow 0..1}
```
재질은 곧바로 쓸 수 있어야 한다 (텍스처가 아직 안 만들어졌으면 평균색으로 보이다가 채워짐).
월드 좌표 큰 무늬(2~10 m 얼룩), 위를 향한 면의 이끼, 땅 근처 0~1.5 m의 때를 셰이더에서 더한다.

이름표 (`TEX.lib`): stone(꿀빛 석회암 마름돌), stoneOld(고대층: 창백, 큰 돌, 황동 이음새, 틈에 약한 레이 빛), stoneEarly(거친 옛 돌), stoneTrim(줄눈 없는 다듬은 돌: 몰딩·창틀), stoneDark(그을린 돌), slate(지붕: u는 처마 방향, v는 경사 위로), copper(녹청 구리), lead, brass, gold, iron, oak, oakPanel, timber, plaster, glassDark(낮의 창: 어둡게 반사, 납 창살), glassLit(밤의 창: 발광 × 정점색), glassStained, cobble, flagstone, gravel, dirt, grass, moss, rock, snow, carpet, velvet, parchment, leather, bookSpines, rope, bark, leaf, leafAutumn, water.

## KIT (js/gothic.js) — 고딕 건축
`const b = new KIT.Builder({ seed, ground: (x,z)=>y })` (Batch를 상속하거나 감싼다). 부품은 `docs/visual-target.md`의 수치를 따른다.
대표 부품 (이름·인자는 구현하며 다듬어도 되지만 이 범위는 갖출 것):
```
b.wall(ax,az,bx,bz,{y, h, thick, era, windows, buttress, plinth, courses, parapet:'none'|'battlement'|'balustrade', corbel})
b.hall(x,z,{w,d,rot,y,h, pitch, era, windows, buttress, flying, rose, dormers, chimneys})   // 벽+경사 지붕 한 동
b.tower(x,z,{r | w, h, y, roof:'cone'|'pyramid'|'spire'|'battlement'|'belfry', roofH, finial, windows, turret, corbelStage})
b.gatehouse(x,z,{rot, ...}), b.portal(...), b.arcade(ax,az,bx,bz,{...}) // 회랑
b.bridge(ax,az,bx,bz,{deckY, width, arches}), b.stairs(x,z,rot,{w,rise,run})
b.pinnacle, b.chimney, b.dormer, b.window(...), b.rose(...)
b.build() → THREE.Group (userData.batch: colliders, lights, marks, anims)
```
- 창은 벽 두께만큼 파인 깊은 창이다 (안쪽 면, 창턱, 물끊기, 납 창살). 낮에는 glassDark, 해 질 녘에는 일부만 glassLit.
- 기초는 `ground(x,z)`까지 내려가 떠 보이지 않게 한다.
- 충돌체: 벽마다 돌린 상자, 탑은 원. 학원 외벽은 기어오를 수 있다(`climb:true`), 지붕은 `stand:true`.
- 표시(marks): 창 `{kind:'window', x,y,z, nx,nz, w,h, lit}` (빛줄기·조명용), 문 `{kind:'door', x,y,z, rot, w,h}`.

## FLORA (js/flora.js) — 식물과 바위
```
FLORA.tree(kind, seed) → {bark: BufferGeometry, leaf: BufferGeometry, h, r}   // kind: oak, beech, pine, birch, yew, dead
FLORA.forest(batchOrGroup, points, o)  → 인스턴싱으로 심기 (색 ±6° / 밝기 ±12% 흔들기, 바람)
FLORA.bush, FLORA.hedge(ax,az,bx,bz), FLORA.ivy(wallMark...), FLORA.flowers, FLORA.reeds, FLORA.rock(seed)
GFX 풀(gfx.js initGrass/updateGrass) 개선: 끝 색, 높이 0.2~0.6 m, 꽃 무리, 바람 물결
```
막대사탕 나무 금지: 보이는 줄기·가지에 노이즈로 부푼 잎 덩어리 3~7개, 하늘이 비치는 틈.

## PROPS (js/props.js) — 소품
`PROPS.<name>(batch, x, y, z, rot, o)` 꼴로 Batch에 형상을 더한다 (한 방의 소품 수백 개가 재질별 메쉬 몇 개로 합쳐진다).
움직이는 것(촛불 불꽃, 혼천의 고리, 시계 바늘)은 `batch.extra`에 Object3D로 넣고 `batch.anims`에 갱신 함수를 넣는다.
불꽃은 가산 혼합 카드 + 헤일로 + `batch.light({...flicker:true})`.

## HERO (js/hero.js) — 캐릭터
actors.js의 `makeRig(look, o)` / `animRig(root, state, dt)`를 같은 이름·같은 인자로 대체한다 (hero.js가 나중에 읽혀서 덮어쓴다).
root에 있어야 하는 것: `body, hips, torso, head, armL, armR, legL, legR, cape, rod(rod.tip은 메쉬), glider(o.glider일 때), ph`.
`look`: cloak, body, hair, skin, legs, hat, scarf, mask, crack, scale. `o`: rod, glider, ghost(모든 부위에 쓸 재질 하나).
`state.mode`: idle walk run climb glide swim fall sit kneel, `state.atk`(0..1), `state.cast`(0..1).

## 보기 페이지 (look-dev)
모듈마다 `asteria/lookdev/<이름>.html`을 둔다. `?shot`이면 메뉴를 숨긴다. `#장면이름`으로 장면을 고른다.
스크린샷: `node <scratchpad>/shot.js "file:///home/user/-/asteria/lookdev/x.html?shot#scene" out.png 15000` (SwiftShader라 느리다: 한 장 30~60초).
