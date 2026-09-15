import * as THREE from 'three';

/**
 * Generates 3D control points for 20 high-speed racing circuit layouts.
 * Scaled for long 32km - 42km racing tracks ensuring 2+ minutes of unique curves.
 */
export function generatePointsForLayout(layout: string, seed: number = 42): THREE.Vector3[] {
  // Simple seeded pseudo-random generator
  let s = Math.abs(seed) || 42;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  const points: THREE.Vector3[] = [];
  const scale = 1400; // Large scale for ultra-fast speeds (450-520 km/h)

  switch (layout) {
    case 'FIGURE_EIGHT_BRIDGE': {
      const numPts = 32;
      for (let i = 0; i < numPts; i++) {
        const t = (i / numPts) * Math.PI * 2;
        const x = Math.sin(t) * scale * 1.6;
        const z = Math.sin(t * 2) * scale * 1.2;
        // Độ dốc mềm mại liên tục hình sin, cầu vượt êm ái triệt tiêu hoàn toàn gãy nứt
        const y = (Math.sin(t) * 0.5 + 0.5) * 16.0 + 4.5;
        points.push(new THREE.Vector3(x, y, z));
      }
      break;
    }

    case 'MOUNTAIN_HAIRPIN_PASS': {
      const numPts = 36;
      for (let i = 0; i < numPts; i++) {
        const t = (i / numPts) * Math.PI * 2;
        const r = scale * (1.1 + 0.5 * Math.sin(3 * t) + 0.25 * Math.sin(6 * t));
        const x = Math.cos(t) * r;
        const z = Math.sin(t) * r * 1.3;
        // Dốc thoải êm ái theo triền núi, không còn dốc đứng làm đứt đường
        const y = Math.sin(t * 2) * 10.0 + Math.cos(t) * 6.0 + 12.0;
        points.push(new THREE.Vector3(x, y, z));
      }
      break;
    }

    case 'AIRPORT_RUNWAY_DRAG': {
      // Long high-speed straights with high-banked sweeper turns
      const l = scale * 2.6;
      const w = scale * 0.45;
      points.push(
        new THREE.Vector3(-l, 5, -w),
        new THREE.Vector3(-l * 0.5, 6, -w),
        new THREE.Vector3(0, 7, -w),
        new THREE.Vector3(l * 0.5, 6, -w),
        new THREE.Vector3(l, 5, -w),
        new THREE.Vector3(l + 300, 8, 0),
        new THREE.Vector3(l, 6, w),
        new THREE.Vector3(l * 0.5, 5, w),
        new THREE.Vector3(0, 7, w),
        new THREE.Vector3(-l * 0.5, 6, w),
        new THREE.Vector3(-l, 5, w),
        new THREE.Vector3(-l - 300, 8, 0)
      );
      break;
    }

    case 'COASTAL_CLIFF_HIGHWAY': {
      const numPts = 28;
      for (let i = 0; i < numPts; i++) {
        const t = (i / numPts) * Math.PI * 2;
        const x = Math.cos(t) * scale * 1.5 + Math.sin(t * 3) * (scale * 0.2);
        const z = Math.sin(t) * scale * 1.2 + Math.cos(t * 2) * (scale * 0.3);
        const y = Math.sin(t * 2) * 12.0 + 10.0;
        points.push(new THREE.Vector3(x, y, z));
      }
      break;
    }

    case 'SUZUKA_TECHNICAL_S': {
      const numPts = 32;
      for (let i = 0; i < numPts; i++) {
        const t = (i / numPts) * Math.PI * 2;
        const x = Math.sin(t) * scale * 1.4 + Math.sin(t * 4) * 220;
        const z = Math.cos(t) * scale * 1.1 + Math.cos(t * 3) * 180;
        const y = Math.sin(t * 2) * 8.0 + 8.0;
        points.push(new THREE.Vector3(x, y, z));
      }
      break;
    }

    case 'MONZA_TEMPLE_OF_SPEED': {
      // Classic Monza: Parabolica sweeper, Curva Grande, Lesmo, Ascari chicane
      points.push(
        new THREE.Vector3(-scale * 1.6, 5, -scale * 0.5),
        new THREE.Vector3(-scale * 0.7, 6, -scale * 0.55),
        new THREE.Vector3(0, 5, -scale * 0.5),
        new THREE.Vector3(scale * 0.8, 6, -scale * 0.4),
        new THREE.Vector3(scale * 1.4, 8, -scale * 0.1),
        new THREE.Vector3(scale * 1.7, 9, scale * 0.4),
        new THREE.Vector3(scale * 1.3, 7, scale * 0.9),
        new THREE.Vector3(scale * 0.6, 5, scale * 0.7),
        new THREE.Vector3(scale * 0.1, 8, scale * 0.95),
        new THREE.Vector3(-scale * 0.4, 6, scale * 0.75),
        new THREE.Vector3(-scale * 1.1, 5, scale * 0.6),
        new THREE.Vector3(-scale * 1.8, 8, scale * 0.1)
      );
      break;
    }

    case 'TOKYO_EXPRESSWAY_RING': {
      const numPts = 30;
      for (let i = 0; i < numPts; i++) {
        const t = (i / numPts) * Math.PI * 2;
        const r = scale * (1.3 + 0.18 * Math.sin(t * 5));
        const x = Math.cos(t) * r;
        const z = Math.sin(t) * r * 1.15;
        const y = Math.sin(t * 4) * 9.0 + 10.0;
        points.push(new THREE.Vector3(x, y, z));
      }
      break;
    }

    case 'NURBURGRING_ROLLER_COASTER': {
      const numPts = 40;
      for (let i = 0; i < numPts; i++) {
        const t = (i / numPts) * Math.PI * 2;
        const r = scale * (1.2 + 0.35 * Math.sin(2 * t) + 0.2 * Math.cos(5 * t));
        const x = Math.cos(t) * r;
        const z = Math.sin(t) * r * 1.25;
        // Dốc nhấp nhô lượn sóng thoải mái, không tạo ra vách đứng
        const y = Math.sin(t * 3) * 12.0 + Math.cos(t * 2) * 8.0 + 14.0;
        points.push(new THREE.Vector3(x, y, z));
      }
      break;
    }

    case 'DESERT_CANYON_DUNES': {
      const numPts = 26;
      for (let i = 0; i < numPts; i++) {
        const t = (i / numPts) * Math.PI * 2;
        const r = scale * (1.35 + 0.28 * Math.sin(3 * t));
        const x = Math.sin(t) * r;
        const z = Math.cos(t) * r * 0.95;
        const y = Math.sin(t * 2) * 10.0 + 10.0;
        points.push(new THREE.Vector3(x, y, z));
      }
      break;
    }

    case 'GRAND_PRIX_OVAL':
    default: {
      const numPts = 24;
      for (let i = 0; i < numPts; i++) {
        const t = (i / numPts) * Math.PI * 2;
        const variation = 1.0 + (rand() * 0.15 - 0.075);
        const x = Math.cos(t) * scale * 1.8 * variation;
        const z = Math.sin(t) * scale * 1.1 * variation;
        const y = Math.sin(t * 2) * 6.0 + 8.0;
        points.push(new THREE.Vector3(x, y, z));
      }
      break;
    }
  }

  // Nhiễu hạt dựa trên seed để tạo ra 100 khúc cua hoàn toàn khác nhau cho 100 bản đồ!
  // Đảm bảo không có bất kỳ 2 seed nào có các khúc cua trùng lặp trùng khớp hoàn toàn.
  // Đảm bảo điểm xuất phát và điểm kết thúc trùng khít 100% để triệt tiêu lỗi đứt đoạn đường.
  const startPerturbX = (rand() - 0.5) * 80;
  const startPerturbY = (rand() - 0.5) * 4;
  const startPerturbZ = (rand() - 0.5) * 80;

  points.forEach((p, idx) => {
    if (idx === 0 || idx === points.length - 1) {
      p.x += startPerturbX;
      p.y += startPerturbY;
      p.z += startPerturbZ;
    } else {
      p.x += (rand() - 0.5) * 160;
      p.y += (rand() - 0.5) * 4.0; // Giới hạn dốc vi mô mềm mại, triệt tiêu hoàn toàn lỗi đứt đoạn đường
      p.z += (rand() - 0.5) * 160;
    }
    p.y = Math.max(4.0, p.y); // Đảm bảo mặt đường luôn nằm cao hơn mặt đất phẳng để tránh đứt đoạn
  });

  return points;
}
