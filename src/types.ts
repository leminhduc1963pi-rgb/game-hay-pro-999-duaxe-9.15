/**
 * Racing Video Factory & 3D High-End Simulator - Type Definitions
 */
export type ResolutionPreset = '1080x1920 (Full HD Dọc)' | '720x1280 (HD Dọc)' | '1440x2560 (2K Dọc)' | '2160x3840 (4K Dọc)' | '1080p (Ngang)' | '720p' | '4K';
export type AspectRatioOption = '9:16' | '16:9';
export type VideoFileFormat = 'mp4' | 'mov' | 'webm';
export type FPSOption = 30 | 60 | 120;
export type VideoDurationPreset = 30 | 60 | 120 | number;

export enum CameraMode {
  // === CÁC GÓC QUAY TRUYỀN HÌNH TẬP TRUNG VÀO XE & NHIỀU XE ĐUA ===
  TRACKSIDE_TELEPHOTO = 'TRACKSIDE_TELEPHOTO', // 1. Telephoto ven đường lia theo đoàn xe (85mm F1)
  PANORAMIC = 'PANORAMIC', // 2. Toàn Cảnh Trường Đua (Đài cao bao quát toàn cảnh khúc cua & nhiều xe đua)
  CHOPPER_HELI_CHASE = 'CHOPPER_HELI_CHASE', // 3. Trực Thăng Truyền Hình (Helicam trên không quay Live show)
  SKY_DRONE_BROADCAST = 'SKY_DRONE_BROADCAST', // 4. Racing Drone / Flycam (Flycam bám sát xé gió)
  MULTI_CAR_FRONT_FACING = 'MULTI_CAR_FRONT_FACING', // 5. Đón đầu nhiều xe đua (Góc phía trước quay trực diện xe đang lao tới)
  MULTI_CAR_OVERTAKE_WIDE = 'MULTI_CAR_OVERTAKE_WIDE', // 6. Toàn cảnh so kè nhiều xe (Bao quát pha vượt mặt của các xe)
  TRACKSIDE_APEX = 'TRACKSIDE_APEX', // 7. Trạm quay đỉnh góc cua Apex đón xe
  MULTI_CAR_PACK_CHASE = 'MULTI_CAR_PACK_CHASE', // 8. Bám đuôi đoàn xe 100m (Bao quát toàn bộ dàn xe đua phía trước)
  PIT_WALL_BROADCAST = 'PIT_WALL_BROADCAST', // 9. Vách kỹ thuật Pit Wall lia theo xe
  PASSING_STATIONARY = 'PASSING_STATIONARY', // 10. Trạm quay tĩnh ven rào chắn xé gió
  VERTICAL_PORTRAIT_OPTIMIZED = 'VERTICAL_PORTRAIT_OPTIMIZED', // 11. Khung hình dọc 9:16 truyền hình
  SPECTATOR_TRACKSIDE = 'SPECTATOR_TRACKSIDE', // 12. Góc quay người đứng ven đường (Đứng yên lia theo xe)
  SIDE_CHASE_MULTI = 'SIDE_CHASE_MULTI', // 13. Hông xa so kè nhiều xe đua
  TUNNEL_CEILING_FAST = 'TUNNEL_CEILING_FAST', // 14. Camera trần hầm hắt xuống siêu tốc
  FENDER_WHEEL_LOOK = 'FENDER_WHEEL_LOOK', // 15. Camera chắn bùn nhìn lốp và hông xe
  WING_REAR_LOOK = 'WING_REAR_LOOK', // 16. Đuôi gió nhìn ngược về trước qua nóc xe
  KERB_CAM_GROUND = 'KERB_CAM_GROUND', // 17. Camera âm vỉa gờ giảm tốc hất lên gầm xe

