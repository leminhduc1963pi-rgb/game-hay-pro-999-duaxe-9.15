import * as THREE from 'three';
import { CameraMode } from '../types';
import { Car3DObject } from './vehiclePhysics';

export class CameraDirector {
  public currentMode: CameraMode = CameraMode.TRACKSIDE_TELEPHOTO;
  public camera: THREE.PerspectiveCamera;
  private currentTargetCarId: string = '';
  private dwellTimer: number = 0;
  private nextSwitchTime: number = 5.0; // 4 to 7 seconds per realistic broadcast shot
  private orbitAngle: number = 0;

  // Trạm quay phim ven đường tĩnh (Trackside Static Station) cho cảm giác truyền hình F1 chân thực
  private tracksideStationPos: THREE.Vector3 = new THREE.Vector3();
  private hasStationPos: boolean = false;
  private grandstandStationPos: THREE.Vector3 = new THREE.Vector3();
  private hasGrandstandPos: boolean = false;
  private spectatorStationPos: THREE.Vector3 = new THREE.Vector3();
  private hasSpectatorPos: boolean = false;
  private helipadStationPos: THREE.Vector3 = new THREE.Vector3();
  private hasHelipadPos: boolean = false;

  // Smoothing buffers for cinematic movement (Gimbal chống rung quang học)
  private smoothedCamPos: THREE.Vector3 = new THREE.Vector3(0, 10, 20);
  private smoothedLookTarget: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private isFirstFrame: boolean = true;

  // Gyro-stabilized broadcast tracking anchor: cách ly hoàn toàn rung giật va chạm
  private stabilizedAnchorPos: THREE.Vector3 = new THREE.Vector3();
  private stabilizedAnchorForward: THREE.Vector3 = new THREE.Vector3(0, 0, 1);
  private hasStabilizedAnchor: boolean = false;

  // Thời gian mô phỏng đồng bộ tuyệt đối với delta (triệt tiêu 100% hiện tượng lệch nhịp rung chấn)
  private simulatedTime: number = 0;

  // Tiêu cự quang học chuẩn thể thao: 68° góc rộng điện ảnh, mở rộng động lên 88° khi đạt 500 km/h
  private readonly BASE_FOV: number = 68;

