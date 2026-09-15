import * as THREE from 'three';
import { safeGetPointAt, safeGetTangentAt, getSafeCurveU } from './curveUtils';
import { audioEngine } from './audioEngine';
import { carModelManager } from './carModelManager';
import { generatePointsForLayout } from './trackLayouts';
import { getTrackVisualTheme, createRoadTexture } from './trackThemes';

export type DrivingAssistMode = 'BEGINNER' | 'SPORT' | 'SIMULATION';
export type PlayerCameraType =
  | 'CHASE'
  | 'HELICOPTER'
  | 'DRONE'
  | 'OVERHEAD'
  | 'HEAD_ON'
  | 'TRACKSIDE'
  | 'COCKPIT'
  | 'HOOD'
  | 'BUMPER'
  | 'CINEMATIC';
export type WeatherType = 'SUNNY' | 'RAIN' | 'SUNSET' | 'NIGHT';

export interface PerformanceStats {
  fps: number;
  avgFrameTimeMs: number;
  gameThreadMs: number;
  renderThreadMs: number;
  gpuTimeMs: number;
  onePercentLowFps: number;
  zeroPointOnePercentLowFps: number;
  bottleneck: 'BALANCED' | 'GPU BOUND' | 'CPU GAME THREAD' | 'RENDER THREAD';
  drawCalls: number;
  triangles: number;
}

export interface PlayerCarTelemetry {
  speedKmh: number;
  rpm: number;
  gear: number; // 0 = R, 1..6
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
  isDrifting: boolean;
  driftAngle: number;
  isAbsActive: boolean;
  isTcsActive: boolean;
  gForceLat: number;
  gForceLong: number;
  lap: number;
  rank: number;
  lapProgress: number; // 0..1
  currentLapTime: number;
  bestLapTime: number;
  lastLapTime: number;
  isWrongWay: boolean;
  damagePct: number;
}

export interface AICarRival {
  id: string;
  name: string;
  driverName: string;
  color: number;
  lapProgress: number;
  lateralOffset: number;
  targetLateralOffset: number;
  laneChangeTimer: number;
  speed: number;
  targetSpeed: number;
  maxSpeed: number;
  lap: number;
  rank: number;
  meshGroup: THREE.Group;
  wheels: THREE.Mesh[];
  meshIndex: number;
  isDrifting: boolean;
  isHyperBoosting: boolean;
  overtakePullAwayDist: number;
  attackPhaseTimer: number;
  nitroCooldown: number;
}

export class PlayableRacingGame {
  public canvas: HTMLCanvasElement;
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;

  // Track & Spline
  public currentLayout: string = 'GRAND_PRIX_OVAL';
  public trackCurve!: THREE.CatmullRomCurve3;
  public totalTrackLength: number = 35000;
  public trackMeshGroup: THREE.Group = new THREE.Group();
  public trackWidth: number = 14.0;

  // Weather & Lighting
  public currentWeather: WeatherType = 'SUNSET';
  public dirLight!: THREE.DirectionalLight;
  public ambientLight!: THREE.AmbientLight;
  public rainParticles?: THREE.Points;

  // Player Vehicle
  public playerGroup: THREE.Group = new THREE.Group();
  public playerWheels: THREE.Mesh[] = [];
  public playerHeadlights: THREE.SpotLight[] = [];
  public playerTaillights: THREE.Mesh[] = [];

  // Vehicle Mechanics
  public playerSpeed: number = 0; // km/h
  public playerRpm: number = 900;
  public playerGear: number = 1;
  public playerLapProgress: number = 0.02;
  public playerLateralOffset: number = -0.2; // -1 to 1
  public playerSteerAngle: number = 0;
  public playerLap: number = 1;
  public playerTotalScore: number = 0;
  public isDrifting: boolean = false;
  public driftAngle: number = 0;
  public damagePct: number = 0;

  // Assists
  public assistMode: DrivingAssistMode = 'SPORT';
  public isAbsActive: boolean = false;
  public isTcsActive: boolean = false;

  // Camera settings (Góc nhìn rộng thể thao 68° mở rộng lên 90° khi chạy 500 km/h)
  public cameraMode: PlayerCameraType = 'CHASE';
  private smoothedCamPos = new THREE.Vector3();
  private smoothedCamLookAt = new THREE.Vector3();
  private camBaseFov = 68;
  private camCurrentFov = 68;

  // Supersonic Wind Streaks effect
  private speedStreaks?: THREE.LineSegments;

  // AI Rivals
  public aiRivals: AICarRival[] = [];

  // Controls input state
  public input = {
    throttle: 0,
    brake: 0,
    steer: 0,
    handbrake: false
  };

  // Timing & Laps
  public raceState: 'COUNTDOWN' | 'RACING' | 'FINISHED' = 'COUNTDOWN';
  public countdownTimer: number = 3.9;
  public currentLapTime: number = 0;
  public bestLapTime: number = 0;
  public lastLapTime: number = 0;
  public isWrongWay: boolean = false;
  public totalLaps: number = 3;

  // Performance Profiler (F3)
  public frameTimes: number[] = [];
  public perfStats: PerformanceStats = {
    fps: 60,
    avgFrameTimeMs: 16.6,
    gameThreadMs: 2.1,
    renderThreadMs: 4.2,
    gpuTimeMs: 8.5,
    onePercentLowFps: 58,
    zeroPointOnePercentLowFps: 54,
    bottleneck: 'BALANCED',
    drawCalls: 45,
    triangles: 12500
  };
  public fpsCap: number = 0; // 0 = unlimited / VSync
  public vsyncEnabled: boolean = true;

  // Internal loop
  private animFrameId: number | null = null;
  private lastTimestamp: number = 0;
  private isDestroyed: boolean = false;
  private isRunning: boolean = false;

