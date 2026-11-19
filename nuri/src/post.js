// Post-processing that ties the stylised robot into the scanned world:
//  * macro depth-of-field focused on the robot (small subjects photographed up close have a shallow focus)
//  * one shared colour grade, vignette and fine film grain over the whole frame
import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export function makeDofPass(depthTexture, camera) {
  const pass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null }, tDepth: { value: depthTexture },
      cameraNear: { value: camera.near }, cameraFar: { value: camera.far },
      uFocus: { value: 1.2 }, uStrength: { value: 1.0 }, uMaxR: { value: 7 }, uRes: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      #include <packing>
      uniform sampler2D tDiffuse, tDepth; uniform float cameraNear, cameraFar, uFocus, uStrength, uMaxR; uniform vec2 uRes;
      varying vec2 vUv;
      float lin(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, cameraNear, cameraFar); }
      float coc(float d){ return clamp(abs(d - uFocus) / max(d, 1e-3) * uStrength, 0.0, 1.0) * uMaxR; }
      void main(){
        float d0 = lin(vUv); float c0 = coc(d0);
        vec4 base = texture2D(tDiffuse, vUv);
        if (c0 < 0.6) { gl_FragColor = base; return; }
        vec3 acc = base.rgb; float wsum = 1.0;
        const float GA = 2.39996323;
        for (int i = 1; i < 20; i++) {
          float r = sqrt(float(i) / 19.0) * c0;
          float a = float(i) * GA;
          vec2 off = vec2(cos(a), sin(a)) * r / uRes;
          vec2 uv = clamp(vUv + off, vec2(0.001), vec2(0.999));
          float d = lin(uv); float c = coc(d);
          // samples in front only bleed as far as their own blur reaches; behind samples cannot bleed onto a sharp subject
          float w = (d < d0) ? smoothstep(r - 1.0, r + 1.0, c) : smoothstep(r - 1.0, r + 1.0, min(c, c0));
          acc += texture2D(tDiffuse, uv).rgb * w; wsum += w;
        }
        gl_FragColor = vec4(acc / wsum, base.a);
      }`,
  });
  pass.material.depthTest = false; pass.material.depthWrite = false;
  // ShaderPass clones its uniforms (and textures); point back at the real depth texture
  pass.uniforms.tDepth.value = depthTexture;
  return pass;
}

export function makeGradePass() {
  const pass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uVig: { value: 0.22 }, uGrain: { value: 0.022 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse; uniform float uTime, uVig, uGrain; uniform vec2 uRes; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        // gentle filmic contrast + shared split toning (cool-green shadows, warm highlights) for robot and forest alike
        c = mix(c, c * c * (3.0 - 2.0 * c), 0.18);
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        c += vec3(-0.012, 0.006, 0.01) * (1.0 - l) + vec3(0.018, 0.008, -0.014) * l;
        c = mix(vec3(l), c, 0.94);
        vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y;
        c *= 1.0 - uVig * smoothstep(0.35, 1.05, length(q) * 1.3);
        c += (h(vUv * uRes + fract(uTime) * 97.0) - 0.5) * uGrain;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  pass.material.depthTest = false; pass.material.depthWrite = false;
  return pass;
}

// soft contact shadow / ambient occlusion blob under the robot
export function makeContactShadow() {
  const s = 128, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(12,10,6,0.9)'); grd.addColorStop(0.3, 'rgba(12,10,6,0.6)'); grd.addColorStop(0.65, 'rgba(12,10,6,0.18)'); grd.addColorStop(1, 'rgba(12,10,6,0)');
  g.fillStyle = grd; g.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: 0xffffff,
    opacity: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: false }));
  tex.colorSpace = THREE.SRGBColorSpace;
  return m;
}

// screen-space crepuscular rays: bright sky seen through the canopy streams toward the camera along the sun direction
export function makeGodRaysPass(depthTexture) {
  const pass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, tDepth: { value: depthTexture }, uSun: { value: new THREE.Vector2(0.5, 0.8) }, uI: { value: 0 },
      uCol: { value: new THREE.Color(1.0, 0.86, 0.62) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse, tDepth; uniform vec2 uSun; uniform float uI; uniform vec3 uCol; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec4 base = texture2D(tDiffuse, vUv);
        if (uI < 0.002) { gl_FragColor = base; return; }
        vec2 d = (uSun - vUv) / 36.0 * 0.85;
        vec2 uv = vUv + d * h(vUv * 1000.0);
        float acc = 0.0, decay = 1.0;
        for (int i = 0; i < 36; i++) {
          uv += d;
          if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) break;
          float sky = step(0.99999, texture2D(tDepth, uv).x);
          float l = dot(texture2D(tDiffuse, uv).rgb, vec3(0.3, 0.59, 0.11));
          acc += sky * smoothstep(0.35, 1.6, l) * decay; decay *= 0.955;
        }
        base.rgb += uCol * (acc / 36.0) * uI;
        gl_FragColor = base;
      }`,
  });
  pass.material.depthTest = false; pass.material.depthWrite = false;
  pass.uniforms.tDepth.value = depthTexture;
  return pass;
}