  constructor(fov: number = 68, aspect: number = 16 / 9) {
    this.camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 15000);
  }

  setCameraMode(mode: CameraMode) {
    if (mode === CameraMode.LOW_GROUND || mode === CameraMode.KERB_CAM_GROUND) {
      mode = CameraMode.BEHIND; // Tự động chuyển hướng nếu người dùng hoặc hệ thống gọi góc Sát Mặt Đường
    }
    this.currentMode = mode;
    this.dwellTimer = 0;
    this.hasStationPos = false;
    this.hasGrandstandPos = false;
    this.hasSpectatorPos = false;
    this.hasHelipadPos = false;
    this.isFirstFrame = true; // Bắt tức thì vào vị trí góc quay mới, triệt tiêu việc bị cách xa hàng trăm mét
  }

  resetFirstFrame() {
    this.isFirstFrame = true;
    this.hasStationPos = false;
    this.hasGrandstandPos = false;
    this.hasSpectatorPos = false;
    this.hasHelipadPos = false;
    this.hasStabilizedAnchor = false;
  }

  update(
    cars: Car3DObject[],
    delta: number,
    activeOvertakeCarId: string | null,
    collisionCarId: string | null,
    autoDirectorEnabled: boolean = true
  ): CameraMode {
    if (cars.length === 0) return this.currentMode;

    this.dwellTimer += delta;
    this.simulatedTime += delta;
    this.orbitAngle += delta * (this.currentMode === CameraMode.CINEMATIC_ORBIT ? 0.95 : 0.35);

    // Determine Leader (P1)
    const leaderCar = cars.find(c => c.state.rank === 1) || cars[0];

    // Priority event-driven director switches (Chuẩn đạo diễn truyền hình thể thao F1)
    // Bắt trọn những khoảnh khắc bứt tốc xé gió 600 km/h và vượt mặt kịch tính
    if (autoDirectorEnabled) {
      if (activeOvertakeCarId && this.dwellTimer > 2.0) {
        // Chuyển tức thì sang các góc quay rượt đuổi kịch tính hoặc so kè tốc độ cao
        const overtakeCamModes = [
          CameraMode.OVERTAKE_ACTION,
          CameraMode.MULTI_CAR_OVERTAKE_WIDE,
          CameraMode.MULTI_CAR_FRONT_FACING,
          CameraMode.SIDE_CHASE_MULTI,
          CameraMode.PASSING_STATIONARY,
          CameraMode.TRACKSIDE_TELEPHOTO,
          CameraMode.BUMPER_FIRST_PERSON
        ];
        this.currentMode = overtakeCamModes[Math.floor(Math.random() * overtakeCamModes.length)];
        this.currentTargetCarId = activeOvertakeCarId;
        this.dwellTimer = 0;
        this.nextSwitchTime = 3.5 + Math.random() * 2.5;
        this.hasStationPos = false;
        this.hasSpectatorPos = false;
      } else if (this.dwellTimer >= this.nextSwitchTime) {
        // Chuyển góc quay truyền hình thực tế: giữ mỗi góc 4.0 đến 6.5 giây để người xem thưởng thức trọn vẹn
        this.cycleNextCinematicMode();
        this.dwellTimer = 0;
        this.nextSwitchTime = 4.0 + Math.random() * 2.5;
        this.hasStationPos = false;
        this.hasGrandstandPos = false;
      }
    }

    // Select target car based on mode
    let targetCar = cars.find(c => c.state.id === this.currentTargetCarId);
    if (!targetCar || this.currentMode === CameraMode.LEADER_TRACKING) {
      targetCar = leaderCar;
      this.currentTargetCarId = targetCar.state.id;
    }

    const idealPos = new THREE.Vector3();
    const lookTarget = new THREE.Vector3();

    const carPos = targetCar.group.position;
    const rawForward = new THREE.Vector3(0, 0, 1).applyQuaternion(targetCar.group.quaternion).normalize();
    const up = new THREE.Vector3(0, 1, 0);

    // =========================================================================
    // HỆ THỐNG CON QUAY HỒI CHUYỂN CHỐNG RUNG TRUYỀN HÌNH (GYRO GIMBAL STABILIZER)
    // Cách ly hoàn toàn máy quay khỏi các cú giật nảy do va chạm hoặc đánh lái gắt.
    // =========================================================================
    const isCloseMode = (
      this.currentMode === CameraMode.BEHIND ||
      this.currentMode === CameraMode.HOOD ||
      this.currentMode === CameraMode.SIDE_PROFILE
    );

    if (!this.hasStabilizedAnchor || this.isFirstFrame) {
      this.stabilizedAnchorPos.copy(carPos);
      this.stabilizedAnchorForward.copy(rawForward);
      this.hasStabilizedAnchor = true;
    } else {
      if (isCloseMode) {
        // Khi quay gần hoặc xe BTC đuổi, vị trí gốc bám tức thời theo xe để triệt tiêu hoàn toàn hiện tượng lệch nhịp nảy giật xe
        this.stabilizedAnchorPos.copy(carPos);
        this.stabilizedAnchorForward.lerp(rawForward, Math.min(1.0, delta * 18.0)).normalize();
      } else {
        const anchorSmoothSpeed = Math.min(1.0, delta * 25.0);
        this.stabilizedAnchorPos.lerp(carPos, anchorSmoothSpeed);
        this.stabilizedAnchorForward.lerp(rawForward, Math.min(1.0, delta * 20.0)).normalize();
      }
    }

    const trackedPos = this.stabilizedAnchorPos;
    const forward = this.stabilizedAnchorForward;
    const right = new THREE.Vector3().crossVectors(forward, up).normalize();
    const currentSpeed = targetCar.state.speed || 0;

    // Tốc độ lerp máy quay (Smooth Damping factor)
    let camSmoothSpeed = 4.5;

    switch (this.currentMode) {
      // =========================================================================
      // GÓC QUAY TRỰC THĂNG TRUYỀN HÌNH TỪ XA (CHOPPER HELI CHASE)
      // Helicam bay lượn trên không ở cự ly xa, bắt trọn toàn bộ đoàn xe và khung cảnh trường đua
      // =========================================================================
      case CameraMode.CHOPPER_HELI_CHASE: {
        camSmoothSpeed = 4.2;
        const swayX = Math.sin(this.orbitAngle * 0.45) * 6.0;
        const swayY = Math.cos(this.orbitAngle * 0.35) * 3.5;
        idealPos.copy(trackedPos)
          .addScaledVector(forward, -48.0)
          .addScaledVector(right, 28.0 + swayX)
          .addScaledVector(up, 38.0 + swayY);
        lookTarget.copy(trackedPos).addScaledVector(forward, 16.0).addScaledVector(up, 1.0);
        break;
      }

      // =========================================================================
      // GÓC QUAY DRONE BAY BÁM ĐUỔI TỪ XA (SKY DRONE BROADCAST / FLYCAM)
      // Drone FPV bay lướt trên cao 18m, chuyển động nhịp nhàng bám sát đoàn xe xé gió
      // =========================================================================
      case CameraMode.SKY_DRONE_BROADCAST: {
        camSmoothSpeed = 8.5;
        const droneWeave = Math.sin(this.orbitAngle * 0.9) * 14.0;
        idealPos.copy(trackedPos)
          .addScaledVector(forward, -28.0)
          .addScaledVector(right, droneWeave)
          .addScaledVector(up, 18.0);
        lookTarget.copy(trackedPos).addScaledVector(forward, 15.0).addScaledVector(up, 1.2);
        break;
      }

      // =========================================================================
      // GÓC QUAY TOÀN CẢNH TỪ TRÊN CAO (PANORAMIC / GRANDSTAND)
      // Đặt ở đài quan sát trên cao 44m, cự ly xa bao quát toàn bộ khúc cua và nhiều xe đua
      // =========================================================================
      case CameraMode.PANORAMIC: {
        camSmoothSpeed = 3.8;
        const distToGrandstand = trackedPos.distanceTo(this.grandstandStationPos);
        if (!this.hasGrandstandPos || distToGrandstand > 220.0) {
          this.grandstandStationPos.copy(trackedPos)
            .addScaledVector(right, 46.0)
            .addScaledVector(forward, 40.0);
          this.grandstandStationPos.y = trackedPos.y + 44.0;
          this.hasGrandstandPos = true;
        }
        idealPos.copy(this.grandstandStationPos);
        lookTarget.copy(trackedPos).addScaledVector(forward, 8.0).addScaledVector(up, 1.0);
        break;
      }

      // =========================================================================
      // 1. MÁY QUAY TELEPHOTO VEN ĐƯỜNG LIA THEO XE (TRACKSIDE TELEPHOTO 85mm)
      // Máy quay ĐỨNG YÊN 100% Ở VEN ĐƯỜNG KHÔNG DI CHUYỂN, chỉ xoay ống kính lia theo đoàn xe đi qua
      // =========================================================================
      case CameraMode.TRACKSIDE_TELEPHOTO: {
        const distToStation = trackedPos.distanceTo(this.tracksideStationPos);
        if (!this.hasStationPos || distToStation > 160.0) {
          this.tracksideStationPos.copy(trackedPos)
            .addScaledVector(right, 14.5)
            .addScaledVector(forward, 55.0);
          this.tracksideStationPos.y = trackedPos.y + 2.8;
          this.hasStationPos = true;
        }
        idealPos.copy(this.tracksideStationPos); // Đứng yên tuyệt đối ở ven đường!
        lookTarget.copy(trackedPos).addScaledVector(up, 0.85); // Chỉ lia ống kính theo xe
        break;
      }

      // =========================================================================
      // 2. TOÀN CẢNH SO KÈ NHIỀU XE (MULTI_CAR_OVERTAKE_WIDE)
      // Góc quay chéo từ trên cao vừa phải, bắt trọn từng pha đảo làn và so kè tay đôi
      // =========================================================================
      case CameraMode.MULTI_CAR_OVERTAKE_WIDE: {
        camSmoothSpeed = 12.0;
        idealPos.copy(trackedPos)
          .addScaledVector(right, 24.0)
          .addScaledVector(forward, -22.0)
          .addScaledVector(up, 12.5);
        lookTarget.copy(trackedPos).addScaledVector(forward, 15.0).addScaledVector(up, 1.1);
        break;
      }

      // =========================================================================
      // 3. GÓC ĐÓN ĐẦU NHIỀU XE ĐUA (MULTI_CAR_FRONT_FACING)
      // Đón đầu đoàn xe, quay trực diện vào xe và nhóm xe phía sau đang lao tới
      // =========================================================================
      case CameraMode.MULTI_CAR_FRONT_FACING: {
        camSmoothSpeed = 16.0;
        idealPos.copy(trackedPos)
          .addScaledVector(forward, 38.0)
          .addScaledVector(up, 5.5)
          .addScaledVector(right, -3.0);
        lookTarget.copy(trackedPos).addScaledVector(forward, -4.0).addScaledVector(up, 1.0);
        break;
      }

      // =========================================================================
      // 4. TRẠM QUAY ĐỈNH GÓC CUA APEX (TRACKSIDE APEX)
      // Đặt ngay mép vỉa cua (apex curb), đón xe ôm cua rõ nét
      // =========================================================================
      case CameraMode.TRACKSIDE_APEX: {
        camSmoothSpeed = 8.0;
        idealPos.copy(trackedPos)
          .addScaledVector(forward, 4.5)
          .addScaledVector(right, -5.2)
          .addScaledVector(up, 1.2);
        lookTarget.copy(trackedPos).addScaledVector(forward, -0.5).addScaledVector(up, 0.7);
        break;
      }

      // =========================================================================
      // 5. BÁM ĐUÔI ĐOÀN XE NGHẸT THỞ (MULTI_CAR_PACK_CHASE)
      // Cách sau xe 35m, trên cao 9.5m bao quát cận cảnh các xe so kè và đảo làn bứt tốc
      // =========================================================================
      case CameraMode.MULTI_CAR_PACK_CHASE: {
        camSmoothSpeed = 16.0;
        idealPos.copy(trackedPos)
          .addScaledVector(forward, -35.0)
          .addScaledVector(up, 9.5)
          .addScaledVector(right, 3.2);
        lookTarget.copy(trackedPos).addScaledVector(forward, 25.0).addScaledVector(up, 1.2);
        break;
      }

      // =========================================================================
      // 6. VÁCH KỸ THUẬT PIT WALL (PIT WALL BROADCAST)
      // Góc nhìn từ tường chỉ đạo pit stop nhìn đoàn xe xé gió đoạn thẳng
      // =========================================================================
      case CameraMode.PIT_WALL_BROADCAST: {
        camSmoothSpeed = 7.5;
        idealPos.copy(trackedPos)
          .addScaledVector(right, -16.0)
          .addScaledVector(forward, 16.0)
          .addScaledVector(up, 3.2);
        lookTarget.copy(trackedPos).addScaledVector(up, 1.0);
        break;
      }

      // =========================================================================
      // 7. TRẠM QUAY TĨNH SÁT RÀO CHẮN XÉ GIÓ (PASSING STATIONARY)
      // Máy quay gắn sát rào chắn xé gió (Armco Barrier Rush), rào chắn và vạch sơn vút qua cực mượt mà
      // =========================================================================
      case CameraMode.PASSING_STATIONARY: {
        camSmoothSpeed = 10.0;
        idealPos.copy(trackedPos)
          .addScaledVector(right, 6.2)
          .addScaledVector(forward, -1.8)
          .addScaledVector(up, 1.25);
        lookTarget.copy(trackedPos)
          .addScaledVector(forward, 2.5)
          .addScaledVector(up, 0.75);
        break;
      }

      // =========================================================================
      // 9. KHUNG HÌNH DỌC 9:16 TRUYỀN HÌNH (VERTICAL PORTRAIT OPTIMIZED)
      // Cân chỉnh tỉ lệ vàng cho màn hình điện thoại (Shorts / Reels)
      // =========================================================================
      case CameraMode.VERTICAL_PORTRAIT_OPTIMIZED: {
        camSmoothSpeed = 6.0;
        idealPos.copy(trackedPos).addScaledVector(forward, -8.5).addScaledVector(up, 3.4);
        lookTarget.copy(trackedPos).addScaledVector(forward, 8.0).addScaledVector(up, 1.0);
        break;
      }

      // =========================================================================
      // 10. GÓC QUAY NGƯỜI ĐỨNG VEN ĐƯỜNG (SPECTATOR TRACKSIDE)
      // Camera ĐỨNG YÊN 100% Ở VEN ĐƯỜNG KHÔNG DI CHUYỂN, chỉ xoay hướng lia nhìn theo xe tốc độ cao đi qua
      // =========================================================================
      case CameraMode.SPECTATOR_TRACKSIDE: {
        const distToSpectator = trackedPos.distanceTo(this.spectatorStationPos);
        if (!this.hasSpectatorPos || distToSpectator > 160.0) {
          this.spectatorStationPos.copy(trackedPos)
            .addScaledVector(right, 14.0)
            .addScaledVector(forward, 50.0);
          this.spectatorStationPos.y = trackedPos.y + 1.65; // Tầm mắt khán giả đứng ven đường
          this.hasSpectatorPos = true;
        }
        idealPos.copy(this.spectatorStationPos); // Tuyệt đối đứng yên!
        lookTarget.copy(trackedPos).addScaledVector(up, 0.85); // Chỉ lia ống kính theo thân xe
        break;
      }

      // =========================================================================
      // 10. HÔNG XA SO KÈ NHIỀU XE ĐUA (SIDE_CHASE_MULTI)
      // Chạy song song cạnh đoàn xe cách 32m, bao quát các xe đua đang so kè bánh xe
      // =========================================================================
      case CameraMode.SIDE_CHASE_MULTI: {
        camSmoothSpeed = 14.0;
        idealPos.copy(trackedPos)
          .addScaledVector(right, -30.0)
          .addScaledVector(forward, 6.0)
          .addScaledVector(up, 6.5);
        lookTarget.copy(trackedPos).addScaledVector(forward, 8.0).addScaledVector(up, 1.2);
        break;
      }

      // =========================================================================
      // 13. CAMERA TRẦN HẦM HẤT XUỐNG SIÊU TỐC (TUNNEL_CEILING_FAST)
      // Gắn dọc trần hầm nhìn từ trên xuống cực kỳ kịch tính khi xe vút qua bên dưới
      // =========================================================================
      case CameraMode.TUNNEL_CEILING_FAST: {
        camSmoothSpeed = 16.0;
        idealPos.copy(trackedPos).addScaledVector(forward, 15.0).addScaledVector(up, 6.2);
        lookTarget.copy(trackedPos).addScaledVector(forward, -2.0).addScaledVector(up, 0.5);
        break;
      }

      // =========================================================================
      // 14. CAMERA CHẮN BÙN NHÌN LỐP VÀ HÔNG XE (FENDER_WHEEL_LOOK)
      // Góc bám lốp xe trước bên hông, thấy rõ bánh xe quay tít mù khói và mặt đường trôi
      // =========================================================================
      case CameraMode.FENDER_WHEEL_LOOK: {
        camSmoothSpeed = 25.0; // Khóa cứng
        idealPos.copy(trackedPos)
          .addScaledVector(right, 1.85)
          .addScaledVector(forward, 1.25)
          .addScaledVector(up, 0.75);
        lookTarget.copy(trackedPos)
          .addScaledVector(right, 0.8)
          .addScaledVector(forward, -1.8)
          .addScaledVector(up, 0.45);
        break;
      }

      // =========================================================================
      // 15. ĐUÔI GIÓ NHÌN NGƯỢC VỀ TRƯỚC (WING_REAR_LOOK)
      // Gắn trên cánh gió sau nhìn vượt qua nóc xe về phía trước, cảm nhận tốc độ cực hạn
      // =========================================================================
      case CameraMode.WING_REAR_LOOK: {
        camSmoothSpeed = 25.0; // Khóa cứng
        idealPos.copy(trackedPos)
          .addScaledVector(forward, -1.75)
          .addScaledVector(up, 1.6);
        lookTarget.copy(trackedPos)
          .addScaledVector(forward, 15.0)
          .addScaledVector(up, 0.95);
        break;
      }

      // =========================================================================
      // 16. CAMERA ÂM VỈA GỜ GIẢM TỐC (KERB_CAM_GROUND)
      // Gầm xe sượt ngay bên trên camera với hiệu ứng tốc độ bốc lửa
      // =========================================================================
      case CameraMode.KERB_CAM_GROUND: {
        camSmoothSpeed = 20.0;
        idealPos.copy(trackedPos).addScaledVector(right, 3.2).addScaledVector(forward, 4.0);
        idealPos.y = Math.max(0.05, trackedPos.y - 0.45);
        lookTarget.copy(trackedPos).addScaledVector(up, 0.35);
        break;
      }

      // =========================================================================
      // 17. GÓC LÁI THỨ NHẤT TRONG CABIN (COCKPIT_FIRST_PERSON)
      // Trải nghiệm trực tiếp bên trong buồng lái xe đua tốc độ cực cao
      // =========================================================================
      case CameraMode.COCKPIT_FIRST_PERSON: {
        camSmoothSpeed = 25.0; // Khóa cứng
        idealPos.copy(trackedPos).addScaledVector(forward, 0.15).addScaledVector(up, 1.05);
        lookTarget.copy(trackedPos).addScaledVector(forward, 35.0).addScaledVector(up, 0.95);
        break;
      }

      // =========================================================================
      // 18. GÓC CẢN TRƯỚC SIÊU TỐC (BUMPER_FIRST_PERSON)
      // Camera gắn sát cản trước ngay trên mặt đường nhựa bốc lửa
      // =========================================================================
      case CameraMode.BUMPER_FIRST_PERSON: {
        camSmoothSpeed = 25.0; // Khóa cứng
        idealPos.copy(trackedPos).addScaledVector(forward, 1.85).addScaledVector(up, 0.45);
        lookTarget.copy(trackedPos).addScaledVector(forward, 40.0).addScaledVector(up, 0.45);
        break;
      }

      // =========================================================================
      // === 10 GÓC QUAY CINEMATIC KINH ĐIỂN (CLASSIC CAMERAS) ===
      // =========================================================================

      // 1. Phía Sau Xe: Cự ly thể thao kinh điển 22m, góc nhìn bao quát toàn bộ xe và các đối thủ xung quanh
      case CameraMode.BEHIND: {
        camSmoothSpeed = 25.0;
        const dist = 22.5; // Cự ly chuẩn mực bắt trọn đuôi xe, tia lửa Nitro và xe đối thủ
        const height = 5.6; // Nâng cao góc nhìn để thấy rõ các xe phía trước đang so kè và đảo làn
        idealPos.copy(trackedPos).addScaledVector(forward, -dist).addScaledVector(up, height);
        idealPos.y = Math.max(idealPos.y, trackedPos.y + 1.8);
        lookTarget.copy(trackedPos).addScaledVector(forward, 18.0).addScaledVector(up, 1.1);
        break;
      }

      // 2. Mui Xe / Cockpit: Góc nhìn thấp từ nắp capo nhìn thẳng đường đua
      case CameraMode.HOOD: {
        camSmoothSpeed = 25.0; // Locked tightly to avoid visual sliding
        idealPos.copy(trackedPos).addScaledVector(forward, 1.1).addScaledVector(up, 0.92);
        lookTarget.copy(trackedPos).addScaledVector(forward, 38.0).addScaledVector(up, 0.85);
        break;
      }

      // 3. Đã bỏ góc quay Sát Mặt Đường theo yêu cầu của người dùng, chuyển sang góc truyền hình trên cao
      case CameraMode.LOW_GROUND: {
        camSmoothSpeed = 12.0;
        idealPos.copy(trackedPos).addScaledVector(forward, -14.0).addScaledVector(up, 4.5);
        lookTarget.copy(trackedPos).addScaledVector(forward, 15.0).addScaledVector(up, 1.0);
        break;
      }

      // 4. Bên Hông Xe: Quay ngang hông xe và các pha so kè bánh xe
      case CameraMode.SIDE_PROFILE: {
        camSmoothSpeed = 7.0;
        idealPos.copy(trackedPos).addScaledVector(right, -4.8).addScaledVector(forward, 0.2).addScaledVector(up, 1.4);
        lookTarget.copy(trackedPos).addScaledVector(forward, 5.0).addScaledVector(up, 0.85);
        break;
      }

      // 5. Bám Xe Dẫn Đầu & Đoàn Đua: Tự động bám theo xe dẫn đầu với cự ly 28m bao quát đoàn xe
      case CameraMode.LEADER_TRACKING: {
        camSmoothSpeed = 14.0;
        idealPos.copy(trackedPos).addScaledVector(forward, -28.0).addScaledVector(up, 7.5);
        lookTarget.copy(trackedPos).addScaledVector(forward, 18.0).addScaledVector(up, 1.1);
        break;
      }

      // 8. Góc Vượt Mặt: Cận cảnh hành động khi xe lách qua đối thủ
      case CameraMode.OVERTAKE_ACTION: {
        camSmoothSpeed = 10.0;
        idealPos.copy(trackedPos)
          .addScaledVector(right, -3.8)
          .addScaledVector(forward, -5.5)
          .addScaledVector(up, 2.0);
        lookTarget.copy(trackedPos).addScaledVector(forward, 12.0).addScaledVector(up, 0.95);
        break;
      }

      // 9. Va Chạm & Drift: Góc truyền hình cận cảnh theo dõi pha so kè, tuyệt đối không rung lắc
      case CameraMode.COLLISION_DRIFT: {
        camSmoothSpeed = 6.0;
        const driftOffset = (targetCar.state.isDrifting ? -1 : 1) * 4.0;
        idealPos.copy(trackedPos).addScaledVector(right, driftOffset).addScaledVector(forward, -6.5).addScaledVector(up, 2.0);
        lookTarget.copy(trackedPos).addScaledVector(forward, 3.0).addScaledVector(up, 0.85);
        break;
      }

      // 10. Xoay 360 Vòng: Quỹ đạo xoay mượt mà liên tục quanh xe theo hệ trục cục bộ
      case CameraMode.CINEMATIC_ORBIT: {
        camSmoothSpeed = 12.0;
        const orbitRadius = 7.5;
        const orbitHeight = 2.2 + Math.sin(this.orbitAngle * 0.8) * 0.35;
        const orbitX = Math.sin(this.orbitAngle) * orbitRadius;
        const orbitZ = Math.cos(this.orbitAngle) * orbitRadius;
        idealPos.copy(trackedPos)
          .addScaledVector(right, orbitX)
          .addScaledVector(forward, orbitZ)
          .addScaledVector(up, orbitHeight);
        lookTarget.copy(trackedPos).addScaledVector(up, 0.75);
        break;
      }

      // Fallback: Mặc định chuyển về máy quay Telephoto ven đường
      default: {
        camSmoothSpeed = 7.0;
        idealPos.copy(trackedPos).addScaledVector(forward, -10.0).addScaledVector(up, 3.0);
        lookTarget.copy(trackedPos).addScaledVector(forward, 7.0).addScaledVector(up, 0.95);
        break;
      }
    }

    // Camera Smoothing Damping (Quán tính quang học mượt mà)
    if (this.isFirstFrame) {
      this.smoothedCamPos.copy(idealPos);
      this.smoothedLookTarget.copy(lookTarget);
      this.isFirstFrame = false;
    } else {
      const isStationaryTrackside = (
        this.currentMode === CameraMode.TRACKSIDE_TELEPHOTO ||
        this.currentMode === CameraMode.SPECTATOR_TRACKSIDE
      );
      const isCloseShot = (
        this.currentMode === CameraMode.BEHIND ||
        this.currentMode === CameraMode.HOOD ||
        this.currentMode === CameraMode.SIDE_PROFILE ||
        this.currentMode === CameraMode.COCKPIT_FIRST_PERSON ||
        this.currentMode === CameraMode.BUMPER_FIRST_PERSON ||
        this.currentMode === CameraMode.FENDER_WHEEL_LOOK ||
        this.currentMode === CameraMode.WING_REAR_LOOK
      );

      if (isStationaryTrackside) {
        // Máy quay ven đường đứng yên hoàn toàn 100% không di chuyển, chỉ xoay ống kính lia theo xe
        this.smoothedCamPos.copy(idealPos);
        this.smoothedLookTarget.lerp(lookTarget, Math.min(1.0, delta * 24.0));
      } else if (isCloseShot) {
        // Khi quay gần, khóa cứng chính xác vị trí và mục tiêu góc nhìn vào xe để triệt tiêu hoàn toàn hiện tượng rung lắc
        this.smoothedCamPos.copy(idealPos);
        this.smoothedLookTarget.copy(lookTarget);
      } else {
        this.smoothedCamPos.lerp(idealPos, Math.min(1.0, delta * camSmoothSpeed));
        this.smoothedLookTarget.lerp(lookTarget, Math.min(1.0, delta * camSmoothSpeed));
      }
    }

    // =========================================================================
    // DYNAMIC FOV & SPEED SENSATION:
    // Tiêu cự chuẩn từng thể loại: 85mm cho Telephoto ven đường, mở rộng xé gió cho Chase
    // =========================================================================
    const speedRatio = Math.min(1.0, currentSpeed / 610);
    let modeBaseFov = this.BASE_FOV;
    let speedFovBoost = Math.pow(speedRatio, 1.25) * 18.0;

    if (this.currentMode === CameraMode.CHOPPER_HELI_CHASE) {
      modeBaseFov = 44.0; // Góc quay Trực thăng truyền hình từ xa
      speedFovBoost = Math.pow(speedRatio, 1.25) * 3.0;
    } else if (this.currentMode === CameraMode.SKY_DRONE_BROADCAST) {
      modeBaseFov = 64.0; // Góc Drone bay lượn FPV
      speedFovBoost = Math.pow(speedRatio, 1.25) * 6.0;
    } else if (this.currentMode === CameraMode.PANORAMIC) {
      modeBaseFov = 40.0; // Góc toàn cảnh từ trên cao
      speedFovBoost = 0;
    } else if (this.currentMode === CameraMode.MULTI_CAR_OVERTAKE_WIDE) {
      modeBaseFov = 54.0;
      speedFovBoost = Math.pow(speedRatio, 1.25) * 4.0;
    } else if (this.currentMode === CameraMode.MULTI_CAR_FRONT_FACING) {
      modeBaseFov = 62.0;
      speedFovBoost = Math.pow(speedRatio, 1.25) * 5.0;
    } else if (this.currentMode === CameraMode.MULTI_CAR_PACK_CHASE) {
      modeBaseFov = 55.0;
      speedFovBoost = Math.pow(speedRatio, 1.25) * 4.0;
    } else if (this.currentMode === CameraMode.SIDE_CHASE_MULTI) {
      modeBaseFov = 50.0;
      speedFovBoost = Math.pow(speedRatio, 1.25) * 4.0;
    } else if (this.currentMode === CameraMode.SPECTATOR_TRACKSIDE) {
      // Khán giả ven đường: tự động zoom ống kính tùy khoảng cách xe để bắt trọn khung hình xe cực đẹp
      const distToCam = this.smoothedCamPos.distanceTo(trackedPos);
      const zoomFactor = THREE.MathUtils.clamp((distToCam - 15.0) / 100.0, 0.0, 1.0);
      modeBaseFov = THREE.MathUtils.lerp(52.0, 18.0, zoomFactor);
      speedFovBoost = 0;
    } else if (this.currentMode === CameraMode.BEHIND) {
      // Góc phía sau xe lùi xa 100m: FOV rộng 56 độ bao quát xe và đoàn đua
      modeBaseFov = 56.0; 
      speedFovBoost = Math.pow(speedRatio, 1.25) * 4.0;
    } else if (this.currentMode === CameraMode.COCKPIT_FIRST_PERSON) {
      modeBaseFov = 78.0; // Khoang lái điện ảnh góc rộng chân thực
      speedFovBoost = Math.pow(speedRatio, 1.25) * 15.0; // Hiệu ứng kéo dãn không gian cực đã
    } else if (this.currentMode === CameraMode.BUMPER_FIRST_PERSON) {
      modeBaseFov = 88.0; // Góc cản trước xé gió siêu tốc
      speedFovBoost = Math.pow(speedRatio, 1.25) * 22.0; // Kéo dãn cực hạn lên tới 110 FOV!
    } else if (this.currentMode === CameraMode.TRACKSIDE_TELEPHOTO) {
      modeBaseFov = 28.0; 
      speedFovBoost = Math.pow(speedRatio, 1.25) * 3.0;
    } else if (this.currentMode === CameraMode.TRACKSIDE_APEX) {
      modeBaseFov = 62.0; 
      speedFovBoost = Math.pow(speedRatio, 1.25) * 8.0;
    } else if (this.currentMode === CameraMode.CINEMATIC_ORBIT) {
      modeBaseFov = 65.0; 
      speedFovBoost = Math.pow(speedRatio, 1.25) * 6.0;
    } else if (this.currentMode === CameraMode.PASSING_STATIONARY) {
      modeBaseFov = 74.0; 
      speedFovBoost = Math.pow(speedRatio, 1.25) * 16.0;
    } else if (this.currentMode === CameraMode.TUNNEL_CEILING_FAST) {
      modeBaseFov = 75.0;
      speedFovBoost = Math.pow(speedRatio, 1.25) * 12.0;
    } else if (this.currentMode === CameraMode.FENDER_WHEEL_LOOK || this.currentMode === CameraMode.WING_REAR_LOOK) {
      modeBaseFov = 72.0;
      speedFovBoost = Math.pow(speedRatio, 1.25) * 10.0;
    }

    const targetFov = modeBaseFov + speedFovBoost;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, Math.min(1.0, delta * 5.0));
    this.camera.updateProjectionMatrix();

    // Ổn định quang học chuẩn Gimbal F1 (Shotover / Cineflex):
    // Giữ camera hoàn toàn tĩnh mượt, triệt tiêu 100% rung giật vi chấn làm xao động xe
    this.camera.position.copy(this.smoothedCamPos);
    this.camera.lookAt(this.smoothedLookTarget);

    return this.currentMode;
  }

  /**
   * Chuyển đổi tự động giữa các góc quay truyền hình & cinematic tập trung vào xe và đoàn xe đua
   */
  private cycleNextCinematicMode() {
    const allModes = [
      // Các góc quay từ xa, trên cao và truyền hình thực tế
      CameraMode.CHOPPER_HELI_CHASE, // Trực thăng truyền hình từ xa
      CameraMode.SKY_DRONE_BROADCAST, // Drone bay lượn FPV
      CameraMode.PANORAMIC, // Toàn cảnh từ trên cao
      CameraMode.MULTI_CAR_FRONT_FACING, // Đón đầu nhiều xe đua
      CameraMode.MULTI_CAR_OVERTAKE_WIDE, // Toàn cảnh so kè nhiều xe
      CameraMode.MULTI_CAR_PACK_CHASE, // Bám đuôi đoàn xe 100m
      CameraMode.TRACKSIDE_TELEPHOTO, // Máy quay Telephoto ven đường lia theo đoàn xe
      CameraMode.TRACKSIDE_APEX, // Trạm đỉnh góc cua
      CameraMode.PASSING_STATIONARY, // Ven rào chắn xé gió
      CameraMode.PIT_WALL_BROADCAST, // Vách kỹ thuật Pit Wall
      CameraMode.VERTICAL_PORTRAIT_OPTIMIZED, // Khung hình dọc 9:16
      CameraMode.SPECTATOR_TRACKSIDE, // Khán giả ven đường
      CameraMode.SIDE_CHASE_MULTI, // Hông xa so kè nhiều xe đua
      CameraMode.TUNNEL_CEILING_FAST, // Camera trần hầm
      CameraMode.FENDER_WHEEL_LOOK, // Camera chắn bùn
      CameraMode.WING_REAR_LOOK, // Đuôi gió nhìn trước
      // Các góc quay Cinematic tập trung vào xe
      CameraMode.BEHIND, // Phía sau xe lùi xa
      CameraMode.HOOD,
      CameraMode.SIDE_PROFILE,
      CameraMode.LEADER_TRACKING,
      CameraMode.OVERTAKE_ACTION,
      CameraMode.COLLISION_DRIFT,
      CameraMode.CINEMATIC_ORBIT,
      CameraMode.COCKPIT_FIRST_PERSON,
      CameraMode.BUMPER_FIRST_PERSON,
    ];

    const available = allModes.filter(m => m !== this.currentMode);
    if (available.length > 0) {
      this.currentMode = available[Math.floor(Math.random() * available.length)];
    } else {
      this.currentMode = CameraMode.BEHIND;
    }
  }
}
