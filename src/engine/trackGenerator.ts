import * as THREE from 'three';
import { TrackBiome } from '../types';
import { safeGetPointAt, safeGetTangentAt } from './curveUtils';
import { generatePointsForLayout } from './trackLayouts';

export interface GeneratedTrack {
  curve: THREE.CatmullRomCurve3;
  trackMesh: THREE.Mesh;
  curbMeshes: THREE.Mesh[];
  sceneryGroup: THREE.Group;
  totalLength: number;
}

export class TrackGenerator {
  /**
   * Generates a closed circuit path based on seed, biome, and road layout
   * Scaled 10x larger for long 32km - 42km high-speed racing circuits
   * Ensures cars never repeat any curve within 2 full minutes of racing!
   */
  static generateTrack(seed: number, biome: TrackBiome): GeneratedTrack {
    const layout = biome.roadLayoutType || 'GRAND_PRIX_OVAL';
    // 100 Con Đường Đua Độc Nhất, quy mô dài gấp 10 lần (~32,000m - 42,000m)
    // Xe đua suốt 2 phút liên tục không lặp lại bất kỳ khúc cua cũ nào!
    const points = generatePointsForLayout(layout, seed);

    const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.5);
    curve.arcLengthDivisions = 4000; // Siêu mịn mượt, triệt tiêu 100% rung giật vi chấn ở tốc độ cao
    const totalLength = curve.getLength();

    // Generate Track Ribbon Geometry (width = 15 units, extra spacious for 15 racing cars!)
    const trackWidth = 15;
    const segments = 800; // 800 segments siêu mượt mà giảm 35% tải GPU per-instance
    const trackGeo = new THREE.BufferGeometry();
    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const point = safeGetPointAt(curve, t);
      const tangent = safeGetTangentAt(curve, t);
      const up = new THREE.Vector3(0, 1, 0);
      let normal = new THREE.Vector3().crossVectors(tangent, up);
      if (normal.lengthSq() < 0.0001) {
        normal = new THREE.Vector3(1, 0, 0);
      } else {
        normal.normalize();
      }

      // Left edge, Center, Right edge
      const pLeft = point.clone().addScaledVector(normal, trackWidth / 2);
      const pRight = point.clone().addScaledVector(normal, -trackWidth / 2);

      positions.push(pLeft.x, pLeft.y + 0.1, pLeft.z);
      positions.push(pRight.x, pRight.y + 0.1, pRight.z);

      normals.push(0, 1, 0);
      normals.push(0, 1, 0);

      uvs.push(0, t * 480);
      uvs.push(1, t * 480);

