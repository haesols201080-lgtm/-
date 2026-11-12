// Quality presets. `auto` picks from device hints; ?q=low|medium|high|ultra overrides.
export const PRESETS = {
  low: {
    name: 'low', pixelRatio: 0.7, maxPixels: 900 * 520, msaa: 0, density: 0.5, detailDist: 420, farChunkDist: 3600,
    cloudScale: 0.25, cloudSteps: 10, bloomMips: 4, probe: 0, probeSize: 64, shadows: 0, motionBlur: 0, ssao: 0,
    traffic: 900, crowd: 60, rain: 2500, godrays: 0, interiorMap: 0, far: 14000,
  },
  medium: {
    name: 'medium', pixelRatio: 1, maxPixels: 1280 * 720, msaa: 0, density: 0.75, detailDist: 700, farChunkDist: 5200,
    cloudScale: 0.33, cloudSteps: 18, bloomMips: 5, probe: 1, probeSize: 96, shadows: 0, motionBlur: 0, ssao: 0,
    traffic: 2200, crowd: 140, rain: 6000, godrays: 1, interiorMap: 1, far: 20000,
  },
  high: {
    name: 'high', pixelRatio: 1, maxPixels: 1920 * 1080, msaa: 4, density: 1, detailDist: 1000, farChunkDist: 7000,
    cloudScale: 0.5, cloudSteps: 28, bloomMips: 6, probe: 1, probeSize: 128, shadows: 1, motionBlur: 1, ssao: 1,
    traffic: 4200, crowd: 260, rain: 12000, godrays: 1, interiorMap: 1, far: 26000,
  },
  ultra: {
    name: 'ultra', pixelRatio: 1.5, maxPixels: 2560 * 1440, msaa: 4, density: 1, detailDist: 1500, farChunkDist: 9000,
    cloudScale: 0.5, cloudSteps: 44, bloomMips: 7, probe: 1, probeSize: 256, shadows: 1, motionBlur: 1, ssao: 1,
    traffic: 6000, crowd: 400, rain: 20000, godrays: 1, interiorMap: 1, far: 30000,
  },
};

export function pickQuality(params) {
  const forced = params.get('q');
  if (forced && PRESETS[forced]) return { ...PRESETS[forced] };
  const saved = (() => { try { return localStorage.getItem('ns.quality'); } catch (e) { return null; } })();
  if (saved && PRESETS[saved]) return { ...PRESETS[saved] };
  const mobile = isMobile();
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  if (mobile) return { ...(mem >= 6 && cores >= 8 ? PRESETS.medium : PRESETS.low) };
  return { ...(cores >= 8 ? PRESETS.high : PRESETS.medium) };
}

export function isMobile() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
}
