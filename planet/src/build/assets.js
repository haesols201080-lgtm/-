// Real hardware models. These are public-domain NASA 3D models
// (github.com/nasa/NASA-3D-Resources, "free and without copyright"),
// re-encoded with meshopt geometry and WebP textures and embedded in the
// bundle. No agency insignia or national flags are used.
//
// loadAssets() runs once at boot, before any building model is built; it
// bakes every mesh into building space (Float32, non-indexed, merged per
// material) so ModelBuilder.asset() can drop one into a model like any part.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import dsn34 from '../../assets/nasa/dsn34.glb';

// name -> { bytes, paint }: paint overrides the source PBR values (the DSN
// antennas are painted structural steel, not bare metal)
const SRC = {
  // Deep Space Network 34 m beam-waveguide antenna (Goldstone / Canberra / Madrid)
  dsn34: { bytes: dsn34, paint: { metalness: 0.12, roughness: 0.62 } },
};

export const ASSETS = {};   // name -> { groups: [{ geo, material }], box: Box3 }

function toFloat(attr) {
  const n = attr.count, k = attr.itemSize, out = new Float32Array(n * k);
  const get = [attr.getX, attr.getY, attr.getZ, attr.getW];
  for (let i = 0; i < n; i++) for (let c = 0; c < k; c++) out[i * k + c] = get[c].call(attr, i);
  return new THREE.BufferAttribute(out, k);
}

function bake(mesh) {
  const src = mesh.geometry;
  const g = new THREE.BufferGeometry();
  if (src.index) g.setIndex(src.index.clone());
  for (const name of ['position', 'normal', 'uv']) if (src.attributes[name]) g.setAttribute(name, toFloat(src.attributes[name]));
  g.applyMatrix4(mesh.matrixWorld);
  const out = g.index ? g.toNonIndexed() : g;
  if (!out.attributes.normal) out.computeVertexNormals();
  return out;
}

export async function loadAssets() {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  await Promise.all(Object.entries(SRC).map(async ([name, { bytes, paint }]) => {
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const gltf = await loader.parseAsync(buf, '');
    gltf.scene.updateMatrixWorld(true);
    const byMat = new Map();
    gltf.scene.traverse((o) => {
      // skip helper geometry (empties exported as unit cubes)
      if (!o.isMesh || o.geometry.attributes.position.count <= 24) return;
      const m = o.material;
      if (!byMat.has(m)) byMat.set(m, []);
      byMat.get(m).push(bake(o));
    });
    const groups = [], box = new THREE.Box3();
    for (const [m, geos] of byMat) {
      // a material shared by meshes with and without uvs: drop the uvs
      const hasUv = geos.every((g) => g.attributes.uv);
      if (!hasUv) for (const g of geos) g.deleteAttribute('uv');
      const geo = geos.length > 1 ? mergeGeometries(geos, false) : geos[0];
      geo.computeBoundingBox();
      box.union(geo.boundingBox);
      const material = new THREE.MeshStandardMaterial({
        map: hasUv ? m.map : null, color: m.color, side: m.side,
        metalness: paint ? paint.metalness : m.metalness, roughness: paint ? paint.roughness : m.roughness,
      });
      material.name = name + ':' + (m.name || groups.length);
      groups.push({ geo, material });
    }
    ASSETS[name] = { groups, box };
  }));
}