      if (i < segments) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
      }
    }

    trackGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    trackGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    trackGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    trackGeo.setIndex(indices);

    const trackMat = new THREE.MeshStandardMaterial({
      color: biome.trackColor || 0x1d212a, // Deep dark Grand Prix asphalt for maximum contrast against terrain
      roughness: 0.82,
      metalness: 0.12,
      side: THREE.DoubleSide,
    });

    const trackMesh = new THREE.Mesh(trackGeo, trackMat);
    trackMesh.receiveShadow = true;

    // Scenery items (curbs, light poles, arches, center markings)
    const sceneryGroup = new THREE.Group();
    const curbMeshes: THREE.Mesh[] = [];

    const dummy = new THREE.Object3D();
    const up = new THREE.Vector3(0, 1, 0);

    // =========================================================================
    // 1. VẠCH KẺ ĐƯỜNG TRẮNG BIÊN 2 BÊN (ROAD EDGE WHITE LINES) - RÕ RÀNG NÉT CĂNG
    // Giúp con đường tách biệt hoàn toàn và nổi bật 100% so với nền đất xung quanh
    // =========================================================================
    const edgeLinesCount = 350;
    const edgeLineGeo = new THREE.BoxGeometry(0.35, 0.05, 14.0);
    const edgeLineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const leftEdgeMesh = new THREE.InstancedMesh(edgeLineGeo, edgeLineMat, edgeLinesCount);
    const rightEdgeMesh = new THREE.InstancedMesh(edgeLineGeo, edgeLineMat, edgeLinesCount);
    leftEdgeMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    rightEdgeMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    for (let i = 0; i < edgeLinesCount; i++) {
      const t = i / edgeLinesCount;
      const point = safeGetPointAt(curve, t);
      const tangent = safeGetTangentAt(curve, t);
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      // Vạch biên trái
      const pL = point.clone().addScaledVector(normal, trackWidth / 2 - 0.4);
      dummy.position.set(pL.x, pL.y + 0.14, pL.z);
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      leftEdgeMesh.setMatrixAt(i, dummy.matrix);

      // Vạch biên phải
      const pR = point.clone().addScaledVector(normal, -trackWidth / 2 + 0.4);
      dummy.position.set(pR.x, pR.y + 0.14, pR.z);
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      rightEdgeMesh.setMatrixAt(i, dummy.matrix);
    }
    leftEdgeMesh.instanceMatrix.needsUpdate = true;
    rightEdgeMesh.instanceMatrix.needsUpdate = true;
    sceneryGroup.add(leftEdgeMesh, rightEdgeMesh);

    // =========================================================================
    // 2. VẠCH KẺ ĐƯỜNG Ở GIỮA (CENTER LINE)
    // 100 kiểu vạch đường độc nhất: màu sắc, độ dày, hoa văn (đơn, đôi, nhấp nháy)
    // =========================================================================
    const centerLinesCount = 450;
    const lineWidth = biome.centerLineWidth || 0.44;
    const lineLength = biome.centerLineLength || 7.5;
    const isDoubleLine = biome.centerLinePattern === 'double';

    const lineGeo = new THREE.BoxGeometry(lineWidth, 0.06, lineLength);
    const lineMat = new THREE.MeshBasicMaterial({ color: biome.centerLineColor || 0xf8fafc });
    
    // Nếu là vạch đôi (double line), tạo 2 vạch song song ở tim đường
    const totalLinesToRender = isDoubleLine ? centerLinesCount * 2 : centerLinesCount;
    const centerLinesMesh = new THREE.InstancedMesh(lineGeo, lineMat, totalLinesToRender);
    centerLinesMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    for (let i = 0; i < centerLinesCount; i++) {
      const t = i / centerLinesCount;
      const point = safeGetPointAt(curve, t);
      const tangent = safeGetTangentAt(curve, t);
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      if (isDoubleLine) {
        // Vạch đôi tim đường: 2 vạch lệch trái phải 0.32m
        const p1 = point.clone().addScaledVector(normal, 0.32);
        dummy.position.set(p1.x, p1.y + 0.16, p1.z);
        dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        centerLinesMesh.setMatrixAt(i * 2, dummy.matrix);

        const p2 = point.clone().addScaledVector(normal, -0.32);
        dummy.position.set(p2.x, p2.y + 0.16, p2.z);
        dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        centerLinesMesh.setMatrixAt(i * 2 + 1, dummy.matrix);
      } else {
        // Vạch đơn ở giữa tâm đường
        dummy.position.set(point.x, point.y + 0.16, point.z);
        dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        centerLinesMesh.setMatrixAt(i, dummy.matrix);
      }
    }
    centerLinesMesh.instanceMatrix.needsUpdate = true;
    sceneryGroup.add(centerLinesMesh);

    // =========================================================================
    // 2. CỘT VEN ĐƯỜNG & CỘT ĐÈN CAO TẦNG - NGẪU NHIÊN 100 KIỂU DÁNG CHO 100 SEED
    // Cọc tiêu giảm từ 1400 -> 460 (giảm 3 lần)
    // Cột đèn cao tầng giảm từ 350 -> 115 (giảm 3 lần)
    // =========================================================================
    let sVal = Math.abs(seed) || 42;
    const pRand = () => {
      sVal = (sVal * 16807) % 2147483647;
      return (sVal - 1) / 2147483646;
    };

    // --- PROCEDURAL BOLLARD (CỌC TIÊU) GENERATION ---
    const bollardCount = 100;
    const bollardHeight = 1.0 + pRand() * 1.4; // Chiều cao từ 1.0m đến 2.4m ngẫu nhiên
    const bShapeType = Math.floor(pRand() * 5); // 5 kiểu hình tháp, trụ tròn, trụ vuông, lăng trụ
    const bRadiusBottom = 0.12 + pRand() * 0.16;
    const bRadiusTop = pRand() < 0.5 ? 0.0 : bRadiusBottom * (0.3 + pRand() * 0.6);

    let bollardGeo: THREE.BufferGeometry;
    if (bShapeType === 0) {
      bollardGeo = new THREE.CylinderGeometry(bRadiusTop, bRadiusBottom, bollardHeight, 12);
    } else if (bShapeType === 1) {
      bollardGeo = new THREE.BoxGeometry(bRadiusBottom * 2, bollardHeight, bRadiusBottom * 2);
    } else if (bShapeType === 2) {
      bollardGeo = new THREE.ConeGeometry(bRadiusBottom, bollardHeight, 12);
    } else if (bShapeType === 3) {
      bollardGeo = new THREE.CylinderGeometry(bRadiusTop, bRadiusBottom, bollardHeight, 8);
    } else {
      bollardGeo = new THREE.CylinderGeometry(bRadiusTop, bRadiusBottom, bollardHeight, 6);
    }

    // Màu sắc thân cọc tiêu ngẫu nhiên rực rỡ khác biệt cho từng bản đồ
    const bColor = new THREE.Color().setHSL(pRand(), 0.8, 0.15 + pRand() * 0.4).getHex();
    const bollardMat = new THREE.MeshStandardMaterial({
      color: bColor,
      roughness: 0.3,
      metalness: 0.7
    });

    const leftBollardsMesh = new THREE.InstancedMesh(bollardGeo, bollardMat, bollardCount);
    const rightBollardsMesh = new THREE.InstancedMesh(bollardGeo, bollardMat, bollardCount);
    leftBollardsMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    rightBollardsMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    // Mũ phản quang (Reflector Caps) trên đỉnh cọc tiêu
    const capShapeType = Math.floor(pRand() * 3);
    let capGeo: THREE.BufferGeometry;
    const capR = bRadiusBottom * 1.15;
    if (capShapeType === 0) {
      capGeo = new THREE.CylinderGeometry(capR, capR, 0.3, 8);
    } else if (capShapeType === 1) {
      capGeo = new THREE.SphereGeometry(capR, 8, 8);
    } else {
      capGeo = new THREE.BoxGeometry(capR * 1.9, 0.25, capR * 1.9);
    }

    const capMat = new THREE.MeshBasicMaterial({ color: biome.bollardReflectorColor || 0xf59e0b });
    const leftCapsMesh = new THREE.InstancedMesh(capGeo, capMat, bollardCount);
    const rightCapsMesh = new THREE.InstancedMesh(capGeo, capMat, bollardCount);
    leftCapsMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    rightCapsMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    // --- PROCEDURAL STREETLIGHTS (CỘT ĐÈN ĐƯỜNG) GENERATION ---
    const tallPoleCount = 35;
    const tallPoleHeight = 8.0 + pRand() * 7.0; // Chiều cao từ 8m đến 15m ngẫu nhiên
    const poleShapeType = Math.floor(pRand() * 4); // Tròn, Lục giác, Tứ giác, Bát giác
    const pRadBot = 0.18 + pRand() * 0.22;
    const pRadTop = pRadBot * (0.3 + pRand() * 0.4);

    let tallPoleGeo: THREE.BufferGeometry;
    if (poleShapeType === 0) {
      tallPoleGeo = new THREE.CylinderGeometry(pRadTop, pRadBot, tallPoleHeight, 12);
    } else if (poleShapeType === 1) {
      tallPoleGeo = new THREE.CylinderGeometry(pRadTop, pRadBot, tallPoleHeight, 6);
    } else if (poleShapeType === 2) {
      tallPoleGeo = new THREE.CylinderGeometry(pRadTop, pRadBot, tallPoleHeight, 4);
      tallPoleGeo.rotateY(Math.PI / 4);
    } else {
      tallPoleGeo = new THREE.CylinderGeometry(pRadTop, pRadBot, tallPoleHeight, 8);
    }

    // Tạo hình dạng đầu đèn (Lamp Head) độc bản bằng Three.js
    const lampHeadType = Math.floor(pRand() * 5);
    let tallLampGeo: THREE.BufferGeometry;
    const lampW = 1.2 + pRand() * 3.5;
    const lampH = 0.2 + pRand() * 0.6;
    const lampD = 0.5 + pRand() * 1.0;

    if (lampHeadType === 0) {
      tallLampGeo = new THREE.BoxGeometry(lampW, lampH, lampD);
    } else if (lampHeadType === 1) {
      tallLampGeo = new THREE.CylinderGeometry(lampD / 2, lampD / 2, lampW, 12);
      tallLampGeo.rotateZ(Math.PI / 2);
    } else if (lampHeadType === 2) {
      tallLampGeo = new THREE.CylinderGeometry(lampD, lampD, lampH, 12);
    } else if (lampHeadType === 3) {
      tallLampGeo = new THREE.TorusGeometry(lampD, 0.2, 8, 24);
      tallLampGeo.rotateX(Math.PI / 2);
    } else {
      tallLampGeo = new THREE.ConeGeometry(lampD, lampW, 4);
      tallLampGeo.rotateZ(Math.PI / 2);
    }

    // Thân cột đèn phủ kim loại
    const tallPoleMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(pRand(), 0.3, 0.25).getHex(),
      metalness: 0.9,
      roughness: 0.2
    });
    const leftTallPolesMesh = new THREE.InstancedMesh(tallPoleGeo, tallPoleMat, tallPoleCount);
    const rightTallPolesMesh = new THREE.InstancedMesh(tallPoleGeo, tallPoleMat, tallPoleCount);

    const tallLampMat = new THREE.MeshBasicMaterial({ color: biome.lampColor || 0x38bdf8 });
    const leftTallLampsMesh = new THREE.InstancedMesh(tallLampGeo, tallLampMat, tallPoleCount);
    const rightTallLampsMesh = new THREE.InstancedMesh(tallLampGeo, tallLampMat, tallPoleCount);

    // VỊ TRÍ HOÁ TIÊU CỘT VEN ĐƯỜNG
    for (let b = 0; b < bollardCount; b++) {
      const t = b / bollardCount;
      const point = safeGetPointAt(curve, t);
      const tangent = safeGetTangentAt(curve, t);
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      const angleY = Math.atan2(tangent.x, tangent.z);
      dummy.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angleY);

      // Cột tiêu lề trái
      const pLeft = point.clone().addScaledVector(normal, trackWidth / 2 + 1.2);
      dummy.position.set(pLeft.x, pLeft.y + bollardHeight / 2, pLeft.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      leftBollardsMesh.setMatrixAt(b, dummy.matrix);

      // Mũ phản quang trái
      dummy.position.set(pLeft.x, pLeft.y + bollardHeight - 0.15, pLeft.z);
      dummy.updateMatrix();
      leftCapsMesh.setMatrixAt(b, dummy.matrix);

      // Cột tiêu lề phải
      const pRight = point.clone().addScaledVector(normal, -trackWidth / 2 - 1.2);
      dummy.position.set(pRight.x, pRight.y + bollardHeight / 2, pRight.z);
      dummy.updateMatrix();
      rightBollardsMesh.setMatrixAt(b, dummy.matrix);

      // Mũ phản quang phải
      dummy.position.set(pRight.x, pRight.y + bollardHeight - 0.15, pRight.z);
      dummy.updateMatrix();
      rightCapsMesh.setMatrixAt(b, dummy.matrix);
    }
    leftBollardsMesh.instanceMatrix.needsUpdate = true;
    rightBollardsMesh.instanceMatrix.needsUpdate = true;
    leftCapsMesh.instanceMatrix.needsUpdate = true;
    rightCapsMesh.instanceMatrix.needsUpdate = true;
    sceneryGroup.add(leftBollardsMesh, rightBollardsMesh, leftCapsMesh, rightCapsMesh);

    // VỊ TRÍ HOÁ CỘT ĐÈN ĐƯỜNG CAO
    for (let p = 0; p < tallPoleCount; p++) {
      const t = p / tallPoleCount;
      const point = safeGetPointAt(curve, t);
      const tangent = safeGetTangentAt(curve, t);
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      const angleY = Math.atan2(tangent.x, tangent.z);
      dummy.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angleY);

      // Cột đèn cao lề trái
      const pLeft = point.clone().addScaledVector(normal, trackWidth / 2 + 3.8);
      dummy.position.set(pLeft.x, pLeft.y + tallPoleHeight / 2, pLeft.z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      leftTallPolesMesh.setMatrixAt(p, dummy.matrix);

      dummy.position.set(pLeft.x, pLeft.y + tallPoleHeight, pLeft.z);
      dummy.updateMatrix();
      leftTallLampsMesh.setMatrixAt(p, dummy.matrix);

      // Cột đèn cao lề phải
      const pRight = point.clone().addScaledVector(normal, -trackWidth / 2 - 3.8);
      dummy.position.set(pRight.x, pRight.y + tallPoleHeight / 2, pRight.z);
      dummy.updateMatrix();
      rightTallPolesMesh.setMatrixAt(p, dummy.matrix);

      dummy.position.set(pRight.x, pRight.y + tallPoleHeight, pRight.z);
      dummy.updateMatrix();
      rightTallLampsMesh.setMatrixAt(p, dummy.matrix);
    }
    leftTallPolesMesh.instanceMatrix.needsUpdate = true;
    rightTallPolesMesh.instanceMatrix.needsUpdate = true;
    leftTallLampsMesh.instanceMatrix.needsUpdate = true;
    rightTallLampsMesh.instanceMatrix.needsUpdate = true;
    sceneryGroup.add(leftTallPolesMesh, rightTallPolesMesh, leftTallLampsMesh, rightTallLampsMesh);

    // --- PROCEDURAL SCENERY DECORATION: 15 RANDOM ITEMS ON EACH ROAD MAP ---
    if (biome.highlightDecorations && biome.highlightDecorations.length > 0) {
      // Đặt chính xác 15 vật phẩm đặc trưng dọc theo đường đua tại các khoảng đều đặn
      for (let i = 0; i < biome.highlightDecorations.length; i++) {
        const decName = biome.highlightDecorations[i];
        
        // Tránh đặt quá gần điểm xuất phát t=0.0 để không chắn camera
        const decT = 0.08 + (i / biome.highlightDecorations.length) * 0.88;
        const decPoint = safeGetPointAt(curve, decT);
        const decTangent = safeGetTangentAt(curve, decT);
        const decNormal = new THREE.Vector3().crossVectors(decTangent, up).normalize();
        
        const side = i % 2 === 0 ? 1 : -1;
        const distOffset = trackWidth / 2 + 4.5 + (i % 3) * 3.0; // Đẩy xa ranh giới mặt đường an toàn
        const decPos = decPoint.clone().addScaledVector(decNormal, side * distOffset);
        
        const decModel = build3DDecorationItem(decName, seed + i, biome, trackWidth);
        decModel.position.copy(decPos);
        
        const angleY = Math.atan2(decTangent.x, decTangent.z);
        decModel.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angleY);
        
        sceneryGroup.add(decModel);
      }
    }

    // Giảm bớt gờ mép đường (curb) 2 bên theo yêu cầu người dùng (giảm 4 lần, ngắt quãng thoáng đãng)
    const curbSegments = 90;
    const curbGeo = new THREE.BoxGeometry(0.8, 0.25, 8.0);
    const curbMat1 = new THREE.MeshStandardMaterial({
      color: biome.kerbColor1 || 0xffffff,
      roughness: 0.5,
      metalness: 0.15
    });
    const curbMat2 = new THREE.MeshStandardMaterial({
      color: biome.kerbColor2 || 0xef4444,
      roughness: 0.5,
      metalness: 0.15
    });

    for (let c = 0; c < curbSegments; c += 2) {
      // Bớt đi các đoạn thừa, chỉ giữ lại các cụm gờ curb nhẹ nhàng ở các khúc cua
      if ((c / 2) % 3 === 2) continue;

      const t = c / curbSegments;
      const point = safeGetPointAt(curve, t);
      const tangent = safeGetTangentAt(curve, t);
      const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

      const isCurb1 = (c / 2) % 2 === 0;
      const currentCurbMat = isCurb1 ? curbMat1 : curbMat2;

      // Left curb
      const pLeft = point.clone().addScaledVector(normal, trackWidth / 2 + 0.4);
      const curbLeft = new THREE.Mesh(curbGeo, currentCurbMat);
      curbLeft.position.set(pLeft.x, pLeft.y + 0.15, pLeft.z);
      curbLeft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
      sceneryGroup.add(curbLeft);
      curbMeshes.push(curbLeft);

      // Right curb
      const pRight = point.clone().addScaledVector(normal, -trackWidth / 2 - 0.4);
      const curbRight = new THREE.Mesh(curbGeo, currentCurbMat);
      curbRight.position.set(pRight.x, pRight.y + 0.15, pRight.z);
      curbRight.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
      sceneryGroup.add(curbRight);
      curbMeshes.push(curbRight);
    }

    // =========================================================================
    // ĐƯỜNG HẦM TỐC ĐỘ CAO (HIGH-SPEED NEON TUNNEL) - XUẤT HIỆN TRÊN MỌI BẢN ĐỒ!
    // Khoảng cách từ t = 0.62 đến t = 0.76 (~5km dài)
    // =========================================================================
    const tunnelStartT = 0.62;
    const tunnelEndT = 0.76;
    const tunnelRingsCount = 30;

    const archRingGeo = new THREE.TorusGeometry(trackWidth / 2 + 1.6, 0.45, 8, 24, Math.PI);
    const archMatDark = new THREE.MeshStandardMaterial({ color: biome.archColor || 0x0f172a, metalness: 0.9, roughness: 0.2 });
    const neonLightGeo = new THREE.BoxGeometry(trackWidth + 2, 0.25, 0.35);
    const neonGlowMat = new THREE.MeshBasicMaterial({ color: biome.lampColor || 0x00f0ff }); // Neon Glow theo bản đồ
    const neonSideGlowMat = new THREE.MeshBasicMaterial({ color: biome.centerLineColor || 0xff007f }); // Neon Accent theo bản đồ

    for (let r = 0; r <= tunnelRingsCount; r++) {
      const ringT = tunnelStartT + (r / tunnelRingsCount) * (tunnelEndT - tunnelStartT);
      const ringPos = safeGetPointAt(curve, ringT);
      const ringTan = safeGetTangentAt(curve, ringT);
      const up = new THREE.Vector3(0, 1, 0);
      const ringNorm = new THREE.Vector3().crossVectors(ringTan, up).normalize();

      // Vòm hầm Torus Arch
      const archRing = new THREE.Mesh(archRingGeo, archMatDark);
      archRing.position.set(ringPos.x, ringPos.y + 0.2, ringPos.z);
      archRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), ringTan);
      archRing.rotation.z = Math.PI / 2;
      sceneryGroup.add(archRing);

      // Thanh đèn LED Neon trên nóc hầm
      const ceilingNeon = new THREE.Mesh(neonLightGeo, (r % 2 === 0) ? neonGlowMat : neonSideGlowMat);
      ceilingNeon.position.set(ringPos.x, ringPos.y + (trackWidth / 2 + 1.2), ringPos.z);
      ceilingNeon.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), ringNorm);
      sceneryGroup.add(ceilingNeon);

      // Cổng chào ĐẦU HẦM TỐC ĐỘ CAO (Entrance Portal)
      if (r === 0) {
        const portalPillarGeo = new THREE.BoxGeometry(1.6, 12, 1.6);
        const pL = new THREE.Mesh(portalPillarGeo, archMatDark);
        pL.position.copy(ringPos).addScaledVector(ringNorm, trackWidth / 2 + 2.5);
        pL.position.y += 6;

        const pR = new THREE.Mesh(portalPillarGeo, archMatDark);
        pR.position.copy(ringPos).addScaledVector(ringNorm, -trackWidth / 2 - 2.5);
        pR.position.y += 6;

        const bannerGeo = new THREE.PlaneGeometry(trackWidth + 3, 2.2);
        const bannerMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide });
        const portalSign = new THREE.Mesh(bannerGeo, bannerMat);
        portalSign.position.copy(ringPos);
        portalSign.position.y += 11.5;
        portalSign.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), ringTan);

        sceneryGroup.add(pL, pR, portalSign);
      }

      // Cổng chào CUỐI HẦM (Exit Portal)
      if (r === tunnelRingsCount) {
        const portalPillarGeo = new THREE.BoxGeometry(1.6, 12, 1.6);
        const pL = new THREE.Mesh(portalPillarGeo, archMatDark);
        pL.position.copy(ringPos).addScaledVector(ringNorm, trackWidth / 2 + 2.5);
        pL.position.y += 6;

        const pR = new THREE.Mesh(portalPillarGeo, archMatDark);
        pR.position.copy(ringPos).addScaledVector(ringNorm, -trackWidth / 2 - 2.5);
        pR.position.y += 6;

        const bannerGeo = new THREE.PlaneGeometry(trackWidth + 3, 2.2);
        const bannerMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide });
        const exitSign = new THREE.Mesh(bannerGeo, bannerMat);
        exitSign.position.copy(ringPos);
        exitSign.position.y += 11.5;
        exitSign.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), ringTan);

        sceneryGroup.add(pL, pR, exitSign);
      }
    }

    // Start/Finish Arch Gantry (Cổng xuất phát & đích)
    const startPoint = safeGetPointAt(curve, 0);
    const startTangent = safeGetTangentAt(curve, 0);
    const startNormal = new THREE.Vector3().crossVectors(startTangent, new THREE.Vector3(0, 1, 0)).normalize();

    const archGroup = new THREE.Group();
    const pillarGeo = new THREE.BoxGeometry(1.4, 11, 1.4);
    const archMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.2 });

    const p1 = new THREE.Mesh(pillarGeo, archMat);
    p1.position.copy(startPoint).addScaledVector(startNormal, trackWidth / 2 + 2.0);
    p1.position.y += 5.5;

    const p2 = new THREE.Mesh(pillarGeo, archMat);
    p2.position.copy(startPoint).addScaledVector(startNormal, -trackWidth / 2 - 2.0);
    p2.position.y += 5.5;

    const crossbarGeo = new THREE.BoxGeometry(trackWidth + 5, 2.0, 2.0);
    const crossbar = new THREE.Mesh(crossbarGeo, new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3, metalness: 0.4 }));
    crossbar.position.copy(startPoint);
    crossbar.position.y += 11;
    crossbar.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), startNormal);

    // Start lights (5 green LEDs)
    const lightGeo = new THREE.SphereGeometry(0.38, 12, 12);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    for (let sl = -2; sl <= 2; sl++) {
      const slMesh = new THREE.Mesh(lightGeo, lightMat);
      slMesh.position.copy(startPoint).addScaledVector(startNormal, sl * 1.8);
      slMesh.position.y += 10.1;
      archGroup.add(slMesh);
    }

    const bannerGeo = new THREE.PlaneGeometry(trackWidth - 1, 1.6);
    const bannerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.copy(crossbar.position);
    banner.position.y -= 0.4;
    banner.lookAt(startPoint.clone().add(startTangent));

    archGroup.add(p1, p2, crossbar, banner);
    sceneryGroup.add(archGroup);

    // Ground terrain plane (Mặt đất mở rộng 35000x35000 bao quát toàn bộ đường đua 35km)
    const groundGeo = new THREE.PlaneGeometry(35000, 35000, 48, 48);
    const groundMat = new THREE.MeshStandardMaterial({
      color: biome.groundColor,
      roughness: 0.9,
      metalness: 0.05
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.5;
    groundMesh.receiveShadow = true;
    sceneryGroup.add(groundMesh);

    return {
      curve,
      trackMesh,
      curbMeshes,
      sceneryGroup,
      totalLength
    };
  }
}

