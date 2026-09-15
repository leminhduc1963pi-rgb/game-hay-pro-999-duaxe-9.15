import * as THREE from 'three';
import { AICarState } from '../types';
import { safeGetPointAt, safeGetTangentAt, getSafeCurveU } from './curveUtils';
import { carModelManager } from './carModelManager';

// Pre-allocated reusable Three.js objects to prevent garbage collection spikes in the render loop
const _upVec = new THREE.Vector3(0, 1, 0);
const _rightVec = new THREE.Vector3();
const _binormalVec = new THREE.Vector3();
const _finalPos = new THREE.Vector3();
const _centerPos = new THREE.Vector3();
const _tangentVec = new THREE.Vector3();
const _mat = new THREE.Matrix4();
const _rotAxisY = new THREE.Vector3(0, 1, 0);
const _targetQuat = new THREE.Quaternion();
const _driftQuat = new THREE.Quaternion();

export interface Car3DObject {
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  wheels: THREE.Mesh[];
  headlights: THREE.Mesh[];
  taillights: THREE.Mesh[];
  exhaustPuffs: THREE.Points;
  state: AICarState;
}

export class VehiclePhysicsSystem {
  private static flameTexture: THREE.Texture | null = null;

  static createFlameTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.2, 'rgba(255, 210, 0, 1)');
      grad.addColorStop(0.45, 'rgba(255, 55, 0, 0.8)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 32, 32);
    }
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  static getFlameTexture(): THREE.Texture {
    if (!this.flameTexture) {
      this.flameTexture = this.createFlameTexture();
    }
    return this.flameTexture;
  }

  /**
   * Builds an aerodynamic 3D racing car model
   */
  static createCarMesh(state: AICarState): Car3DObject {
    const group = new THREE.Group();

    // Car Body Material
    const bodyMat = new THREE.MeshStandardMaterial({
      color: state.hexColor,
      metalness: 0.85,
      roughness: 0.25,
    });

    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x111116,
      metalness: 0.5,
      roughness: 0.6,
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x050b14,
      metalness: 0.9,
      roughness: 0.1,
      transmission: 0.6,
      transparent: true,
      opacity: 0.85,
    });

    // 1. Lower Chassis
    const chassisGeo = new THREE.BoxGeometry(1.5, 0.38, 3.3);
    const chassisMesh = new THREE.Mesh(chassisGeo, bodyMat);
    chassisMesh.position.y = 0.4;
    group.add(chassisMesh);

    // 2. Cockpit / Cabin
    const cabinGeo = new THREE.BoxGeometry(1.2, 0.45, 1.6);
    const cabinMesh = new THREE.Mesh(cabinGeo, glassMat);
    cabinMesh.position.set(0, 0.72, -0.15);
    group.add(cabinMesh);

    // 3. Hood slope
    const hoodGeo = new THREE.BoxGeometry(1.4, 0.2, 1.0);
    const hoodMesh = new THREE.Mesh(hoodGeo, bodyMat);
    hoodMesh.position.set(0, 0.5, 0.95);
    hoodMesh.rotation.x = 0.1;
    group.add(hoodMesh);

    // 4. Rear Wing / Spoiler
    const wingPillarGeo = new THREE.BoxGeometry(0.08, 0.4, 0.15);
    const pLeft = new THREE.Mesh(wingPillarGeo, carbonMat);
    pLeft.position.set(0.5, 0.75, -1.35);
    const pRight = new THREE.Mesh(wingPillarGeo, carbonMat);
    pRight.position.set(-0.5, 0.75, -1.35);

    const wingBladeGeo = new THREE.BoxGeometry(1.5, 0.06, 0.35);
    const wingBlade = new THREE.Mesh(wingBladeGeo, carbonMat);
    wingBlade.position.set(0, 0.95, -1.35);
    group.add(pLeft, pRight, wingBlade);

    // 5. Headlights
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xeeffff });
    const headlightGeo = new THREE.BoxGeometry(0.25, 0.1, 0.08);
    const hl1 = new THREE.Mesh(headlightGeo, lightMat);
    hl1.position.set(0.55, 0.45, 1.65);
    const hl2 = new THREE.Mesh(headlightGeo, lightMat);
    hl2.position.set(-0.55, 0.45, 1.65);
    group.add(hl1, hl2);

    // 6. Taillights (Red LED bar - High Emissive Standard Material)
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0xff0033,
      emissive: 0xff0000,
      emissiveIntensity: 3.5,
      roughness: 0.1,
      metalness: 0.9
    });
    const tailGeo = new THREE.BoxGeometry(1.4, 0.09, 0.08);
    const tailMesh = new THREE.Mesh(tailGeo, tailMat);
    tailMesh.position.set(0, 0.5, -1.65);
    group.add(tailMesh);

    // 7. Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.28, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.8,
      metalness: 0.2
    });

    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xdddddd,
      metalness: 0.9,
      roughness: 0.2
    });

    const wheels: THREE.Mesh[] = [];
    const wheelPositions = [
      [-0.75, 0.35, 0.95],  // Front Left
      [0.75, 0.35, 0.95],   // Front Right
      [-0.75, 0.35, -0.95], // Rear Left
      [0.75, 0.35, -0.95],  // Rear Right
    ];

    wheelPositions.forEach(([x, y, z]) => {
      const tire = new THREE.Mesh(wheelGeo, wheelMat);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.29, 8), rimMat);
      rim.rotateZ(Math.PI / 2);
      tire.add(rim);
      tire.position.set(x, y, z);
      group.add(tire);
      wheels.push(tire);
    });

    // 8. Nitro / Exhaust Trail Particle System (Procedural glowing spheres with additive blending)
    // Add two beautiful glowing blue LED lights on the sides, and 1 central flame-throwing nozzle
    const blueLedGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const blueLedMat = new THREE.MeshStandardMaterial({
      color: 0x00d2ff,
      emissive: 0x0078ff,
      emissiveIntensity: 6.0,
      roughness: 0.1,
      metalness: 0.9
    });
    const leftExhaustLed = new THREE.Mesh(blueLedGeo, blueLedMat);
    leftExhaustLed.position.set(-0.4, 0.25, -1.65);
    const rightExhaustLed = new THREE.Mesh(blueLedGeo, blueLedMat);
    rightExhaustLed.position.set(0.4, 0.25, -1.65);
    group.add(leftExhaustLed, rightExhaustLed);

    const particleCount = 18;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i++) pPos[i] = 0;
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.45,
      map: VehiclePhysicsSystem.getFlameTexture(),
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const exhaustPuffs = new THREE.Points(pGeo, pMat);
    exhaustPuffs.position.set(0, 0.25, -1.7); // Placed at center
    group.add(exhaustPuffs);

    group.castShadow = true;
    group.receiveShadow = true;

    const carObj: Car3DObject = {
      group,
      bodyMesh: chassisMesh,
      wheels,
      headlights: [hl1, hl2],
      taillights: [tailMesh],
      exhaustPuffs,
      state
    };

    // Attach authentic high-fidelity 3D car model from xedep.usdz (Model index 0-7)
    const placeholders: THREE.Object3D[] = [
      chassisMesh,
      cabinMesh,
      hoodMesh,
      pLeft,
      pRight,
      wingBlade,
      hl1,
      hl2,
      tailMesh,
      ...wheels
    ];
    carModelManager.attachCarVisual(carObj, state.meshIndex ?? 0, placeholders);

    return carObj;
  }

  /**
   * Updates AI Vehicle steering, throttle, overtaking logic, and position on track
   */
  static updateVehicles(
    cars: Car3DObject[],
    curve: THREE.CatmullRomCurve3,
    totalLength: number,
    delta: number,
    globalAggression: number
  ): { activeOvertakeCarId: string | null; collisionCarId: string | null } {
    let activeOvertakeCarId: string | null = null;
    let collisionCarId: string | null = null;

    const trackWidth = 12.0;

    // Step 1: Update AI decisions for each car
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      const s = car.state;

      // Ensure s.lapProgress is valid finite number
      if (typeof s.lapProgress !== 'number' || isNaN(s.lapProgress) || !isFinite(s.lapProgress)) {
        s.lapProgress = 0;
      }
      s.lapProgress = ((s.lapProgress % 1.0) + 1.0) % 1.0;

      // Track curvature & turning direction ahead to adapt speed and drift physics accurately
      const lookAheadT = getSafeCurveU(s.lapProgress + 0.015);
      const currentTangent = safeGetTangentAt(curve, s.lapProgress);
      const aheadTangent = safeGetTangentAt(curve, lookAheadT);
      const upVec = new THREE.Vector3(0, 1, 0);
      const trackNormal = new THREE.Vector3().crossVectors(currentTangent, upVec).normalize();
      
      // turnCurl: > 0 means track turns LEFT (towards normal), < 0 means track turns RIGHT
      const turnCurl = aheadTangent.dot(trackNormal);
      const curveAngle = Math.abs(currentTangent.angleTo(aheadTangent)) || 0;

      // 5 Làn đua linh hoạt trên mặt đường rộng 12-15m (Far Left, Mid Left, Center, Mid Right, Far Right)
      const AVAILABLE_LANES = [-0.68, -0.34, 0.0, 0.34, 0.68];

      // Khởi tạo thuộc tính riêng cho từng xe nếu chưa có (đảm bảo các xe tốc độ không được giống nhau)
      if (!s.baseCruiseSpeed) {
        const carBias = (((i * 23 + (s.hexColor % 31)) % 40) - 20); // độ lệch -20 đến +20 km/h
        s.baseCruiseSpeed = 500 + carBias; // Tốc độ hành trình riêng mỗi xe: 480 - 520 km/h (trung bình ~500 km/h)
      }
      if (!s.targetPullAwayGoal) {
        s.targetPullAwayGoal = 320 + Math.random() * 180; // Mục tiêu bứt xa 300 đến 500 mét!
        s.overtakePullAwayDist = 0;
      }
      if (s.cooldownTimer === undefined) s.cooldownTimer = 0;
      if (s.attackPhaseTimer === undefined) s.attackPhaseTimer = 1.0 + Math.random() * 3.0;

      // Giảm timer đổi làn và timer hồi Nitro / Tấn công / Hạ nhiệt
      s.laneChangeTimer = (s.laneChangeTimer ?? 1.5) - delta;
      s.nitroBoostTimer = (s.nitroBoostTimer ?? 0) - delta;
      s.nitroCooldown = (s.nitroCooldown ?? 0) - delta;
      s.attackPhaseTimer -= delta;
      if (s.cooldownTimer > 0) {
        s.cooldownTimer -= delta;
      }

      const isLeader = s.rank === 1;

      // Quét tất cả các đối thủ xung quanh: phía trước, phía sau, và mật độ từng làn đường
      let carAheadDist = 9999;
      let carAheadLateral = 0;
      let carAheadSpeed = 500;
      let carAheadId = '';

      let carBehindDist = 9999;
      let carBehindSpeed = 500;

      // Kiểm tra làn hiện tại có bị xe chắn ngay trước mũi không
      let isDirectlyBlockedAhead = false;
      const laneDistances: { [laneIdx: number]: number } = { 0: 9999, 1: 9999, 2: 9999, 3: 9999, 4: 9999 };

      for (let j = 0; j < cars.length; j++) {
        if (i === j) continue;
        const other = cars[j].state;
        let distAlong = (other.lapProgress - s.lapProgress);
        if (distAlong < -0.5) distAlong += 1.0;
        if (distAlong > 0.5) distAlong -= 1.0;
        const worldDist = distAlong * totalLength;

        // Xe ở phía trước
        if (worldDist > 0 && worldDist < 500) {
          if (worldDist < carAheadDist) {
            carAheadDist = worldDist;
            carAheadLateral = other.lateralOffset;
            carAheadSpeed = other.speed;
            carAheadId = other.id;
          }

          // Kiểm tra xem xe này đang chiếm làn nào trong 5 làn
          for (let l = 0; l < AVAILABLE_LANES.length; l++) {
            if (Math.abs(other.lateralOffset - AVAILABLE_LANES[l]) < 0.22) {
              if (worldDist < laneDistances[l]) {
                laneDistances[l] = worldDist;
              }
            }
          }

          // Nếu có xe cùng làn ngay trước mặt dưới 32 mét -> Bị chắn đường!
          if (Math.abs(s.lateralOffset - other.lateralOffset) < 0.28 && worldDist < 32) {
            isDirectlyBlockedAhead = true;
          }
        }

        // Xe bám đuổi ở phía sau
        if (worldDist < 0 && worldDist > -120) {
          const absBehindDist = Math.abs(worldDist);
          if (absBehindDist < carBehindDist) {
            carBehindDist = absBehindDist;
            carBehindSpeed = other.speed;
          }
        }
      }

      // =========================================================================
      // 1. TỐC ĐỘ 400 - 600 KM/H, TRUNG BÌNH ~500 KM/H, MAX 650 KM/H
      // CƠ CHẾ VƯỢT NHAU KHỐC LIỆT GẤP 10 LẦN & BỨT XA 300 ĐẾN 500 MÉT
      // =========================================================================
      let isHyperBoosting = false;

      // Kiểm tra xem xe có đang trong giai đoạn bứt phá vượt mặt (kéo giãn 300 - 500m) không
      const isPullingAway = (s.overtakePullAwayDist ?? 0) > 0;

      if (isPullingAway) {
        // XE ĐANG DUY TRÌ BỨT XA 300 - 500 MÉT:
        isHyperBoosting = true;
        // Duy trì tốc độ cực hạn 590 - 645 km/h (tối đa 650 km/h)
        s.targetSpeed = Math.min(650, 600 + (s.aggression * 40) + Math.sin(s.lapProgress * 25 + i) * 8);

        // Tích lũy khoảng cách bứt xa so với tốc độ đoàn xe trung bình (~460 km/h)
        const pullSpeedMps = Math.max(30, (s.speed - 450) * (1000 / 3600));
        s.overtakePullAwayDist = (s.overtakePullAwayDist ?? 0) + pullSpeedMps * delta;

        // Khi đã bứt xa đủ 300 đến 500 mét theo mục tiêu đã định:
        if (s.overtakePullAwayDist >= (s.targetPullAwayGoal ?? 400)) {
          // Hoàn thành đợt bứt phá! Nhường cơ hội cho xe khác vượt lên
          s.overtakePullAwayDist = 0;
          s.targetPullAwayGoal = 300 + Math.random() * 200; // Reset mục tiêu 300 - 500m cho lần tới
          s.isHyperBoosting = false;
          s.nitroBoostTimer = 0;
          s.nitroCooldown = 4.0 + Math.random() * 3.0;
          s.cooldownTimer = 3.0 + Math.random() * 2.5; // Hạ nhiệt động cơ: giảm tốc để xe sau vượt lên!
        }
      } else if (s.cooldownTimer > 0) {
        // GIAI ĐOẠN HẠ NHIỆT / GIẢM TỐC: Không phải lúc nào cũng chạy max 600, giảm xuống 400 - 450 km/h
        // để xe khác bứt tốc vượt lên, tạo ra các cuộc rượt đuổi và so kè liên tục
        isHyperBoosting = false;
        const dipSpeed = 410 + ((i * 11) % 35) + Math.sin(s.lapProgress * 18 + i) * 12;
        s.targetSpeed = Math.max(400, Math.min(455, dipSpeed));
      } else {
        // GIAI ĐOẠN SĂN ĐUỔI HOẶC KÍCH HOẠT ĐỢT VƯỢT MẶT MỚI:
        // Xe có xe phía trước trong 85m HOẶC timer săn đuổi kích hoạt: BÙNG NỔ BỨT TỐC!
        const wantsToOvertake = (carAheadDist < 85 && s.nitroCooldown <= 0) || (s.attackPhaseTimer <= 0 && s.nitroCooldown <= 0);

        if (wantsToOvertake) {
          // Kích hoạt chu kỳ bứt phá vượt mặt khốc liệt kéo dài 300 - 500 mét!
          isHyperBoosting = true;
          s.nitroBoostTimer = 3.5 + Math.random() * 2.0;
          s.overtakePullAwayDist = 1.0; // Khởi động hành trình bứt xa 300 - 500m
          s.targetPullAwayGoal = 300 + Math.random() * 200; // 300 đến 500 mét!
          s.attackPhaseTimer = 5.0 + Math.random() * 4.0;
          s.targetSpeed = Math.min(650, 605 + (s.aggression * 40));
        } else if (s.nitroBoostTimer > 0) {
          isHyperBoosting = true;
          s.targetSpeed = Math.min(650, 595 + (s.aggression * 45));
        } else if (carAheadDist < 120) {
          // Núp gió khí động học (Slipstream / DRS): tăng tốc lên 520 - 565 km/h để áp sát
          s.targetSpeed = Math.min(570, Math.max(515, carAheadSpeed + 35));
        } else {
          // Tốc độ hành trình tự nhiên: Dao động ngẫu nhiên quanh 475 - 530 km/h (trung bình ~500 km/h)
          const cornerSpeedFactor = Math.max(0.92, 1.0 - curveAngle * 0.14);
          const naturalVariation = Math.sin(s.lapProgress * 28 + i * 2.5) * 22;
          s.targetSpeed = ((s.baseCruiseSpeed ?? 500) + naturalVariation) * cornerSpeedFactor;
        }
      }

      s.isHyperBoosting = isHyperBoosting;

      // Khống chế nghiêm ngặt khoảng tốc độ: Tối thiểu 400 km/h, tối đa 650 km/h
      s.targetSpeed = Math.max(400, Math.min(650, s.targetSpeed));

      // Gia tốc mượt mà, phản hồi chân thực không giật cục:
      if (s.speed < s.targetSpeed) {
        const accelRate = isHyperBoosting ? (90.0 + s.aggression * 30.0) : (45.0 + s.acceleration * 5.0);
        s.speed = Math.min(s.targetSpeed, s.speed + accelRate * delta);
      } else if (s.speed > s.targetSpeed) {
        const decelRate = s.cooldownTimer > 0 ? 48.0 : 30.0;
        s.speed = Math.max(s.targetSpeed, s.speed - decelRate * delta);
      }

      // Giới hạn tuyệt đối tốc độ xe chạy trong khoảng 400 đến 650 km/h
      s.speed = Math.max(400, Math.min(650, s.speed));

      // Đánh dấu hành động vượt mặt & làm xe bị vượt giảm nhẹ tốc độ (Dirty Air) để pha vượt dứt khoát
      if (isHyperBoosting && carAheadDist < 26 && s.speed > carAheadSpeed + 15) {
        activeOvertakeCarId = s.id;
        if (carAheadId) {
          const overtakenCar = cars.find(c => c.state.id === carAheadId);
          if (overtakenCar && overtakenCar.state.cooldownTimer === 0) {
            overtakenCar.state.cooldownTimer = 2.0; // Xe bị vượt tạm hạ nhiệt nhường đường
            overtakenCar.state.speed = Math.max(405, overtakenCar.state.speed * 0.95);
          }
        }
      }

      // =========================================================================
      // 2. CHIẾN THUẬT ĐẢO LÀN ĐƯỜNG LIÊN TỤC & ĐA DẠNG (LANE WEAVING & OVERTAKING)
      // =========================================================================
      const shouldForceLaneChange = isDirectlyBlockedAhead || (s.laneChangeTimer <= 0) || (isHyperBoosting && carAheadDist < 45);

      if (shouldForceLaneChange) {
        // Reset timer đổi làn linh hoạt: từ 1.2 đến 2.5 giây đổi làn 1 lần
        s.laneChangeTimer = 1.2 + Math.random() * 1.5;

        let bestLane = s.targetLateralOffset;

        if (isHyperBoosting || isPullingAway || carAheadDist < 50) {
          // KHI ĐANG VƯỢT: Tìm làn trống nhất phía trước (khoảng cách xe phía trước xa nhất)
          let maxClearDist = -1;
          let candidateLanes: number[] = [];

          for (let l = 0; l < AVAILABLE_LANES.length; l++) {
            const lanePos = AVAILABLE_LANES[l];
            const distInLane = laneDistances[l];

            // Ưu tiên làn có khoảng cách thông thoáng trên 25m và không cùng làn xe bị cản
            if (distInLane > 25 && Math.abs(lanePos - carAheadLateral) > 0.25) {
              candidateLanes.push(lanePos);
            }
            if (distInLane > maxClearDist) {
              maxClearDist = distInLane;
              bestLane = lanePos;
            }
          }

          if (candidateLanes.length > 0) {
            // Chọn làn thoáng gần làn hiện tại nhất để lách qua nhanh nhất
            candidateLanes.sort((a, b) => Math.abs(a - s.lateralOffset) - Math.abs(b - s.lateralOffset));
            bestLane = candidateLanes[0];
          }
        } else if (Math.abs(turnCurl) > 0.08) {
          // KHI VÀO CUA: Cắt vào làn cua trong (Apex Clipping)
          const apexLane = turnCurl > 0 ? (AVAILABLE_LANES[0] + 0.1) : (AVAILABLE_LANES[AVAILABLE_LANES.length - 1] - 0.1);
          bestLane = THREE.MathUtils.lerp(s.lateralOffset, apexLane, 0.65);
        } else if (isLeader && carBehindDist < 25 && carBehindSpeed > s.speed) {
          // KHI DẪN ĐẦU & BỊ BÁM SÁT: Đảo làn đánh võng phòng thủ chặn đường vượt
          bestLane = Math.random() > 0.5 ? 0.34 : -0.34;
        } else {
          // CHẠY SO KÈ BÌNH THƯỜNG: Đảo làn tìm vị trí đua chiến thuật giữa các làn
          const currentLaneIdx = AVAILABLE_LANES.findIndex(lp => Math.abs(lp - s.targetLateralOffset) < 0.2);
          const currentIdx = currentLaneIdx !== -1 ? currentLaneIdx : Math.floor(AVAILABLE_LANES.length / 2);
          const dir = Math.random() > 0.5 ? 1 : -1;
          const nextIdx = Math.max(0, Math.min(AVAILABLE_LANES.length - 1, currentIdx + dir));
          bestLane = AVAILABLE_LANES[nextIdx];
        }

        s.targetLateralOffset = bestLane;
      }

      // Chuyển làn dứt khoát, mượt mà, phản hồi sắc nét như tay đua chuyên nghiệp
      const steerSpeed = 4.2 * (s.aggression + 0.4);
      const steerDiff = s.targetLateralOffset - s.lateralOffset;
      s.lateralOffset += steerDiff * Math.min(1.0, delta * steerSpeed);
      s.lateralOffset = Math.max(-0.82, Math.min(0.82, s.lateralOffset));
      
      // Bẻ lái bánh trước và nghiêng thân xe theo đúng hướng đảo làn
      s.steerAngle = THREE.MathUtils.lerp(s.steerAngle, steerDiff * 1.1, Math.min(1.0, delta * 12.0));

      // Tốc độ di chuyển thực tế trên đường đua (tỉ lệ chuẩn mượt mà 1.85x, loại bỏ hoàn toàn rung giật)
      const speedUnitsPerSec = (s.speed * 1000 / 3600) * 1.85;
      const progressDelta = (speedUnitsPerSec * delta) / totalLength;

      s.lapProgress += progressDelta;
      if (s.lapProgress >= 1.0) {
        s.lapProgress -= 1.0;
        s.lap += 1;
      }

      // Tắt đường hầm theo yêu cầu
      s.inTunnel = false;

      // Drift physics: chỉ kích hoạt khi vào khúc cua gắt thực sự hoặc đánh lái né gấp ở tốc độ cao
      // Trên đường thẳng và các đoạn cua thoải, xe giữ độ bám đường chuẩn xác (grip running), không drift liên tục
      const hasSharpCorner = Math.abs(turnCurl) > 0.22 && curveAngle > 0.16 && s.speed > 360;
      const hasExtremeSwerve = Math.abs(steerDiff) > 0.65 && s.speed > 450;

      if (hasSharpCorner || hasExtremeSwerve) {
        s.isDrifting = true;
        let targetDrift = 0;
        if (hasSharpCorner) {
          targetDrift = -Math.sign(turnCurl) * Math.min(0.26, Math.abs(turnCurl) * 1.3 + 0.06);
        } else if (hasExtremeSwerve) {
          targetDrift = -Math.sign(steerDiff) * 0.16;
        }
        s.driftAngle = THREE.MathUtils.lerp(s.driftAngle, targetDrift, Math.min(1.0, delta * 8.0));
      } else {
        s.isDrifting = false;
        s.driftAngle = THREE.MathUtils.lerp(s.driftAngle, 0, Math.min(1.0, delta * 10.0));
      }

      // Update collision cooldown
      if (s.collisionCooldown > 0) {
        s.collisionCooldown -= delta;
      }
    }

    // Step 2: Car-to-car collision resolution
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const c1 = cars[i];
        const c2 = cars[j];

        const p1Dist = c1.state.lap * totalLength + c1.state.lapProgress * totalLength;
        const p2Dist = c2.state.lap * totalLength + c2.state.lapProgress * totalLength;

        const longitudinalDist = Math.abs(p1Dist - p2Dist);
        const lateralDist = Math.abs(c1.state.lateralOffset - c2.state.lateralOffset) * (trackWidth / 2);

        if (longitudinalDist < 3.2 && lateralDist < 1.4) {
          // Collision occurred!
          collisionCarId = c1.state.id;

          if (c1.state.collisionCooldown <= 0 && c2.state.collisionCooldown <= 0) {
            c1.state.collisionCooldown = 0.8;
            c2.state.collisionCooldown = 0.8;

            // Phản lực tách làn mượt mà, không teleport giật cục
            const pushDir = c1.state.lateralOffset > c2.state.lateralOffset ? 1 : -1;
            const pushDelta = pushDir * Math.min(0.04, 0.4 * delta);
            c1.state.lateralOffset = Math.max(-0.85, Math.min(0.85, c1.state.lateralOffset + pushDelta));
            c2.state.lateralOffset = Math.max(-0.85, Math.min(0.85, c2.state.lateralOffset - pushDelta));

            // Ma sát giảm tốc độ nhẹ tự nhiên khi va chạm
            c1.state.speed *= 0.96;
            c2.state.speed *= 0.96;
          }
        }
      }
    }

    // Step 3: Update 3D Positions and Rotations along Curve
    cars.forEach(car => {
      const s = car.state;
      const t = getSafeCurveU(s.lapProgress);

      safeGetPointAt(curve, t, _centerPos);
      safeGetTangentAt(curve, t, _tangentVec);
      // Right-handed Frenet frame: Right = Up x Tangent, Up (binormal) = Tangent x Right
      // Guarantees det(mat) = +1.0 everywhere, completely preventing cars from flipping backwards
      _rightVec.crossVectors(_upVec, _tangentVec).normalize();
      _binormalVec.crossVectors(_tangentVec, _rightVec).normalize();

      // World position with lateral offset using pre-allocated _finalPos
      const lateralDist = s.lateralOffset * (trackWidth / 2);
      _finalPos.copy(_centerPos).addScaledVector(_rightVec, lateralDist);

      // Copy position and orientation directly to completely eliminate micro-stutters, deformation, and relative lag
      car.group.position.copy(_finalPos);

      // Continuous Right-Handed Frenet basis matrix - zero gimbal lock, zero backward flips, ultra smooth
      _mat.makeBasis(_rightVec, _binormalVec, _tangentVec);
      _targetQuat.setFromRotationMatrix(_mat);
      if (Math.abs(s.driftAngle) > 0.001) {
        _driftQuat.setFromAxisAngle(_rotAxisY, s.driftAngle);
        _targetQuat.multiply(_driftQuat);
      }
      // Slerp mượt mà triệt tiêu hoàn toàn vi chấn rung giật ở dải tốc độ cao 500-650 km/h
      car.group.quaternion.slerp(_targetQuat, Math.min(1.0, delta * 36.0));

      // Realistic Wheel spin animation & Front wheel counter-steering
      const wheelRotSpeed = ((s.speed * 1000 / 3600) / 0.42) * delta;
      car.wheels.forEach((w, wIdx) => {
        w.rotation.x += wheelRotSpeed;
        if (wIdx < 2) {
          // Bánh trước counter-steer khi drift tạo thế drift thể thao chuyên nghiệp
          const counterSteer = -s.driftAngle * 0.75 + s.steerAngle * 0.3;
          w.rotation.y = Math.max(-0.42, Math.min(0.42, counterSteer));
        }
      });

      // Dynamically flare up tail lights when braking or drifting
      if (car.taillights) {
        car.taillights.forEach(tl => {
          const m = tl.material as THREE.MeshStandardMaterial;
          if (m && m.isMeshStandardMaterial) {
            m.emissiveIntensity = s.isDrifting || s.speed > s.targetSpeed ? 8.5 : 2.0;
          }
        });
      }

      // Nitro & Exhaust Flame Particles animation with organic state-aware physics
      if (car.exhaustPuffs) {
        const isSuperSpeed = s.speed > 520;
        const isHighSpeed = s.speed > 430;
        const isDrifting = s.isDrifting;

        // Chỉ cập nhật hạt định kỳ hoặc cho các xe đang bứt tốc/drift/dẫn đầu để tối ưu GPU và CPU
        const shouldUpdateParticles = isSuperSpeed || isDrifting || s.rank <= 3 || Math.random() < 0.35;

        if (shouldUpdateParticles) {
          const posAttr = car.exhaustPuffs.geometry.attributes.position as THREE.BufferAttribute;
          const arr = posAttr.array as Float32Array;

          for (let p = 0; p < arr.length / 3; p++) {
            const idx = p * 3;
            
            // Thổi hạt về phía sau tương ứng với tốc độ cực đại (+z là hướng tiến)
            const blowSpeed = isDrifting ? 16.0 : (isSuperSpeed ? 28.0 : (isHighSpeed ? 14.0 : 6.0));
            arr[idx + 2] -= delta * blowSpeed;
            
            // Phân tán tia lửa Nitro
            arr[idx] += (Math.random() - 0.5) * (isSuperSpeed ? 0.16 : 0.05);
            arr[idx + 1] += (Math.random() - 0.5) * (isSuperSpeed ? 0.12 : 0.04);

            // Khi hạt bay quá xa đuôi xe, reset về ống pô
            const maxDist = isSuperSpeed ? -3.8 : (isDrifting ? -2.2 : -2.0);
            if (arr[idx + 2] < maxDist) {
              arr[idx] = (Math.random() - 0.5) * 0.08;
              arr[idx + 1] = -0.15 + (Math.random() - 0.5) * 0.06;
              arr[idx + 2] = 0;
            }
          }
          posAttr.needsUpdate = true;

          // Màu sắc lửa pô: Trên 520 km/h là lửa plasma xanh Cyan cực sáng, Drift là lửa cam rực cháy
          const mat = car.exhaustPuffs.material as THREE.PointsMaterial;
          if (isDrifting) {
            mat.color.setHex(0xff5500); // Drifting: Lửa cam bùng cháy
            mat.size = 0.58;
            mat.opacity = 0.95;
          } else if (isSuperSpeed) {
            mat.color.setHex(0x00ffff); // 600 km/h: Tia lửa plasma Nitro cyan xé gió
            mat.size = 0.65;
            mat.opacity = 1.0;
          } else if (isHighSpeed) {
            mat.color.setHex(0x0099ff); // 450+ km/h: Ngọn lửa xanh thể thao
            mat.size = 0.42;
            mat.opacity = 0.8;
          } else {
            mat.color.setHex(0x999999); // Chạy 400 km/h: Khói xả nhẹ
            mat.size = 0.25;
            mat.opacity = 0.35;
          }
        }
      }
    });

    // Step 4: Re-calculate leaderboard ranks based on (lap * 1000 + lapProgress)
    const sorted = [...cars].sort((a, b) => {
      const scoreA = a.state.lap + a.state.lapProgress;
      const scoreB = b.state.lap + b.state.lapProgress;
      return scoreB - scoreA;
    });

    sorted.forEach((car, index) => {
      car.state.rank = index + 1;
    });

    return { activeOvertakeCarId, collisionCarId };
  }
}
