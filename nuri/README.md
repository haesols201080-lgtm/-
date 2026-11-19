# 누리: 작은 탐험가 (프로토타입)

35cm 오리지널 로봇 '누리'가 숲을 탐험하는 3D 플랫폼 어드벤처의 **작업 중인 프로토타입**입니다.
브라우저(three.js + Rapier 물리)에서 실행되고 터치 조작을 지원합니다.

> 숲은 Poly Haven(CC0)의 실제 3D 스캔 에셋(지면·바위·그루터기·통나무·뿌리·고사리·식물·소나무 껍질·전나무 잔가지·HDRI)으로
> 구성합니다. 브라우저(WebGL) 실시간 렌더링이라 UE5 같은 전역조명 수준은 아닙니다.

## 구성
- `blender/` — Blender(bpy 5.3) 스크립트
  - `build_robot.py`: 누리 하드서피스 모델(장갑판, 서보, 힌지 관절, 피스톤, 케이블, 볼트) + 리그 → `assets/robot/nuri.blend`
  - `export_robot.py`: 재질별 스킨 메시로 합치고 AO를 버텍스 컬러로 구워 `public/models/nuri.glb`로 내보냄
  - `render_robot.py`: Cycles 턴어라운드 렌더 (`docs/renders/nuri_turnaround.png`)
  - `pack_polyhaven_textures.py`: Poly Haven 스캔 텍스처를 게임 형식(알베도/노멀/AO·거칠기·높이)으로 변환
  - `process_polyhaven_models.py`: Poly Haven 스캔 모델을 웹·모바일용 폴리곤 수로 줄여 GLB로 내보냄
  - `build_conifers.py`: 스캔한 전나무 잔가지·소나무 껍질로 소나무/전나무/묘목을 생성(LOD 포함)
  - `build_env.py`: 터널 동굴 암반, 속 빈 통나무 (나머지 함수는 초기 절차적 버전)
  - `bake_textures.py`: 초기 절차적 텍스처 굽기 (현재는 사용하지 않음)
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
# Poly Haven 원본은 api.polyhaven.com / dl.polyhaven.org 에서 받습니다 (CC0)
python blender/pack_polyhaven_textures.py <다운로드 폴더> public/tex
python blender/process_polyhaven_models.py <다운로드 폴더> public/models/ph
python blender/build_conifers.py <다운로드 폴더> public/models/trees
python blender/build_env.py public/models outcrop logs
```

## 라이선스 메모
- 숲 스캔 텍스처·모델·HDRI(`forest_slope`): Poly Haven, CC0 (https://polyhaven.com/license)
- 로봇·나무 구조·지형·사운드·음악은 이 저장소의 스크립트로 만든 것입니다.