  // Callbacks
  public onTelemetryUpdate?: (t: PlayerCarTelemetry) => void;
  public onPerfUpdate?: (p: PerformanceStats) => void;
  public onCountdownTick?: (n: number) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // WebGL Renderer with Anti-Aliasing and proper tone mapping
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25)); // Tối ưu GPU, khóa 1.25x tránh lag trên màn hình Retina
    const initialW = Math.max(320, canvas.clientWidth || window.innerWidth || 1920);
    const initialH = Math.max(240, canvas.clientHeight || window.innerHeight || 1080);
    this.renderer.setSize(initialW, initialH, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      this.camBaseFov,
      initialW / initialH,
      0.2,
      15000
    );

    this.initScene();
    this.buildTrack();
    this.buildPlayerCar();
    this.buildAIRivals();
    this.setupWeather(this.currentWeather);
    this.updatePlayerPhysics(0.016);
    this.initCameraPosition();

    // Bind window resize
    window.addEventListener('resize', this.handleResize);
  }

  public handleResize = () => {
    if (!this.canvas || this.isDestroyed) return;
    const w = Math.max(320, this.canvas.clientWidth || window.innerWidth || 1920);
    const h = Math.max(240, this.canvas.clientHeight || window.innerHeight || 1080);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  };

  private initScene() {
    this.ambientLight = new THREE.AmbientLight(0xffeedd, 1.2);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 2.2);
    this.dirLight.position.set(120, 180, 80);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 500;
    this.dirLight.shadow.camera.left = -150;
    this.dirLight.shadow.camera.right = 150;
    this.dirLight.shadow.camera.top = 150;
    this.dirLight.shadow.camera.bottom = -150;
    this.scene.add(this.dirLight);

    // Ground plane (Mở rộng 35,000m x 35,000m cho đại lộ đua 10x)
    const groundGeo = new THREE.PlaneGeometry(35000, 35000, 32, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x18241b,
      roughness: 0.95,
      metalness: 0.05
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  private buildTrack() {
    // Dọn sạch meshes cũ nếu có
    while (this.trackMeshGroup.children.length > 0) {
      this.trackMeshGroup.remove(this.trackMeshGroup.children[0]);
    }

    // Sinh đường đua từ 100 cấu trúc độc nhất, quy mô 10x (~32km - 42km)
    const points = generatePointsForLayout(this.currentLayout, 42);

    this.trackCurve = new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.5);
    this.trackCurve.arcLengthDivisions = 6000;
    this.totalTrackLength = this.trackCurve.getLength();

    // Road Ribbon Mesh (1200 segments)
    const segments = 1200;
    const roadHalfWidth = this.trackWidth / 2;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      const pt = safeGetPointAt(this.trackCurve, u);
      const tg = safeGetTangentAt(this.trackCurve, u);
      const normal = new THREE.Vector3().crossVectors(tg, new THREE.Vector3(0, 1, 0)).normalize();

      const left = pt.clone().addScaledVector(normal, -roadHalfWidth);
      const right = pt.clone().addScaledVector(normal, roadHalfWidth);

      positions.push(left.x, left.y + 0.12, left.z);
      positions.push(right.x, right.y + 0.12, right.z);

      uvs.push(0, (i / segments) * 450);
      uvs.push(1, (i / segments) * 450);

      if (i < segments) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
      }
    }

    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    roadGeo.setIndex(indices);
    roadGeo.computeVertexNormals();

    const theme = getTrackVisualTheme(this.currentLayout);
    const roadTexture = createRoadTexture(theme);

    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTexture,
      roughness: 0.65,
      metalness: 0.15,
      side: THREE.DoubleSide
    });

    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.receiveShadow = true;
    this.trackMeshGroup.add(roadMesh);

    // =========================================================================
    // VẠCH KẺ ĐƯỜNG SIÊU DÀY ĐẶC & CỘT TIÊU VEN ĐƯỜNG CHO CẢM GIÁC TỐC ĐỘ CAO
    // =========================================================================
    const centerLinesCount = 1800;
    const lineGeo = new THREE.BoxGeometry(theme.centerLineWidth, 0.06, 6.5);
    const lineMat = new THREE.MeshBasicMaterial({ color: theme.centerLineColor });
    const centerLinesMesh = new THREE.InstancedMesh(lineGeo, lineMat, centerLinesCount);
    centerLinesMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    const dummy = new THREE.Object3D();

    for (let i = 0; i < centerLinesCount; i++) {
      const u = i / centerLinesCount;
      const pt = safeGetPointAt(this.trackCurve, u);
      const tg = safeGetTangentAt(this.trackCurve, u);

      dummy.position.set(pt.x, pt.y + 0.16, pt.z);
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tg);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      centerLinesMesh.setMatrixAt(i, dummy.matrix);
    }
    centerLinesMesh.instanceMatrix.needsUpdate = true;
    this.trackMeshGroup.add(centerLinesMesh);

    // CỘT TIÊU VEN ĐƯỜNG & CỘT ĐÈN - GIẢM ĐI 3 LẦN THEO YÊU CẦU NGƯỜI DÙNG
    const up = new THREE.Vector3(0, 1, 0);
    const bollardCount = 460;
    const bollardHeight = 1.8;
    const bollardGeo = new THREE.CylinderGeometry(0.18, 0.22, bollardHeight, 8);
    const bollardMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.8 });
    const leftBollardsMesh = new THREE.InstancedMesh(bollardGeo, bollardMat, bollardCount);
    const rightBollardsMesh = new THREE.InstancedMesh(bollardGeo, bollardMat, bollardCount);
    leftBollardsMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    rightBollardsMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    const capGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.35, 8);
    const capMat = new THREE.MeshBasicMaterial({ color: theme.bollardReflectorColor });
    const leftCapsMesh = new THREE.InstancedMesh(capGeo, capMat, bollardCount);
    const rightCapsMesh = new THREE.InstancedMesh(capGeo, capMat, bollardCount);
    leftCapsMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    rightCapsMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

    for (let b = 0; b < bollardCount; b++) {
      const u = b / bollardCount;
      const pt = safeGetPointAt(this.trackCurve, u);
      const tg = safeGetTangentAt(this.trackCurve, u);
      const normal = new THREE.Vector3().crossVectors(tg, up).normalize();

      const pL = pt.clone().addScaledVector(normal, roadHalfWidth + 1.2);
      dummy.position.set(pL.x, pL.y + bollardHeight / 2, pL.z);
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tg);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      leftBollardsMesh.setMatrixAt(b, dummy.matrix);

      dummy.position.set(pL.x, pL.y + bollardHeight - 0.15, pL.z);
      dummy.updateMatrix();
      leftCapsMesh.setMatrixAt(b, dummy.matrix);

      const pR = pt.clone().addScaledVector(normal, -roadHalfWidth - 1.2);
      dummy.position.set(pR.x, pR.y + bollardHeight / 2, pR.z);
      dummy.updateMatrix();
      rightBollardsMesh.setMatrixAt(b, dummy.matrix);

      dummy.position.set(pR.x, pR.y + bollardHeight - 0.15, pR.z);
      dummy.updateMatrix();
      rightCapsMesh.setMatrixAt(b, dummy.matrix);
    }
    leftBollardsMesh.instanceMatrix.needsUpdate = true;
    rightBollardsMesh.instanceMatrix.needsUpdate = true;
    leftCapsMesh.instanceMatrix.needsUpdate = true;
    rightCapsMesh.instanceMatrix.needsUpdate = true;
    this.trackMeshGroup.add(leftBollardsMesh, rightBollardsMesh, leftCapsMesh, rightCapsMesh);

    // Cột đèn cao tầng chiếu sáng (Tall Highway Light Poles - Giảm 3 lần)
    const tallPoleCount = 115;
    const tallPoleHeight = 12;
    const tallPoleGeo = new THREE.CylinderGeometry(0.25, 0.35, tallPoleHeight, 8);
    const tallPoleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.25 });
    const leftTallPolesMesh = new THREE.InstancedMesh(tallPoleGeo, tallPoleMat, tallPoleCount);
    const rightTallPolesMesh = new THREE.InstancedMesh(tallPoleGeo, tallPoleMat, tallPoleCount);

    const tallLampGeo = new THREE.BoxGeometry(1.6, 0.3, 0.8);
    const tallLampMat = new THREE.MeshBasicMaterial({ color: theme.lampColor });
    const leftTallLampsMesh = new THREE.InstancedMesh(tallLampGeo, tallLampMat, tallPoleCount);
    const rightTallLampsMesh = new THREE.InstancedMesh(tallLampGeo, tallLampMat, tallPoleCount);

    for (let p = 0; p < tallPoleCount; p++) {
      const u = p / tallPoleCount;
      const pt = safeGetPointAt(this.trackCurve, u);
      const tg = safeGetTangentAt(this.trackCurve, u);
      const normal = new THREE.Vector3().crossVectors(tg, up).normalize();

      const pL = pt.clone().addScaledVector(normal, roadHalfWidth + 3.8);
      dummy.position.set(pL.x, pL.y + tallPoleHeight / 2, pL.z);
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tg);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      leftTallPolesMesh.setMatrixAt(p, dummy.matrix);

      dummy.position.set(pL.x, pL.y + tallPoleHeight, pL.z);
      dummy.updateMatrix();
      leftTallLampsMesh.setMatrixAt(p, dummy.matrix);

      const pR = pt.clone().addScaledVector(normal, -roadHalfWidth - 3.8);
      dummy.position.set(pR.x, pR.y + tallPoleHeight / 2, pR.z);
      dummy.updateMatrix();
      rightTallPolesMesh.setMatrixAt(p, dummy.matrix);

      dummy.position.set(pR.x, pR.y + tallPoleHeight, pR.z);
      dummy.updateMatrix();
      rightTallLampsMesh.setMatrixAt(p, dummy.matrix);
    }
    leftTallPolesMesh.instanceMatrix.needsUpdate = true;
    rightTallPolesMesh.instanceMatrix.needsUpdate = true;
    leftTallLampsMesh.instanceMatrix.needsUpdate = true;
    rightTallLampsMesh.instanceMatrix.needsUpdate = true;
    this.trackMeshGroup.add(leftTallPolesMesh, rightTallPolesMesh, leftTallLampsMesh, rightTallLampsMesh);

    // Gờ mép đường (curb) 2 bên giảm bớt và ngắt quãng thoáng đãng (giảm 4 lần)
    const curbSegments = 90;
    for (let i = 0; i < curbSegments; i += 2) {
      if ((i / 2) % 3 === 2) continue; // Bớt đi các đoạn thừa

      const u = i / curbSegments;
      const pt = safeGetPointAt(this.trackCurve, u);
      const tg = safeGetTangentAt(this.trackCurve, u);
      const normal = new THREE.Vector3().crossVectors(tg, new THREE.Vector3(0, 1, 0)).normalize();

      const isWhite = (i / 2) % 2 === 0;
      const curbMat = new THREE.MeshStandardMaterial({
        color: isWhite ? 0xffffff : 0xef4444,
        roughness: 0.5
      });

      const curbGeo = new THREE.BoxGeometry(0.8, 0.2, 4.0);
      const curbL = new THREE.Mesh(curbGeo, curbMat);
      curbL.position.copy(pt).addScaledVector(normal, -roadHalfWidth - 0.4);
      curbL.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tg);
      this.trackMeshGroup.add(curbL);

      const curbR = new THREE.Mesh(curbGeo, curbMat);
      curbR.position.copy(pt).addScaledVector(normal, roadHalfWidth + 0.4);
      curbR.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tg);
      this.trackMeshGroup.add(curbR);
    }

    // Start / Finish Arch Gantry
    const startPt = safeGetPointAt(this.trackCurve, 0);
    const startTg = safeGetTangentAt(this.trackCurve, 0);
    const startNorm = new THREE.Vector3().crossVectors(startTg, new THREE.Vector3(0, 1, 0)).normalize();

    const archGroup = new THREE.Group();
    const pillarGeo = new THREE.CylinderGeometry(0.4, 0.4, 7, 12);
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });

    const pLeft = new THREE.Mesh(pillarGeo, metalMat);
    pLeft.position.copy(startPt).addScaledVector(startNorm, -roadHalfWidth - 1.2);
    pLeft.position.y += 3.5;
    archGroup.add(pLeft);

    const pRight = new THREE.Mesh(pillarGeo, metalMat);
    pRight.position.copy(startPt).addScaledVector(startNorm, roadHalfWidth + 1.2);
    pRight.position.y += 3.5;
    archGroup.add(pRight);

    const beamGeo = new THREE.BoxGeometry(this.trackWidth + 3, 1.2, 1.2);
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshStandardMaterial({ color: theme.archColor, metalness: 0.5, roughness: 0.4 }));
    beam.position.copy(startPt);
    beam.position.y += 7.0;
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), startNorm);
    archGroup.add(beam);

    this.trackMeshGroup.add(archGroup);
    this.scene.add(this.trackMeshGroup);
  }

  private buildPlayerCar() {
    // High-End Sports GT Car Mesh
    this.playerGroup = new THREE.Group();

    // Body
    const bodyGeo = new THREE.BoxGeometry(2.1, 0.65, 4.4);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x2563eb, // Metallic Racing Blue
      roughness: 0.25,
      metalness: 0.85
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.55;
    body.castShadow = true;
    this.playerGroup.add(body);

    // Cabin
    const cabinGeo = new THREE.BoxGeometry(1.6, 0.5, 2.2);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      roughness: 0.1,
      metalness: 0.9,
      transmission: 0.6,
      transparent: true
    });
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(0, 1.0, -0.2);
    cabin.castShadow = true;
    this.playerGroup.add(cabin);

    // Rear Wing
    const wingGeo = new THREE.BoxGeometry(2.0, 0.08, 0.4);
    const carbonMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.4, metalness: 0.8 });
    const wing = new THREE.Mesh(wingGeo, carbonMat);
    wing.position.set(0, 1.15, -2.0);
    this.playerGroup.add(wing);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.35, 20);
    wheelGeo.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.9 });

    const wheelOffsets = [
      { x: -1.05, y: 0.38, z: 1.35 },
      { x: 1.05, y: 0.38, z: 1.35 },
      { x: -1.05, y: 0.38, z: -1.35 },
      { x: 1.05, y: 0.38, z: -1.35 }
    ];

    this.playerWheels = [];
    wheelOffsets.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeo, tireMat);
      wheel.position.set(pos.x, pos.y, pos.z);
      wheel.castShadow = true;
      this.playerGroup.add(wheel);
      this.playerWheels.push(wheel);
    });

    // Headlights
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
    const hlGeo = new THREE.BoxGeometry(0.35, 0.12, 0.05);

    const hlLeft = new THREE.Mesh(hlGeo, hlMat);
    hlLeft.position.set(-0.7, 0.58, 2.21);
    this.playerGroup.add(hlLeft);

    const hlRight = new THREE.Mesh(hlGeo, hlMat);
    hlRight.position.set(0.7, 0.58, 2.21);
    this.playerGroup.add(hlRight);

    // Spotlights for night driving
    const spotLeft = new THREE.SpotLight(0xffffff, 0, 80, Math.PI / 6, 0.3);
    spotLeft.position.set(-0.7, 0.6, 2.2);
    this.playerGroup.add(spotLeft);
    this.playerHeadlights.push(spotLeft);

    const spotRight = new THREE.SpotLight(0xffffff, 0, 80, Math.PI / 6, 0.3);
    spotRight.position.set(0.7, 0.6, 2.2);
    this.playerGroup.add(spotRight);
    this.playerHeadlights.push(spotRight);

    // Taillights
    const tlMat = new THREE.MeshBasicMaterial({ color: 0xdc2626 });
    const tlGeo = new THREE.BoxGeometry(0.4, 0.1, 0.05);

    const tlLeft = new THREE.Mesh(tlGeo, tlMat);
    tlLeft.position.set(-0.7, 0.6, -2.21);
    this.playerGroup.add(tlLeft);
    this.playerTaillights.push(tlLeft);

    const tlRight = new THREE.Mesh(tlGeo, tlMat);
    tlRight.position.set(0.7, 0.6, -2.21);
    this.playerGroup.add(tlRight);
    this.playerTaillights.push(tlRight);

    // Attach high-fidelity 3D USDZ car model for player
    const playerPlaceholders = [body, cabin, wing, ...this.playerWheels, hlLeft, hlRight, tlLeft, tlRight];
    carModelManager.attachCarVisual({ group: this.playerGroup, wheels: this.playerWheels }, 2, playerPlaceholders);

    // Wind Streaks / Hyperspace Supersonic Lines (Vệt tốc độ xé gió siêu thực)
    const streakCount = 180;
    const streakPositions = new Float32Array(streakCount * 2 * 3);
    for (let i = 0; i < streakCount; i++) {
      const sx = (Math.random() - 0.5) * 14;
      const sy = Math.random() * 3.5 + 0.3;
      const sz = Math.random() * 50 - 25;
      streakPositions[i * 6 + 0] = sx;
      streakPositions[i * 6 + 1] = sy;
      streakPositions[i * 6 + 2] = sz;
      streakPositions[i * 6 + 3] = sx;
      streakPositions[i * 6 + 4] = sy;
      streakPositions[i * 6 + 5] = sz - 3.0;
    }
    const streakGeo = new THREE.BufferGeometry();
    streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPositions, 3));
    const streakMat = new THREE.LineBasicMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending
    });
    this.speedStreaks = new THREE.LineSegments(streakGeo, streakMat);
    this.playerGroup.add(this.speedStreaks);

    this.scene.add(this.playerGroup);
  }

  private buildAIRivals() {
    const aiConfigs = [
      { id: 'ai_1', name: 'Phantom GT #7', driverName: 'Cristiano Ronaldo', color: 0x2563eb, offset: 0.34, progress: 0.055, modelIndex: 1 },
      { id: 'ai_2', name: 'Viper RS #11', driverName: 'Neymar Jr.', color: 0xeab308, offset: -0.34, progress: 0.048, modelIndex: 2 },
      { id: 'ai_3', name: 'Apex Predator #23', driverName: 'David Beckham', color: 0x16a34a, offset: 0.0, progress: 0.042, modelIndex: 3 },
      { id: 'ai_4', name: 'Nebula Turbo #10', driverName: 'Kylian Mbappé', color: 0x9333ea, offset: -0.68, progress: 0.036, modelIndex: 4 },
      { id: 'ai_5', name: 'Cyber Falcon #80', driverName: 'Ronaldinho', color: 0x06b6d4, offset: 0.68, progress: 0.030, modelIndex: 5 },
      { id: 'ai_6', name: 'Solar Flare #9', driverName: 'Ronaldo Nazário', color: 0xea580c, offset: 0.34, progress: 0.025, modelIndex: 6 },
      { id: 'ai_7', name: 'Thunderbolt #5', driverName: 'Zinedine Zidane', color: 0xec4899, offset: -0.34, progress: 0.020, modelIndex: 7 },
      { id: 'ai_8', name: 'Spectre RS #10', driverName: 'Pelé', color: 0xf59e0b, offset: 0.0, progress: 0.015, modelIndex: 8 },
      { id: 'ai_9', name: 'Titan Hyper #11', driverName: 'Zlatan Ibrahimović', color: 0x334155, offset: -0.68, progress: 0.011, modelIndex: 9 },
      { id: 'ai_10', name: 'Vortex 9 #10', driverName: 'Diego Maradona', color: 0x0284c7, offset: 0.68, progress: 0.007, modelIndex: 0 },
      { id: 'ai_11', name: 'Zenith F1 #14', driverName: 'Thierry Henry', color: 0xb91c1c, offset: -0.34, progress: 0.003, modelIndex: 2 }
    ];

    this.aiRivals = [];

    aiConfigs.forEach((cfg, idx) => {
      const g = new THREE.Group();

      const bodyGeo = new THREE.BoxGeometry(2.0, 0.65, 4.3);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: cfg.color,
        roughness: 0.3,
        metalness: 0.75
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.55;
      body.castShadow = true;
      g.add(body);

      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.48, 2.0),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.8 })
      );
      cabin.position.set(0, 0.95, -0.2);
      g.add(cabin);

      const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.35, 16);
      wheelGeo.rotateZ(Math.PI / 2);
      const wheels: THREE.Mesh[] = [];
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1c1917 });

      [
        { x: -1.0, y: 0.38, z: 1.3 },
        { x: 1.0, y: 0.38, z: 1.3 },
        { x: -1.0, y: 0.38, z: -1.3 },
        { x: 1.0, y: 0.38, z: -1.3 }
      ].forEach(pos => {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.position.set(pos.x, pos.y, pos.z);
        g.add(w);
        wheels.push(w);
      });

      // Attach authentic 3D USDZ car model
      carModelManager.attachCarVisual({ group: g, wheels: wheels }, cfg.modelIndex, [body, cabin, ...wheels]);

      this.scene.add(g);

      this.aiRivals.push({
        id: cfg.id,
        name: cfg.name,
        driverName: cfg.driverName,
        color: cfg.color,
        lapProgress: cfg.progress,
        lateralOffset: cfg.offset,
        targetLateralOffset: cfg.offset,
        laneChangeTimer: 1.0 + idx * 0.2,
        speed: 0,
        targetSpeed: 440 + (idx % 4) * 12,
        maxSpeed: 780 + Math.random() * 40,
        lap: 1,
        rank: idx + 2,
        meshGroup: g,
        wheels,
        meshIndex: cfg.modelIndex,
        isDrifting: false,
        isHyperBoosting: false,
        overtakePullAwayDist: 0,
        attackPhaseTimer: 1.0 + (idx * 0.4) % 2.5,
        nitroCooldown: 0
      });
    });
  }

  public setupWeather(weather: WeatherType) {
    this.currentWeather = weather;

    if (this.rainParticles) {
      this.scene.remove(this.rainParticles);
      this.rainParticles = undefined;
    }

    if (weather === 'SUNNY') {
      this.scene.background = new THREE.Color(0x38bdf8);
      this.scene.fog = new THREE.FogExp2(0xbae6fd, 0.00025);
      this.ambientLight.color.setHex(0xffffff);
      this.ambientLight.intensity = 1.4;
      this.dirLight.color.setHex(0xfffbeb);
      this.dirLight.intensity = 2.4;
      this.playerHeadlights.forEach(h => (h.intensity = 0));
    } else if (weather === 'SUNSET') {
      this.scene.background = new THREE.Color(0x281424);
      this.scene.fog = new THREE.FogExp2(0xd97706, 0.00035);
      this.ambientLight.color.setHex(0xfed7aa);
      this.ambientLight.intensity = 1.2;
      this.dirLight.color.setHex(0xfb923c);
      this.dirLight.intensity = 2.0;
      this.playerHeadlights.forEach(h => (h.intensity = 20));
    } else if (weather === 'NIGHT') {
      this.scene.background = new THREE.Color(0x030712);
      this.scene.fog = new THREE.FogExp2(0x0f172a, 0.00045);
      this.ambientLight.color.setHex(0x1e293b);
      this.ambientLight.intensity = 0.5;
      this.dirLight.color.setHex(0x38bdf8);
      this.dirLight.intensity = 0.6;
      this.playerHeadlights.forEach(h => (h.intensity = 80));
    } else if (weather === 'RAIN') {
      this.scene.background = new THREE.Color(0x1e293b);
      this.scene.fog = new THREE.FogExp2(0x334155, 0.0005);
      this.ambientLight.color.setHex(0x94a3b8);
      this.ambientLight.intensity = 0.8;
      this.dirLight.color.setHex(0xcbd5e1);
      this.dirLight.intensity = 1.2;
      this.playerHeadlights.forEach(h => (h.intensity = 40));

      // Build Rain Particle System
      const rainCount = 3000;
      const rainGeo = new THREE.BufferGeometry();
      const rainPos: number[] = [];
      for (let i = 0; i < rainCount; i++) {
        rainPos.push(
          Math.random() * 300 - 150,
          Math.random() * 60 + 5,
          Math.random() * 300 - 150
        );
      }
      rainGeo.setAttribute('position', new THREE.Float32BufferAttribute(rainPos, 3));
      const rainMat = new THREE.PointsMaterial({
        color: 0x93c5fd,
        size: 0.25,
        transparent: true,
        opacity: 0.65
      });
      this.rainParticles = new THREE.Points(rainGeo, rainMat);
      this.scene.add(this.rainParticles);
    }
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTimestamp = performance.now();
    this.animate(this.lastTimestamp);
  }

  public stop() {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private animate = (timestamp: number) => {
    if (!this.isRunning || this.isDestroyed) return;

    this.animFrameId = requestAnimationFrame(this.animate);

    const delta = Math.min(0.06, (timestamp - this.lastTimestamp) / 1000);
    this.lastTimestamp = timestamp;

    const gameThreadStart = performance.now();

    // 1. Race Flow & Countdown
    if (this.raceState === 'COUNTDOWN') {
      this.countdownTimer -= delta;
      if (this.onCountdownTick) {
        this.onCountdownTick(Math.max(0, Math.ceil(this.countdownTimer)));
      }
      if (this.countdownTimer <= 0) {
        this.raceState = 'RACING';
        audioEngine.playCountdownBeep(true);
      }
    } else if (this.raceState === 'RACING') {
      this.currentLapTime += delta;
    }

    // 2. Physics & Player Car Update
    this.updatePlayerPhysics(delta);

    // 3. AI Opponents Update
    this.updateAIOpponents(delta);

    // 4. Update Race Standings & Checkpoints
    this.updateLeaderboard();

    // 5. Camera Director Update
    this.updateCamera(delta);

    // 6. Rain System Animation
    if (this.rainParticles) {
      const posAttr = this.rainParticles.geometry.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        let y = posAttr.getY(i) - delta * 45;
        if (y < 0) y = 60;
        posAttr.setY(i, y);
      }
      posAttr.needsUpdate = true;
    }

    const gameThreadTime = performance.now() - gameThreadStart;

    // 7. Render Pass
    const renderThreadStart = performance.now();
    this.renderer.render(this.scene, this.camera);
    const renderThreadTime = performance.now() - renderThreadStart;

    // 8. Profiler & Frame Pacing Calculation
    this.updatePerformanceMetrics(delta, gameThreadTime, renderThreadTime);

    // 9. Sound Engine Synchronization
    audioEngine.update(
      this.playerRpm,
      this.input.throttle,
      this.isDrifting,
      this.input.brake > 0.4,
      this.playerSpeed
    );

    // 10. Emit Telemetry
    if (this.onTelemetryUpdate) {
      this.onTelemetryUpdate({
        speedKmh: Math.round(this.playerSpeed),
        rpm: Math.round(this.playerRpm),
        gear: this.playerGear,
        throttle: this.input.throttle,
        brake: this.input.brake,
        steer: this.input.steer,
        handbrake: this.input.handbrake,
        isDrifting: this.isDrifting,
        driftAngle: this.driftAngle,
        isAbsActive: this.isAbsActive,
        isTcsActive: this.isTcsActive,
        gForceLat: (this.playerSpeed / 100) * this.playerSteerAngle * 1.6,
        gForceLong: (this.input.throttle - this.input.brake) * 1.2,
        lap: this.playerLap,
        rank: this.getPlayerRank(),
        lapProgress: this.playerLapProgress,
        currentLapTime: this.currentLapTime,
        bestLapTime: this.bestLapTime,
        lastLapTime: this.lastLapTime,
        isWrongWay: this.isWrongWay,
        damagePct: Math.round(this.damagePct)
      });
    }
  };

  private updatePlayerPhysics(delta: number) {
    if (this.raceState === 'COUNTDOWN') {
      // Pre-race revving
      if (this.input.throttle > 0) {
        this.playerRpm = Math.min(6500, this.playerRpm + this.input.throttle * 3000 * delta);
      } else {
        this.playerRpm = Math.max(900, this.playerRpm - 1500 * delta);
      }
      return;
    }

    // Drivetrain Gearbox Simulation (Upgraded for 450 - 520 km/h hyper-speed)
    const gearRatios = [3.82, 2.36, 1.69, 1.31, 1.0, 0.82];
    const maxSpeedsPerGear = [90, 175, 270, 370, 450, 520];

    // Throttle & Braking calculation
    let effectiveThrottle = this.input.throttle;
    let effectiveBrake = this.input.brake;

    // Driving Assist: Traction Control (TCS)
    this.isTcsActive = false;
    if (this.assistMode !== 'SIMULATION' && this.isDrifting && effectiveThrottle > 0.6) {
      effectiveThrottle *= this.assistMode === 'BEGINNER' ? 0.4 : 0.7;
      this.isTcsActive = true;
    }

    // Driving Assist: ABS
    this.isAbsActive = false;
    if (this.assistMode !== 'SIMULATION' && effectiveBrake > 0.7 && this.playerSpeed > 30) {
      this.isAbsActive = true;
      effectiveBrake = 0.8;
    }

    // Acceleration & Drag (Blistering 460 - 520 km/h response)
    const maxEnginePower = 780 * (1 - this.damagePct * 0.005); // Reduced by damage
    if (effectiveThrottle > 0) {
      const accelRate = (maxEnginePower / 780) * 22.5 * (1.25 - this.playerSpeed / 560);
      this.playerSpeed += accelRate * effectiveThrottle * delta * 60;
    } else {
      // Engine braking & rolling resistance
      this.playerSpeed = Math.max(0, this.playerSpeed - 18 * delta);
    }

    // Braking
    if (effectiveBrake > 0) {
      const brakeForce = 95 * effectiveBrake;
      this.playerSpeed = Math.max(0, this.playerSpeed - brakeForce * delta);
    }

    // Handbrake
    if (this.input.handbrake) {
      this.playerSpeed = Math.max(0, this.playerSpeed - 45 * delta);
      this.isDrifting = this.playerSpeed > 35;
    }

    // Surface friction adjustment (Rain reduces grip)
    const surfaceGrip = this.currentWeather === 'RAIN' ? 0.65 : 1.0;

    // Steering & Lateral Slip
    const maxSteerSpeedFactor = Math.max(0.20, 1.0 - (this.playerSpeed / 520) * 0.70);
    const targetSteerAngle = this.input.steer * maxSteerSpeedFactor;
    this.playerSteerAngle = THREE.MathUtils.lerp(this.playerSteerAngle, targetSteerAngle, delta * 12);

    // Calculate lateral shift along track width
    const lateralSpeed = (this.playerSpeed / 120) * this.playerSteerAngle * 0.45 * surfaceGrip;
    this.playerLateralOffset = Math.max(-0.85, Math.min(0.85, this.playerLateralOffset + lateralSpeed * delta));

    // Drift Detection
    if (Math.abs(this.playerSteerAngle) > 0.4 && this.playerSpeed > 75) {
      this.isDrifting = true;
      this.driftAngle = this.playerSteerAngle * 0.4;
    } else if (!this.input.handbrake) {
      this.isDrifting = false;
      this.driftAngle = THREE.MathUtils.lerp(this.driftAngle, 0, delta * 5);
    }

    // Gear & RPM Update
    for (let g = 0; g < maxSpeedsPerGear.length; g++) {
      if (this.playerSpeed <= maxSpeedsPerGear[g]) {
        this.playerGear = g + 1;
        break;
      }
    }
    const currentGearMaxSpeed = maxSpeedsPerGear[this.playerGear - 1];
    const prevGearMaxSpeed = this.playerGear > 1 ? maxSpeedsPerGear[this.playerGear - 2] : 0;
    const gearFraction = (this.playerSpeed - prevGearMaxSpeed) / (currentGearMaxSpeed - prevGearMaxSpeed + 1e-4);
    this.playerRpm = Math.max(900, Math.min(8200, 1800 + gearFraction * 6000));

    // Progress along spline track (Tỉ lệ xé gió 2.4x mang lại cảm giác 480 - 520 km/h cực đỉnh)
    const speedUnitsPerSec = ((this.playerSpeed * 1000) / 3600) * 2.4;
    const progressDelta = (speedUnitsPerSec * delta) / this.totalTrackLength;
    this.playerLapProgress += progressDelta;

    // Lap Completion
    if (this.playerLapProgress >= 1.0) {
      this.playerLapProgress -= 1.0;
      this.playerLap++;
      this.lastLapTime = this.currentLapTime;
      if (this.bestLapTime === 0 || this.currentLapTime < this.bestLapTime) {
        this.bestLapTime = this.currentLapTime;
      }
      this.currentLapTime = 0;

      if (this.playerLap > this.totalLaps) {
        this.raceState = 'FINISHED';
      }
    }

    // Update 3D Transform on Curve with stable right-handed Frenet basis (zero jitter, zero flips)
    const safeT = getSafeCurveU(this.playerLapProgress);
    const centerPoint = safeGetPointAt(this.trackCurve, safeT);
    const tangent = safeGetTangentAt(this.trackCurve, safeT);
    const worldUp = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(worldUp, tangent).normalize();
    const up = new THREE.Vector3().crossVectors(tangent, right).normalize();

    // Lateral displacement along road right vector
    const roadWidthOffset = this.playerLateralOffset * (this.trackWidth * 0.45);
    const carPos = centerPoint.clone().addScaledVector(right, roadWidthOffset);
    this.playerGroup.position.copy(carPos);

    // Continuous Right-Handed Frenet basis matrix - zero gimbal lock, zero backward flips, ultra smooth
    const basisMat = new THREE.Matrix4().makeBasis(right, up, tangent);
    this.playerGroup.quaternion.setFromRotationMatrix(basisMat);
    const steerYaw = -this.playerSteerAngle * 0.25 - this.driftAngle;
    if (Math.abs(steerYaw) > 0.001) {
      this.playerGroup.rotateOnAxis(new THREE.Vector3(0, 1, 0), steerYaw);
    }

    // Rotate Wheels
    const wheelRotSpeed = (speedUnitsPerSec / 0.38) * delta;
    this.playerWheels.forEach((w, idx) => {
      w.rotation.x += wheelRotSpeed;
      if (idx < 2) {
        w.rotation.y = this.playerSteerAngle * 0.5; // Steer front wheels
      }
    });

    // Wind Streaks Animation (Vệt tốc độ siêu thực bắn ngược về sau)
    if (this.speedStreaks) {
      const streakMat = this.speedStreaks.material as THREE.LineBasicMaterial;
      if (this.playerSpeed > 150) {
        const speedRatio = Math.min(1.0, (this.playerSpeed - 150) / 300);
        streakMat.opacity = speedRatio * 0.75;
        const posAttr = this.speedStreaks.geometry.attributes.position as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        const streamSpeed = (this.playerSpeed * 0.28) * delta;
        for (let i = 0; i < arr.length / 6; i++) {
          const idx = i * 6;
          arr[idx + 2] -= streamSpeed;
          arr[idx + 5] = arr[idx + 2] - (2.0 + speedRatio * 4.0);
          if (arr[idx + 2] < -18) {
            arr[idx + 2] = 22 + Math.random() * 15;
            arr[idx + 5] = arr[idx + 2] - (2.0 + speedRatio * 4.0);
            arr[idx + 0] = (Math.random() - 0.5) * 14;
            arr[idx + 3] = arr[idx + 0];
            arr[idx + 1] = Math.random() * 3.5 + 0.3;
            arr[idx + 4] = arr[idx + 1];
          }
        }
        posAttr.needsUpdate = true;
      } else {
        streakMat.opacity = 0;
      }
    }

    // Wrong way detection
    const carForward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.playerGroup.quaternion);
    this.isWrongWay = carForward.dot(tangent) < -0.3;
  }

  private updateAIOpponents(delta: number) {
    const AVAILABLE_LANES = [-0.68, -0.34, 0.0, 0.34, 0.68];
    const playerProgress = this.playerLapProgress;
    const playerOffset = this.playerLateralOffset;
    const playerSpd = this.playerSpeed;

    this.aiRivals.forEach((ai, i) => {
      // Giảm timer đổi làn & hồi phục
      ai.laneChangeTimer = (ai.laneChangeTimer ?? 0.8) - delta;
      ai.attackPhaseTimer = (ai.attackPhaseTimer ?? (1.0 + (i * 0.5) % 2.5)) - delta;
      ai.nitroCooldown = (ai.nitroCooldown ?? 0) - delta;

      if (this.raceState === 'RACING') {
        // Quét khoảng cách tới xe người chơi và các xe AI khác
        let carAheadDist = 9999;
        let carAheadSpeed = 400;
        let isAlongsideAnyCar = false;

        // 1. So sánh với xe người chơi
        let distToPlayer = (playerProgress - ai.lapProgress);
        if (distToPlayer < -0.5) distToPlayer += 1.0;
        if (distToPlayer > 0.5) distToPlayer -= 1.0;
        const playerWorldDist = distToPlayer * this.totalTrackLength;

        if (playerWorldDist > 0 && playerWorldDist < 250) {
          carAheadDist = playerWorldDist;
          carAheadSpeed = playerSpd;
        }
        if (Math.abs(playerWorldDist) < 18 && Math.abs(ai.lateralOffset - playerOffset) > 0.18) {
          isAlongsideAnyCar = true;
        }

        // 2. So sánh với các đối thủ AI khác
        for (let j = 0; j < this.aiRivals.length; j++) {
          if (i === j) continue;
          const other = this.aiRivals[j];
          let dist = (other.lapProgress - ai.lapProgress);
          if (dist < -0.5) dist += 1.0;
          if (dist > 0.5) dist -= 1.0;
          const wDist = dist * this.totalTrackLength;

          if (wDist > 0 && wDist < carAheadDist) {
            carAheadDist = wDist;
            carAheadSpeed = other.speed;
          }
          if (Math.abs(wDist) < 18 && Math.abs(ai.lateralOffset - other.lateralOffset) > 0.18) {
            isAlongsideAnyCar = true;
          }
        }

        // =====================================================================
        // TĂNG TỐC VƯỢT MẶT KHỐC LIỆT GẤP 10 LẦN - BỨT XA 300 ĐẾN 500 MÉT
        // =====================================================================
        let isHyper = false;

        // A. Đợt tấn công định kỳ mỗi 1.5 - 3.5 giây
        if (ai.attackPhaseTimer <= 0) {
          ai.attackPhaseTimer = 2.0 + Math.random() * 2.5;
          ai.overtakePullAwayDist = 1;
        }

        // B. Núp gió và bắn vọt (Slipstream Slingshot) khi có xe phía trước < 120m
        if (carAheadDist < 120) {
          if (ai.overtakePullAwayDist <= 0) {
            ai.overtakePullAwayDist = 1;
          }
        }

        // C. Phá vỡ thế đi ngang hàng (Anti-Side-by-Side Stalemate)
        if (isAlongsideAnyCar) {
          ai.overtakePullAwayDist = Math.max(ai.overtakePullAwayDist, 1);
        }

        // D. Duy trì bứt tốc xa 300m - 500m lên phía trước
        if (ai.overtakePullAwayDist > 0) {
          ai.overtakePullAwayDist += delta * (ai.speed / 3.6);
          if (ai.overtakePullAwayDist < 480) {
            isHyper = true;
          } else {
            ai.overtakePullAwayDist = 0;
            ai.nitroCooldown = 1.8;
          }
        }

        ai.isHyperBoosting = isHyper;

        // Vận tốc mục tiêu: Bình thường 440-470 km/h, bứt tốc Hyper-Nitro lên 720-800 km/h!
        const baseSpeed = 440 + (i % 4) * 12;
        if (isHyper) {
          ai.targetSpeed = 730 + (i % 3) * 35;
        } else if (carAheadDist < 120) {
          ai.targetSpeed = Math.max(baseSpeed + 80, carAheadSpeed + 85);
        } else {
          ai.targetSpeed = baseSpeed;
        }

        // Gia tốc bứt phá sấm sét: +160 km/h mỗi giây khi bứt phá
        if (ai.speed < ai.targetSpeed) {
          const accel = isHyper ? 160.0 : 38.0;
          ai.speed = Math.min(ai.targetSpeed, ai.speed + accel * delta);
        } else if (ai.speed > ai.targetSpeed) {
          ai.speed = Math.max(ai.targetSpeed, ai.speed - 22.0 * delta);
        }

        // Chiến thuật đảo làn liên tục để vượt xe
        if (ai.laneChangeTimer <= 0 || (isHyper && carAheadDist < 45) || isAlongsideAnyCar) {
          ai.laneChangeTimer = 0.8 + Math.random() * 1.0;
          // Chọn làn thoáng nhất
          const targetLane = AVAILABLE_LANES[Math.floor(Math.random() * AVAILABLE_LANES.length)];
          ai.targetLateralOffset = targetLane;
        }

        // Di chuyển mượt mà giữa các làn
        ai.lateralOffset = THREE.MathUtils.lerp(
          ai.lateralOffset,
          ai.targetLateralOffset,
          Math.min(1.0, delta * 3.8)
        );

        // Cập nhật tiến trình vòng đua
        const speedUnitsPerSec = ((ai.speed * 1000) / 3600) * 2.4;
        ai.lapProgress += (speedUnitsPerSec * delta) / this.totalTrackLength;

        if (ai.lapProgress >= 1.0) {
          ai.lapProgress -= 1.0;
          ai.lap++;
        }
      }

      // 3D placement with right-handed Frenet frame (Right = WorldUp x Tangent, Up = Tangent x Right)
      const safeT = getSafeCurveU(ai.lapProgress);
      const centerPoint = safeGetPointAt(this.trackCurve, safeT);
      const tangent = safeGetTangentAt(this.trackCurve, safeT);
      const worldUp = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(worldUp, tangent).normalize();
      const up = new THREE.Vector3().crossVectors(tangent, right).normalize();

      const offsetDist = ai.lateralOffset * (this.trackWidth * 0.45);
      ai.meshGroup.position.copy(centerPoint).addScaledVector(right, offsetDist);

      const aiMat = new THREE.Matrix4().makeBasis(right, up, tangent);
      ai.meshGroup.quaternion.setFromRotationMatrix(aiMat);

      // Rotate AI wheels
      const wRot = ((ai.speed * 1000) / 3600 / 0.38) * delta;
      ai.wheels.forEach(w => (w.rotation.x += wRot));
    });
  }

  private updateLeaderboard() {
    this.playerTotalScore = this.playerLap * 100000 + this.playerLapProgress * 10000;

    const scores = [
      { id: 'player', score: this.playerTotalScore },
      ...this.aiRivals.map(ai => ({
        id: ai.id,
        score: ai.lap * 100000 + ai.lapProgress * 10000
      }))
    ];

    scores.sort((a, b) => b.score - a.score);

    scores.forEach((s, idx) => {
      if (s.id !== 'player') {
        const ai = this.aiRivals.find(c => c.id === s.id);
        if (ai) ai.rank = idx + 1;
      }
    });
  }

  public getPlayerRank(): number {
    const scores = [
      { id: 'player', score: this.playerTotalScore },
      ...this.aiRivals.map(ai => ({
        id: ai.id,
        score: ai.lap * 100000 + ai.lapProgress * 10000
      }))
    ];
    scores.sort((a, b) => b.score - a.score);
    return scores.findIndex(s => s.id === 'player') + 1;
  }

  public getFullStartingGrid(): { id: string; name: string; driverName: string; rank: number; speed: number; lap: number; progress: number; color: string; isPlayer: boolean; carType: string }[] {
    const list = [
      {
        id: 'player',
        name: 'Hyper Predator #10',
        driverName: 'Lionel Messi',
        score: this.playerTotalScore,
        speed: Math.round(this.playerSpeed),
        lap: this.playerLap,
        progress: this.playerLapProgress,
        color: '#dc2626',
        isPlayer: true,
        carType: 'HYPER'
      },
      ...this.aiRivals.map((ai, idx) => ({
        id: ai.id,
        name: ai.name,
        driverName: ai.driverName,
        score: ai.lap * 100000 + ai.lapProgress * 10000,
        speed: Math.round(ai.speed),
        lap: ai.lap,
        progress: ai.lapProgress,
        color: `#${ai.color.toString(16).padStart(6, '0')}`,
        isPlayer: false,
        carType: idx % 2 === 0 ? 'F1' : 'HYPER'
      }))
    ];
    list.sort((a, b) => b.score - a.score);
    return list.map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  private updateCamera(delta: number) {
    const carPos = this.playerGroup.position;
    const carQuat = this.playerGroup.quaternion;
    const carForward = new THREE.Vector3(0, 0, 1).applyQuaternion(carQuat);
    const carUp = new THREE.Vector3(0, 1, 0).applyQuaternion(carQuat);
    const carRight = new THREE.Vector3().crossVectors(carForward, carUp).normalize();

    let targetCamPos = new THREE.Vector3();
    let targetLookAt = new THREE.Vector3();

    if (this.cameraMode === 'CHASE') {
      // Dynamic Chase thể thao bám sát đuôi xe với cự ly ổn định 5.6m - 7m
      const chaseDist = 5.6 + (this.playerSpeed / 500) * 1.5;
      const chaseHeight = 1.75;
      targetCamPos = carPos.clone().addScaledVector(carForward, -chaseDist).addScaledVector(carUp, chaseHeight);
      targetLookAt = carPos.clone().addScaledVector(carForward, 12.0).addScaledVector(carUp, 0.75);

      // Speed FOV: Mở rộng góc nhìn từ 68° lên tới 88° ở 500 km/h
      const speedRatio = Math.min(1.0, this.playerSpeed / 500);
      const targetFov = this.camBaseFov + Math.pow(speedRatio, 1.25) * 20;
      this.camCurrentFov = THREE.MathUtils.lerp(this.camCurrentFov, targetFov, delta * 6.0);
      this.camera.fov = this.camCurrentFov;
      this.camera.updateProjectionMatrix();

      // Vi chấn khí động học nhẹ nhàng
      if (this.playerSpeed > 250) {
        const shakeRatio = Math.min(1.0, (this.playerSpeed - 250) / 250);
        const shakeIntensity = Math.pow(shakeRatio, 2.0) * 0.035;
        const shakeTime = performance.now() * 0.035;
        const localShakeX = Math.sin(shakeTime * 2.1) * shakeIntensity;
        const localShakeY = Math.cos(shakeTime * 3.3) * (shakeIntensity * 0.5);
        targetCamPos.addScaledVector(carRight, localShakeX).addScaledVector(carUp, localShakeY);
      }
    } else if (this.cameraMode === 'HELICOPTER') {
      // 1. TRỰC THĂNG TRUYỀN HÌNH (HELICAM): Trên cao 38m, lượn theo xe với zoom telephoto đầm chắc
      targetCamPos = carPos.clone()
        .addScaledVector(carForward, -46.0)
        .addScaledVector(carRight, 22.0)
        .addScaledVector(carUp, 36.0);
      targetLookAt = carPos.clone().addScaledVector(carForward, 18.0).addScaledVector(carUp, 1.0);
      this.camera.fov = 34;
      this.camera.updateProjectionMatrix();
    } else if (this.cameraMode === 'DRONE') {
      // 2. DRONE BAY SIÊU TỐC (RACING FLYCAM): Bám lượn xé gió trên cao 8m - 12m
      targetCamPos = carPos.clone()
        .addScaledVector(carForward, -18.0)
        .addScaledVector(carRight, 3.5)
        .addScaledVector(carUp, 8.5);
      targetLookAt = carPos.clone().addScaledVector(carForward, 22.0).addScaledVector(carUp, 1.2);
      this.camera.fov = 60;
      this.camera.updateProjectionMatrix();
    } else if (this.cameraMode === 'OVERHEAD') {
      // 3. TOÀN CẢNH TỪ TRÊN CAO (PANORAMIC): Đứng trên tháp cao 55m bao quát toàn cảnh khúc cua & nhiều xe đua
      targetCamPos = carPos.clone()
        .addScaledVector(carForward, -28.0)
        .addScaledVector(carRight, 34.0)
        .addScaledVector(carUp, 54.0);
      targetLookAt = carPos.clone().addScaledVector(carForward, 14.0).addScaledVector(carUp, 1.0);
      this.camera.fov = 68;
      this.camera.updateProjectionMatrix();
    } else if (this.cameraMode === 'HEAD_ON') {
      // 4. ĐÓN ĐẦU NHIỀU XE ĐUA: Phía trước mũi xe 42m quay ngược lại đoàn xe đang lao tới
      targetCamPos = carPos.clone()
        .addScaledVector(carForward, 42.0)
        .addScaledVector(carRight, -3.2)
        .addScaledVector(carUp, 5.2);
      targetLookAt = carPos.clone().addScaledVector(carForward, -5.0).addScaledVector(carUp, 0.9);
      this.camera.fov = 62;
      this.camera.updateProjectionMatrix();
    } else if (this.cameraMode === 'TRACKSIDE') {
      // 5. TELEPHOTO VEN ĐƯỜNG (85MM): Đứng ven đường lia theo xe cực nét
      targetCamPos = carPos.clone()
        .addScaledVector(carForward, 18.0)
        .addScaledVector(carRight, 18.0)
        .addScaledVector(carUp, 2.5);
      targetLookAt = carPos.clone().addScaledVector(carForward, 4.0).addScaledVector(carUp, 0.9);
      this.camera.fov = 28;
      this.camera.updateProjectionMatrix();
    } else if (this.cameraMode === 'COCKPIT') {
      targetCamPos = carPos.clone().addScaledVector(carForward, 0.2).addScaledVector(carUp, 1.15);
      targetLookAt = carPos.clone().addScaledVector(carForward, 40.0).addScaledVector(carUp, 1.0);
      const speedRatio = Math.min(1.0, this.playerSpeed / 500);
      this.camera.fov = 76 + speedRatio * 14;
      this.camera.updateProjectionMatrix();
    } else if (this.cameraMode === 'HOOD') {
      targetCamPos = carPos.clone().addScaledVector(carForward, 1.6).addScaledVector(carUp, 0.95);
      targetLookAt = carPos.clone().addScaledVector(carForward, 50.0).addScaledVector(carUp, 0.9);
      const speedRatio = Math.min(1.0, this.playerSpeed / 500);
      this.camera.fov = 74 + speedRatio * 16;
      this.camera.updateProjectionMatrix();
    } else if (this.cameraMode === 'BUMPER') {
      targetCamPos = carPos.clone().addScaledVector(carForward, 2.2).addScaledVector(carUp, 0.4);
      targetLookAt = carPos.clone().addScaledVector(carForward, 50.0).addScaledVector(carUp, 0.4);
      const speedRatio = Math.min(1.0, this.playerSpeed / 500);
      this.camera.fov = 82 + speedRatio * 18;
      this.camera.updateProjectionMatrix();
    } else if (this.cameraMode === 'CINEMATIC') {
      // Drone chase orbit around player in local coordinate space
      const time = performance.now() * 0.001;
      const orbitX = Math.sin(time * 0.8) * 8.5;
      const orbitZ = Math.cos(time * 0.8) * 8.5;
      targetCamPos = carPos.clone()
        .addScaledVector(carRight, orbitX)
        .addScaledVector(carForward, orbitZ)
        .addScaledVector(carUp, 2.5);
      targetLookAt = carPos.clone().addScaledVector(carUp, 0.8);
      this.camera.fov = 65;
      this.camera.updateProjectionMatrix();
    }

    // Ổn định Gimbal chân trời F1: giữ camera.up luôn là [0, 1, 0] không bị lộn nghiêng theo đường
    this.camera.up.set(0, 1, 0);

    // Exponential smoothing for zero-jitter
    const smoothSpeed = this.cameraMode === 'COCKPIT' || this.cameraMode === 'BUMPER' ? 24 : 12;
    if (this.smoothedCamPos.lengthSq() < 0.001) {
      this.smoothedCamPos.copy(targetCamPos);
      this.smoothedCamLookAt.copy(targetLookAt);
    } else {
      this.smoothedCamPos.lerp(targetCamPos, 1.0 - Math.exp(-smoothSpeed * delta));
      this.smoothedCamLookAt.lerp(targetLookAt, 1.0 - Math.exp(-smoothSpeed * delta));
    }

    this.camera.position.copy(this.smoothedCamPos);
    this.camera.lookAt(this.smoothedCamLookAt);

    // Keep sunlight & shadows centered on player car
    if (this.dirLight) {
      this.dirLight.position.set(carPos.x + 120, carPos.y + 180, carPos.z + 80);
      this.dirLight.target.position.copy(carPos);
      this.dirLight.target.updateMatrixWorld();
    }
  }

  public initCameraPosition() {
    if (!this.playerGroup) return;
    const carPos = this.playerGroup.position;
    const carForward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.playerGroup.quaternion);
    const carUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.playerGroup.quaternion);

    const targetCamPos = carPos.clone().addScaledVector(carForward, -7.5).addScaledVector(carUp, 2.8);
    const targetLookAt = carPos.clone().addScaledVector(carForward, 12.0).addScaledVector(carUp, 1.2);

    this.smoothedCamPos.copy(targetCamPos);
    this.smoothedCamLookAt.copy(targetLookAt);
    this.camera.position.copy(targetCamPos);
    this.camera.lookAt(targetLookAt);

    if (this.dirLight) {
      this.dirLight.position.set(carPos.x + 120, carPos.y + 180, carPos.z + 80);
      this.dirLight.target.position.copy(carPos);
      this.dirLight.target.updateMatrixWorld();
    }
  }

  private updatePerformanceMetrics(delta: number, gameThreadTime: number, renderThreadTime: number) {
    const frameTimeMs = delta * 1000;
    this.frameTimes.push(frameTimeMs);
    if (this.frameTimes.length > 240) {
      this.frameTimes.shift();
    }

    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || 16.6;
    const p999 = sorted[Math.floor(sorted.length * 0.999)] || 16.6;

    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    const fps = Math.round(1000 / Math.max(1, avg));

    let bottleneck: PerformanceStats['bottleneck'] = 'BALANCED';
    if (renderThreadTime > 12) bottleneck = 'RENDER THREAD';
    else if (gameThreadTime > 12) bottleneck = 'CPU GAME THREAD';
    else if (frameTimeMs > 20) bottleneck = 'GPU BOUND';

    this.perfStats = {
      fps,
      avgFrameTimeMs: parseFloat(avg.toFixed(2)),
      gameThreadMs: parseFloat(gameThreadTime.toFixed(2)),
      renderThreadMs: parseFloat(renderThreadTime.toFixed(2)),
      gpuTimeMs: parseFloat((frameTimeMs - gameThreadTime).toFixed(2)),
      onePercentLowFps: Math.round(1000 / p99),
      zeroPointOnePercentLowFps: Math.round(1000 / p999),
      bottleneck,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles
    };

    if (this.onPerfUpdate) {
      this.onPerfUpdate(this.perfStats);
    }
  }

  public setTrackLayout(layout: string) {
    this.currentLayout = layout;
    this.buildTrack();
    this.resetCar();
    this.playerLapProgress = 0.02;
    this.playerLap = 1;
    this.raceState = 'COUNTDOWN';
    this.countdownTimer = 3.9;
  }

  public resetCar() {
    this.playerSpeed = 0;
    this.playerLateralOffset = 0;
    this.playerSteerAngle = 0;
    this.isDrifting = false;
    this.driftAngle = 0;
    this.damagePct = 0;
    this.updatePlayerPhysics(0.016);
    this.initCameraPosition();
  }

  public cycleCamera(): PlayerCameraType {
    const modes: PlayerCameraType[] = [
      'CHASE',
      'HELICOPTER',
      'DRONE',
      'OVERHEAD',
      'HEAD_ON',
      'TRACKSIDE',
      'COCKPIT',
      'HOOD',
      'BUMPER',
      'CINEMATIC'
    ];
    const idx = modes.indexOf(this.cameraMode);
    this.cameraMode = modes[(idx + 1) % modes.length];
    return this.cameraMode;
  }

  public setCameraMode(mode: PlayerCameraType) {
    this.cameraMode = mode;
  }

  public destroy() {
    this.isDestroyed = true;
    this.stop();
    window.removeEventListener('resize', this.handleResize);
    this.renderer.dispose();
  }
}
