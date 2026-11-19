# 누리: 작은 탐험가 (프로토타입)

35cm 오리지널 로봇 '누리'가 숲을 탐험하는 3D 플랫폼 어드벤처의 **작업 중인 프로토타입**입니다.
브라우저(three.js + Rapier 물리)에서 실행되고 터치 조작을 지원합니다.

> 현재 상태: 실행·조작은 되지만 화면이 '실사'와는 거리가 있습니다. 이 환경에는 GPU, Unreal Engine, 3D 스캔 에셋이 없어서
> 절차적으로 만든 에셋의 한계가 있습니다. 실사 수준을 원하면 UE5 + 스캔 에셋(Megascans) 쪽으로 옮기는 것을 검토 중입니다.

## 구성
- `blender/` — Blender(bpy 5.3) 스크립트
  - `build_robot.py`: 누리 하드서피스 모델(장갑판, 서보, 힌지 관절, 피스톤, 케이블, 볼트) + 리그 → `assets/robot/nuri.blend`
  - `export_robot.py`: 재질별 스킨 메시로 합치고 AO를 버텍스 컬러로 구워 `public/models/nuri.glb`로 내보냄
  - `render_robot.py`: Cycles 턴어라운드 렌더 (`docs/renders/nuri_turnaround.png`)
  - `bake_textures.py`: 숲 바닥·흙길·강바닥(실제 3D 오브젝트 산포 렌더), 바위·이끼·나무껍질(4D 토러스 노이즈로 이음매 없음) PBR 세트 굽기
  - `build_env.py`: 바위, 나무(버트레스 뿌리·가지·잎 카드, LOD), 통나무, 그루터기, 터널 동굴 암반, 버섯 → GLB
- `src/` — 게임 코드 (지형/스플랫 셰이더, 캐릭터 컨트롤러, 카메라, 퍼즐, 생물, 절차적 사운드, UI, 저장)
- `public/` — 게임에서 불러오는 텍스처·모델·HDRI

## 실행
```
npm install
npx vite            # http://localhost:5173  (?quality=low|medium|high)
```

## 에셋 다시 만들기
```
pip install bpy==5.3.0 pillow
python blender/build_robot.py assets/robot                 # 원본 .blend
python blender/build_robot.py /tmp/r --q 0.4 && python blender/export_robot.py /tmp/r/nuri_q0.4.blend public/models/nuri.glb
python blender/bake_textures.py public/tex 2048
python blender/build_env.py public/models
```

## 라이선스 메모
- 숲 HDRI(`forest.exr`): Poly Haven(CC0), `@pmndrs/assets` npm 패키지 경유 — `assets/hdri/PMNDRS_ASSETS_LICENSE`
- 그 밖의 모델·텍스처·사운드·음악은 이 저장소의 스크립트로 생성한 것입니다.
