import * as THREE from 'three';
import { CameraDirector } from './cameraDirector';
import { TrackGenerator, GeneratedTrack } from './trackGenerator';
import { VehiclePhysicsSystem, Car3DObject } from './vehiclePhysics';
import { BIOMES, ROAD_LAYOUT_PRESETS } from './scenarioGenerator';
import {
  CameraMode,
  AICarState,
  InstanceSeedData,
  InstanceRuntime,
  RoadLayoutType,
  TrackBiome,
  WeatherType
} from '../types';

const CAR_NAMES = [
  'Apex Predator', 'Phantom GT', 'Viper X', 'Nebula Turbo', 'Cyber Falcon',
  'Solar Flare', 'Thunderbolt', 'Spectre RS', 'Titan R', 'Crimson Hawk',
  'Vortex 9', 'Velocity Zero', 'Zenith F1', 'Onyx Hyper', 'Quantum Drifter'
];

const MASTER_DECORATOR_ITEMS = [
  // 1. Roadside safety/signage
  'Cột đèn đường cao', 'Đèn chiếu sáng sân đua', 'Đèn LED dọc đường', 'Biển báo giới hạn tốc độ', 
  'Biển báo hướng cua', 'Biển báo nguy hiểm', 'Biển báo đường trơn', 'Biển báo giảm tốc', 
  'Biển báo khu vực xuất phát', 'Biển báo khu vực về đích', 'Cột mốc khoảng cách', 'Cọc tiêu giao thông', 
  'Rào chắn nhựa', 'Hàng rào thép', 'Hàng rào lưới B40', 'Tường chắn bê tông', 'Barrier bảo vệ đường đua', 
  'Gờ giảm tốc', 'Gương cầu giao thông', 'Cột phản quang',
  // 2. Start/Finish & Race banners
  'Cổng xuất phát', 'Cổng về đích', 'Bảng điện tử thời gian', 'Đồng hồ đếm ngược', 'Đèn tín hiệu xuất phát', 
  'Bảng số vòng đua', 'Bảng tên đường đua', 'Bảng quảng cáo nhà tài trợ', 'Banner treo trên hàng rào', 
  'Cờ caro', 'Cờ đua nhiều màu', 'Cờ quốc gia', 'Cờ cảnh báo vàng', 'Cờ đỏ', 'Cột cờ', 'Phao đánh dấu góc cua', 
  'Biển số Turn 1', 'Biển số Turn 2', 'Biển số Turn 3', 'Bảng khoảng cách đến cua',
  // 3. Pit-lane & Team gear
  'Nhà pit', 'Gara đội đua', 'Trạm sửa xe', 'Bàn dụng cụ', 'Thùng dụng cụ', 'Kệ lốp xe', 'Lốp xe xếp chồng', 
  'Bình chữa cháy', 'Xe cứu hộ', 'Xe kéo', 'Xe an ninh', 'Xe y tế', 'Xe kiểm tra đường đua', 
  'Xe chở nhiên liệu', 'Máy nén khí', 'Giá nâng xe', 'Cầu nâng ô tô', 'Cột đèn pit', 'Bảng pit crew', 'Ghế chờ đội đua',
  // 4. Grandstands & Spectator facilities
  'Khán đài lớn', 'Khán đài nhỏ', 'Ghế khán giả', 'Lều VIP', 'Khu vực VIP', 'Hàng rào ngăn khán giả', 
  'Cổng kiểm soát', 'Cabin bảo vệ', 'Bảng chỉ dẫn khán đài', 'Màn hình LED khổng lồ',
  // 5. Nature & Landscape
  'Cây xanh', 'Cây thông', 'Cây dừa', 'Cây bụi', 'Bồn hoa', 'Thảm cỏ', 'Đồi đất', 'Núi phía xa', 
  'Hồ nước', 'Suối nhỏ', 'Hàng cây ven đường', 'Bụi cây thấp', 'Đá lớn', 'Đá trang trí', 'Tường cây xanh',
  // 6. Urban & Utilities
  'Nhà dân', 'Nhà kho', 'Trạm xăng', 'Cửa hàng tiện lợi', 'Quán cà phê', 'Nhà hàng', 'Bãi đỗ xe', 'Cột điện', 
  'Dây điện', 'Trạm xe buýt', 'Xe đậu bên đường', 'Xe tải vận chuyển', 'Container', 'Máy bán hàng tự động', 
  'Billboard quảng cáo khổng lồ'
];

