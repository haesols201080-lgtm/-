// Materials for the generated town: the library materials in their tinted
// (vertex colour) variants, plus the sign atlas and frosted pub glass.
import * as THREE from 'three';
import { signAtlas } from './signs.js';

export function townMaterials(G) {
  const own = new Map();
  return (name) => {
    if (own.has(name)) return own.get(name);
    let m = null;
    if (name === 'signs') m = new THREE.MeshStandardMaterial({ map: signAtlas().tex, roughness: 0.75, metalness: 0.05 });
    else if (name === 'frosted') m = new THREE.MeshStandardMaterial({ color: 0x8e9088, roughness: 0.28, metalness: 0.0, envMapIntensity: 1.6 });
    else m = G.mats.vc(name);
    if (m) own.set(name, m);
    return m;
  };
}
