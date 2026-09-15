export interface TrackVisualTheme {
  trackColor: number;
  centerLineWidth: number;
  centerLineColor: number;
  bollardReflectorColor: number;
  lampColor: number;
  archColor: number;
}

const DEFAULT_THEME: TrackVisualTheme = {
  trackColor: 0x1a1a24,
  centerLineWidth: 0.35,
  centerLineColor: 0xffffff,
  bollardReflectorColor: 0xffaa00,
  lampColor: 0x38bdf8,
  archColor: 0x0284c7
};

const THEMES: Record<string, TrackVisualTheme> = {
  GRAND_PRIX_OVAL: {
    trackColor: 0x1e1e24,
    centerLineWidth: 0.4,
    centerLineColor: 0xffffff,
    bollardReflectorColor: 0xf59e0b,
    lampColor: 0x60a5fa,
    archColor: 0x2563eb
  },
  MONZA_TEMPLE_OF_SPEED: {
    trackColor: 0x18181f,
    centerLineWidth: 0.35,
    centerLineColor: 0xffffff,
    bollardReflectorColor: 0xef4444,
    lampColor: 0x38bdf8,
    archColor: 0xd97706
  },
  TOKYO_EXPRESSWAY_RING: {
    trackColor: 0x111118,
    centerLineWidth: 0.45,
    centerLineColor: 0xfacc15,
    bollardReflectorColor: 0xec4899,
    lampColor: 0xa855f7,
    archColor: 0xec4899
  },
  NEON_TUNNEL_METRO: {
    trackColor: 0x0c0d14,
    centerLineWidth: 0.5,
    centerLineColor: 0x22d3ee,
    bollardReflectorColor: 0xf43f5e,
    lampColor: 0x06b6d4,
    archColor: 0x8b5cf6
  },
  MOUNTAIN_HAIRPIN_PASS: {
    trackColor: 0x27272a,
    centerLineWidth: 0.3,
    centerLineColor: 0xfde047,
    bollardReflectorColor: 0xf97316,
    lampColor: 0xfbbf24,
    archColor: 0xca8a04
  },
  COASTAL_CLIFF_HIGHWAY: {
    trackColor: 0x1c1917,
    centerLineWidth: 0.35,
    centerLineColor: 0xffffff,
    bollardReflectorColor: 0x06b6d4,
    lampColor: 0x67e8f9,
    archColor: 0x0891b2
  },
  DESERT_CANYON_DUNES: {
    trackColor: 0x292524,
    centerLineWidth: 0.4,
    centerLineColor: 0xfef08a,
    bollardReflectorColor: 0xea580c,
    lampColor: 0xf59e0b,
    archColor: 0xb45309
  },
  NURBURGRING_ROLLER_COASTER: {
    trackColor: 0x1f2421,
    centerLineWidth: 0.35,
    centerLineColor: 0xffffff,
    bollardReflectorColor: 0x22c55e,
    lampColor: 0x86efac,
    archColor: 0x16a34a
  },
  FUTURISTIC_HYPERLOOP: {
    trackColor: 0x0f172a,
    centerLineWidth: 0.5,
    centerLineColor: 0x38bdf8,
    bollardReflectorColor: 0x6366f1,
    lampColor: 0x818cf8,
    archColor: 0x4f46e5
  }
};

export function getTrackVisualTheme(layoutKey?: string): TrackVisualTheme {
  if (!layoutKey || typeof layoutKey !== 'string') return DEFAULT_THEME;
  return THEMES[layoutKey] || DEFAULT_THEME;
}

import * as THREE from 'three';

export function createRoadTexture(theme: TrackVisualTheme): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  const hexStr = '#' + theme.trackColor.toString(16).padStart(6, '0');
  ctx.fillStyle = hexStr;
  ctx.fillRect(0, 0, 512, 512);

  // Asphalt asphalt noise texture
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const alpha = Math.random() * 0.08;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Left & right edge white solid lines
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(16, 0, 8, 512);
  ctx.fillRect(512 - 24, 0, 8, 512);

  // Center dashed line
  const centerHex = '#' + theme.centerLineColor.toString(16).padStart(6, '0');
  ctx.fillStyle = centerHex;
  const dashLength = 70;
  const gapLength = 40;
  let yPos = 0;
  while (yPos < 512) {
    ctx.fillRect(256 - 4, yPos, 8, dashLength);
    yPos += dashLength + gapLength;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