export function getDecoratorsForSeed(seed: number): string[] {
  let sVal = Math.abs(seed) || 42;
  const pRand = () => {
    sVal = (sVal * 16807) % 2147483647;
    return (sVal - 1) / 2147483646;
  };
  const arr = [...MASTER_DECORATOR_ITEMS];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(pRand() * (i + 1));
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr.slice(0, 15);
}

/**
 * Hàm biến đổi cấu hình môi trường dựa trên seed để tạo ra 100 bản đồ độc nhất vô nhị
 * về màu nền (sky/ground), màu vạch đường, độ dày mỏng của vạch và màu đèn chiếu sáng.
 */
function customizeBiomeBySeed(baseBiome: TrackBiome, seed: number): TrackBiome {
  const biome = { ...baseBiome };
  let sValue = Math.abs(seed) || 42;
  const pseudoRand = () => {
    sValue = (sValue * 16807) % 2147483647;
    return (sValue - 1) / 2147483646;
  };

  // Tuyển tập 12 bảng phối màu nền & bầu trời ban ngày rực rỡ, tươi sáng và đa dạng
  const BRIGHT_SKY_PALETTES = [
    { sky: 0x38bdf8, ground: 0x22c55e, fog: 0xe0f2fe, ambient: 0xbbf7d0, light: 2.3 }, // Trời xanh đồng cỏ xanh mướt
    { sky: 0x60a5fa, ground: 0x64748b, fog: 0xeff6ff, ambient: 0xdbeafe, light: 2.4 }, // Đô thị hiện đại trời trong nắng
    { sky: 0x0ea5e9, ground: 0x06b6d4, fog: 0xcffafe, ambient: 0xa5f3fc, light: 2.4 }, // Vịnh biển Địa Trung Hải xanh ngọc
    { sky: 0x7dd3fc, ground: 0xf1f5f9, fog: 0xf8fafc, ambient: 0xe2e8f0, light: 2.5 }, // Đỉnh tuyết sáng rực ban ngày
    { sky: 0xfb923c, ground: 0xd97706, fog: 0xffedd5, ambient: 0xfef3c7, light: 2.3 }, // Hoàng hôn nắng vàng rực rỡ
    { sky: 0x38bdf8, ground: 0xfbbf24, fog: 0xfef3c7, ambient: 0xfde68a, light: 2.5 }, // Sa mạc cát vàng rực nắng
    { sky: 0x93c5fd, ground: 0x4ade80, fog: 0xfce7f3, ambient: 0xfbcfe8, light: 2.3 }, // Mùa xuân hoa cỏ tươi mới
    { sky: 0x60a5fa, ground: 0x84cc16, fog: 0xe0f2fe, ambient: 0xfef08a, light: 2.4 }, // Thảo nguyên California nắng vàng
    { sky: 0xfb7185, ground: 0xf97316, fog: 0xffe4e6, ambient: 0xfecdd3, light: 2.3 }, // Bình minh rạng ngời ban sáng
    { sky: 0x38bdf8, ground: 0x15803d, fog: 0xdcfce7, ambient: 0xa7f3d0, light: 2.4 }, // Cao nguyên ngút ngàn nắng đẹp
    { sky: 0x0284c7, ground: 0x38bdf8, fog: 0xe0f2fe, ambient: 0xbae6fd, light: 2.5 }, // Bến du thuyền biển xanh nắng chói
    { sky: 0x818cf8, ground: 0x34d399, fog: 0xf5f3ff, ambient: 0xe0e7ff, light: 2.4 }, // Trời xanh tím Solarpunk rực rỡ
  ];

  const paletteIndex = Math.abs(seed) % BRIGHT_SKY_PALETTES.length;
  const chosenPalette = BRIGHT_SKY_PALETTES[paletteIndex];

  const hsvToHex = (h: number, s: number, v: number) => {
    const c = new THREE.Color().setHSL(h / 360, s, v);
    return c.getHex();
  };

  // Màu sắc nền bầu trời và mặt đất luôn sáng rõ, tươi tắn, không bị tối mờ
  const usePreset = pseudoRand() > 0.4;
  if (usePreset && baseBiome.skyColor) {
    biome.skyColor = baseBiome.skyColor;
    biome.groundColor = baseBiome.groundColor;
    biome.fogColor = baseBiome.fogColor;
    biome.ambientColor = baseBiome.ambientColor;
    biome.lightIntensity = baseBiome.lightIntensity || 2.4;
  } else {
    biome.skyColor = chosenPalette.sky;
    biome.groundColor = chosenPalette.ground;
    biome.fogColor = chosenPalette.fog;
    biome.ambientColor = chosenPalette.ambient;
    biome.lightIntensity = chosenPalette.light;
  }

  // Tăng cường độ sáng sủa, trong trẻo cho sương mù khí quyển
  biome.fogDensity = 0.00008 + pseudoRand() * 0.00006; // Rất thoáng, nhìn rõ xe đua ở khoảng cách 100m+

  // Màu mặt đường đua: Tương phản rõ nét với nền đất để người xem và camera dễ bắt trọn hành trình
  const trackHue = (pseudoRand() * 360);
  biome.trackColor = pseudoRand() > 0.6 ? 0x1e293b : hsvToHex(trackHue, 0.45, 0.38);
  biome.kerbColor1 = 0xffffff;
  biome.kerbColor2 = hsvToHex(pseudoRand() * 360, 0.9, 0.65);
  biome.lampColor = 0xffffff;
  biome.bollardReflectorColor = hsvToHex(pseudoRand() * 360, 0.95, 0.9);

  const lineRand = pseudoRand();
  biome.centerLinePattern = lineRand < 0.35 ? 'double' : (lineRand < 0.7 ? 'pulse' : 'single');
  biome.centerLineColor = hsvToHex(pseudoRand() * 360, 0.9, 0.95);
  biome.centerLineWidth = 0.32 + pseudoRand() * 0.22;
  biome.centerLineLength = 4.2 + pseudoRand() * 5.5;

  biome.name = `${baseBiome.name} (Chặng #${(seed % 100) + 1})`;
  biome.highlightDecorations = getDecoratorsForSeed(seed);
  return biome;
}

