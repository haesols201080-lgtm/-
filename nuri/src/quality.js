// Device detection + quality tiers. Mobile defaults to "low"; desktop to "high".
export const isTouch = (('ontouchstart' in window) || navigator.maxTouchPoints > 0) && matchMedia('(pointer: coarse)').matches;
export const isMobile = isTouch || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export const TIERS = {
  low: { pixelRatio: 1.0, maxDpr: 1.5, shadowMap: 1024, shadowRange: 14, grassDensity: 0.35, grassRadius: 12, texSize: 1024,
    post: false, bloom: false, ao: false, treeLod0Dist: 22, fernDensity: 0.5, msaa: 0, antialias: true, farFog: 55, creatures: 0.6 },
  medium: { pixelRatio: 1.0, maxDpr: 1.75, shadowMap: 2048, shadowRange: 18, grassDensity: 0.65, grassRadius: 16, texSize: 1024,
    post: true, bloom: true, ao: false, treeLod0Dist: 32, fernDensity: 0.8, msaa: 4, antialias: false, farFog: 70, creatures: 1 },
  high: { pixelRatio: 1.0, maxDpr: 2, shadowMap: 4096, shadowRange: 22, grassDensity: 1.0, grassRadius: 20, texSize: 2048,
    post: true, bloom: true, ao: true, treeLod0Dist: 45, fernDensity: 1, msaa: 4, antialias: false, farFog: 80, creatures: 1 },
};

export function defaultTier() {
  if (isMobile) return 'low';
  const mem = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 8;
  if (mem <= 4 || cores <= 4) return 'medium';
  return 'high';
}
