// 아스테리아 1부 — 대기와 렌더링
// 하늘(해·달·별·오로라), 구름(하늘 덮개 + 지평선 구름 둑), 환경광(IBL: HDRI + 절차 하늘),
// 두 단계 해 그림자, 높이 안개 + 거리 안개(해 쪽 산란), 빛줄기와 먼지, 후처리(AO → 번짐 → 색 보정 → SMAA).
// 전역 ATMOS 하나로 쓴다. gfx.js의 initGfx()가 ATMOS.init()을 부르고, updateSky(o)는 ATMOS.legacy(o)로 넘어온다.
'use strict';
(function () {
  if (window.ATMOS) return;
  const T = THREE;
  const A = { ready: false, tier: 'high', vol: [], time: 0, frame: 0 };
  window.ATMOS = A;

  // 자산 위치: js/atmos.js 기준으로 한 단계 위
  const cur = document.currentScript;
  A.base = cur && cur.src ? new URL('..', cur.src).href : './';

  const C = h => new T.Color(h);
  const D2R = Math.PI / 180;
  const cl = (v, a, b) => v < a ? a : v > b ? b : v;
  const lp = (a, b, t) => a + (b - a) * t;
  const sm = (a, b, v) => { const t = cl((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const dirEA = (el, az, out) => (out || new T.Vector3()).set(Math.cos(el * D2R) * Math.sin(az * D2R), Math.sin(el * D2R), Math.cos(el * D2R) * Math.cos(az * D2R));

  // =====================================================================
  // 1. 모든 재질이 함께 보는 값 (셰이더 조각을 고쳐 전역으로 쓴다)
  //    값이 Vector가 아닌 평범한 {x,y,z,w} 객체라 재질마다 복제되지 않고 같은 것을 가리킨다.
  // =====================================================================
  const SH = A.shared = {
    fogA: { x: 0, y: 0.04, z: 0, w: 0 },   // 높이 안개 밀도, 감쇠(1/m), 바닥 높이, 켜짐
    fogB: { x: 1, y: 0.8, z: 0.6, w: 6 },  // 해 쪽 산란 색(선형), 날카로움
    fogC: { x: 0, y: 1, z: 0, w: 1 },      // 해 방향, 최대 안개
    fogD: { x: 0, y: 0, z: 0, w: 0 },      // 안개가 시작되는 거리
    env: { x: 1, y: 1, z: 1, w: 0 },       // 환경광 색·세기, 켜짐
  };
  function fogUniforms() {
    return { atmosFogA: { value: SH.fogA }, atmosFogB: { value: SH.fogB }, atmosFogC: { value: SH.fogC }, atmosFogD: { value: SH.fogD } };
  }
  for (const k in T.ShaderLib) { const u = T.ShaderLib[k].uniforms; if (u && u.fogColor) Object.assign(u, fogUniforms()); }
  Object.assign(T.UniformsLib.fog, fogUniforms());
  T.ShaderLib.standard.uniforms.atmosEnv = { value: SH.env };
  T.ShaderLib.physical.uniforms.atmosEnv = { value: SH.env };

  const CH = T.ShaderChunk;
  CH.fog_pars_vertex = `
#ifdef USE_FOG
	varying float vFogDepth;
	varying vec3 vFogWorld;
#endif`;
  CH.fog_vertex = `
#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
	{ vec3 fv_ = mvPosition.xyz - viewMatrix[ 3 ].xyz;
	  vFogWorld = vec3( dot( viewMatrix[ 0 ].xyz, fv_ ), dot( viewMatrix[ 1 ].xyz, fv_ ), dot( viewMatrix[ 2 ].xyz, fv_ ) ); }
#endif`;
  CH.fog_pars_fragment = `
#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	varying vec3 vFogWorld;
	uniform vec4 atmosFogA;
	uniform vec4 atmosFogB;
	uniform vec4 atmosFogC;
	uniform vec4 atmosFogD;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`;
  CH.fog_fragment = `
#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
		float fogDen_ = fogDensity;
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
		float fogDen_ = 0.0;
	#endif
	vec3 fogCol_ = fogColor;
	if ( atmosFogA.w > 0.5 ) {
		vec3 fv = vFogWorld - cameraPosition;
		float fd = length( fv );
		vec3 frd = fv / max( fd, 1e-4 );
		float dE = fogDen_ * max( fd - atmosFogD.x, 0.0 );
		float fk = atmosFogA.y;
		float ry = frd.y * fd * fk;
		float hE = atmosFogA.x * exp( - fk * ( cameraPosition.y - atmosFogA.z ) ) * fd * ( abs( ry ) > 1e-3 ? ( 1.0 - exp( - ry ) ) / ry : 1.0 - 0.5 * ry );
		fogFactor = min( 1.0 - exp( - dE - max( hE, 0.0 ) ), atmosFogC.w );
		float sunA = pow( max( dot( frd, atmosFogC.xyz ), 0.0 ), atmosFogB.w );
		fogCol_ = mix( fogColor, atmosFogB.rgb, sunA );
	}
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogCol_, fogFactor );
#endif`;

  // 환경광 세기·색을 한곳에서
  CH.envmap_physical_pars_fragment = CH.envmap_physical_pars_fragment
    .replace('#if defined( USE_ENVMAP )', '#if defined( USE_ENVMAP )\n\tuniform vec4 atmosEnv;')
    .replace(/envMapColor\.rgb \* envMapIntensity/g, 'envMapColor.rgb * envMapIntensity * mix( vec3( 1.0 ), atmosEnv.rgb, atmosEnv.w )');

  // 두 단계 해 그림자: 방향광 0(가까운 단계)과 1(먼 단계, 빛 없이 그림자만)을 섞는다
  (function patchCascade() {
    let s = CH.lights_fragment_begin;
    const line = /([ \t]*)directLight\.color \*= all\( bvec2\( directLight\.visible, receiveShadow \) \) \? getShadow\( directionalShadowMap\[ i \][^\n]*\n/;
    const m = s.match(line);
    const k = s.indexOf('for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ )');
    const p = k > 0 ? s.lastIndexOf('#pragma unroll_loop_start', k) : -1;
    if (!m || p < 0) { console.warn('ATMOS: 그림자 단계 조각을 고치지 못했다'); A.cascadeOK = false; return; }
    s = s.replace(line, `
		#if ( NUM_DIR_LIGHT_SHADOWS > 1 ) && ( UNROLLED_LOOP_INDEX == 0 )
		directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? atmosCS : 1.0;
		#elif ( NUM_DIR_LIGHT_SHADOWS > 1 ) && ( UNROLLED_LOOP_INDEX == 1 )
		directLight.color = vec3( 0.0 );
		#else
${m[0]}		#endif
`);
    const pre = `
	#if defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 1 )
	float atmosCS = 1.0;
	{
		vec3 cp0 = vDirectionalShadowCoord[ 0 ].xyz / vDirectionalShadowCoord[ 0 ].w;
		vec2 ce0 = min( cp0.xy, 1.0 - cp0.xy );
		float cw0 = smoothstep( 0.0, 0.1, min( ce0.x, ce0.y ) ) * step( cp0.z, 1.0 );
		float cs0 = 1.0, cs1 = 1.0;
		if ( cw0 < 0.999 ) {
			vec3 cp1 = vDirectionalShadowCoord[ 1 ].xyz / vDirectionalShadowCoord[ 1 ].w;
			vec2 ce1 = min( cp1.xy, 1.0 - cp1.xy );
			DirectionalLightShadow dls1 = directionalLightShadows[ 1 ];
			cs1 = mix( 1.0, getShadow( directionalShadowMap[ 1 ], dls1.shadowMapSize, dls1.shadowBias, dls1.shadowRadius, vDirectionalShadowCoord[ 1 ] ), smoothstep( 0.0, 0.12, min( ce1.x, ce1.y ) ) );
		}
		if ( cw0 > 0.001 ) {
			DirectionalLightShadow dls0 = directionalLightShadows[ 0 ];
			cs0 = getShadow( directionalShadowMap[ 0 ], dls0.shadowMapSize, dls0.shadowBias, dls0.shadowRadius, vDirectionalShadowCoord[ 0 ] );
		}
		atmosCS = mix( cs1, cs0, cw0 );
	}
	#endif
	`;
    CH.lights_fragment_begin = s.slice(0, p) + pre + s.slice(p);
    A.cascadeOK = true;
  })();

  // =====================================================================
  // 2. 장면 설정 (프리셋). 색은 sRGB 16진수로 적는다.
  //    sun: [고도°, 방위°]  방위 0 = +z, 90 = +x
  // =====================================================================
  const PRE = A.presets = {
    goldenHour: {
      sun: [15, 238], sunCol: 0xffc98a, sunI: 3.1,
      hemiSky: 0x9cb6dc, hemiGround: 0x6a5a3e, hemiI: 0.22, ambI: 0.0,
      env: { sunset: 1 }, envI: 0.75, envTint: 0xfff1e2, envMix: 0.55,
      zenith: 0x2f5a9e, horizon: 0xe9c9a6, glow: 0xffa257, anti: 0xb6a6c2, ground: 0x6b5d4c,
      glowK: 1.0, antiK: 0.45, haloK: 1.0, sunSize: 1.1, sunDisc: 26,
      stars: 0, aurora: 0, moon: 0, moonDir: [35, 60], milky: 0,
      cloudCov: 0.46, cloudLit: 0xffcd96, cloudShade: 0x8a7d92, cloudOp: 0.92, bankOp: 1.0,
      fogCol: 0xc4b5a6, fogSun: 0xffb46a, fogDen: 0.0013, fogH: 0.010, fogFall: 0.045, fogBase: -4, fogMax: 0.93, fogPow: 5, fogStart: 8,
      expo: 1.0, contrast: 1.07, sat: 1.06, shTint: 0x6278a8, hiTint: 0xffd29a, split: 0.24, vig: 0.34, grain: 0.028,
      bloomS: 0.42, bloomR: 0.55, bloomT: 2.8, aoI: 1.0, aoR: 1.4,
    },
    day: {
      sun: [48, 200], sunCol: 0xfff0dc, sunI: 2.6,
      hemiSky: 0xbcd6f2, hemiGround: 0x6f6a4a, hemiI: 0.3, ambI: 0.0,
      env: { sky: 1 }, envI: 0.85, envTint: 0xffffff, envMix: 0.5,
      zenith: 0x2c63b4, horizon: 0xbcd4e6, glow: 0xfff0d8, anti: 0xb4cce4, ground: 0x6d6a58,
      glowK: 0.35, antiK: 0.0, haloK: 0.6, sunSize: 0.8, sunDisc: 30,
      stars: 0, aurora: 0, moon: 0, moonDir: [35, 60], milky: 0,
      cloudCov: 0.4, cloudLit: 0xffffff, cloudShade: 0x9aa6b8, cloudOp: 0.9, bankOp: 0.95,
      fogCol: 0xb8c8d6, fogSun: 0xf4ead8, fogDen: 0.0011, fogH: 0.006, fogFall: 0.04, fogBase: -4, fogMax: 0.9, fogPow: 4, fogStart: 10,
      expo: 0.95, contrast: 1.05, sat: 1.04, shTint: 0x6f86b0, hiTint: 0xfff0dc, split: 0.12, vig: 0.28, grain: 0.022,
      bloomS: 0.32, bloomR: 0.5, bloomT: 3.4, aoI: 1.0, aoR: 1.4,
    },
    dusk: {
      sun: [-2.5, 245], sunCol: 0xff9a68, sunI: 0.9,
      hemiSky: 0x6f7fb8, hemiGround: 0x3e3440, hemiI: 0.26, ambI: 0.02,
      env: { dawn: 1 }, envI: 0.7, envTint: 0xf0e0ff, envMix: 0.6,
      zenith: 0x23305e, horizon: 0xd99a86, glow: 0xff8a4c, anti: 0x8e7aa8, ground: 0x3a3440,
      glowK: 1.2, antiK: 0.7, haloK: 0.8, sunSize: 1.1, sunDisc: 6,
      stars: 0.25, aurora: 0, moon: 0.4, moonDir: [12, 70], milky: 0,
      cloudCov: 0.5, cloudLit: 0xff9e7a, cloudShade: 0x4e4866, cloudOp: 0.9, bankOp: 1.0,
      fogCol: 0x7e7690, fogSun: 0xe8906a, fogDen: 0.0015, fogH: 0.012, fogFall: 0.045, fogBase: -4, fogMax: 0.92, fogPow: 4, fogStart: 8,
      expo: 1.25, contrast: 1.08, sat: 1.08, shTint: 0x4e5ca0, hiTint: 0xffbf8f, split: 0.3, vig: 0.38, grain: 0.03,
      bloomS: 0.55, bloomR: 0.6, bloomT: 1.6, aoI: 1.0, aoR: 1.4,
    },
    night: {
      sun: [32, 70], sunCol: 0x9fb8ff, sunI: 0.55, moonlight: 1,
      hemiSky: 0x4a5c94, hemiGround: 0x1c2030, hemiI: 0.22, ambI: 0.03,
      env: { night: 1 }, envI: 0.45, envTint: 0xa8b8ff, envMix: 0.6,
      zenith: 0x060a1c, horizon: 0x1f2a4c, glow: 0x3c4c80, anti: 0x1a2240, ground: 0x10131c,
      glowK: 0.0, antiK: 0.0, haloK: 0.0, sunSize: 0.9, sunDisc: 0,
      stars: 1, aurora: 0, moon: 1, moonDir: [32, 70], milky: 0.8,
      cloudCov: 0.34, cloudLit: 0x5c6c96, cloudShade: 0x161a2a, cloudOp: 0.75, bankOp: 0.8,
      fogCol: 0x1b2440, fogSun: 0x40507e, fogDen: 0.0016, fogH: 0.012, fogFall: 0.05, fogBase: -4, fogMax: 0.92, fogPow: 6, fogStart: 6,
      expo: 1.75, contrast: 1.08, sat: 0.92, shTint: 0x3c4c90, hiTint: 0xffc890, split: 0.32, vig: 0.42, grain: 0.035,
      bloomS: 0.7, bloomR: 0.6, bloomT: 0.75, aoI: 0.9, aoR: 1.4,
    },
    interiorWarm: {
      interior: 1,
      sun: [24, 250], sunCol: 0xffd7a8, sunI: 0.35,
      hemiSky: 0xffd6a8, hemiGround: 0x4a3426, hemiI: 0.16, ambI: 0.02,
      env: { hall: 1 }, envI: 0.5, envTint: 0xffc890, envMix: 0.0,
      zenith: 0x22305c, horizon: 0xc98a6c, glow: 0xff9a58, anti: 0x6a5a84, ground: 0x2a2228,
      glowK: 1.0, antiK: 0.5, haloK: 0.6, sunSize: 1.0, sunDisc: 4,
      stars: 0.3, aurora: 0, moon: 0, moonDir: [20, 60], milky: 0,
      cloudCov: 0.45, cloudLit: 0xff9e7a, cloudShade: 0x463e5a, cloudOp: 0.9, bankOp: 0.9,
      fogCol: 0x3a2a22, fogSun: 0x7a5434, fogDen: 0.006, fogH: 0.0, fogFall: 0.1, fogBase: 0, fogMax: 0.6, fogPow: 4, fogStart: 4,
      expo: 1.3, contrast: 1.06, sat: 1.04, shTint: 0x5a5a8c, hiTint: 0xffc080, split: 0.28, vig: 0.42, grain: 0.03,
      bloomS: 0.6, bloomR: 0.55, bloomT: 1.0, aoI: 1.0, aoR: 1.0,
    },
    interiorMoon: {
      interior: 1,
      sun: [34, 60], sunCol: 0x8fb0ff, sunI: 1.25, moonlight: 1,
      hemiSky: 0x5a6ca8, hemiGround: 0x241e24, hemiI: 0.1, ambI: 0.015,
      env: { hall: 1 }, envI: 0.22, envTint: 0x8ea4e8, envMix: 0.0,
      zenith: 0x060a1c, horizon: 0x1f2a4c, glow: 0x3c4c80, anti: 0x1a2240, ground: 0x10131c,
      glowK: 0.0, antiK: 0.0, haloK: 0.0, sunSize: 0.9, sunDisc: 0,
      stars: 1, aurora: 0, moon: 1, moonDir: [34, 60], milky: 0.7,
      cloudCov: 0.3, cloudLit: 0x5c6c96, cloudShade: 0x161a2a, cloudOp: 0.7, bankOp: 0.8,
      fogCol: 0x141a2c, fogSun: 0x2c3a64, fogDen: 0.005, fogH: 0.0, fogFall: 0.1, fogBase: 0, fogMax: 0.6, fogPow: 4, fogStart: 4,
      expo: 1.55, contrast: 1.08, sat: 0.96, shTint: 0x4656a0, hiTint: 0xffb870, split: 0.34, vig: 0.45, grain: 0.035,
      bloomS: 0.7, bloomR: 0.6, bloomT: 0.85, aoI: 1.0, aoR: 1.0,
    },
    dungeon: {
      interior: 1,
      sun: [60, 40], sunCol: 0x6f8cc0, sunI: 0.0,
      hemiSky: 0x3a4a6a, hemiGround: 0x141418, hemiI: 0.1, ambI: 0.02,
      env: { night: 1 }, envI: 0.12, envTint: 0x7ca0d0, envMix: 0.0,
      zenith: 0x05070e, horizon: 0x0b1220, glow: 0x0b1220, anti: 0x0b1220, ground: 0x050608,
      glowK: 0.0, antiK: 0.0, haloK: 0.0, sunSize: 0.9, sunDisc: 0,
      stars: 0, aurora: 0, moon: 0, moonDir: [30, 60], milky: 0,
      cloudCov: 0.0, cloudLit: 0x202838, cloudShade: 0x0a0c12, cloudOp: 0.0, bankOp: 0.0,
      fogCol: 0x0a1018, fogSun: 0x0f1a28, fogDen: 0.03, fogH: 0.0, fogFall: 0.1, fogBase: 0, fogMax: 0.85, fogPow: 4, fogStart: 2,
      expo: 1.6, contrast: 1.1, sat: 0.9, shTint: 0x2c4a7a, hiTint: 0x9ff0ff, split: 0.3, vig: 0.5, grain: 0.04,
      bloomS: 0.85, bloomR: 0.65, bloomT: 0.6, aoI: 1.1, aoR: 0.9,
    },
  };

  // 숫자 상태로 바꾼다 (색은 선형)
  const COLK = ['sunCol', 'hemiSky', 'hemiGround', 'envTint', 'zenith', 'horizon', 'glow', 'anti', 'ground', 'cloudLit', 'cloudShade', 'fogCol', 'fogSun', 'shTint', 'hiTint'];
  const NUMK = ['sunI', 'hemiI', 'ambI', 'envI', 'envMix', 'glowK', 'antiK', 'haloK', 'sunSize', 'sunDisc', 'stars', 'aurora', 'moon', 'milky', 'cloudCov', 'cloudOp', 'bankOp',
    'fogDen', 'fogH', 'fogFall', 'fogBase', 'fogMax', 'fogPow', 'fogStart', 'expo', 'contrast', 'sat', 'split', 'vig', 'grain', 'bloomS', 'bloomR', 'bloomT', 'aoI', 'aoR', 'interior', 'moonlight'];
  function toState(p) {
    const s = { sunDir: dirEA(p.sun[0], p.sun[1]), moonDir: dirEA(p.moonDir[0], p.moonDir[1]), env: Object.assign({}, p.env) };
    for (const k of COLK) s[k] = C(p[k]);
    for (const k of NUMK) s[k] = p[k] || 0;
    return s;
  }
  function cloneState(s) {
    const o = { sunDir: s.sunDir.clone(), moonDir: s.moonDir.clone(), env: Object.assign({}, s.env) };
    for (const k of COLK) o[k] = s[k].clone();
    for (const k of NUMK) o[k] = s[k];
    return o;
  }
  function lerpState(a, b, t, o) {
    o = o || cloneState(a);
    o.sunDir.copy(a.sunDir).lerp(b.sunDir, t).normalize();
    o.moonDir.copy(a.moonDir).lerp(b.moonDir, t).normalize();
    for (const k of COLK) o[k].copy(a[k]).lerp(b[k], t);
    for (const k of NUMK) o[k] = lp(a[k], b[k], t);
    const e = {};
    for (const k in a.env) e[k] = (e[k] || 0) + a.env[k] * (1 - t);
    for (const k in b.env) e[k] = (e[k] || 0) + b.env[k] * t;
    o.env = e;
    return o;
  }
  A.toState = toState; A.lerpState = lerpState;

  // =====================================================================
  // 3. 셰이더 공용 코드
  // =====================================================================
  const GLSL_NOISE = `
    float h12( vec2 p ) { vec3 p3 = fract( vec3( p.xyx ) * 0.1031 ); p3 += dot( p3, p3.yzx + 33.33 ); return fract( ( p3.x + p3.y ) * p3.z ); }
    float h13( vec3 p3 ) { p3 = fract( p3 * 0.1031 ); p3 += dot( p3, p3.zyx + 31.32 ); return fract( ( p3.x + p3.y ) * p3.z ); }
    float vnoise( vec2 p ) { vec2 i = floor( p ), f = fract( p ); vec2 u = f * f * ( 3.0 - 2.0 * f );
      return mix( mix( h12( i ), h12( i + vec2( 1.0, 0.0 ) ), u.x ), mix( h12( i + vec2( 0.0, 1.0 ) ), h12( i + vec2( 1.0, 1.0 ) ), u.x ), u.y ); }
    float fbmN( vec2 p, const int oct ) { float a = 0.5, s = 0.0; mat2 R = mat2( 1.6, 1.2, -1.2, 1.6 );
      for ( int i = 0; i < 6; i ++ ) { if ( i >= oct ) break; s += a * vnoise( p ); p = R * p; a *= 0.5; } return s; }
  `;
  // 하늘 바탕: 지평선 띠, 해 쪽 노을, 반대쪽 띠, 해무리, 땅 쪽 연무. 환경광도 같은 함수를 쓴다.
  const GLSL_SKYBASE = `
    uniform vec3 top, horizon, bottom, sunDir, sunCol, glowCol, antiCol, hazeCol, hazeSun;
    uniform float glowK, antiK, haloK, hazePow;
    vec3 skyBase( vec3 d ) {
      float h = d.y, hh = max( h, 0.0 );
      float mu = dot( d, sunDir );
      float g = pow( 1.0 - hh, 5.0 );
      vec3 c = mix( top, horizon, g );
      vec2 dh = normalize( d.xz + 1e-5 ), sh = normalize( sunDir.xz + 1e-5 );
      float az = dot( dh, sh ) * 0.5 + 0.5;
      float band = exp( - hh * 7.0 );
      c = mix( c, glowCol, glowK * pow( az, 3.0 ) * band * smoothstep( -0.35, 0.05, sunDir.y ) );
      c = mix( c, antiCol, antiK * pow( 1.0 - az, 2.0 ) * exp( - abs( h - 0.06 ) * 14.0 ) );
      c += sunCol * haloK * ( pow( max( mu, 0.0 ), 9.0 ) * 0.22 + pow( max( mu, 0.0 ), 90.0 ) * 0.9 );
      vec3 hz = mix( hazeCol, hazeSun, pow( max( mu, 0.0 ), hazePow ) );
      c = mix( c, hz, exp( - hh * 26.0 ) * 0.85 );
      c = mix( c, mix( hz, bottom, 0.65 ), smoothstep( 0.0, -0.12, h ) );
      return c;
    }
  `;

  // =====================================================================
  // 4. 하늘 덮개
  // =====================================================================
  function makeSky() {
    const U = GFX.skyU = {
      top: { value: C(0x3a7bd5) }, horizon: { value: C(0xbfe3f5) }, bottom: { value: C(0x6a7a8a) },
      sunDir: { value: new T.Vector3(0.3, 0.8, 0.2).normalize() }, sunCol: { value: C(0xfff2d0) }, stars: { value: 0 }, aurora: { value: 0 }, t: { value: 0 },
      glowCol: { value: C(0xffa060) }, antiCol: { value: C(0xa898c0) }, hazeCol: { value: C(0xc0b0a0) }, hazeSun: { value: C(0xffb070) },
      glowK: { value: 1 }, antiK: { value: 0.4 }, haloK: { value: 1 }, hazePow: { value: 5 },
      sunSize: { value: 1 }, sunDisc: { value: 20 }, moonDir: { value: new T.Vector3(0, 0.5, 1).normalize() }, moon: { value: 0 }, milky: { value: 0 },
      cloudCov: { value: 0.4 }, cloudLit: { value: C(0xffffff) }, cloudShade: { value: C(0x8090a0) }, cloudOp: { value: 0.9 }, cloudOff: { value: new T.Vector2() },
    };
    const lowQ = A.tier !== 'high';
    const m = new T.ShaderMaterial({
      uniforms: U, side: T.BackSide, depthWrite: false, fog: false,
      defines: { OCT: lowQ ? 4 : 5 },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position = p.xyww; }',
      fragmentShader: GLSL_NOISE + GLSL_SKYBASE + `
        uniform float stars, aurora, t, sunSize, sunDisc, moon, milky, cloudCov, cloudOp;
        uniform vec3 moonDir, cloudLit, cloudShade;
        uniform vec2 cloudOff;
        varying vec3 vDir;
        vec3 starLayer( vec3 d, float sc, float thr ) {
          vec3 p = d * sc; vec3 id = floor( p ); vec3 f = fract( p ) - 0.5;
          float h = h13( id );
          if ( h < thr ) return vec3( 0.0 );
          vec3 o = vec3( h13( id + 1.7 ), h13( id + 3.1 ), h13( id + 5.3 ) ) - 0.5;
          float r = length( f - o * 0.7 );
          float b = smoothstep( 0.09, 0.0, r ) * ( ( h - thr ) / ( 1.0 - thr ) );
          float tw = 0.65 + 0.35 * sin( t * ( 1.5 + h * 3.0 ) + h * 70.0 );
          vec3 tint = mix( vec3( 0.75, 0.82, 1.0 ), vec3( 1.0, 0.86, 0.7 ), h13( id + 9.0 ) );
          return tint * b * tw;
        }
        void main() {
          vec3 d = normalize( vDir );
          float h = d.y, hh = max( h, 0.0 );
          float mu = dot( d, sunDir );
          vec3 c = skyBase( d );
          // 밤하늘: 별, 은하수, 오로라
          if ( stars > 0.0 && h > -0.02 ) {
            float vis = stars * smoothstep( -0.02, 0.18, h );
            vec3 st = starLayer( d, 120.0, 0.965 ) * 3.0 + starLayer( d, 260.0, 0.94 ) * 1.2;
            vec3 mwN = normalize( vec3( 0.35, 0.55, -0.75 ) );
            float mw = exp( - pow( dot( d, mwN ) / 0.2, 2.0 ) );
            float mwn = fbmN( d.xz * 6.0 / ( 0.6 + hh ) + d.y * 3.0, 4 );
            float dust = smoothstep( 0.45, 0.7, fbmN( d.xz * 11.0 + 7.0, 3 ) );
            c += vec3( 0.55, 0.62, 0.85 ) * milky * mw * mwn * ( 1.0 - dust * 0.7 ) * 0.09 * vis;
            st *= 1.0 + mw * milky * 1.5;
            c += st * vis;
          }
          if ( aurora > 0.0 && h > 0.0 ) {
            float a = 0.0; vec3 ac = vec3( 0.0 );
            for ( int i = 0; i < 3; i ++ ) {
              float fi = float( i );
              float w = sin( d.x * ( 3.0 + fi ) + t * 0.12 + fi * 2.1 + sin( d.z * 2.5 + t * 0.09 + fi ) * 1.6 );
              float y0 = 0.16 + fi * 0.07 + w * 0.05;
              float band = smoothstep( y0 - 0.03, y0, h ) * exp( - ( h - y0 ) * ( 9.0 - fi * 2.0 ) );
              float streak = 0.55 + 0.45 * vnoise( vec2( atan( d.x, d.z ) * 60.0 + t * 0.3, fi * 4.0 ) );
              ac += mix( vec3( 0.15, 1.0, 0.55 ), vec3( 0.55, 0.3, 1.0 ), smoothstep( y0, y0 + 0.2, h ) ) * band * streak;
            }
            c += ac * aurora * 0.35;
          }
          // 달
          if ( moon > 0.0 ) {
            float mm = dot( d, moonDir );
            float disc = smoothstep( 0.99985, 0.99992, mm );
            vec3 mp = d - moonDir; float cr = vnoise( mp.xy * 900.0 ) * 0.25 + vnoise( mp.yz * 2100.0 ) * 0.12;
            c = mix( c, vec3( 1.15, 1.12, 1.05 ) * ( 1.6 - cr ), disc * moon );
            c += vec3( 0.55, 0.65, 0.95 ) * moon * ( pow( max( mm, 0.0 ), 1400.0 ) * 0.35 + pow( max( mm, 0.0 ), 60.0 ) * 0.04 );
          }
          // 구름 덮개 (얇은 층구름·고적운). 해 쪽 가장자리는 밝게, 속은 그늘지게
          float cloudA = 0.0;
          if ( cloudCov > 0.0 && h > 0.015 ) {
            vec2 uv = d.xz / ( h + 0.12 ) * 0.55;
            uv = vec2( uv.x * 0.7 + uv.y * 0.25, uv.y * 1.25 - uv.x * 0.1 ) + cloudOff;
            vec2 q = vec2( fbmN( uv * 0.6, 3 ), fbmN( uv * 0.6 + 5.2, 3 ) );
            vec2 w = uv + q * 1.1;
            float n = fbmN( w, OCT );
            float cov = smoothstep( 1.0 - cloudCov, 1.0 - cloudCov + 0.3, n );
            vec2 sd = normalize( sunDir.xz + 1e-5 ) * 0.09;
            float n2 = fbmN( w + sd, OCT );
            float lit = clamp( ( n - n2 ) * 5.0 + 0.45 + sunDir.y * 0.6, 0.0, 1.0 );
            vec3 cc = mix( cloudShade, cloudLit, lit );
            cc += sunCol * pow( max( mu, 0.0 ), 7.0 ) * ( 1.0 - cov ) * 0.9 * haloK;
            cc = mix( cc, c, 0.15 );
            float fadeH = smoothstep( 0.015, 0.22, h );
            cloudA = cov * fadeH * cloudOp;
            c = mix( c, cc, cloudA );
            c = mix( c, mix( hazeCol, hazeSun, pow( max( mu, 0.0 ), hazePow ) ), cloudA * exp( - h * 9.0 ) * 0.55 );
          }
          // 해 원반
          float cs = cos( sunSize * 0.0175 );
          float disc = smoothstep( cs, mix( cs, 1.0, 0.25 ), mu );
          c += sunCol * disc * sunDisc * ( 1.0 - cloudA * 0.85 ) * smoothstep( -0.02, 0.01, h );
          gl_FragColor = vec4( max( c, 0.0 ), 1.0 );
        }`,
    });
    const sky = new T.Mesh(new T.SphereGeometry(900, 48, 24), m);
    sky.renderOrder = -10; sky.frustumCulled = false;
    return sky;
  }

  // =====================================================================
  // 5. 지평선 구름 둑 (구름 사진 한 장을 겹겹이)
  // =====================================================================
  const CLOUDU = {
    map: { value: null }, sunDir: null, sunCol: null, lit: null, shade: null, hazeCol: null, hazeSun: null, hazePow: null,
    op: { value: 1 }, haloK: null,
  };
  function makeCloudBanks() {
    const U = GFX.skyU;
    Object.assign(CLOUDU, { sunDir: U.sunDir, sunCol: U.sunCol, lit: U.cloudLit, shade: U.cloudShade, hazeCol: U.hazeCol, hazeSun: U.hazeSun, hazePow: U.hazePow, haloK: U.haloK });
    const pos = [], uv = [], ctr = [], prm = [], idx = [];
    let rs = 7;
    const R = () => { rs = (rs * 16807) % 2147483647; return (rs - 1) / 2147483646; };
    const banks = [[205, 1.2], [238, 1.0], [262, 0.9], [300, 0.7], [20, 0.8], [70, 1.0], [118, 0.75], [160, 0.9], [340, 0.6]];
    const RAD = 1050;
    for (const [baz, bs] of banks) {
      const n = 4 + Math.floor(R() * 4);
      for (let i = 0; i < n; i++) {
        const az = (baz + (R() - 0.5) * 16 * bs) * D2R;
        const low = i < n * 0.6;
        const el = (low ? 0.4 + R() * 1.4 : 1.6 + R() * 2.6) * D2R;
        const w = (low ? 190 + R() * 160 : 120 + R() * 110) * bs, hgt = w * (low ? 0.48 + R() * 0.2 : 0.62 + R() * 0.25);
        const cx = Math.sin(az) * Math.cos(el) * RAD, cy = Math.sin(el) * RAD, cz = Math.cos(az) * Math.cos(el) * RAD;
        const rx = Math.cos(az), rz = -Math.sin(az);
        const b = pos.length / 3;
        const flip = R() < 0.5 ? 1 : 0, rot = (R() - 0.5) * 0.5, tone = R();
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          pos.push(cx + rx * sx * w * 0.5, cy + sy * hgt * 0.5 + hgt * 0.32, cz + rz * sx * w * 0.5);
          uv.push(sx * 0.5 + 0.5, sy * 0.5 + 0.5);
          ctr.push(cx, cy, cz);
          prm.push(flip, rot, tone, low ? 1 : 0);
        }
        idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setAttribute('ctr', new T.Float32BufferAttribute(ctr, 3));
    g.setAttribute('prm', new T.Float32BufferAttribute(prm, 4));
    g.setIndex(idx);
    const m = new T.ShaderMaterial({
      uniforms: CLOUDU, transparent: true, depthWrite: false, fog: false,
      vertexShader: `attribute vec3 ctr; attribute vec4 prm; varying vec2 vUv, vQ; varying vec3 vC, vRight; varying vec4 vP;
        void main(){ vQ = uv; vec2 u = uv - 0.5; float c = cos( prm.y ), s = sin( prm.y ); u = mat2( c, s, -s, c ) * u; if ( prm.x > 0.5 ) u.x = -u.x; vUv = u * 0.96 + 0.5;
          vC = normalize( ctr ); vRight = normalize( vec3( vC.z, 0.0, -vC.x ) ); vP = prm;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); gl_Position.z = gl_Position.w * 0.99999; }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 sunDir, sunCol, lit, shade, hazeCol, hazeSun; uniform float hazePow, op, haloK;
        varying vec2 vUv, vQ; varying vec3 vC, vRight; varying vec4 vP;
        void main(){
          vec4 tx = texture2D( map, vUv );
          float a = tx.a * smoothstep( 0.0, 0.3, vQ.y ) * op;
          if ( a < 0.004 ) discard;
          float lum = dot( tx.rgb, vec3( 0.333 ) );
          float mu = dot( vC, sunDir );
          vec2 sh = normalize( sunDir.xz + 1e-5 );
          float side = dot( vec2( vRight.x, vRight.z ), sh );
          float l = lum * 0.9 + ( vQ.x - 0.5 ) * side * 0.9 + ( vQ.y - 0.55 ) * ( 0.5 + sunDir.y ) - 0.25 + vP.z * 0.15;
          vec3 c = mix( shade, lit, smoothstep( 0.0, 0.85, l ) );
          float back = pow( max( mu, 0.0 ), 5.0 );
          c += sunCol * haloK * back * ( pow( 1.0 - tx.a, 1.5 ) * 1.4 + 0.15 );
          c *= mix( 1.0, 0.75, back * smoothstep( 0.6, 1.0, tx.a ) );
          vec3 hz = mix( hazeCol, hazeSun, pow( max( mu, 0.0 ), hazePow ) );
          c = mix( c, hz, mix( 0.62, 0.22, smoothstep( 0.0, 0.9, vQ.y ) ) * ( 0.6 + 0.4 * vP.w ) );
          gl_FragColor = vec4( c, a );
        }`,
    });
    const me = new T.Mesh(g, m);
    me.frustumCulled = false; me.renderOrder = -9;
    return me;
  }

  // =====================================================================
  // 6. 자산 불러오기 (http면 파일을, file://이면 같은 내용의 .js를)
  // =====================================================================
  const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(s); });
  const isFile = location.protocol === 'file:';
  function b64ToBuf(b64) { const bin = atob(b64), n = bin.length, u = new Uint8Array(n); for (let i = 0; i < n; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
  async function fetchBin(rel, key) {
    if (!isFile) {
      try { const r = await fetch(A.base + rel); if (r.ok) return await r.arrayBuffer(); } catch (e) { /* 아래로 */ }
    }
    window.ATMOS_DATA = window.ATMOS_DATA || {};
    if (!window.ATMOS_DATA[key]) await loadScript(A.base + rel + '.js');
    return b64ToBuf(window.ATMOS_DATA[key]);
  }
  const HDR = A.hdri = {};
  A.loadHDRI = function (name) {
    if (HDR[name]) return HDR[name].p;
    const e = HDR[name] = { name, tex: null, mean: 1, sunAz: 0 };
    e.p = (async () => {
      if (!T.EXRLoader) throw new Error('EXRLoader 없음');
      const buf = await fetchBin('assets/hdri/' + name + '.exr', 'hdri/' + name);
      const L = new T.EXRLoader(); L.setDataType(T.HalfFloatType);
      const d = L.parse(buf);
      const tex = new T.DataTexture(d.data, d.width, d.height, d.format, d.type);
      tex.encoding = T.LinearEncoding; tex.minFilter = tex.magFilter = T.LinearFilter; tex.generateMipmaps = false; tex.flipY = d.flipY || false;
      tex.wrapS = T.RepeatWrapping; tex.wrapT = T.ClampToEdgeWrapping;
      tex.needsUpdate = true;
      // 평균 밝기와 가장 밝은 방향(해)
      const W = d.width, H = d.height, nc = d.data.length / (W * H), f = T.DataUtils.fromHalfFloat;
      let sum = 0, wsum = 0, best = -1, bx = 0, by = 0;
      for (let y = 0; y < H; y += 2) {
        const lat = (0.5 - (y + 0.5) / H) * Math.PI, cw = Math.cos(lat);
        for (let x = 0; x < W; x += 2) {
          const i = (y * W + x) * nc, l = 0.2126 * f(d.data[i]) + 0.7152 * f(d.data[i + 1]) + 0.0722 * f(d.data[i + 2]);
          if (!isFinite(l)) continue;
          sum += Math.min(l, 50) * cw; wsum += cw;
          if (l > best) { best = l; bx = x; by = y; }
        }
      }
      e.mean = Math.max(1e-4, sum / wsum);
      e.sunU = (bx + 0.5) / W; e.sunV = (by + 0.5) / H;
      e.tex = tex;
      A.envDirty = true;
      return e;
    })().catch(err => { console.warn('ATMOS: HDRI ' + name + ' 실패', err.message); e.failed = true; });
    return e.p;
  };
  A.loadCloudTex = async function () {
    const tex = new T.Texture();
    let src;
    if (isFile) { window.ATMOS_DATA = window.ATMOS_DATA || {}; if (!window.ATMOS_DATA.cloud) await loadScript(A.base + 'assets/cloud.webp.js'); src = window.ATMOS_DATA.cloud; }
    else src = A.base + 'assets/cloud.webp';
    await new Promise((res, rej) => { const im = new Image(); im.onload = () => { tex.image = im; res(); }; im.onerror = rej; im.src = src; });
    tex.encoding = T.sRGBEncoding; tex.anisotropy = 4; tex.needsUpdate = true;
    CLOUDU.map.value = tex;
    if (A.banks) A.banks.visible = true;
    return tex;
  };

  // =====================================================================
  // 7. 환경광: 절차 하늘 + HDRI를 한 장면에 그려 PMREM으로 굽는다
  // =====================================================================
  const ENVU = {
    hA: { value: null }, hB: { value: null }, hK: { value: 0 }, hOn: { value: 0 },
    hNormA: { value: 1 }, hNormB: { value: 1 }, yawA: { value: 0 }, yawB: { value: 0 },
    procW: { value: 1 }, groundCol: { value: C(0x404040) }, clampMax: { value: 16 },
  };
  function makeEnvScene() {
    const U = Object.assign({}, GFX.skyU, ENVU);
    const m = new T.ShaderMaterial({
      uniforms: U, side: T.BackSide, depthWrite: false, depthTest: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: GLSL_SKYBASE + `
        uniform sampler2D hA, hB; uniform float hK, hOn, hNormA, hNormB, yawA, yawB, procW, clampMax; uniform vec3 groundCol;
        varying vec3 vDir;
        vec2 eq( vec3 d, float yaw ) { float c = cos( yaw ), s = sin( yaw ); d = vec3( c * d.x - s * d.z, d.y, s * d.x + c * d.z );
          return vec2( atan( d.z, d.x ) * 0.15915494 + 0.5, asin( clamp( d.y, -1.0, 1.0 ) ) * 0.31830989 + 0.5 ); }
        void main() {
          vec3 d = normalize( vDir );
          vec3 proc = skyBase( d );
          proc = mix( proc, groundCol, smoothstep( 0.02, -0.2, d.y ) );
          vec3 c = proc;
          if ( hOn > 0.5 ) {
            vec3 a = min( texture2D( hA, eq( d, yawA ) ).rgb * hNormA, vec3( clampMax ) );
            vec3 b = min( texture2D( hB, eq( d, yawB ) ).rgb * hNormB, vec3( clampMax ) );
            vec3 hd = mix( a, b, hK );
            c = mix( hd, proc, procW );
          }
          gl_FragColor = vec4( c, 1.0 );
        }`,
    });
    const s = new T.Scene();
    s.add(new T.Mesh(new T.SphereGeometry(10, 48, 24), m));
    return s;
  }
  let envRT = null, roomRT = null, lastEnvKey = '', lastEnvT = -1e9;
  function envKey(s) {
    const r = v => Math.round(v * 40);
    const U = GFX.skyU;
    const top2 = Object.entries(s.env).filter(([n]) => HDR[n] && HDR[n].tex).sort((a, b) => b[1] - a[1]).slice(0, 2);
    let k = top2.map(([n, w]) => n + r(w)).join(',') + '|' + r(s.envMix) + '|' + (s.interior > 0.5 ? 1 : 0);
    for (const c of [U.top.value, U.horizon.value, U.glowCol.value, U.hazeCol.value, U.hazeSun.value, ENVU.groundCol.value]) k += '|' + r(c.r) + ',' + r(c.g) + ',' + r(c.b);
    const sd = U.sunDir.value; k += '|' + Math.round(sd.x * 20) + ',' + Math.round(sd.y * 20) + ',' + Math.round(sd.z * 20);
    return { key: k, top2 };
  }
  function updateEnv(s, force) {
    const r = GFX.renderer;
    const { key, top2 } = envKey(s);
    const now = performance.now();
    if (!force && key === lastEnvKey) return;
    if (!force && !A.envDirty && now - lastEnvT < (A.tier === 'high' ? 400 : 1500)) return;
    // 실내인데 HDRI가 없으면 방 환경으로
    if (s.interior > 0.5 && !top2.length) {
      if (!roomRT && T.RoomEnvironment) { const room = new T.RoomEnvironment(); roomRT = A.pmrem.fromScene(room, 0.04); }
      if (roomRT) { GFX.scene.environment = roomRT.texture; lastEnvKey = key; lastEnvT = now; A.envDirty = false; return; }
    }
    const sunAz = Math.atan2(GFX.skyU.sunDir.value.z, GFX.skyU.sunDir.value.x);
    const procLevel = 0.6 * (0.2126 * GFX.skyU.horizon.value.r + 0.7152 * GFX.skyU.horizon.value.g + 0.0722 * GFX.skyU.horizon.value.b) + 0.4 * (0.2126 * GFX.skyU.top.value.r + 0.7152 * GFX.skyU.top.value.g + 0.0722 * GFX.skyU.top.value.b);
    const set = (slot, e) => {
      ENVU['h' + slot].value = e.tex;
      ENVU['hNorm' + slot].value = (s.interior > 0.5 ? 1 : Math.max(0.05, procLevel)) / e.mean;
      // HDRI 속 해를 우리 해 방향으로 돌린다 (실내는 그대로)
      const hAz = (e.sunU - 0.5) * Math.PI * 2;
      ENVU['yaw' + slot].value = s.interior > 0.5 ? 0 : hAz - sunAz;
    };
    if (top2.length) {
      set('A', HDR[top2[0][0]]);
      set('B', HDR[(top2[1] || top2[0])[0]]);
      ENVU.hK.value = top2[1] ? top2[1][1] / (top2[0][1] + top2[1][1]) : 0;
      ENVU.hOn.value = 1;
    } else ENVU.hOn.value = 0;
    ENVU.procW.value = s.interior > 0.5 ? (top2.length ? 0 : 1) : s.envMix;
    ENVU.clampMax.value = s.interior > 0.5 ? 24 : 10;
    const rt = A.pmrem.fromScene(A.envScene, 0, 0.1, 100);
    GFX.scene.environment = rt.texture;
    if (envRT) envRT.dispose();
    envRT = rt;
    lastEnvKey = key; lastEnvT = now; A.envDirty = false;
  }

  // =====================================================================
  // 8. 해 그림자 두 단계 (가까운 단계는 GFX.sun, 먼 단계는 빛 없는 그림자 전용 방향광)
  // =====================================================================
  const _ax = new T.Vector3(), _ay = new T.Vector3(), _az = new T.Vector3(), _c = new T.Vector3(), _up = new T.Vector3(0, 1, 0), _fw = new T.Vector3();
  function placeShadow(light, center, dir, half, size, dist) {
    _az.copy(dir).normalize();
    _ax.crossVectors(Math.abs(_az.y) > 0.999 ? _ay.set(0, 0, 1) : _up, _az).normalize();
    _ay.crossVectors(_az, _ax);
    const tx = (2 * half) / size;
    const px = center.dot(_ax), py = center.dot(_ay);
    _c.copy(center).addScaledVector(_ax, Math.round(px / tx) * tx - px).addScaledVector(_ay, Math.round(py / tx) * tx - py);
    light.position.copy(_c).addScaledVector(_az, dist);
    light.target.position.copy(_c);
    const sc = light.shadow.camera;
    if (sc.right !== half || sc.far !== dist * 2) { sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 1; sc.far = dist * 2; sc.updateProjectionMatrix(); }
    light.updateMatrixWorld(); light.target.updateMatrixWorld();
  }
  function setupShadows() {
    const sun = GFX.sun, r = GFX.renderer;
    r.shadowMap.autoUpdate = false;
    r.shadowMap.needsUpdate = true;
    const hi = A.tier === 'high';
    A.shadowCfg = hi ? { half: 34, size: 2048, farHalf: 150, farSize: 2048 } : { half: 40, size: 1024 };
    sun.shadow.mapSize.set(A.shadowCfg.size, A.shadowCfg.size);
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = hi ? 0.035 : 0.05;
    if (hi && A.cascadeOK) {
      const far = A.sunFar = new T.DirectionalLight(0xffffff, 0);
      far.castShadow = true;
      far.shadow.mapSize.set(A.shadowCfg.farSize, A.shadowCfg.farSize);
      far.shadow.bias = -0.0008; far.shadow.normalBias = 0.16;
      far.shadow.autoUpdate = false;
      GFX.scene.add(far); GFX.scene.add(far.target);
    }
  }
  A.focus = new T.Vector3();
  let _lastTarget = new T.Vector3(1e9, 0, 0), _fogY = null;
  function placeShadows(focus) {
    const cam = GFX.camera, sd = GFX.skyU.sunDir.value, cfg = A.shadowCfg;
    // 가까운 단계는 카메라가 보는 쪽으로 조금 밀어 둔다
    cam.getWorldDirection(_fw); _fw.y = 0;
    if (_fw.lengthSq() > 1e-6) _fw.normalize();
    const ctr = new T.Vector3().copy(focus).addScaledVector(_fw, cfg.half * 0.35);
    placeShadow(GFX.sun, ctr, sd, cfg.half, cfg.size, 220);
    _lastTarget.copy(GFX.sun.target.position);
    if (A.sunFar) {
      const ctr2 = new T.Vector3().copy(focus).addScaledVector(_fw, cfg.farHalf * 0.4);
      placeShadow(A.sunFar, ctr2, sd, cfg.farHalf, cfg.farSize, 420);
      A.sunFar.shadow.needsUpdate = (A.frame % 2 === 0) || A.farForce;
      A.farForce = false;
    }
    GFX.renderer.shadowMap.needsUpdate = true;
  }

  // =====================================================================
  // 9. 상태를 장면에 적용
  // =====================================================================
  const _tmpC = new T.Color();
  function lum(c) { return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; }
  function apply(s, o) {
    o = o || {};
    const U = GFX.skyU, sc = GFX.scene;
    // 하늘
    U.top.value.copy(s.zenith); U.horizon.value.copy(s.horizon); U.bottom.value.copy(s.ground);
    U.sunDir.value.copy(s.sunDir);
    U.sunCol.value.copy(s.sunCol).multiplyScalar(s.moonlight > 0.5 ? 0.0 : 1.0);
    U.glowCol.value.copy(s.glow); U.antiCol.value.copy(s.anti);
    U.glowK.value = s.glowK; U.antiK.value = s.antiK; U.haloK.value = s.haloK; U.sunSize.value = s.sunSize; U.sunDisc.value = s.sunDisc;
    U.stars.value = s.stars; U.aurora.value = s.aurora + (o.aurora || 0); U.moon.value = s.moon; U.milky.value = s.milky;
    U.moonDir.value.copy(s.moonDir);
    U.cloudCov.value = s.cloudCov; U.cloudLit.value.copy(s.cloudLit); U.cloudShade.value.copy(s.cloudShade); U.cloudOp.value = s.cloudOp;
    CLOUDU.op.value = s.bankOp;
    // 안개 (하늘 지평선과 같은 색으로 맞춘다)
    const fogC = _tmpC.copy(s.fogCol);
    if (o.haze) fogC.lerp(C(o.haze), o.hazeK || 0.4);
    U.hazeCol.value.copy(fogC); U.hazeSun.value.copy(s.fogSun); U.hazePow.value = s.fogPow;
    if (sc.fog) { sc.fog.color.copy(fogC); sc.fog.density = s.fogDen * (o.fogK || 1); }
    const fy = (o.fogY !== undefined ? o.fogY : 0) + s.fogBase;
    SH.fogA.x = s.fogH * (o.fogK || 1); SH.fogA.y = s.fogFall; SH.fogA.z = fy; SH.fogA.w = 1;
    SH.fogB.x = s.fogSun.r; SH.fogB.y = s.fogSun.g; SH.fogB.z = s.fogSun.b; SH.fogB.w = s.fogPow;
    SH.fogC.x = s.sunDir.x; SH.fogC.y = s.sunDir.y; SH.fogC.z = s.sunDir.z; SH.fogC.w = s.fogMax;
    SH.fogD.x = s.fogStart;
    // 빛
    GFX.sun.color.copy(s.sunCol);
    GFX.sun.intensity = s.sunI * (o.sunK || 1) * sm(-0.06, 0.02, s.sunDir.y);
    GFX.hemi.color.copy(s.hemiSky); GFX.hemi.groundColor.copy(s.hemiGround); GFX.hemi.intensity = s.hemiI;
    GFX.amb.color.copy(s.hemiSky); GFX.amb.intensity = s.ambI;
    // 환경광
    SH.env.x = s.envTint.r * s.envI; SH.env.y = s.envTint.g * s.envI; SH.env.z = s.envTint.b * s.envI; SH.env.w = 1;
    ENVU.groundCol.value.copy(s.ground).lerp(s.hemiGround, 0.5).multiplyScalar(0.6).add(_tmpC.copy(s.sunCol).multiplyScalar(0.05 * s.sunI * Math.max(0, s.sunDir.y) * (s.moonlight > 0.5 ? 0.2 : 1)));
    // 등급
    const F = GFX.finalU;
    if (F) {
      F.expoBase.value = s.expo; F.contrast.value = s.contrast; F.sat.value = s.sat; F.split.value = s.split;
      F.vig.value = s.vig; F.grain.value = s.grain; F.shTint.value.copy(s.shTint); F.hiTint.value.copy(s.hiTint);
    }
    if (GFX.bloom) { GFX.bloom.strength = s.bloomS; GFX.bloom.radius = s.bloomR; GFX.bloom.threshold = s.bloomT; }
    if (A.pipe && A.pipe.aoU) { A.pipe.aoU.intensity.value = s.aoI; A.pipe.aoU.radius.value = s.aoR; }
    if (A.tier === 'low') GFX.renderer.toneMappingExposure = s.expo * (F ? F.exposure.value / 0.85 : 1) * 0.9;
    if (A.banks) A.banks.visible = !!CLOUDU.map.value && s.bankOp > 0.01;
  }

  // =====================================================================
  // 10. 매 프레임
  // =====================================================================
  A.cur = null; A.target = null; A.from = null; A.blendT = 1; A.blendDur = 0; A.opts = {};
  A.preset = function (name, blend, over) {
    const p = PRE[name];
    if (!p) { console.warn('ATMOS: 없는 프리셋 ' + name); return; }
    A.presetName = name;
    A.legacyMode = false;
    const st = toState(over ? Object.assign({}, p, over) : p);
    if (!blend || !A.cur) { A.cur = st; A.blendT = 1; A.blendDur = 0; A.target = st; }
    else { A.from = cloneState(A.cur); A.target = st; A.blendT = 0; A.blendDur = blend; }
    for (const n in st.env) A.loadHDRI(n);
    if (A.ready) { apply(A.cur, A.opts); A.envDirty = true; A.farForce = true; }
    return A.cur;
  };
  // 시간(0~24)으로 바깥 하늘을 고른다. night: 0~1 (게임의 밤 정도)
  const _s1 = {}, _s2 = {};
  let STATES = null;
  function states() { if (!STATES) { STATES = {}; for (const k in PRE) STATES[k] = toState(PRE[k]); } return STATES; }
  A.timeOfDay = function (sunDir, night, out) {
    const S = states();
    const el = Math.asin(cl(sunDir.y, -1, 1)) / D2R;
    let s;
    if (el >= 30) s = cloneState(S.day);
    else if (el >= 13) s = lerpState(S.goldenHour, S.day, sm(13, 30, el));
    else if (el >= 1.5) s = cloneState(S.goldenHour);
    else s = lerpState(S.dusk, S.goldenHour, sm(-3, 1.5, el));
    if (night > 0) s = lerpState(s, S.night, cl(night, 0, 1));
    s.sunDir.copy(sunDir);
    if (out) { Object.assign(out, s); return out; }
    return s;
  };
  // 예전 updateSky(o) 호출을 받는다
  A.legacy = function (o) {
    if (!A.ready) return;
    A.legacyMode = true;
    let s;
    if (o.indoor) {
      const S = states();
      const base = (o.sun === 0 || (o.hemi !== undefined && o.hemi < 0.1)) ? 'dungeon' : (o.hemiC && (new T.Color(o.hemiC).r > new T.Color(o.hemiC).b)) ? 'interiorWarm' : 'interiorMoon';
      s = cloneState(S[base]);
      if (o.bg !== undefined) s.fogCol.lerp(C(o.bg), 0.5);
      if (o.fog !== undefined) s.fogDen = lp(s.fogDen, o.fog * 0.5, 0.5);
      A.presetName = base;
      A.opts = {};
    } else {
      const h = o.hour;
      const a = (h - 6) / 12 * Math.PI;
      const sy = Math.sin(a), sx = Math.cos(a);
      const sunUp = sy > -0.05;
      const dir = sunUp ? new T.Vector3(sx, Math.max(sy, 0.05), 0.35).normalize() : new T.Vector3(-sx, Math.max(-sy, 0.2), -0.3).normalize();
      // 실제 해 고도로 하늘을 고른다 (해가 지는 중이면 위 식이 0.05로 막아 두므로 sy를 쓴다)
      const el = new T.Vector3(sx, sy, 0.35).normalize();
      s = A.timeOfDay(el, o.night || 0);
      s.sunDir.copy(dir);
      if (!sunUp) s.moonDir.copy(dir);
      A.opts = { haze: o.haze, hazeK: o.hazeK, fogK: (o.fog ?? 0.0028) / 0.0028, aurora: (o.aurora || 0) * (o.night || 0), sunK: o.sunK };
      A.presetName = 'tod';
    }
    A.cur = s; A.target = s; A.blendT = 1;
    for (const n in s.env) if (s.env[n] > 0.05) A.loadHDRI(n);
    apply(s, Object.assign({ fogY: A._fogY }, A.opts));
  };

  let _lastNow = 0, _manualFrame = -1, _autoFrame = -1, _internal = false;
  function rafTick() { A.frame++; requestAnimationFrame(rafTick); }
  A.update = function (dt, focus) {
    _manualFrame = A.frame;
    step(dt, focus);
  };
  function autoStep() {
    if (!A.ready || _internal) return;
    if (_manualFrame === A.frame || _autoFrame === A.frame) return;
    _autoFrame = A.frame;
    const now = performance.now();
    const dt = _lastNow ? Math.min(0.1, (now - _lastNow) / 1000) : 0.016;
    _lastNow = now;
    step(dt, null);
  }
  A._autoStep = autoStep;
  function step(dt, focus) {
    A.time += dt;
    // 초점: 직접 준 것 > 누가 GFX.sun.target을 옮겼으면 그것 > 그대로
    if (focus) A.focus.copy(focus);
    else if (GFX.sun.target.position.distanceToSquared(_lastTarget) > 1e-6) A.focus.copy(GFX.sun.target.position);
    if (A._fogY === undefined || A._fogY === null) A._fogY = A.focus.y;
    A._fogY = lp(A._fogY, A.focus.y, Math.min(1, dt * 0.5));
    // 프리셋 사이 넘어가기
    if (!A.legacyMode && A.blendT < 1 && A.target) {
      A.blendT = Math.min(1, A.blendT + dt / Math.max(1e-3, A.blendDur));
      A.cur = lerpState(A.from, A.target, sm(0, 1, A.blendT), A.cur === A.target ? null : A.cur);
    }
    if (!A.legacyMode && A.cur) apply(A.cur, Object.assign({ fogY: A._fogY }, A.opts));
    else if (A.legacyMode) { SH.fogA.z = A._fogY + (A.cur ? A.cur.fogBase : 0); }
    const U = GFX.skyU;
    U.t.value = A.time;
    U.cloudOff.value.x += dt * 0.0035; U.cloudOff.value.y += dt * 0.0012;
    GFX.sky.position.copy(GFX.camera.position); GFX.sky.updateMatrixWorld();
    if (A.banks) { A.banks.position.copy(GFX.camera.position); A.banks.position.y -= 25; A.banks.rotation.y += dt * 0.0015; A.banks.updateMatrixWorld(); }
    if (GFX.finalU) GFX.finalU.time.value = A.time;
    for (const v of A.vol) if (v.material.uniforms) v.material.uniforms.time.value = A.time;
    if (GFX.renderer.shadowMap.enabled) placeShadows(A.focus);
    if (A.cur) updateEnv(A.cur, false);
  }

  // =====================================================================
  // 11. 후처리 사슬
  // =====================================================================
  const VS_QUAD = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }';
  function rtHalf(w, h, o) { return new T.WebGLRenderTarget(w, h, Object.assign({ type: T.HalfFloatType, depthBuffer: false, minFilter: T.LinearFilter, magFilter: T.LinearFilter }, o)); }
  class Pipeline {
    constructor() {
      const r = GFX.renderer;
      this.tier = A.tier;
      this.w = 16; this.h = 16; this.pr = r.getPixelRatio();
      const hi = this.tier === 'high';
      this.rtScene = new T.WebGLRenderTarget(16, 16, { type: T.HalfFloatType, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: true });
      if (hi) {
        this.rtScene.depthTexture = new T.DepthTexture(16, 16, T.FloatType);
        this.rtAO = rtHalf(8, 8, { type: T.UnsignedByteType });
        this.rtAO2 = rtHalf(8, 8, { type: T.UnsignedByteType });
        this.rtVol = rtHalf(8, 8);
        this.rtHDR = rtHalf(16, 16);
        this.rtLDR = new T.WebGLRenderTarget(16, 16, { depthBuffer: false, minFilter: T.LinearFilter, magFilter: T.LinearFilter });
      }
      // AO (깊이만으로)
      this.aoU = {
        tDepth: { value: hi ? this.rtScene.depthTexture : null }, res: { value: new T.Vector2() }, pInv: { value: new T.Vector2() }, pScale: { value: new T.Vector2() },
        near: { value: 0.1 }, far: { value: 1000 }, radius: { value: 1.4 }, intensity: { value: 1 }, maxDist: { value: 90 }, frame: { value: 0 },
      };
      const DEPTHF = `uniform sampler2D tDepth; uniform float near, far; uniform vec2 pInv;
        float vz( vec2 uv ) { float d = texture2D( tDepth, uv ).r; return ( near * far ) / ( ( far - near ) * d - far ); }
        vec3 vpos( vec2 uv ) { float z = vz( uv ); return vec3( ( uv * 2.0 - 1.0 ) * pInv * -z, z ); }`;
      this.aoMat = new T.ShaderMaterial({
        uniforms: this.aoU, vertexShader: VS_QUAD, depthTest: false, depthWrite: false,
        fragmentShader: DEPTHF + `
          uniform vec2 res, pScale; uniform float radius, intensity, maxDist, frame; varying vec2 vUv;
          void main() {
            float d0 = texture2D( tDepth, vUv ).r;
            if ( d0 >= 0.99999 ) { gl_FragColor = vec4( 1.0 ); return; }
            vec2 tx = 1.0 / res;
            vec3 P = vpos( vUv );
            vec3 pr = vpos( vUv + vec2( tx.x, 0.0 ) ), pl = vpos( vUv - vec2( tx.x, 0.0 ) ), pu = vpos( vUv + vec2( 0.0, tx.y ) ), pd = vpos( vUv - vec2( 0.0, tx.y ) );
            vec3 dx = abs( pr.z - P.z ) < abs( P.z - pl.z ) ? pr - P : P - pl;
            vec3 dy = abs( pu.z - P.z ) < abs( P.z - pd.z ) ? pu - P : P - pd;
            vec3 N = normalize( cross( dx, dy ) );
            float rnd = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
            vec2 uvR = radius * 0.5 * pScale / -P.z;
            float lim = 0.12 / max( uvR.y, 1e-4 ); uvR *= min( 1.0, lim );
            float occ = 0.0, r2 = radius * radius;
            const int NS = 14;
            for ( int i = 0; i < NS; i ++ ) {
              float a = ( float( i ) + 0.5 ) / float( NS );
              float ang = a * 6.2831853 * 4.3 + rnd * 6.2831853;
              vec2 o = vec2( cos( ang ), sin( ang ) ) * a * uvR;
              vec3 v = vpos( vUv + o ) - P;
              float vv = dot( v, v );
              float vn = dot( v, N ) * inversesqrt( vv + 1e-4 );
              float f = max( 1.0 - vv / r2, 0.0 );
              occ += max( vn - 0.12, 0.0 ) * f;
            }
            float ao = clamp( 1.0 - occ / float( NS ) * intensity * 2.6, 0.0, 1.0 );
            ao = mix( ao, 1.0, smoothstep( maxDist * 0.55, maxDist, -P.z ) );
            gl_FragColor = vec4( ao, ao, ao, 1.0 );
          }`,
      });
      this.blurU = { tAO: { value: null }, tDepth: { value: hi ? this.rtScene.depthTexture : null }, dir: { value: new T.Vector2() }, near: this.aoU.near, far: this.aoU.far, pInv: this.aoU.pInv };
      this.blurMat = new T.ShaderMaterial({
        uniforms: this.blurU, vertexShader: VS_QUAD, depthTest: false, depthWrite: false,
        fragmentShader: DEPTHF + `uniform sampler2D tAO; uniform vec2 dir; varying vec2 vUv;
          void main() {
            float z0 = vz( vUv ), s = 0.0, w = 0.0;
            for ( int i = -4; i <= 4; i ++ ) {
              vec2 uv = vUv + dir * float( i );
              float z = vz( uv );
              float k = exp( - float( i * i ) * 0.08 ) * max( 0.0, 1.0 - abs( z - z0 ) / ( abs( z0 ) * 0.04 + 0.05 ) );
              s += texture2D( tAO, uv ).r * k; w += k;
            }
            gl_FragColor = vec4( vec3( s / max( w, 1e-4 ) ), 1.0 );
          }`,
      });
      this.combU = { tScene: { value: null }, tAO: { value: null }, tVol: { value: null }, aoOn: { value: 0 }, volOn: { value: 0 }, aoK: { value: 0.85 } };
      this.combMat = new T.ShaderMaterial({
        uniforms: this.combU, vertexShader: VS_QUAD, depthTest: false, depthWrite: false,
        fragmentShader: `uniform sampler2D tScene, tAO, tVol; uniform float aoOn, volOn, aoK; varying vec2 vUv;
          void main() {
            vec4 s = texture2D( tScene, vUv );
            if ( aoOn > 0.5 ) {
              float ao = texture2D( tAO, vUv ).r;
              float l = dot( s.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
              ao = mix( ao, 1.0, smoothstep( 1.2, 5.0, l ) * 0.8 );
              s.rgb *= mix( 1.0, ao, aoK );
            }
            if ( volOn > 0.5 ) s.rgb += texture2D( tVol, vUv ).rgb;
            gl_FragColor = s;
          }`,
      });
      // 색 보정 (ACES, 노출, 따뜻한·차가운 나눔, 비네트, 입자감, 디더)
      GFX.finalU = Object.assign(GFX.finalU || {}, {
        tDiffuse: { value: null }, exposure: { value: 0.85 }, vig: { value: 0.35 }, sat: { value: 1.05 }, tint: { value: C(0xffffff) },
        expoBase: { value: 1 }, contrast: { value: 1.05 }, split: { value: 0.2 }, shTint: { value: C(0x6070a0) }, hiTint: { value: C(0xffd0a0) },
        grain: { value: 0.03 }, time: { value: 0 }, srgbOut: { value: 1 },
      });
      this.gradeMat = new T.ShaderMaterial({
        uniforms: GFX.finalU, vertexShader: VS_QUAD, depthTest: false, depthWrite: false,
        fragmentShader: `uniform sampler2D tDiffuse; uniform float exposure, expoBase, vig, sat, contrast, split, grain, time, srgbOut; uniform vec3 tint, shTint, hiTint; varying vec2 vUv;
          const mat3 ACESIn = mat3( 0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777 );
          const mat3 ACESOut = mat3( 1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602 );
          vec3 rrt( vec3 v ) { vec3 a = v * ( v + 0.0245786 ) - 0.000090537; vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081; return a / b; }
          vec3 toSRGB( vec3 c ) { return mix( c * 12.92, 1.055 * pow( c, vec3( 1.0 / 2.4 ) ) - 0.055, step( 0.0031308, c ) ); }
          float hash( vec2 p ) { vec3 p3 = fract( vec3( p.xyx ) * 0.1031 ); p3 += dot( p3, p3.yzx + 33.33 ); return fract( ( p3.x + p3.y ) * p3.z ); }
          void main() {
            vec3 c = texture2D( tDiffuse, vUv ).rgb * tint * ( exposure / 0.85 ) * expoBase;
            float l0 = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
            // 나눔 색조: 어두운 곳은 차갑게, 밝은 곳은 따뜻하게 (밝기는 지킨다)
            vec3 sT = shTint / max( dot( shTint, vec3( 0.2126, 0.7152, 0.0722 ) ), 1e-3 );
            vec3 hT = hiTint / max( dot( hiTint, vec3( 0.2126, 0.7152, 0.0722 ) ), 1e-3 );
            float k = smoothstep( 0.02, 0.6, l0 );
            c *= mix( vec3( 1.0 ), mix( sT, hT, k ), split );
            c = ACESOut * rrt( ACESIn * ( c / 0.6 ) );
            c = clamp( c, 0.0, 1.0 );
            float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
            c = max( mix( vec3( l ), c, sat ), 0.0 );
            vec3 s = toSRGB( c );
            s = clamp( ( s - 0.5 ) * contrast + 0.5, 0.0, 1.0 );
            vec2 q = vUv - 0.5; q.x *= 1.25;
            float v = 1.0 - vig * smoothstep( 0.15, 0.85, length( q ) * 1.15 );
            s *= v;
            float n = hash( gl_FragCoord.xy + fract( time * 7.13 ) * 517.0 ) - 0.5;
            s += n * grain * ( 1.0 - l * 0.6 );
            s += ( hash( gl_FragCoord.xy * 1.37 + 11.0 ) - 0.5 ) / 255.0;
            gl_FragColor = vec4( srgbOut > 0.5 ? s : c, 1.0 );
          }`,
      });
      this.quad = new T.FullScreenQuad(null);
      // 번짐
      const bs = hi ? 0.5 : 0.35;
      this.bloom = new T.UnrealBloomPass(new T.Vector2(256, 256), 0.45, 0.55, 1.3);
      for (const rt of [this.bloom.renderTargetBright, ...this.bloom.renderTargetsHorizontal, ...this.bloom.renderTargetsVertical]) rt.texture.type = T.HalfFloatType;
      this.bloomScale = bs;
      GFX.bloom = this.bloom;
      if (hi && T.SMAAPass) { this.smaa = new T.SMAAPass(16, 16); this.smaa.renderToScreen = true; }
    }
    setPixelRatio(p) { this.pr = p; this.setSize(this.w, this.h); }
    setSize(w, h) {
      this.w = w; this.h = h;
      const W = Math.max(1, Math.round(w * this.pr)), H = Math.max(1, Math.round(h * this.pr));
      this.rtScene.setSize(W, H);
      if (this.rtAO) {
        const hw = Math.max(1, W >> 1), hh = Math.max(1, H >> 1);
        this.rtAO.setSize(hw, hh); this.rtAO2.setSize(hw, hh); this.rtVol.setSize(hw, hh);
        this.rtHDR.setSize(W, H); this.rtLDR.setSize(W, H);
        this.aoU.res.value.set(W, H);
      }
      this.bloom.setSize(Math.round(W * this.bloomScale / 0.5), Math.round(H * this.bloomScale / 0.5));
      if (this.smaa) this.smaa.setSize(W, H);
    }
    fs(mat, target) { const r = GFX.renderer; this.quad.material = mat; r.setRenderTarget(target); this.quad.render(r); }
    render() {
      autoStep();
      const r = GFX.renderer, scene = GFX.scene, cam = GFX.camera;
      const hi = this.tier === 'high';
      const ac = r.autoClear;
      r.autoClear = true;
      r.shadowMap.needsUpdate = true;
      r.setRenderTarget(this.rtScene);
      r.clear();
      r.render(scene, cam);
      let src = this.rtScene;
      if (hi) {
        // AO
        const P = cam.projectionMatrix.elements;
        this.aoU.near.value = cam.near; this.aoU.far.value = cam.far;
        this.aoU.pInv.value.set(1 / P[0], 1 / P[5]); this.aoU.pScale.value.set(P[0], P[5]);
        const aoOn = A.cur ? A.cur.aoI > 0.01 : true;
        if (aoOn) {
          this.fs(this.aoMat, this.rtAO);
          const W = this.rtScene.width, H = this.rtScene.height;
          this.blurU.tAO.value = this.rtAO.texture; this.blurU.dir.value.set(2 / W, 0); this.fs(this.blurMat, this.rtAO2);
          this.blurU.tAO.value = this.rtAO2.texture; this.blurU.dir.value.set(0, 2 / H); this.fs(this.blurMat, this.rtAO);
        }
        // 빛줄기 (깊이를 읽어 부드럽게 사라진다)
        let volOn = false;
        for (const v of A.vol) if (v.visible && v.parent) { volOn = true; break; }
        if (volOn) {
          const cc = r.getClearColor(new T.Color()), ca = r.getClearAlpha();
          r.setClearColor(0x000000, 0);
          r.setRenderTarget(this.rtVol); r.clear();
          const bg = scene.background, ov = scene.overrideMaterial;
          cam.layers.set(A.VOL_LAYER);
          _internal = true;
          for (const v of A.vol) if (v.material.uniforms) { v.material.uniforms.tDepth.value = this.rtScene.depthTexture; v.material.uniforms.res.value.set(this.rtVol.width, this.rtVol.height); v.material.uniforms.near.value = cam.near; v.material.uniforms.far.value = cam.far; }
          scene.background = null;
          r.render(scene, cam);
          scene.background = bg; scene.overrideMaterial = ov;
          _internal = false;
          cam.layers.set(0);
          r.setClearColor(cc, ca);
        }
        this.combU.tScene.value = this.rtScene.texture; this.combU.tAO.value = this.rtAO.texture; this.combU.tVol.value = this.rtVol.texture;
        this.combU.aoOn.value = aoOn ? 1 : 0; this.combU.volOn.value = volOn ? 1 : 0;
        this.fs(this.combMat, this.rtHDR);
        src = this.rtHDR;
      }
      // 번짐: src에 더한다
      if (this.bloom.strength > 0.001) this.bloom.render(r, null, src, 0.016, false);
      // 색 보정 → (SMAA) → 화면
      GFX.finalU.tDiffuse.value = src.texture;
      GFX.finalU.srgbOut.value = 1;
      if (this.smaa) {
        this.fs(this.gradeMat, this.rtLDR);
        this.smaa.render(r, null, this.rtLDR);
      } else this.fs(this.gradeMat, null);
      r.autoClear = ac;
    }
  }

  // =====================================================================
  // 12. 빛줄기와 먼지
  // =====================================================================
  A.VOL_LAYER = 3;
  const SHAFT_FS = `
    uniform vec3 color; uniform float intensity, time, len, noiseK, softDist, near, far, edgeSides; uniform vec2 res; uniform sampler2D tDepth;
    varying vec2 vUv; varying vec3 vN, vV; varying float vZ;
    float h12( vec2 p ) { vec3 p3 = fract( vec3( p.xyx ) * 0.1031 ); p3 += dot( p3, p3.yzx + 33.33 ); return fract( ( p3.x + p3.y ) * p3.z ); }
    float vn( vec2 p ) { vec2 i = floor( p ), f = fract( p ); vec2 u = f * f * ( 3.0 - 2.0 * f );
      return mix( mix( h12( i ), h12( i + vec2( 1.0, 0.0 ) ), u.x ), mix( h12( i + vec2( 0.0, 1.0 ) ), h12( i + vec2( 1.0, 1.0 ) ), u.x ), u.y ); }
    void main() {
      float along = 1.0 - vUv.y;
      float fall = smoothstep( 0.0, 0.06, along ) * pow( 1.0 - along, 1.6 );
      float ndv = abs( dot( normalize( vN ), normalize( vV ) ) );
      float edge = smoothstep( 0.0, 0.75, ndv );
      if ( edgeSides > 0.5 ) { float fu = fract( vUv.x * edgeSides ); edge *= smoothstep( 0.0, 0.22, min( fu, 1.0 - fu ) ); }
      float n = vn( vec2( vUv.x * 18.0 + time * 0.03, along * 2.0 * len * 0.1 - time * 0.05 ) ) * 0.6 + vn( vec2( vUv.x * 47.0 - time * 0.02, along * 6.0 ) ) * 0.4;
      n = mix( 1.0, 0.45 + n * 1.1, noiseK );
      float camF = smoothstep( 0.4, 2.5, vZ );
      float soft = 1.0;
      #ifdef DEPTH_FADE
        float d = texture2D( tDepth, gl_FragCoord.xy / res ).r;
        float sz = - ( near * far ) / ( ( far - near ) * d - far );
        soft = clamp( ( sz - vZ ) / softDist, 0.0, 1.0 );
      #endif
      float a = fall * edge * n * camF * soft * intensity;
      gl_FragColor = vec4( color * a, a );
    }`;
  A.shaft = function (from, dir, length, radius, color, o) {
    o = o || {};
    const spread = o.spread ?? 0.25, sides = o.width ? 4 : 28;
    const r0 = radius, r1 = radius * (1 + spread);
    const g = new T.CylinderGeometry(r0, r1, length, sides, 1, true);
    if (o.width) {
      g.rotateY(Math.PI / 4);
      g.scale(o.width / (radius * Math.SQRT2), 1, (o.height || o.width) / (radius * Math.SQRT2));
    }
    g.translate(0, -length / 2, 0);
    g.computeVertexNormals();
    const hi = A.tier === 'high' && !!(A.pipe && A.pipe.rtScene.depthTexture);
    const m = new T.ShaderMaterial({
      uniforms: {
        color: { value: C(color ?? 0xfff0d0) }, intensity: { value: o.intensity ?? 0.35 }, time: { value: 0 }, len: { value: length }, noiseK: { value: o.noise ?? 0.8 },
        softDist: { value: o.soft ?? 0.6 }, near: { value: 0.1 }, far: { value: 1000 }, res: { value: new T.Vector2(1, 1) }, tDepth: { value: null }, edgeSides: { value: o.width ? 4 : 0 },
      },
      defines: hi ? { DEPTH_FADE: 1 } : {},
      transparent: true, depthWrite: false, depthTest: !hi, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
      vertexShader: 'varying vec2 vUv; varying vec3 vN, vV; varying float vZ; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4( position, 1.0 ); vN = normalize( normalMatrix * normal ); vV = normalize( -mv.xyz ); vZ = -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: SHAFT_FS,
    });
    const me = new T.Mesh(g, m);
    me.position.copy(from);
    me.quaternion.setFromUnitVectors(new T.Vector3(0, -1, 0), dir.clone().normalize());
    me.renderOrder = 4; me.frustumCulled = true;
    me.userData.shaft = { from: from.clone(), dir: dir.clone().normalize(), length, r0, r1: o.width ? r1 : r1 };
    if (hi) me.layers.set(A.VOL_LAYER);
    A.vol.push(me);
    me.addEventListener('removed', () => { /* 장면에서 빠져도 목록에는 남는다: parent 검사로 건너뛴다 */ });
    return me;
  };
  // 먼지: box는 THREE.Box3 또는 {min:{x,y,z}, max:{x,y,z}}. 빛줄기 안에서 더 밝게 반짝인다.
  A.motes = function (box, count, o) {
    o = o || {};
    count = count || 400;
    if (A.tier !== 'high') count = Math.round(count * 0.5);
    const mn = box.min, mx = box.max;
    const pos = new Float32Array(count * 3), seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = mn.x + Math.random() * (mx.x - mn.x); pos[i * 3 + 1] = mn.y + Math.random() * (mx.y - mn.y); pos[i * 3 + 2] = mn.z + Math.random() * (mx.z - mn.z);
      seed[i] = Math.random();
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('seed', new T.BufferAttribute(seed, 1));
    const sa = [], sb = [];
    const shafts = (o.shafts || []).slice(0, 4);
    for (let i = 0; i < 4; i++) {
      const s = shafts[i] && shafts[i].userData.shaft;
      if (s) { sa.push(new T.Vector4(s.from.x, s.from.y, s.from.z, s.r0 * 1.15)); const e = s.from.clone().addScaledVector(s.dir, s.length); sb.push(new T.Vector4(e.x, e.y, e.z, s.r1 * 1.15)); }
      else { sa.push(new T.Vector4(0, -1e5, 0, 0)); sb.push(new T.Vector4(0, -1e5 + 1, 0, 0)); }
    }
    const m = new T.ShaderMaterial({
      uniforms: {
        time: { value: 0 }, color: { value: C(o.color ?? 0xffe2b0) }, size: { value: o.size ?? 0.035 }, scale: { value: 600 }, base: { value: o.base ?? 0.12 }, boost: { value: o.boost ?? 2.2 },
        bmin: { value: new T.Vector3(mn.x, mn.y, mn.z) }, bmax: { value: new T.Vector3(mx.x, mx.y, mx.z) }, sA: { value: sa }, sB: { value: sb }, nS: { value: shafts.length },
      },
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false,
      vertexShader: `attribute float seed; uniform float time, size, scale, base, boost; uniform vec3 bmin, bmax; uniform vec4 sA[ 4 ], sB[ 4 ]; uniform int nS;
        varying float vA;
        void main() {
          vec3 p = position; float s = seed * 6.2831;
          p += vec3( sin( time * 0.13 + s ) * 0.35 + sin( time * 0.31 + s * 3.0 ) * 0.1, sin( time * 0.11 + s * 2.0 ) * 0.25, cos( time * 0.12 + s * 1.7 ) * 0.35 );
          p.y = bmin.y + mod( p.y - bmin.y - time * 0.015 * ( 0.5 + seed ), bmax.y - bmin.y );
          float lit = 0.0;
          for ( int i = 0; i < 4; i ++ ) {
            if ( i >= nS ) break;
            vec3 a = sA[ i ].xyz, ab = sB[ i ].xyz - a;
            float t = clamp( dot( p - a, ab ) / dot( ab, ab ), 0.0, 1.0 );
            float r = mix( sA[ i ].w, sB[ i ].w, t );
            float d = length( p - ( a + ab * t ) );
            lit = max( lit, smoothstep( r, r * 0.4, d ) * ( 1.0 - t * 0.7 ) );
          }
          float tw = 0.55 + 0.45 * sin( time * ( 0.8 + seed * 2.0 ) + seed * 40.0 );
          vA = ( base + lit * boost ) * tw;
          vec4 mv = modelViewMatrix * vec4( p, 1.0 );
          gl_PointSize = max( size * scale / -mv.z, 1.0 );
          vA *= smoothstep( 0.3, 1.2, -mv.z );
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `uniform vec3 color; varying float vA;
        void main() { vec2 q = gl_PointCoord - 0.5; float d = dot( q, q ) * 4.0; float a = exp( - d * 3.5 ) * vA; if ( a < 0.003 ) discard; gl_FragColor = vec4( color * a, a ); }`,
    });
    const pts = new T.Points(g, m);
    pts.frustumCulled = false; pts.renderOrder = 6;
    pts.onBeforeRender = (r) => { m.uniforms.time.value = A.time; m.uniforms.scale.value = r.domElement.height * 0.5; };
    return pts;
  };

  // =====================================================================
  // 13. 시작
  // =====================================================================
  A.init = function () {
    if (A.ready) return;
    const r = GFX.renderer, scene = GFX.scene;
    A.tier = GFX.low ? 'low' : GFX.mobile ? 'mobile' : (GFX.webgl2 ? 'high' : 'mobile');
    if (A.tier === 'mobile' && !GFX.webgl2) A.tier = 'low';
    r.outputEncoding = T.sRGBEncoding;
    // 하늘과 구름
    if (GFX.sky) { scene.remove(GFX.sky); }
    GFX.sky = makeSky(); scene.add(GFX.sky);
    A.banks = makeCloudBanks(); A.banks.visible = false; scene.add(A.banks);
    A.loadCloudTex().catch(e => console.warn('ATMOS: 구름 그림 실패', e && e.message));
    if (!scene.fog) scene.fog = new T.FogExp2(0xbfe3f5, 0.002);
    // 그림자
    r.shadowMap.enabled = A.tier !== 'low';
    r.shadowMap.type = T.PCFSoftShadowMap;
    if (r.shadowMap.enabled) setupShadows();
    // 환경광
    A.pmrem = new T.PMREMGenerator(r);
    A.envScene = makeEnvScene();
    // 후처리
    if (A.tier !== 'low' && T.UnrealBloomPass && T.FullScreenQuad) {
      A.pipe = new Pipeline();
      GFX.composer = A.pipe;
      r.toneMapping = T.NoToneMapping;
    } else {
      GFX.composer = null;
      r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
      GFX.finalU = GFX.finalU || { exposure: { value: 0.85 }, vig: { value: 0 }, sat: { value: 1 }, tint: { value: C(0xffffff) } };
      // 낮은 단계에는 후처리가 없지만 같은 값 묶음을 갖춰 둔다 (등급 값을 써 넣는 곳이 있다)
      for (const k of ['expoBase', 'contrast', 'split', 'grain', 'time']) if (!GFX.finalU[k]) GFX.finalU[k] = { value: 1 };
      for (const k of ['shTint', 'hiTint']) if (!GFX.finalU[k]) GFX.finalU[k] = { value: C(0xffffff) };
    }
    // 다른 길(직접 그리기)로 그려도 매 프레임 한 번은 갱신되게
    const prev = scene.onBeforeRender;
    scene.onBeforeRender = function (rr, sc, cam) { if (cam === GFX.camera) autoStep(); if (prev) prev.apply(this, arguments); };
    requestAnimationFrame(rafTick);
    A.ready = true;
    A.preset('goldenHour');
    updateEnv(A.cur, true);
    // 자주 쓰는 HDRI는 미리
    for (const n of ['sunset', 'night', 'hall']) A.loadHDRI(n);
  };
  A.render = function () { if (GFX.composer) GFX.composer.render(); else { autoStep(); GFX.renderer.render(GFX.scene, GFX.camera); } };
  // HDRI 불러오기를 기다린다 (보기 페이지용)
  A.whenLoaded = function () { return Promise.all(Object.values(HDR).map(e => e.p)).then(() => { A.envDirty = true; if (A.cur) updateEnv(A.cur, true); }); };
  A.refreshEnv = function () { if (A.cur) updateEnv(A.cur, true); };
})();
