/**
 * Instance Detail Modal - Multi-Instance Camera & Track Director
 */
import React, { useState } from 'react';
import { X, Camera, Trophy, Gauge, Activity, RefreshCw, Compass, MapPin, Sparkles, Layers } from 'lucide-react';
import { CameraMode, InstanceRuntime, RoadLayoutType } from '../types';
import { ROAD_LAYOUT_PRESETS, BIOMES } from '../engine/scenarioGenerator';

interface InstanceDetailModalProps {
  instance: InstanceRuntime | null;
  onClose: () => void;
  onSelectCamera: (instanceId: number, mode: CameraMode) => void;
  onSelectRoadLayout?: (instanceId: number, layoutId: RoadLayoutType) => void;
  onSelectBiome?: (instanceId: number, biomeId: string) => void;
  onForceRerollSeed: (instanceId: number) => void;
}

export const InstanceDetailModal: React.FC<InstanceDetailModalProps> = ({
  instance,
  onClose,
  onSelectCamera,
  onSelectRoadLayout,
  onSelectBiome,
  onForceRerollSeed
}) => {
  if (!instance) return null;

  const [activeTab, setActiveTab] = useState<'cameras' | 'tracks' | 'biomes' | 'cars'>('cameras');
  const [cameraFilter, setCameraFilter] = useState<'all' | 'classic' | 'broadcast'>('all');

  // Các Góc Quay Cinematic Tập Trung Vào Xe & Đoàn Đua
  const classicCameras: { mode: CameraMode; label: string; desc: string; tag: string }[] = [
    {
      mode: CameraMode.BEHIND,
      label: '1. Phía Sau Xe (Xa 100m)',
      desc: 'Lùi xa về sau thêm 100m, trên cao bao quát toàn bộ đoàn xe phía trước',
      tag: 'Sau Xe 100m'
    },
    {
      mode: CameraMode.MULTI_CAR_PACK_CHASE,
      label: '2. Bám Đuôi Đoàn Xe 100m',
      desc: 'Góc nhìn toàn cảnh từ sau 100m thu trọn 6-10 xe đua đang so kè',
      tag: 'Đoàn Xe 100m'
    },
    {
      mode: CameraMode.HOOD,
      label: '3. Mui Xe / Cockpit',
      desc: 'Góc nhìn thấp từ nắp capo nhìn thẳng đường đua',
      tag: 'Mui Xe'
    },
    {
      mode: CameraMode.SIDE_PROFILE,
      label: '4. Bên Hông Xe',
      desc: 'Quay ngang hông xe và các pha so kè bánh xe',
      tag: 'Ngang Hông'
    },
    {
      mode: CameraMode.LEADER_TRACKING,
      label: '6. Bám Xe Dẫn Đầu (P1)',
      desc: 'Tự động khóa mục tiêu bám theo xe hạng 1 và nhóm bám đuổi',
      tag: 'Bám P1'
    },
    {
      mode: CameraMode.OVERTAKE_ACTION,
      label: '7. Góc Vượt Mặt',
      desc: 'Cận cảnh hành động khi xe lách qua đối thủ',
      tag: 'Vượt Mặt'
    },
    {
      mode: CameraMode.COLLISION_DRIFT,
      label: '8. Va Chạm & Drift',
      desc: 'Bắt khoảnh khắc trượt bánh, bốc khói và va chạm',
      tag: 'Drift & Va Chạm'
    },
    {
      mode: CameraMode.CINEMATIC_ORBIT,
      label: '9. Xoay 360 Vòng',
      desc: 'Quỹ đạo xoay mượt mà liên tục quanh xe',
      tag: 'Orbit 360°'
    },
  ];

  // Danh mục Các Góc Quay Truyền Hình Tập Trung Vào Xe & Nhiều Xe Đua
  const broadcastCameras: { mode: CameraMode; label: string; desc: string; tag: string }[] = [
    {
      mode: CameraMode.CHOPPER_HELI_CHASE,
      label: '1. Trực Thăng Truyền Hình (Helicam)',
      desc: 'Trực thăng bay trên cao 38m lượn theo đoàn xe với độ ổn định con quay hồi chuyển F1',
      tag: 'Trực Thăng'
    },
    {
      mode: CameraMode.SKY_DRONE_BROADCAST,
      label: '2. Drone Bay Siêu Tốc (Racing Drone)',
      desc: 'Flycam bám lượn trên cao 8m-14m, lướt xé gió bám sát từng pha vượt mặt',
      tag: 'Drone Bay'
    },
    {
      mode: CameraMode.PANORAMIC,
      label: '3. Toàn Cảnh Từ Trên Cao (Panoramic)',
      desc: 'Đài quan sát trên cao bao quát toàn bộ khúc cua và đoàn xe đua so kè',
      tag: 'Toàn Cảnh Cao'
    },
    {
      mode: CameraMode.MULTI_CAR_FRONT_FACING,
      label: '4. Đón Đầu Nhiều Xe Đua (Head-on)',
      desc: 'Camera đi lùi phía trước mũi xe 45m, quay trực diện vào đoàn xe đang lao tới',
      tag: 'Đón Đầu Xe'
    },
    {
      mode: CameraMode.MULTI_CAR_PACK_CHASE,
      label: '5. Bám Đuôi Đoàn Xe 100m',
      desc: 'Cách sau xe 100m trên cao bao quát trọn vẹn toàn bộ dàn xe đua so kè',
      tag: 'Bao Quát 100m'
    },
    {
      mode: CameraMode.MULTI_CAR_OVERTAKE_WIDE,
      label: '6. Toàn Cảnh So Kè Nhiều Xe',
      desc: 'Góc chéo trên cao bao quát toàn cảnh nhiều xe đua đang so kè vượt mặt',
      tag: 'Nhiều Xe Đua'
    },
    {
      mode: CameraMode.TRACKSIDE_TELEPHOTO,
      label: '7. Telephoto Ven Đường (85mm)',
      desc: 'Máy quay đứng ven đường lia Pan-Tilt theo xe cực nét và chân thực',
      tag: '85mm Tele'
    },
    {
      mode: CameraMode.TRACKSIDE_APEX,
      label: '8. Trạm Quay Mép Cua Apex',
      desc: 'Đón xe ôm cua ép sát mép đường cua kịch tính rồi mở hết ga',
      tag: 'Góc Cua Apex'
    },
    {
      mode: CameraMode.SIDE_CHASE_MULTI,
      label: '9. Hông Xa So Kè Nhiều Xe',
      desc: 'Chạy song song cạnh đoàn xe cách 32m bao quát các cặp xe đua so kè',
      tag: 'Hông Xa Nhóm'
    },
    {
      mode: CameraMode.PIT_WALL_BROADCAST,
      label: '10. Vách Kỹ Thuật Pit Wall',
      desc: 'Trực tiếp từ tường chỉ đạo pit stop đón đoàn xe xé gió đoạn thẳng',
      tag: 'Pit Wall'
    },
    {
      mode: CameraMode.PASSING_STATIONARY,
      label: '11. Ven Rào Chắn Xé Gió',
      desc: 'Máy quay tĩnh ven đường thu trọn hiệu ứng xe vút qua tốc độ cao',
      tag: 'Trạm Tĩnh'
    },
    {
      mode: CameraMode.VERTICAL_PORTRAIT_OPTIMIZED,
      label: '12. Khung Hình Dọc 9:16 Truyền Hình',
      desc: 'Cân chỉnh tỉ lệ vàng chuyên dụng cho định dạng video ngắn Shorts/Reels/TikTok',
      tag: 'Chuẩn 9:16'
    },
  ];

  const sortedCars = [...instance.cars].sort((a, b) => a.rank - b.rank);
  const currentRoadId = instance.seedData.biome.roadLayoutType || 'GRAND_PRIX_OVAL';
  const currentBiomeId = instance.seedData.biome.id;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/90">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-400 font-mono text-xs font-bold border border-cyan-500/30">
              NHÀ MÁY VIDEO &bull; LUỒNG #{instance.id.toString().padStart(2, '0')}
            </span>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>{instance.seedData.biome.name}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-purple-950 text-purple-300 font-normal border border-purple-800/40">
                  {instance.seedData.biome.roadLayoutType || 'Grand Prix'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Mã Seed: #{instance.seedData.seed} &bull; Thời tiết: {instance.seedData.weather} &bull; 60 FPS 9:16
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onForceRerollSeed(instance.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition cursor-pointer"
              title="Đổi kịch bản ngẫu nhiên mới"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
              Đổi Ngẫu Nhiên Seed Mới
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950 px-5 pt-2 gap-2 overflow-x-auto text-xs font-semibold">
          <button
            onClick={() => setActiveTab('cameras')}
            className={`flex items-center gap-1.5 px-4 py-2 border-b-2 transition cursor-pointer ${
              activeTab === 'cameras'
                ? 'border-purple-500 text-purple-300 bg-purple-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-4 h-4 text-purple-400" />
            19 Góc Quay ({broadcastCameras.length + classicCameras.length})
          </button>

          <button
            onClick={() => setActiveTab('tracks')}
            className={`flex items-center gap-1.5 px-4 py-2 border-b-2 transition cursor-pointer ${
              activeTab === 'tracks'
                ? 'border-cyan-500 text-cyan-300 bg-cyan-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-4 h-4 text-cyan-400" />
            20 Con Đường Đua Khác Biệt ({ROAD_LAYOUT_PRESETS.length})
          </button>

          <button
            onClick={() => setActiveTab('biomes')}
            className={`flex items-center gap-1.5 px-4 py-2 border-b-2 transition cursor-pointer ${
              activeTab === 'biomes'
                ? 'border-emerald-500 text-emerald-300 bg-emerald-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            20 Môi Trường & Thời Tiết Mới ({BIOMES.length})
          </button>

          <button
            onClick={() => setActiveTab('cars')}
            className={`flex items-center gap-1.5 px-4 py-2 border-b-2 transition cursor-pointer ${
              activeTab === 'cars'
                ? 'border-amber-500 text-amber-300 bg-amber-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            Bảng Xếp Hạng Xe ({sortedCars.length})
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* TAB 1: 19 GÓC QUAY (9 TRUYỀN HÌNH + 10 ĐIỆN ẢNH) */}
          {activeTab === 'cameras' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCameraFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                      cameraFilter === 'all'
                        ? 'bg-purple-600 text-white shadow'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                    }`}
                  >
                    Tất Cả (19)
                  </button>
                  <button
                    onClick={() => setCameraFilter('broadcast')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                      cameraFilter === 'broadcast'
                        ? 'bg-purple-600 text-white shadow'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                    }`}
                  >
                    Góc Truyền Hình & Nhiều Xe
                  </button>
                  <button
                    onClick={() => setCameraFilter('classic')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition ${
                      cameraFilter === 'classic'
                        ? 'bg-purple-600 text-white shadow'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                    }`}
                  >
                    Góc Xe & Bám Đoàn Xe 100m
                  </button>
                </div>

                <span className="text-[11px] text-purple-300 font-mono bg-purple-950/60 px-2.5 py-1 rounded-md border border-purple-800/40">
                  Đang kích hoạt: {instance.currentCameraMode}
                </span>
              </div>

              {/* Góc Truyền Hình Thể Thao & Nhiều Xe Đua */}
              {(cameraFilter === 'all' || cameraFilter === 'broadcast') && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" />
                    Góc Quay Truyền Hình & Bao Quát Nhiều Xe Đua
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {broadcastCameras.map(cam => {
                      const isSelected = instance.currentCameraMode === cam.mode;
                      return (
                        <button
                          key={cam.mode}
                          onClick={() => onSelectCamera(instance.id, cam.mode)}
                          className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between min-h-[105px] relative group ${
                            isSelected
                              ? 'bg-purple-600/30 border-purple-500 text-white shadow-md ring-1 ring-purple-400'
                              : 'bg-slate-950/70 border-slate-800/90 hover:border-purple-500/50 hover:bg-slate-900 text-slate-300'
                          }`}
                        >
                          {isSelected && (
                            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                          )}
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-xs font-bold block text-white group-hover:text-purple-300 transition">
                                {cam.label}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                              {cam.desc}
                            </p>
                          </div>
                          <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                            <span className="text-[9.5px] uppercase tracking-wider font-mono text-purple-400 font-semibold">
                              {cam.tag}
                            </span>
                            {isSelected ? (
                              <span className="text-[9.5px] font-bold text-emerald-400">Đang chiếu</span>
                            ) : (
                              <span className="text-[9.5px] text-slate-500 group-hover:text-purple-300">Chọn góc</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Góc Quay Điện Ảnh & Bám Đoàn Xe 100m */}
              {(cameraFilter === 'all' || cameraFilter === 'classic') && (
                <div className="space-y-2 mt-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Góc Quay Điện Ảnh & Bám Đoàn Xe 100m
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {classicCameras.map(cam => {
                      const isSelected = instance.currentCameraMode === cam.mode;
                      return (
                        <button
                          key={cam.mode}
                          onClick={() => onSelectCamera(instance.id, cam.mode)}
                          className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between min-h-[105px] relative group ${
                            isSelected
                              ? 'bg-cyan-600/30 border-cyan-500 text-white shadow-md ring-1 ring-cyan-400'
                              : 'bg-slate-950/70 border-slate-800/90 hover:border-cyan-500/50 hover:bg-slate-900 text-slate-300'
                          }`}
                        >
                          {isSelected && (
                            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                          )}
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-xs font-bold block text-white group-hover:text-cyan-300 transition">
                                {cam.label}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                              {cam.desc}
                            </p>
                          </div>
                          <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                            <span className="text-[9.5px] uppercase tracking-wider font-mono text-cyan-400 font-semibold">
                              {cam.tag}
                            </span>
                            {isSelected ? (
                              <span className="text-[9.5px] font-bold text-emerald-400">Đang chiếu</span>
                            ) : (
                              <span className="text-[9.5px] text-slate-500 group-hover:text-cyan-300">Chọn góc</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: 20 CON ĐƯỜNG ĐUA KHÁC BIỆT */}
          {activeTab === 'tracks' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Chọn 1 trong 20 loại đường đua để áp dụng tái tạo cung đường ngay lập tức cho Luồng #{instance.id}:
                </p>
                <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                  Đang chạy: {currentRoadId}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {ROAD_LAYOUT_PRESETS.map((road, idx) => {
                  const isCurrent = currentRoadId === road.id;
                  return (
                    <button
                      key={road.id}
                      onClick={() => onSelectRoadLayout && onSelectRoadLayout(instance.id, road.id)}
                      className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between relative ${
                        isCurrent
                          ? 'bg-cyan-600/25 border-cyan-500 text-white shadow-md ring-1 ring-cyan-400'
                          : 'bg-slate-950/80 border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900 text-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-950/80 px-1.5 py-0.5 rounded">
                            #{idx + 1}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Đang Chạy
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-white mb-1.5">{road.name}</h4>
                        <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                          {road.description}
                        </p>
                      </div>
                      <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-cyan-400/80 font-mono">
                        <span>Độ dốc 3D thực</span>
                        <span className="font-semibold text-slate-200">Đổi ngay &rarr;</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: 20 MÔI TRƯỜNG & KHUNG CẢNH MỚI */}
          {activeTab === 'biomes' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Chọn 1 trong 20 khung cảnh để đổi màu trời, sương mù, mặt đất và ánh sáng cho Luồng #{instance.id}:
                </p>
                <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                  Khung cảnh: {instance.seedData.biome.name}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {BIOMES.map((b, idx) => {
                  const isCurrent = currentBiomeId === b.id;
                  const hexColor = '#' + b.skyColor.toString(16).padStart(6, '0');
                  const groundHex = '#' + b.groundColor.toString(16).padStart(6, '0');

                  return (
                    <button
                      key={b.id}
                      onClick={() => onSelectBiome && onSelectBiome(instance.id, b.id)}
                      className={`p-3.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                        isCurrent
                          ? 'bg-emerald-600/25 border-emerald-500 text-white shadow-md ring-1 ring-emerald-400'
                          : 'bg-slate-950/80 border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900 text-slate-300'
                      }`}
                    >
                      {/* Color Accent Preview Strip */}
                      <div className="flex items-center gap-1 mb-2">
                        <span
                          className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                          style={{ backgroundColor: hexColor }}
                          title="Màu bầu trời"
                        />
                        <span
                          className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                          style={{ backgroundColor: groundHex }}
                          title="Màu địa hình"
                        />
                        <span className="text-[10px] font-mono text-slate-400 ml-1">
                          #{idx + 1} &bull; {b.theme}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-xs font-bold text-white mb-1">{b.name}</h4>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span>Sương mù: {(b.fogDensity * 1000).toFixed(1)}</span>
                          <span>&bull;</span>
                          <span>Độ sáng: {b.lightIntensity}x</span>
                        </div>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-emerald-400 font-mono">
                        <span>{isCurrent ? 'Đang kích hoạt' : 'Áp dụng khung cảnh'}</span>
                        <span className="font-semibold text-slate-200">&rarr;</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: BẢNG XẾP HẠNG VÀ THÔNG SỐ XE */}
          {activeTab === 'cars' && (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {sortedCars.map(car => (
                  <div
                    key={car.id}
                    className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-6 h-6 rounded-full bg-slate-800 text-cyan-400 font-bold text-xs flex items-center justify-center font-mono shrink-0">
                          P{car.rank}
                        </span>
                        <span
                          className="w-3.5 h-3.5 rounded-full ring-2 ring-white/20 shrink-0"
                          style={{ backgroundColor: car.color }}
                        ></span>
                        <div className="flex flex-col truncate">
                          <span className="text-xs font-bold text-amber-300 truncate">
                            {car.driverName || 'Cristiano Ronaldo'}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate">
                            {car.name}
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">
                        {car.type}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Tốc độ hiện tại</span>
                        <span className="font-bold text-cyan-400 flex items-center gap-1 text-sm">
                          <Gauge className="w-3.5 h-3.5" />
                          {Math.round(car.speed)} km/h
                        </span>
                      </div>

                      <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">Vòng đua / Tiến trình</span>
                        <span className="font-bold text-emerald-400 text-sm">
                          L{car.lap} ({(car.lapProgress * 100).toFixed(0)}%)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-900">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5 text-rose-400" />
                        Hung hãn: {Math.round(car.aggression * 100)}%
                      </span>
                      {car.isDrifting ? (
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 animate-pulse">
                          ĐANG DRIFT KHÓI
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-mono">Bám đường</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Mô phỏng 60 FPS mượt mà &bull; 30 Góc Quay Điện Ảnh &bull; 20 Con Đường &bull; 20 Khung Cảnh</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