const DRIVER_NAMES = [
  'Lionel Messi', 'Cristiano Ronaldo', 'Neymar Jr.', 'David Beckham', 'Kylian Mbappé',
  'Ronaldinho', 'Ronaldo Nazário', 'Zinedine Zidane', 'Pelé', 'Zlatan Ibrahimović',
  'Diego Maradona', 'Thierry Henry', 'Kaká', 'Karim Benzema', 'Robert Lewandowski',
  'Xavi', 'Andrés Iniesta', 'Andrea Pirlo', 'Gianluigi Buffon', 'Paolo Maldini',
  'Cafu', 'Roberto Carlos', 'Rivaldo', 'Arjen Robben', 'Robin van Persie',
  'Miroslav Klose', 'Bastian Schweinsteiger', 'Iker Casillas', 'Fernando Torres', 'Francesco Totti',
  'Sergio Ramos', 'Thiago Silva', 'Thomas Müller', 'Manuel Neuer', 'Eden Hazard',
  'Marcelo', 'Gerard Piqué', 'N\'Golo Kanté', 'Vinícius Júnior', 'Erling Haaland',
  'Harry Kane', 'Mohamed Salah', 'Kevin De Bruyne', 'Jude Bellingham', 'Lamine Yamal',
  'Sergio Busquets', 'Pepe', 'Luis Suárez', 'Edinson Cavani', 'Ángel Di María',
  'Sergio Agüero', 'James Rodríguez', 'Wayne Rooney', 'Steven Gerrard', 'Frank Lampard',
  'Paul Scholes', 'Didier Drogba', 'Samuel Eto\'o', 'Antoine Griezmann', 'Luis Figo'
];