  // === CÁC GÓC QUAY CINEMATIC TẬP TRUNG VÀO XE ===
  BEHIND = 'BEHIND', // 1. Phía Sau Xe Xa 100m (Bao quát xe đua và các đối thủ phía trước)
  HOOD = 'HOOD', // 2. Mui Xe / Cockpit (Góc nhìn thấp từ nắp capo nhìn thẳng đường đua)
  LOW_GROUND = 'LOW_GROUND', // 3. Sát Mặt Đường (Góc siêu thấp sát lốp và hệ thống giảm xóc)
  SIDE_PROFILE = 'SIDE_PROFILE', // 4. Bên Hông Xe (Quay ngang hông xe và các pha so kè bánh xe)
  LEADER_TRACKING = 'LEADER_TRACKING', // 5. Bám Xe Dẫn Đầu & Đoàn Đua
  OVERTAKE_ACTION = 'OVERTAKE_ACTION', // 6. Góc Vượt Mặt (Cận cảnh hành động khi xe lách qua đối thủ)
  COLLISION_DRIFT = 'COLLISION_DRIFT', // 7. Va Chạm & Drift (Bắt khoảnh khắc trượt bánh, bốc khói và va chạm)
  CINEMATIC_ORBIT = 'CINEMATIC_ORBIT', // 8. Xoay 360 Vòng quanh xe
  COCKPIT_FIRST_PERSON = 'COCKPIT_FIRST_PERSON', // 9. Góc Lái Thứ Nhất (Trực tiếp trong cabin lái, tốc độ cực cao)
  BUMPER_FIRST_PERSON = 'BUMPER_FIRST_PERSON', // 10. Góc Cản Trước Siêu Tốc (Gần sát đường, FOV xé gió)

  // Legacy compatibility aliases
  GRANDSTAND_PANORAMIC = 'PANORAMIC',
  FLYCAM = 'SKY_DRONE_BROADCAST',
  HELIPAD_ZOOM = 'CHOPPER_HELI_CHASE',
  SATELLITE_ORBIT = 'PANORAMIC',
}

export type WeatherType =
  | 'Sunny'
  | 'Sunset'
  | 'HeavyRain'
  | 'NeonNight'
  | 'DenseFog'
  | 'Thunderstorm'
  | 'SnowBlizzard'
  | 'Sandstorm'
  | 'MidnightFullMoon'
  | 'AuroraBorealis'
  | 'VolcanicAsh'
  | 'BloodMoon'
  | 'ToxicHaze'
  | 'HeatwaveMirage'
  | 'SunriseDawn'
  | 'AutumnDrizzle'
  | 'TropicalMonsoon'
  | 'SolarEclipse'
  | 'StarlightGalaxy'
  | 'VaporwaveDusk'
  | 'CrystalRain'
  | 'OvercastGloom'
  | 'DustDevil'
  | 'PolarTwilight'
  | 'OceanBreeze'
  // Legacy support
  | 'Overcast'
  | 'Night'
  | 'Neon';

export type RoadLayoutType =
  | 'GRAND_PRIX_OVAL'
  | 'FIGURE_EIGHT_BRIDGE'
  | 'MOUNTAIN_HAIRPIN_PASS'
  | 'AIRPORT_RUNWAY_DRAG'
  | 'COASTAL_CLIFF_HIGHWAY'
  | 'CITY_GRID_INTERSECTION'
  | 'SUZUKA_TECHNICAL_S'
  | 'MONZA_TEMPLE_OF_SPEED'
  | 'DESERT_CANYON_DUNES'
  | 'NURBURGRING_ROLLER_COASTER'
  | 'TOKYO_EXPRESSWAY_RING'
  | 'FOREST_RIVER_MEANDER'
  | 'HARBOR_DOCK_CIRCUIT'
  | 'ALPINE_SUMMIT_SPIRAL'
  | 'FUTURISTIC_HYPERLOOP'
  | 'VOLCANO_CALDERA_RIM'
  | 'AIRPORT_HANGAR_CHICANE'
  | 'ISLAND_BRIDGE_CROSSING'
  | 'NEON_TUNNEL_METRO'
  | 'STADIUM_SUPERCROSS'
  | string;

export interface TrackBiome {
  id: string;
  name: string;
  skyColor: number;
  groundColor: number;
  trackColor: number;
  kerbColor1: number;
  kerbColor2: number;
  fogColor: number;
  fogDensity: number;
  lightIntensity: number;
  ambientColor: number;
  theme: string;
  roadLayoutType?: RoadLayoutType;
  // 100 Kiểu vạch đường và chi tiết độc nhất
  centerLineColor?: number;
  centerLineWidth?: number;
  centerLineLength?: number;
  centerLinePattern?: 'single' | 'double' | 'strobe' | 'pulse';
  lampColor?: number;
  bollardReflectorColor?: number;
  archColor?: number;
  curbFrequency?: number;
  highlightDecorations?: string[];
}

