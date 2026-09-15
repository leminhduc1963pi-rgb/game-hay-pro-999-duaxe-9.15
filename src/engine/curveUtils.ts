import * as THREE from 'three';

/**
 * Safely normalizes curve parameter U into range [0, 1] without NaN or out of bounds.
 */
export function getSafeCurveU(u: number): number {
  if (typeof u !== 'number' || isNaN(u) || !isFinite(u)) {
    return 0;
  }
  let safe = u % 1.0;
  if (safe < 0) safe += 1.0;
  return Math.min(Math.max(safe, 0), 1);
}

/**
 * Safely samples a point along a 3D curve with fallback to avoid crashes.
 * Supports optional target vector to eliminate GC overhead.
 */
export function safeGetPointAt(
  curve: THREE.Curve<THREE.Vector3>,
  u: number,
  target?: THREE.Vector3
): THREE.Vector3 {
  const out = target || new THREE.Vector3();
  if (!curve) return out.set(0, 2.5, 0);
  const safeU = getSafeCurveU(u);
  try {
    const pt = curve.getPointAt(safeU, out);
    if (!pt || isNaN(pt.x) || isNaN(pt.y) || isNaN(pt.z)) {
      return out.set(0, 2.5, 0);
    }
    return out;
  } catch {
    return out.set(0, 2.5, 0);
  }
}

/**
 * Safely samples tangent vector along a 3D curve with normalization and fallback.
 * Supports optional target vector to eliminate GC overhead.
 */
export function safeGetTangentAt(
  curve: THREE.Curve<THREE.Vector3>,
  u: number,
  target?: THREE.Vector3
): THREE.Vector3 {
  const out = target || new THREE.Vector3();
  if (!curve) return out.set(0, 0, 1);
  const safeU = getSafeCurveU(u);
  try {
    const tan = curve.getTangentAt(safeU, out);
    if (!tan || isNaN(tan.x) || isNaN(tan.y) || isNaN(tan.z) || tan.lengthSq() < 1e-6) {
      return out.set(0, 0, 1);
    }
    return out.normalize();
  } catch {
    return out.set(0, 0, 1);
  }
}