const CAR_COLORS = [
  { name: 'Crimson Red', hex: 0xdc2626 },
  { name: 'Cobalt Blue', hex: 0x2563eb },
  { name: 'Emerald Green', hex: 0x16a34a },
  { name: 'Solar Yellow', hex: 0xeab308 },
  { name: 'Neon Purple', hex: 0x9333ea },
  { name: 'Cyber Cyan', hex: 0x06b6d4 },
  { name: 'Blaze Orange', hex: 0xea580c },
  { name: 'Magma Pink', hex: 0xec4899 },
  { name: 'Pure White', hex: 0xf8fafc },
  { name: 'Stealth Black', hex: 0x1e293b },
  { name: 'Gold Rush', hex: 0xd97706 },
  { name: 'Lime Venom', hex: 0x84cc16 },
  { name: 'Sky Silver', hex: 0x94a3b8 },
  { name: 'Electric Violet', hex: 0x7c3aed },
  { name: 'Rose Gold', hex: 0xf43f5e }
];

export class RacingInstance {
  public id: number;
  public scene: THREE.Scene;
  public cameraDirector: CameraDirector;
  public track!: GeneratedTrack;
  public cars: Car3DObject[] = [];
  public seedData!: InstanceSeedData;

  public videoChunkIndex: number = 1;
  public chunkTimeElapsed: number = 0;
  public totalChunkDuration: number = 120; // 120s by default
  public desiredCarCount: number = 10;
  public status: 'idle' | 'rendering' | 'exporting' | 'recovering' = 'rendering';
  public isOfflineExport: boolean = false;
  public lastViewport?: { x: number; y: number; w: number; h: number };

  private trackMeshGroup: THREE.Group = new THREE.Group();
  private carsGroup: THREE.Group = new THREE.Group();
  private dirLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;

  constructor(
    id: number,
    durationSeconds: number = 120,
    seed?: number,
    carCount: number = 10
  ) {
    this.id = id;
    this.totalChunkDuration = durationSeconds;
    this.desiredCarCount = Math.max(2, Math.min(15, carCount));

    this.scene = new THREE.Scene();
    this.cameraDirector = new CameraDirector(68, 9 / 16);

    this.scene.add(this.trackMeshGroup);
    this.scene.add(this.carsGroup);

    this.setupLighting();
    this.initRace(seed);
  }

  get currentCameraMode(): CameraMode {
    return this.cameraDirector.currentMode;
  }