export interface AICarState {
  id: string;
  name: string;
  driverName?: string; // Tên nhân vật / tài xế lái xe
  color: string;
  hexColor: number;
  type: 'hypercar' | 'muscle' | 'formula' | 'gt_racer' | 'cyber_coupe';
  speed: number;
  targetSpeed: number;
  maxSpeed: number;
  acceleration: number;
  lap: number;
  lapProgress: number; // 0 to 1 along track
  lateralOffset: number; // offset from track center line (-1.0 to 1.0)
  targetLateralOffset: number;
  steerAngle: number;
  rank: number;
  aggression: number;
  isDrifting: boolean;
  driftAngle: number;
  collisionCooldown: number;
  meshIndex: number;
  inTunnel?: boolean;
  laneChangeTimer?: number;
  nitroBoostTimer?: number;
  nitroCooldown?: number;
  attackPhaseTimer?: number;
  isHyperBoosting?: boolean;
  overtakePullAwayDist?: number; // Quãng đường bứt phá vượt mặt lên phía trước (đạt cự ly bứt xa 300 - 500m)
  targetPullAwayGoal?: number; // Mục tiêu bứt xa 300 - 500 mét trước khi hạ nhiệt
  cooldownTimer?: number; // Giai đoạn hạ nhiệt/giảm tốc độ xuống 400-450 km/h để xe sau vượt
  baseCruiseSpeed?: number; // Tốc độ hành trình riêng biệt từng xe quanh mốc 500 km/h
  assignedLaneIndex?: number;
}

export interface InstanceSeedData {
  seed: number;
  instanceId: number;
  biome: TrackBiome;
  weather: WeatherType;
  roadLayout: RoadLayoutType;
  carCount: number;
  cars: AICarState[];
  aiAggressionBase: number;
  createdAt: string;
}

export interface InstanceRuntime {
  id: number;
  name: string;
  active: boolean;
  seedData: InstanceSeedData;
  currentCameraMode: CameraMode;
  cameraDwellTimer: number;
  cameraNextSwitchDuration: number;
  targetCarId: string;
  cars: AICarState[];
  lapLeaderId: string;
  isRecording: boolean;
  currentVideoChunkIndex: number;
  chunkTimeElapsed: number; // seconds into current 2-minute cycle
  totalChunkDuration: number; // 120 seconds default
  fps: number;
  status: 'idle' | 'rendering' | 'exporting' | 'recovering';
  errorMessage?: string;
  inTunnel?: boolean;
  lastViewport?: { x: number; y: number; w: number; h: number };
}

export interface VideoRecordJob {
  id: string;
  instanceId: number;
  videoNumber: number;
  fileName: string;
  url: string;
  blob?: Blob;
  sizeMB: number;
  durationSeconds: number;
  timestamp: string;
  seed: number;
  biomeName: string;
  winnerCar: string;
  topSpeedKmh: number;
  resolution: ResolutionPreset;
  fps: number;
  status?: 'processing' | 'ready' | 'failed';
  progressPercent?: number;
}

export interface SystemConfig {
  instanceCount: 1 | 2 | 4 | 6 | 8 | 10;
  resolution: ResolutionPreset;
  aspectRatio: AspectRatioOption;
  fileFormat: VideoFileFormat;
  fps: FPSOption;
  carsPerRace?: 6 | 8 | 10 | 12 | 15; // Số lượng xe đua cùng nhau (mặc định: 10, tối đa 15)
  durationSeconds: number; // 120 for 2 mins
  saveDirectory: string;
  autoExportToDisk: boolean;
  autoDownloadToDevice?: boolean; // Tự động tải video xuống máy tính ngay khi hoàn thành
  codec: 'video/webm;codecs=vp9' | 'video/mp4;codecs=avc1' | 'video/webm';
  aiAggressionGlobal: number; // 0.2 - 1.0
  cinematicAutoDirector: boolean;
}

export interface SystemHardwareStats {
  engineFPS: number;
  cpuUsagePct: number;
  gpuUsagePct: number;
  ramUsageMB: number;
  ramTotalMB: number;
  diskFreeGB: number;
  totalVideosCreated: number;
  systemUptimeSeconds: number;
}

export interface LogMessage {
  id: string;
  timestamp: string;
  instanceId?: number;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}