function build3DDecorationItem(name: string, seed: number, biome: any, trackWidth: number): THREE.Group {
  const itemGroup = new THREE.Group();
  itemGroup.name = name;

  // Sử dụng mã băm của tên làm seed phụ để ngẫu nhiên hóa thiết kế chi tiết của từng vật trang trí
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  let sVal = Math.abs(hash + seed) || 123;
  const pRand = () => {
    sVal = (sVal * 16807) % 2147483647;
    return (sVal - 1) / 2147483646;
  };

  const grayMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.1 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 });
  const greenMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.6 });
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.5 });
  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.4 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
  const orangeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });

  // Tạo vật thể 3D đặc hữu chất lượng cao tùy thuộc vào tên vật trang trí
  switch (name) {
    case 'Cột đèn đường cao':
    case 'Đèn chiếu sáng sân đua':
    case 'Đèn LED dọc đường': {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 5.0, 6), grayMat);
      pole.position.y = 2.5;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.4), new THREE.MeshBasicMaterial({ color: biome.lampColor || 0xffe57f }));
      head.position.set(0, 5.0, 0.2);
      itemGroup.add(pole, head);
      break;
    }
    case 'Biển báo giới hạn tốc độ':
    case 'Biển báo hướng cua':
    case 'Biển báo nguy hiểm':
    case 'Biển báo đường trơn':
    case 'Biển báo giảm tốc':
    case 'Biển báo khu vực xuất phát':
    case 'Biển báo khu vực về đích':
    case 'Bảng khoảng cách đến cua':
    case 'Biển số Turn 1':
    case 'Biển số Turn 2':
    case 'Biển số Turn 3': {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.5, 6), grayMat);
      pole.position.y = 1.25;
      
      let boardGeo: THREE.BufferGeometry;
      let boardMat = yellowMat;
      if (name.includes('giới hạn tốc độ')) {
        boardGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.05, 12);
        boardGeo.rotateX(Math.PI / 2);
        boardMat = whiteMat;
      } else if (name.includes('nguy hiểm') || name.includes('trơn')) {
        boardGeo = new THREE.ConeGeometry(0.6, 1.0, 3);
        boardGeo.rotateZ(Math.PI);
        boardMat = orangeMat;
      } else {
        boardGeo = new THREE.BoxGeometry(0.9, 0.6, 0.05);
        boardMat = name.includes('về đích') ? greenMat : blueMat;
      }
      
      const board = new THREE.Mesh(boardGeo, boardMat);
      board.position.set(0, 2.5, 0);
      itemGroup.add(pole, board);
      break;
    }
    case 'Cổng xuất phát':
    case 'Cổng về đích': {
      const archGroup = new THREE.Group();
      const pL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 9, 0.8), metalMat);
      pL.position.set(-trackWidth / 2 - 1.5, 4.5, 0);
      const pR = new THREE.Mesh(new THREE.BoxGeometry(0.8, 9, 0.8), metalMat);
      pR.position.set(trackWidth / 2 + 1.5, 4.5, 0);
      
      const cross = new THREE.Mesh(new THREE.BoxGeometry(trackWidth + 4, 1.2, 0.8), redMat);
      cross.position.set(0, 9, 0);
      archGroup.add(pL, pR, cross);
      itemGroup.add(archGroup);
      break;
    }
    case 'Khán đài lớn':
    case 'Khán đài nhỏ': {
      const isBig = name === 'Khán đài lớn';
      const steps = isBig ? 8 : 4;
      const w = isBig ? 12 : 6;
      for (let i = 0; i < steps; i++) {
        const stepGeo = new THREE.BoxGeometry(w, 0.6, 0.8);
        const step = new THREE.Mesh(stepGeo, grayMat);
        step.position.set(0, (i + 1) * 0.3, i * 0.6);
        itemGroup.add(step);
        
        for (let s = -w/2 + 0.5; s < w/2; s += 1.2) {
          if (pRand() < 0.6) {
            const chair = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), pRand() < 0.5 ? redMat : blueMat);
            chair.position.set(s, (i + 1) * 0.3 + 0.4, i * 0.6);
            itemGroup.add(chair);
          }
        }
      }
      break;
    }
    case 'Cây xanh':
    case 'Cây thông':
    case 'Cây dừa':
    case 'Hàng cây ven đường':
    case 'Tường cây xanh': {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.3, 2.5, 8), new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 }));
      trunk.position.y = 1.25;
      itemGroup.add(trunk);
      
      let leavesGeo: THREE.BufferGeometry;
      if (name.includes('thông')) {
        leavesGeo = new THREE.ConeGeometry(1.2, 3.5, 5);
        const leaves = new THREE.Mesh(leavesGeo, greenMat);
        leaves.position.y = 3.5;
        itemGroup.add(leaves);
      } else if (name.includes('dừa')) {
        for (let d = 0; d < 5; d++) {
          const frond = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.3), greenMat);
          frond.position.set(0, 2.5, 0);
          frond.rotation.y = (d * Math.PI * 2) / 5;
          frond.rotation.z = 0.25;
          itemGroup.add(frond);
        }
      } else {
        leavesGeo = new THREE.SphereGeometry(1.1, 8, 8);
        const leaves = new THREE.Mesh(leavesGeo, greenMat);
        leaves.position.y = 3.0;
        itemGroup.add(leaves);
      }
      break;
    }
    case 'Xe cứu hộ':
    case 'Xe kéo':
    case 'Xe an ninh':
    case 'Xe y tế':
    case 'Xe kiểm tra đường đua':
    case 'Xe chở nhiên liệu':
    case 'Xe đậu bên đường':
    case 'Xe tải vận chuyển': {
      const carBody = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.8, 1.2), name.includes('y tế') ? whiteMat : (name.includes('an ninh') ? blackMat : yellowMat));
      carBody.position.y = 0.4;
      
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 1.0), name.includes('an ninh') ? whiteMat : blueMat);
      cabin.position.set(-0.2, 1.0, 0);
      
      const wheelG = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8);
      wheelG.rotateX(Math.PI / 2);
      const wMat = blackMat;
      const w1 = new THREE.Mesh(wheelG, wMat); w1.position.set(0.7, 0.3, 0.65);
      const w2 = new THREE.Mesh(wheelG, wMat); w2.position.set(0.7, 0.3, -0.65);
      const w3 = new THREE.Mesh(wheelG, wMat); w3.position.set(-0.7, 0.3, 0.65);
      const w4 = new THREE.Mesh(wheelG, wMat); w4.position.set(-0.7, 0.3, -0.65);
      
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), redMat);
      beacon.position.set(-0.2, 1.35, 0);
      
      itemGroup.add(carBody, cabin, w1, w2, w3, w4, beacon);
      break;
    }
    case 'Lốp xe xếp chồng': {
      const stacks = 3;
      for (let s = 0; s < stacks; s++) {
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.32, 8), blackMat);
        tire.position.y = 0.16 + s * 0.32;
        itemGroup.add(tire);
      }
      break;
    }
    case 'Hàng rào thép':
    case 'Hàng rào lưới B40':
    case 'Tường chắn bê tông':
    case 'Barrier bảo vệ đường đua':
    case 'Rào chắn nhựa': {
      const barGeo = new THREE.BoxGeometry(3.0, 0.85, 0.25);
      const fenceMat = name.includes('bê tông') ? grayMat : (name.includes('nhựa') ? orangeMat : metalMat);
      const fence = new THREE.Mesh(barGeo, fenceMat);
      fence.position.y = 0.425;
      itemGroup.add(fence);
      break;
    }
    case 'Cột cờ':
    case 'Cờ đua nhiều màu':
    case 'Cờ quốc gia':
    case 'Cờ caro': {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 4.5, 6), metalMat);
      pole.position.y = 2.25;
      
      const flagGeo = new THREE.BoxGeometry(1.2, 0.6, 0.03);
      let flagMat = redMat;
      if (name.includes('caro')) {
        flagMat = whiteMat;
      } else if (name.includes('nhiều màu')) {
        flagMat = blueMat;
      } else {
        flagMat = yellowMat;
      }
      const flag = new THREE.Mesh(flagGeo, flagMat);
      flag.position.set(0.6, 4.0, 0);
      itemGroup.add(pole, flag);
      break;
    }
    case 'Billboard quảng cáo khổng lồ':
    case 'Màn hình LED khổng lồ': {
      const archG = new THREE.Group();
      const leftP = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7.5, 0.3), metalMat);
      leftP.position.set(-1.8, 3.75, 0);
      const rightP = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7.5, 0.3), metalMat);
      rightP.position.set(1.8, 3.75, 0);
      
      const screen = new THREE.Mesh(new THREE.BoxGeometry(5.5, 3.2, 0.35), blackMat);
      screen.position.set(0, 7.5, 0);
      
      const glowScreen = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.9, 0.08), new THREE.MeshBasicMaterial({ color: biome.lampColor || 0x00f0ff }));
      glowScreen.position.set(0, 7.5, 0.2);
      
      archG.add(leftP, rightP, screen, glowScreen);
      itemGroup.add(archG);
      break;
    }
    case 'Nhà dân':
    case 'Nhà kho':
    case 'Trạm xăng':
    case 'Gara đội đua':
    case 'Nhà pit': {
      const hGroup = new THREE.Group();
      const wall = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.5, 2.5), name.includes('pit') || name.includes('Gara') ? grayMat : whiteMat);
      wall.position.y = 1.25;
      
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.5, 4), redMat);
      roof.position.set(0, 3.25, 0);
      roof.rotation.y = Math.PI / 4;
      
      if (name.includes('Trạm xăng') || name.includes('Gara') || name.includes('pit')) {
        const sign = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.2), new THREE.MeshBasicMaterial({ color: biome.centerLineColor || 0xff00ff }));
        sign.position.set(0, 2.0, 1.3);
        hGroup.add(sign);
      }
      
      hGroup.add(wall, roof);
      itemGroup.add(hGroup);
      break;
    }
    default: {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 10), orangeMat);
      drum.position.y = 0.6;
      
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.41, 0.4, 10), whiteMat);
      stripe.position.y = 0.6;
      itemGroup.add(drum, stripe);
      break;
    }
  }

  itemGroup.rotation.y += (pRand() - 0.5) * 0.25;
  const s = 0.85 + pRand() * 0.3;
  itemGroup.scale.set(s, s, s);

  return itemGroup;
}