  private setupLighting() {
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.35);
    this.hemiLight.position.set(0, 200, 0);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 2.4);
    this.dirLight.position.set(120, 320, 160);
    this.scene.add(this.dirLight);
  }

  private initRace(customSeed?: number) {
    const seed = customSeed !== undefined ? customSeed : Math.floor(Math.random() * 900000 + 100000);
    const biomeIndex = (this.id - 1 + seed) % BIOMES.length;

    // Select Road Layout
    const layoutIndex = (this.id - 1 + Math.floor(seed / 10)) % ROAD_LAYOUT_PRESETS.length;
    const rawBiome = { ...BIOMES[biomeIndex], roadLayoutType: ROAD_LAYOUT_PRESETS[layoutIndex].id };
    const biome = customizeBiomeBySeed(rawBiome, seed);

    // Apply Biome Atmosphere - luôn sáng rực rỡ, độ tương phản cao
    this.scene.background = new THREE.Color(biome.skyColor);
    this.scene.fog = new THREE.FogExp2(biome.fogColor, biome.fogDensity);
    this.dirLight.intensity = Math.max(2.2, biome.lightIntensity || 2.4);
    this.hemiLight.color.setHex(biome.ambientColor);
    this.hemiLight.intensity = 1.35;

    // Build Track
    this.rebuildTrack(seed, biome);

    // Build Cars
    this.rebuildCars(seed, biome);

    this.seedData = {
      seed,
      instanceId: this.id,
      biome,
      weather: 'Sunny',
      roadLayout: biome.roadLayoutType,
      carCount: this.cars.length,
      cars: this.cars.map(c => c.state),
      aiAggressionBase: 0.85,
      createdAt: new Date().toISOString()
    };

    this.chunkTimeElapsed = 0;
    this.cameraDirector.resetFirstFrame();
  }

  private rebuildTrack(seed: number, biome: TrackBiome) {
    while (this.trackMeshGroup.children.length > 0) {
      this.trackMeshGroup.remove(this.trackMeshGroup.children[0]);
    }

    this.track = TrackGenerator.generateTrack(seed, biome);
    this.trackMeshGroup.add(this.track.trackMesh);
    this.track.curbMeshes.forEach(mesh => this.trackMeshGroup.add(mesh));
    this.trackMeshGroup.add(this.track.sceneryGroup);
  }

  private rebuildCars(seed: number, _biome: TrackBiome) {
    while (this.carsGroup.children.length > 0) {
      this.carsGroup.remove(this.carsGroup.children[0]);
    }
    this.cars = [];

    const numCars = this.desiredCarCount;
    // Bố trí cự ly xuất phát theo tiêu chuẩn hàng đôi Grand Prix cự ly nghẹt thở (4.5m - 5.8m mỗi hàng)
    // Toàn bộ 10-15 xe nằm sát cạnh nhau trong phạm vi 35-45m, ngay từ giây đầu tiên đã rượt đuổi và đảo làn kịch tính
    const trackLen = (this.track && this.track.totalLength > 100) ? this.track.totalLength : 35000;
    const startProgress = 0.08;

    for (let i = 0; i < numCars; i++) {
      const colorInfo = CAR_COLORS[i % CAR_COLORS.length];
      const carName = CAR_NAMES[i % CAR_NAMES.length];
      const driver = DRIVER_NAMES[((this.id - 1) * 10 + i) % DRIVER_NAMES.length];
      const meshIdx = i % 5;

      // Xuất phát hàng đôi so le: Xe chẵn bên trái, xe lẻ bên phải, khoảng cách chỉ 5.5 mét mỗi hàng
      const rowIndex = Math.floor(i / 2);
      const isLeft = i % 2 === 0;
      const distanceBehindLeader = rowIndex * 5.5 + (isLeft ? 0 : 2.75);

      let initialProgress = startProgress - (distanceBehindLeader / trackLen);
      if (initialProgress < 0) initialProgress += 1.0;

      const initialLane = isLeft ? -0.34 : 0.34;

      const state: AICarState = {
        id: `car_${this.id}_${i + 1}`,
        name: `${carName} #${i + 1}`,
        driverName: driver,
        color: colorInfo.name,
        hexColor: colorInfo.hex,
        type: i % 2 === 0 ? 'hypercar' : 'formula',
        // Tốc độ thay đổi ngẫu nhiên 400 - 600 km/h, trung bình ~500 km/h, tối đa 650 km/h
        speed: 460 + (i % 5) * 12 + Math.random() * 10,
        targetSpeed: 485 + (i % 5) * 8,
        maxSpeed: 650, // Tối đa đạt 650 km/h
        baseCruiseSpeed: 480 + (i % 5) * 10, // Mỗi xe một dải tốc độ riêng biệt
        targetPullAwayGoal: 320 + Math.random() * 180, // Mục tiêu bứt xa 300 - 500m
        overtakePullAwayDist: 0,
        cooldownTimer: 0,
        attackPhaseTimer: 1.0 + Math.random() * 3.0,
        acceleration: 3.5 + Math.random() * 0.8,
        lap: 0,
        lapProgress: initialProgress,
        lateralOffset: initialLane,
        targetLateralOffset: initialLane,
        steerAngle: 0,
        rank: i + 1,
        aggression: 0.82 + Math.random() * 0.18,
        isDrifting: false,
        driftAngle: 0,
        collisionCooldown: 0,
        meshIndex: meshIdx,
        inTunnel: false,
        laneChangeTimer: 1.0 + Math.random() * 2.5,
        nitroBoostTimer: i > 0 ? (1.5 + Math.random() * 2.5) : 0, // Xe sau sẵn sàng bứt tốc ngay từ đầu
        nitroCooldown: 0,
        isHyperBoosting: false
      };

      const carObj = VehiclePhysicsSystem.createCarMesh(state);
      this.cars.push(carObj);
      this.carsGroup.add(carObj.group);
    }
  }

  setCameraMode(mode: CameraMode) {
    this.cameraDirector.setCameraMode(mode);
  }

  setRoadLayout(layout: RoadLayoutType) {
    if (!this.seedData) return;
    this.seedData.roadLayout = layout;
    this.seedData.biome.roadLayoutType = layout;
    this.rebuildTrack(this.seedData.seed, this.seedData.biome);
    this.cameraDirector.resetFirstFrame();
  }

  setBiome(biomeId: string) {
    const baseBiome = BIOMES.find(b => b.id === biomeId);
    if (!baseBiome || !this.seedData) return;
    const rawBiome = { ...baseBiome, roadLayoutType: this.seedData.roadLayout };
    const biome = customizeBiomeBySeed(rawBiome, this.seedData.seed);
    this.seedData.biome = biome;
    this.scene.background = new THREE.Color(biome.skyColor);
    this.scene.fog = new THREE.FogExp2(biome.fogColor, biome.fogDensity);
    this.dirLight.intensity = Math.max(2.2, biome.lightIntensity || 2.4);
    this.hemiLight.color.setHex(biome.ambientColor);
    this.hemiLight.intensity = 1.35;
    this.rebuildTrack(this.seedData.seed, this.seedData.biome);
  }

  recycleToNextRace(durationSeconds?: number, carsPerRace?: number) {
    if (durationSeconds !== undefined) {
      this.totalChunkDuration = durationSeconds;
    }
    if (carsPerRace !== undefined) {
      this.desiredCarCount = Math.max(2, Math.min(15, carsPerRace));
    }
    this.videoChunkIndex++;
    this.initRace();
  }

  update(
    delta: number,
    aiAggressionGlobal: number = 0.85,
    cinematicAutoDirector: boolean = true
  ): { chunkCompleted: boolean } {
    this.chunkTimeElapsed += delta;
    const chunkCompleted = this.chunkTimeElapsed >= this.totalChunkDuration;

    if (this.track && this.cars.length > 0) {
      // 1. Run vehicle physics & steering AI
      const { activeOvertakeCarId, collisionCarId } = VehiclePhysicsSystem.updateVehicles(
        this.cars,
        this.track.curve,
        this.track.totalLength,
        delta,
        aiAggressionGlobal
      );

      // 2. Sort ranks by total distance
      const sorted = [...this.cars].sort((a, b) => {
        const distA = a.state.lap + a.state.lapProgress;
        const distB = b.state.lap + b.state.lapProgress;
        return distB - distA;
      });
      sorted.forEach((car, index) => {
        car.state.rank = index + 1;
      });

      // 3. Update Camera Director
      this.cameraDirector.update(
        this.cars,
        delta,
        activeOvertakeCarId,
        collisionCarId,
        cinematicAutoDirector
      );
    }

    return { chunkCompleted };
  }

  getRuntimeState(): InstanceRuntime {
    const leaderCar = this.cars.find(c => c.state.rank === 1) || this.cars[0];
    return {
      id: this.id,
      name: `Luồng #${this.id.toString().padStart(2, '0')}`,
      active: true,
      seedData: this.seedData,
      currentCameraMode: this.cameraDirector.currentMode,
      cameraDwellTimer: 0,
      cameraNextSwitchDuration: 5.0,
      targetCarId: leaderCar ? leaderCar.state.id : '',
      cars: this.cars.map(c => c.state),
      lapLeaderId: leaderCar ? leaderCar.state.id : '',
      isRecording: false,
      currentVideoChunkIndex: this.videoChunkIndex,
      chunkTimeElapsed: this.chunkTimeElapsed,
      totalChunkDuration: this.totalChunkDuration,
      fps: 60,
      status: this.status,
      lastViewport: this.lastViewport
    };
  }
}
