// 그래픽 품질 단계. 모바일은 자동으로 낮춰 시작하고, 실행 중에는 해상도를 동적으로 조절합니다.
export const PRESETS = {
  low: { label: '낮음', dprCap: 1.0, bloom: false, msaa: 0, lod: 1.45, flora: 0.45, grassRadius: 38, farFlora: 0.6, clouds: 0.5 },
  medium: { label: '보통', dprCap: 1.35, bloom: true, msaa: 0, lod: 1.8, flora: 0.7, grassRadius: 52, farFlora: 0.8, clouds: 0.8 },
  high: { label: '높음', dprCap: 1.75, bloom: true, msaa: 4, lod: 2.2, flora: 1.0, grassRadius: 70, farFlora: 1.0, clouds: 1.0 },
  ultra: { label: '최고', dprCap: 2.0, bloom: true, msaa: 4, lod: 2.8, flora: 1.35, grassRadius: 90, farFlora: 1.25, clouds: 1.0 },
};

export const IS_TOUCH = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0) && matchMedia('(pointer: coarse)').matches;

export function detectQuality() {
  const mem = navigator.deviceMemory || 4;
  if (IS_TOUCH) return mem >= 6 ? 'medium' : 'low';
  const cores = navigator.hardwareConcurrency || 4;
  return cores >= 8 ? 'high' : 'medium';
}
