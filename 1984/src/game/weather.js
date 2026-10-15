// Rain falling round the camera, the streets getting wet, and the wind that
// whirls dust and torn paper into spirals (the novel's first page).
import * as THREE from 'three';

export function setupWeather(G) {
  const N = 9000, BOX = 36;
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.006, 0, 0, 0.006, 0, 0, 0.006, 1, 0, -0.006, 1, 0], 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const off = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) { off[i * 4] = Math.random() * BOX; off[i * 4 + 1] = Math.random() * 30; off[i * 4 + 2] = Math.random() * BOX; off[i * 4 + 3] = Math.random(); }
  geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
  geo.instanceCount = N;
  const rainU = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uAmount: { value: 0 }, uWind: { value: new THREE.Vector2(1.2, 0.4) }, uLight: { value: new THREE.Color(0.6, 0.62, 0.66) } };
  const rainMat = new THREE.ShaderMaterial({
    uniforms: rainU, transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    vertexShader: `
      attribute vec4 aOff; uniform float uTime, uAmount; uniform vec3 uCam; uniform vec2 uWind; varying float vA; varying float vY;
      void main(){
        float speed = 9.0 + aOff.w * 3.0;
        vec3 p = aOff.xyz;
        p.y = mod(p.y - uTime * speed, 30.0);
        p.xz += uWind * (30.0 - p.y) * 0.05;
        p.x = mod(p.x - uCam.x, ${BOX.toFixed(1)}) + uCam.x - ${(BOX / 2).toFixed(1)};
        p.z = mod(p.z - uCam.z, ${BOX.toFixed(1)}) + uCam.z - ${(BOX / 2).toFixed(1)};
        p.y += uCam.y - 10.0;
        vec3 dir = normalize(vec3(uWind.x * 0.05, -1.0, uWind.y * 0.05));
        float len = 0.5 + aOff.w * 0.3;
        // billboard the streak sideways toward the camera
        vec3 toCam = normalize(cameraPosition - p);
        vec3 side = normalize(cross(dir, toCam));
        vec3 w = p + side * position.x - dir * position.y * len;
        vA = step(aOff.w, uAmount) * (0.25 + 0.2 * aOff.w);
        vY = position.y;
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }`,
    fragmentShader: `uniform vec3 uLight; varying float vA; varying float vY;
      void main(){ if (vA < 0.01) discard; gl_FragColor = vec4(uLight, vA * (1.0 - vY * 0.6)); }`,
  });
  const rain = new THREE.Mesh(geo, rainMat);
  rain.frustumCulled = false;
  rain.renderOrder = 5;
  G.scene.add(rain);

  // paper and dust whirling near the ground in gusts
  const PN = 70;
  const paperGeo = new THREE.PlaneGeometry(0.22, 0.16);
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xcfc6b0, roughness: 0.9, side: THREE.DoubleSide });
  const papers = new THREE.InstancedMesh(paperGeo, paperMat, PN);
  papers.frustumCulled = false;
  const pd = [];
  for (let i = 0; i < PN; i++) pd.push({ a: Math.random() * 6.28, r: 1 + Math.random() * 4, h: Math.random(), cx: (Math.random() - 0.5) * 40, cz: (Math.random() - 0.5) * 40, s: 0.5 + Math.random(), rot: new THREE.Euler() });
  G.scene.add(papers);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1);

  let wet = 0;
  const weather = {
    name: 'clear_cold',
    set(name) { weather.name = name; G.atmos.setWeather(name); },
  };
  G.onUpdate((dt) => {
    const w = G.atmos.w || {};
    const ext = !G.location || G.location.exterior;
    rainU.uTime.value += dt;
    rainU.uCam.value.copy(G.camera.position);
    rainU.uAmount.value = ext ? (w.rain || 0) : 0;
    rainU.uLight.value.setRGB(0.35 + G.atmos.day * 0.35, 0.37 + G.atmos.day * 0.35, 0.4 + G.atmos.day * 0.35);
    rain.visible = ext && (w.rain || 0) > 0.02;
    // wetness lags behind the rain: streets stay wet after a shower
    const target = (w.rain || 0) > 0.1 ? 1 : 0;
    wet += (target - wet) * Math.min(1, dt * (target ? 0.08 : 0.01));
    G.mats.globals.uWet.value = ext ? wet : 0;
    // gusts
    const gust = Math.max(0, Math.sin(G.time * 0.21) * Math.sin(G.time * 0.53)) * (w.wind || 0);
    papers.visible = ext && G.state.location === 'city' && gust > 0.05 && (w.rain || 0) < 0.5;
    if (papers.visible) {
      const c = G.camera.position;
      pd.forEach((p, i) => {
        p.a += dt * (1.5 + p.s) * gust * 2;
        p.h = Math.max(0, p.h + Math.sin(p.a * 1.7) * dt * gust);
        if (Math.hypot(p.cx - c.x, p.cz - c.z) > 30) { p.cx = c.x + (Math.random() - 0.5) * 40; p.cz = c.z + (Math.random() - 0.5) * 40; }
        P.set(p.cx + Math.cos(p.a) * p.r, 0.05 + p.h * 1.8 * gust, p.cz + Math.sin(p.a) * p.r);
        p.rot.set(p.a * 2.1, p.a * 1.3, p.a * 0.7);
        Q.setFromEuler(p.rot);
        M.compose(P, Q, S1);
        papers.setMatrixAt(i, M);
      });
      papers.instanceMatrix.needsUpdate = true;
    }
  });
  G.weather = weather;
  return weather;
}
