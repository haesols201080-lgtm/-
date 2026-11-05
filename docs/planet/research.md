# 테라 제네시스 — 레퍼런스 조사와 설계 반영 기록

이 문서는 「테라 제네시스」(`planet/`)를 만들면서 참고한 게임들을 실제 자료로 조사한 내용과, 그것이 게임의 어느 부분에 어떻게 반영됐는지를 정리합니다.

> 조사 방법과 한계: 이 개발 환경에서는 위키 페이지(fandom, wiki.gg)에 직접 접속할 수 없어서, 웹 검색 결과로 수치와 메커니즘을 확인하고 서로 다른 출처를 교차 확인했습니다. 출처끼리 수치가 다른 경우(예: The Planet Crafter 후반 단계 Ti 값)는 아래에 명시했습니다. 영상은 직접 볼 수 없어서, 공략·위키·리뷰·개발사 자료에 적힌 실제 구현 내용을 기준으로 삼았습니다.

## 1. 월드와 테라포밍

### The Planet Crafter — 월드의 핵심 기준

**조사한 사실**
- 테라포밍 지수(Ti)는 산소(ppq) + 열(pK) + 기압(nPa) + 바이오매스(g)의 합이고, 단위가 달라도 1Ti = 1ppq = 1pK = 1nPa = 1g으로 더합니다. Ti는 줄어들지 않고, 행성의 변화는 개별 수치가 아니라 전체 Ti로 결정됩니다. ([Terraformation Index](https://planet-crafter.fandom.com/wiki/Terraformation_Index), [Steam 토론](https://steamcommunity.com/app/1284190/discussions/0/3280321473017981684/))
- 단계 사다리(Prime 기준): 불모 0 → 푸른 하늘 175kTi → 구름 350kTi → 비 875kTi → 액체 물 3MTi → 호수 50MTi → 이끼 200MTi → 초원 700MTi → 나무 2GTi → 곤충 8GTi → 숨쉬는 대기 32GTi. 초반·중반 값은 출처 간에 일치합니다. 물고기·양서류·포유류·완전 테라포밍 같은 후반 값은 출처마다 다릅니다(4TTi와 5TTi 등). ([PinDrop](https://pindrop.gg/planet-crafter/planets), [Steam 가이드](https://steamcommunity.com/sharedfiles/filedetails/?id=2954847428), [banrado.de](https://banrado.de/en/planet-crafter-terraformation-stages), [Complete Terraformation](https://planet-crafter.fandom.com/wiki/Complete_Terraformation))
- 산소는 식물 배양관·조류 발생기·나무 살포기가, 열은 히터가, 기압은 드릴이 주로 올립니다. 바이오매스는 식물·곤충·동물의 합입니다. 커뮤니티 수치상 후반에는 나무 살포기의 산소 기여가 히터보다 큽니다. ([shapes.inc 정리](https://shapes.inc/fandom/planet-crafter/terraformation-stages), [Steam 토론](https://steamcommunity.com/app/1284190/discussions/0/4355620586425403754/))
- 기지 건설: 생활 구획(Living Compartment)이 기본 블록이고, 안에 들어가면 산소가 채워집니다(물에 잠기면 불가). 조각들은 가까이 두면 자동으로 스냅됩니다. 초반에는 문 하나 달린 방을 임시 산소 텐트로 씁니다. ([Base Building](https://planet-crafter.fandom.com/wiki/Base_Building), [Living Compartment](https://planet-crafter-terraformation.fandom.com/wiki/Living_Compartment), [초보자 가이드](https://steamcommunity.com/sharedfiles/filedetails/?id=2885568978))

**반영한 곳**
- 같은 네 가지 수치와 단계 구조를 그대로 씁니다(`planet/src/sim/data.js`의 `STAGES`, `planet/src/sim/terraform.js`). 수십 시간 걸리는 원작 대신 몇 시간 안에 끝까지 갈 수 있도록 임계값을 1kTi~4MTi로 압축했습니다. 단계 사이 간격이 지수적으로 커지는 비율은 유지했습니다.
- 단계 사이를 로그 보간한 연속값 하나로 모든 시각 요소를 움직입니다. 하늘의 산란 색, 먼지, 구름량, 서리, 크레이터 얼음 해빙, 해수면(−295m → 0m), 극지 눈의 후퇴, 이끼·풀·꽃·나무의 생장, 색 포화도가 여기에 따라갑니다. 단계를 넘을 때만 바뀌지 않고 진행하는 동안 계속 변합니다.
- 생활 구획처럼 거주 모듈 안(실내 볼륨)에 들어가면 산소가 채워지고, 착륙 포드 근처와 로버 안에서도 채워집니다. 숨쉬는 대기 단계부터는 산소가 줄지 않습니다(`planet/src/game/game.js`의 `survival`).

### Surviving Mars: Green Planet
- 대기·온도·물·식생, 네 가지 테라포밍 지표를 다룹니다. 극관 해빙, 얼음 소행성 포획, 우주 거울 같은 특수 프로젝트가 있고, 물 펌프로 호수 바닥을 채웁니다. ([Nuuvem 상품 설명](https://www.nuuvem.com/item/surviving-mars-green-planet), [GOG](https://www.gog.com/game/surviving_mars_green_planet), [Paradox 포럼](https://admin-forum.paradoxplaza.com/forum/threads/small-fixes-to-vastly-improve-terraforming.1180369))
- 반영: 「궤도 반사경 송신소」(우주 거울에 해당), 극지 눈 후퇴, 정수 펌프는 호숫가에서 물을 퍼 올리고 그렇지 않으면 얼음을 녹입니다(`planet/src/sim/economy.js`의 `nearWater`).

### Terra Nil
- 독성 토양 정화 → 관개 → 생물군계별 식생 → 야생동물 귀환 → 시설 재활용으로 이어지는 「역(逆) 도시 건설」 게임입니다. 습지·초원·숲을 고르게 갖춰야 생물다양성이 생깁니다. ([PC Gamer](https://pcgamer.com/transforming-a-barren-wasteland-into-a-leafy-green-paradise-feels-damn-good-in-terra-nil), [Roundtable Co-Op](https://roundtablecoop.com/?p=4167), [Wikipedia](https://en.wikipedia.com/wiki/Terra_Nil))
- 반영: 이끼 살포기와 나무 살포기는 행성 전체 단계와 별도로 주변 60~80m를 먼저 초록으로 만듭니다(`uGreen` 유니폼이 지형 셰이더와 식생 셰이더 양쪽에 들어감). 기계를 세운 자리부터 땅이 살아나는 모습이 보입니다.

### ASTRONEER
- 지형 도구로 올리기·파기·평탄화를 하고, 정렬 모드로 평평한 면을 만듭니다. ([Terrain Tool](https://astroneer.wiki.gg/wiki/Terrain_Tool), [Twinfinite](https://twinfinite.net/guides/astroneer-build-terrain-how/))
- 반영: 지형 도구(G). 좌클릭 올리기, 우클릭 파기, Shift 평탄화이고 휠로 반경을 조절합니다. 모든 편집은 높이장 위의 편집 목록으로 저장되고 워커와 동기화됩니다(`planet/src/world/edits.js`). 건물을 놓으면 같은 방식으로 발밑이 자동으로 평탄화됩니다.

## 2. 도시와 문명

### Anno 1800 — 도시의 핵심 기준
- 농부 → 노동자 → 장인 → 기술자 → 투자가 순서의 계층이 있습니다. 농부 주택은 기본 10명이고, 기본 필요(시장·생선·작업복)와 사치 필요(슈냅스·선술집)가 있습니다. 노동자 주택은 기본 20명입니다. 기본 필요가 하나씩 채워질 때마다 주택 인원이 늘고, 집이 가득 차고 기본 필요가 다 채워지면 목재 4로 상위 계층으로 업그레이드합니다. 생산 건물마다 특정 계층의 노동력이 필요합니다. ([Farmer Residence](https://anno1800.fandom.com/wiki/Farmer_Residence), [Worker Residence](https://anno1800.fandom.com/wiki/Worker_Residence), [Population](https://anno1800.fandom.com/wiki/Population), [Residences](https://anno1800.fandom.com/wiki/Residences))
- 반영(`planet/src/sim/colony.js`): 개척민 → 기술자 → 공학자 → 시민 4계층. 기본 필요(물·식량·전력·배급소·의료·생활용품·학교·전자기기·문화)가 하나씩 채워질 때마다 주택 인원이 늘고, 사치 필요는 행복도와 세수를 올립니다. 업그레이드 조건은 Anno와 같습니다(기본 필요 충족, 집이 가득 참, 해당 연구, 창고의 재료). 업그레이드하면 주택 모델 자체가 돔 → 2층 복층 → 4층 아파트 → 유리 타워로 바뀝니다. 농장·펌프·공장·학교·연구소는 계층별 일손이 필요하고, 일손이 모자라면 그만큼 생산성이 떨어집니다.

### Cities: Skylines II
- 인구만이 아니라 경험치(XP)로 마일스톤이 열리고, 주거·상업·산업 수요는 서로 맞물립니다. 수도·전기·의료·교육 같은 서비스는 범위와 만족도에 영향을 줍니다. ([Xbox Wire](https://news.xbox.com/en-us/2023/10/24/cities-skylines-2-helpful-tips/), [PCGamesN](https://www.pcgamesn.com/cities-skylines-2/game-progression), [Paradox 기능 소개](https://www.paradoxinteractive.com/games/cities-skylines-ii/features/zones-signature-buildings))
- 반영: 배급소·의료소·학교·라운지·공원·문화 센터는 반경형 서비스입니다(반경 안의 주택만 혜택). 전력은 연결된 전력망 단위로 공급량/수요를 계산합니다. 도로를 깔면 정착민의 길찾기(A*) 비용이 낮아져 정착민이 도로로 다닙니다(`planet/src/npc/npc.js`).

### Civilization VI
- 기술마다 특정 행동을 하면 연구가 50% 진행되는 「유레카」가 있고, 시대(era) 단위로 기술이 묶입니다. ([Civilization Wiki](https://civilization.fandom.com/wiki/Great_Scientist_(Civ6)))
- 반영(`planet/src/sim/research.js`): 5개 시대(개척·정착·마을·도시·문명)로 묶인 16개 연구가 있습니다. 고대 유적을 조사하면 무작위 연구에 유레카(비용 50%)가 붙습니다. 문명 시대 자체도 Civ처럼 조건(인구·계층·기념물)을 채우면 전초기지 → 정착지 → 마을 → 도시 → 문명으로 넘어갑니다.

### 정착민 흐름 (사용자 피드백 반영)
- 정착민은 본부를 세우는 것만으로 오지 않습니다. 심우주 교신기로 행성 상태를 송신해 초청해야 하고, 구름 단계 전에는 아무도 응답하지 않습니다. 응답 인원은 테라포밍 단계(구름 6명 → 숨쉬는 대기 30명)와 빈 집 수로 정해집니다(`planet/src/sim/colony.js`의 `callStatus`·`sendCall`). 송신 → 약 18초 뒤 응답 → 약 30초 뒤 셔틀 착륙 순서로 진행됩니다.

### Spore (문명 단계)
- 도시와 공장이 지속적으로 자원(스파이스/스포어벅스)을 만들고, 그 자원으로 도시와 차량을 늘립니다. ([Civilization Stage](https://spore.fandom.com/wiki/Civilization_Stage), [Making money](https://spore.fandom.com/wiki/Making_money))
- 반영: 주민 세수(크레딧)로 식민지 건물과 업그레이드 비용을 냅니다. 행성 규모의 목표(궤도 엘리베이터)가 문명의 최종 상징입니다.

### 건축 언어 — SpaceX 화성 도시 콘셉트 (사용자 제공 레퍼런스)
사용자가 보낸 SpaceX 화성 도시 렌더(착륙장 → 가압 연결 통로 → 격자형 도시)를 기준으로 삼았습니다. 렌더에서 읽은 규칙:
- **재질과 색**: 붉은 지면 위 흰색·밝은 회색 복합재 외피, 짙은 유리, 흑연색 띠. 원색 강조색이 없습니다. → 주황 강조색과 갈색 오염을 걷어내고, 패널 이음매를 크고 옅게 바꿨습니다.
- **형태**: 낮은 원통 벽 위의 흰 돔 거주 유닛이 2~4개씩 붙은 군집, 반구형 지붕의 원통형 타워(층마다 어두운 띠창), 초록 식물이 보이는 유리 돔, 짧은 가압 튜브 연결.
- **도시 구성**: 밝은 회색 도로의 격자, 블록마다 돔·타워·온실이 빽빽하게 들어섭니다. → 도로 포장을 밝은 회색으로 바꿨습니다.

주거 등급에 반영한 내용:
- **1단계**: 띠창이 있는 흰 돔 + 원통형 출입 에어록 + 유리 정원 돔 + 지상 태양광 패널.
- **2단계**: 크기가 다른 돔 2개 + 정원 돔을 가압 튜브로 연결한 군집.
- **3단계**: 띠창이 둘린 반구 지붕 원통 타워 2개 + 스카이브리지 + 로비 돔.
- **4단계**: 유리 코어를 강철 다이어그리드가 감싼 모래시계형 타워(사용자가 괜찮다고 한 디자인) + 유리 포디엄 + 옥상 정원 돔.
- **본부**: 흰 본관 위에 띠창 타워를 올렸고, 깃발형 배너 대신 조명주를 세웠습니다.

재질과 입면 (사용자 피드백 "재질이 최악, 유리 떡칠 금지, 실제 건물 같지 않음" 반영):
- **유리**: 평면 파란 유리 대신 어두운 반사 유리(프레넬 반사) 뒤에 가짜 방을 그립니다(interior mapping: 3.6×3.2×3.6 m 방, 바닥·천장 조명·벽·가구·블라인드). 낮에는 어둡게, 밤에는 방마다 불이 켜집니다.
- **유리 양**: 층마다 둘렀던 연속 유리 띠를 없애고, 벽에 뚫린 창(깊이 있는 창틀·문설주·돌출 창대·인방·멀리언)으로 바꿨습니다.
- **외장재**: 실제 도장 알루미늄 패널 수준의 반사율과 광택, 줄눈을 맞춘 대형 패널(벽돌처럼 엇갈리지 않게), 원통·돔은 면을 따라 감기는 패널 좌표를 씁니다.
- **건축 디테일**: 층 라인, 발코니(난간), 캐노피와 유리문이 있는 출입구, 옥상 설비(계단실·실외기·덕트), 기단.

먼저 시도했던 3D 프린팅 레골리스 외피(Foster + Partners/ESA 달 기지, ICON/BIG Mars Dune Alpha, AI SpaceFactory MARSHA)는 적층 결이 "목조 건축물"처럼 읽힌다는 피드백을 받아 폐기했습니다.

### 도로 — 지형에 새긴 포장 통로
도로는 메시를 덧대지 않고 지형 편집으로 만듭니다. 경사를 제한해 다듬은 폴리라인을 따라 노반을 고르고, 셰이더가 그 면에 육각 소결 포장을 입힙니다. 그래서 교차로와 곡선이 이음매나 Z-파이팅 없이 이어지고, 절토·성토 깊이에 비례해 사면 폭이 넓어져 수직 벽이 생기지 않습니다. 참고: [ESA — How to make roads on the Moon](https://www.esa.int/Enabling_Support/Space_Engineering_Technology/How_to_make_roads_on_the_Moon), [PAVER (IAC 2022)](https://liquifer.com/wp-content/uploads/2022/12/PAVER_IAC22_0109_FINAL.pdf).

## 3. 직접 짓는 3D 게임플레이 — Satisfactory

- 빌드 건이 홀로그램을 투사합니다. 설치할 수 있으면 파랑, 없으면 빨강입니다(최신 텍스처 홀로그램에서도 같은 규칙이라는 사용자 증언). 화살표 키로 1m씩 미세 이동하고, H로 홀로그램을 고정하고, Ctrl로 월드 그리드에 스냅합니다. 해체 모드(F)에서는 좌클릭을 길게 눌러 해체합니다. ([Build Gun](https://satisfactory.wiki.gg/wiki/Build_Gun), [Foundations](https://satisfactory.wiki.gg/wiki/Foundations), [Prima Games](https://primagames.com/tips/how-to-snap-to-world-grid-in-satisfactory), [Steam 토론](https://steamcommunity.com/app/526870/discussions/0/4329623982987996094/))
- 반영(`planet/src/build/buildmode.js`):
  - 홀로그램은 프레넬 외곽선과 스캔라인을 넣은 반투명 셰이더입니다. 가능하면 파랑, 불가면 빨강이고, 이유를 한국어로 표시합니다(자원 부족, 지형이 가파름, 겹침, 광맥 위만 가능, 수심 조건, 기초 판 지지 부족 등).
  - 기초 판(8×8m)은 조준한 기초 판의 가장자리로 스냅해 이어 붙고, PageUp/PageDown으로 1m씩 높이를 조정합니다. 기초 판 위의 건물은 기초 판 회전에 맞춰 1m 격자로 스냅합니다.
  - 해체 모드(F)에서는 빨간 오버레이가 표시되고 좌클릭을 길게 누르면 해체되며, 재료는 100% 돌려받습니다. 위에 건물이 있는 기초 판은 해체할 수 없습니다.
  - 자동 채굴기는 광맥 중심에 스냅하고, 조류 배양기는 얕은 물 위에만 뜹니다.
  - 핫바(1~9)와 「건설 메뉴에서 숫자 키를 누르면 핫바에 등록」은 Satisfactory의 단축칸 방식을 따랐습니다.

## 4. 조사가 결정한 정체성 — 직접 걷는 오픈월드

- 탑다운 카메라는 없습니다. 모든 건설·관리는 우주복을 입은 플레이어가 1인칭(V로 전환)·3인칭으로 현장에서 합니다. 건설 범위는 55m입니다.
- 건물 내부는 실제로 걸어 들어가는 공간입니다. 거주 모듈·본부·농장·배급소·라운지·연구소·물류 창고는 문이 자동으로 열리고, 벽에는 실제 창 개구부(안에서 바깥이 보임)·가구·조명이 있고, 벽마다 충돌체가 있습니다.
- 행성의 넓이: 사용자 요청에 따라 Planet Crafter(약 2~3km)보다 훨씬 넓은 16km×16km(256km²) 행성으로 만들었습니다. 위도대(극지 빙원, 크레이터 지대·협곡·메사, 사구·화산대·결정 평원·염원)와 대륙 노이즈, 부드럽게 섞이는 프로빈스(소프트 보로노이), 랜드마크(거대 순상화산, 대협곡, 충돌 분지)가 하나의 행성을 이룹니다. 넓은 맵을 다니도록 탐사 로버(N)를 넣었습니다.

## 5. 검증 방법

헤드리스 Chromium(SwiftShader)에서 Playwright로 다음을 자동 확인했습니다.
- 불모·초원·호수·밤 단계의 화면
- 건물 배치 규칙(겹침, 경사, 기초 판 지지, 광맥)
- 거주 모듈 진입(문 열림 → 실내 판정 → 산소 충전 → 뒷벽 충돌)
- 채집, 제작, 해체 환급, 지형 도구, 로버 주행, 유적 조사, 저장
