import React, { RefObject } from 'react';
import { Camera, Maximize2, Radio, Trophy, Gauge, Compass, Sparkles, ChevronRight } from 'lucide-react';
import { CameraMode, InstanceRuntime } from '../types';
import { ROAD_LAYOUT_PRESETS } from '../engine/scenarioGenerator';

interface InstanceGridProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  instances: InstanceRuntime[];
  activeCount: number;
  onInspectInstance: (instanceId: number) => void;
  onQuickSwitchCamera?: (instanceId: number, mode: CameraMode) => void;
}

export const InstanceGrid: React.FC<InstanceGridProps> = ({
  canvasRef,
  instances,
  activeCount,
  onInspectInstance,
  onQuickSwitchCamera
}) => {
  // Bố cục lưới dựa theo số instance kích hoạt
  const getGridColsClass = (count: number) => {
    switch (count) {
      case 1:
        return 'grid-cols-1 grid-rows-1';
      case 2:
        return 'grid-cols-1 sm:grid-cols-2 grid-rows-2 sm:grid-rows-1';
      case 4:
        return 'grid-cols-2 grid-rows-2';
      case 6:
        return 'grid-cols-2 sm:grid-cols-3 grid-rows-3 sm:grid-rows-2';
      case 8:
        return 'grid-cols-2 sm:grid-cols-4 grid-rows-4 sm:grid-rows-2';
      case 10:
        return 'grid-cols-2 sm:grid-cols-5 grid-rows-5 sm:grid-rows-2';
      default:
        return 'grid-cols-2 sm:grid-cols-4 grid-rows-4 sm:grid-rows-2';
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const cameraModesList: CameraMode[] = [
    // Góc Quay Từ Xa & Truyền Hình F1 Live Show
    CameraMode.CHOPPER_HELI_CHASE,
    CameraMode.SKY_DRONE_BROADCAST,
    CameraMode.PANORAMIC,
    CameraMode.MULTI_CAR_FRONT_FACING,
    CameraMode.MULTI_CAR_OVERTAKE_WIDE,
    CameraMode.MULTI_CAR_PACK_CHASE,
    CameraMode.TRACKSIDE_TELEPHOTO,
    CameraMode.BEHIND,
    CameraMode.TRACKSIDE_APEX,
    CameraMode.PIT_WALL_BROADCAST,
    CameraMode.PASSING_STATIONARY,
    CameraMode.VERTICAL_PORTRAIT_OPTIMIZED,
    CameraMode.SPECTATOR_TRACKSIDE,
    CameraMode.SIDE_CHASE_MULTI,
    CameraMode.TUNNEL_CEILING_FAST,
    CameraMode.FENDER_WHEEL_LOOK,
    CameraMode.WING_REAR_LOOK,
    // Classic Cinematic Car angles
    CameraMode.HOOD,
    CameraMode.SIDE_PROFILE,
    CameraMode.LEADER_TRACKING,
    CameraMode.OVERTAKE_ACTION,
    CameraMode.COLLISION_DRIFT,
    CameraMode.CINEMATIC_ORBIT,
    CameraMode.COCKPIT_FIRST_PERSON,
    CameraMode.BUMPER_FIRST_PERSON,
  ];

  const handleNextCamera = (instanceId: number, current: CameraMode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onQuickSwitchCamera) return;
    const idx = cameraModesList.indexOf(current);
    const nextIdx = (idx + 1) % cameraModesList.length;
    onQuickSwitchCamera(instanceId, cameraModesList[nextIdx]);
  };

  const getCameraLabelVN = (mode: CameraMode) => {
    switch (mode) {
      // Góc quay từ xa & Truyền hình
      case CameraMode.CHOPPER_HELI_CHASE: return 'Trực Thăng Truyền Hình';
      case CameraMode.SKY_DRONE_BROADCAST: return 'Drone Bay Siêu Tốc';
      case CameraMode.PANORAMIC: return 'Toàn Cảnh Trên Cao';
      case CameraMode.BEHIND: return 'Phía Sau Xe 100m';
      case CameraMode.MULTI_CAR_PACK_CHASE: return 'Bám Đuôi Đoàn Xe 100m';
      case CameraMode.MULTI_CAR_FRONT_FACING: return 'Đón Đầu Nhiều Xe';
      case CameraMode.MULTI_CAR_OVERTAKE_WIDE: return 'Toàn Cảnh So Kè Nhiều Xe';
      case CameraMode.SIDE_CHASE_MULTI: return 'Hông Xa So Kè Nhóm Xe';
      case CameraMode.TRACKSIDE_TELEPHOTO: return 'Telephoto Lia Xe (85mm)';
      case CameraMode.TRACKSIDE_APEX: return 'Mép Cua Apex Đón Xe';
      case CameraMode.PIT_WALL_BROADCAST: return 'Vách Pit Wall Lia Xe';
      case CameraMode.PASSING_STATIONARY: return 'Ven Rào Xé Gió';
      case CameraMode.VERTICAL_PORTRAIT_OPTIMIZED: return 'Dọc 9:16 TV';
      case CameraMode.SPECTATOR_TRACKSIDE: return 'Khán Giả Lia Theo Xe';
      case CameraMode.TUNNEL_CEILING_FAST: return 'Trần Hầm Siêu Tốc';
      case CameraMode.FENDER_WHEEL_LOOK: return 'Chắn Bùn Sát Lốp';
      case CameraMode.WING_REAR_LOOK: return 'Đuôi Gió Nhìn Trước';
      case CameraMode.KERB_CAM_GROUND: return 'Âm Vỉa Lên Gầm';

      // Cinematic car angles
      case CameraMode.HOOD: return 'Mui Xe / Capo';
      case CameraMode.LOW_GROUND: return 'Sát Mặt Đường';
      case CameraMode.SIDE_PROFILE: return 'Bên Hông Xe';
      case CameraMode.LEADER_TRACKING: return 'Bám Xe Dẫn Đầu (P1)';
      case CameraMode.OVERTAKE_ACTION: return 'Góc Vượt Mặt';
      case CameraMode.COLLISION_DRIFT: return 'Va Chạm & Drift';
      case CameraMode.CINEMATIC_ORBIT: return 'Xoay 360 Vòng Quanh Xe';
      case CameraMode.COCKPIT_FIRST_PERSON: return 'Góc Lái Thứ 1';
      case CameraMode.BUMPER_FIRST_PERSON: return 'Cản Trước Siêu Tốc';
      default: return 'Góc Quay Xe';
    }
  };

  const formatRoadLayoutName = (raw?: string) => {
    if (!raw) return 'Grand Prix Oval';
    return raw.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="relative flex-1 w-full h-full min-h-[450px] bg-black overflow-hidden flex flex-col">
      {/* Canvas WebGL render trực tiếp đa khung hình */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block z-0 pointer-events-none"
      />

      {/* Lớp phủ HUD hiển thị thông tin thời gian thực 9:16 Full HD Dọc */}
      <div
        className={`absolute inset-0 z-10 grid ${getGridColsClass(
          activeCount
        )} gap-2 p-2 pointer-events-none`}
      >
        {instances.slice(0, activeCount).map(instance => {
          const leader = instance.cars.find(c => c.rank === 1) || instance.cars[0];
          const progressPct = Math.min(
            100,
            (instance.chunkTimeElapsed / instance.totalChunkDuration) * 100
          );
          const remainingSecs = Math.max(
            0,
            Math.ceil(instance.totalChunkDuration - instance.chunkTimeElapsed)
          );
          const leaderSpeed = Math.round(leader?.speed || 0);
          const roadName = instance.seedData.biome.roadLayoutType || 'GRAND_PRIX_OVAL';
          const biomeName = instance.seedData.biome.name;

          return (
            <div
              key={instance.id}
              className="flex items-center justify-center w-full h-full min-h-0 overflow-hidden pointer-events-none"
            >
              <div
                id={`viewport-tile-${instance.id}`}
                className="relative aspect-[9/16] h-full max-h-full max-w-full rounded-2xl border-2 border-slate-700/80 overflow-hidden bg-transparent flex flex-col justify-between p-2 shadow-2xl pointer-events-auto group hover:border-cyan-400/90 transition-all ring-1 ring-white/10"
              >
                {/* Lớp Gradient bảo đảm chữ luôn đọc rõ nét */}
                <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/85 via-black/45 to-transparent pointer-events-none -z-10" />
                <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/90 via-black/55 to-transparent pointer-events-none -z-10" />

                {/* Thanh thông tin phía trên - Chuẩn Video Dọc 9:16 */}
                <div className="flex flex-col gap-1 z-10">
                  <div className="flex items-center justify-between">
                    {/* Badge Luồng & Định dạng */}
                    <div className="flex items-center gap-1">
                      <span className="px-1.5 py-0.5 rounded bg-cyan-500/30 text-cyan-300 font-mono text-[9px] font-bold border border-cyan-500/40 shadow-sm">
                        LUỒNG #{instance.id.toString().padStart(2, '0')}
                      </span>
                      <span className="px-1 py-0.5 rounded bg-slate-900/80 text-emerald-400 font-mono text-[9px] font-semibold border border-slate-700">
                        9:16 HD
                      </span>
                    </div>

                    {/* Trạng thái REC */}
                    <div className="flex items-center gap-1 bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded-full border border-rose-500/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                      <span className="text-[9px] font-mono font-bold text-rose-400">
                        REC {formatTime(instance.chunkTimeElapsed)}
                      </span>
                    </div>
                  </div>

                  {/* Hiển thị Bản đồ trong 100 Bản Đồ & Môi Trường */}
                  <div className="flex items-center justify-between gap-1 text-[8.5px]">
                    <div className="flex items-center gap-1 text-slate-300 truncate max-w-[120px]" title={biomeName}>
                      <Sparkles className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                      <span className="truncate">{biomeName}</span>
                    </div>

                    <div className="flex items-center gap-0.5 text-cyan-300 truncate max-w-[120px]" title={roadName}>
                      <Compass className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                      <span className="truncate font-mono">
                        {ROAD_LAYOUT_PRESETS.find(p => p.id === roadName)?.name || formatRoadLayoutName(roadName)}
                      </span>
                    </div>
                  </div>

                  {/* Thẻ Góc quay trong 9 góc truyền hình + Nút chuyển nhanh */}
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 font-mono font-bold border border-emerald-500/40 flex items-center gap-1 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      {instance.fps || 60} FPS
                    </span>
                    <button
                      onClick={(e) => handleNextCamera(instance.id, instance.currentCameraMode, e)}
                      className="flex items-center gap-1 text-purple-200 bg-purple-950/90 hover:bg-purple-900/90 px-1.5 py-0.5 rounded border border-purple-500/50 cursor-pointer transition active:scale-95"
                      title="Bấm để chuyển nhanh sang góc quay tiếp theo trong 9 góc truyền hình"
                    >
                      <Camera className="w-2.5 h-2.5 text-purple-400" />
                      <span className="truncate max-w-[90px] font-medium">{getCameraLabelVN(instance.currentCameraMode)}</span>
                      <ChevronRight className="w-2.5 h-2.5 text-purple-400" />
                    </button>
                  </div>
                </div>

                {/* Nút xem chi tiết khi rê chuột */}
                <div className="flex-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-200 z-10">
                  <button
                    id={`btn-inspect-${instance.id}`}
                    onClick={() => onInspectInstance(instance.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-600/95 hover:bg-cyan-500 text-white text-[11px] font-bold shadow-xl backdrop-blur cursor-pointer active:scale-95 transition border border-cyan-400/40"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    Tùy Chỉnh 9 Góc Truyền Hình &bull; 20 Đường &bull; 20 Môi Trường
                  </button>
                </div>

                {/* Thông số xe dẫn đầu & Tốc độ cao & Tiến độ */}
                <div className="space-y-1 z-10">
                  {/* Bảng tốc độ, tên nhân vật / tài xế và xe dẫn đầu */}
                  <div className="flex flex-col gap-1 bg-black/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/80 shadow-lg">
                    <div className="flex items-center justify-between text-[10px]">
                      {/* Tên Nhân Vật / Tài Xế & Xe */}
                      <div className="flex items-center gap-1.5 truncate">
                        <Trophy className="w-3 h-3 text-amber-400 shrink-0" />
                        <span
                          className="w-2 h-2 rounded-full shrink-0 ring-1 ring-white/30"
                          style={{ backgroundColor: leader?.color || '#00f0ff' }}
                        ></span>
                        <div className="flex flex-col truncate">
                          <span className="font-bold text-amber-300 truncate text-[10px]">
                            {leader?.driverName || 'Cristiano Ronaldo'}
                          </span>
                          <span className="text-[8.5px] text-slate-400 truncate">
                            {leader?.name || 'Xe Dẫn Đầu'}
                          </span>
                        </div>
                      </div>

                      {/* Tốc độ KM/H */}
                      <div className={`flex items-center gap-1 font-mono font-black text-xs px-2 py-0.5 rounded-lg border shrink-0 ${
                        leaderSpeed > 340 
                          ? 'bg-rose-950/80 text-rose-300 border-rose-500/50 animate-pulse' 
                          : 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50'
                      }`}>
                        <Gauge className="w-3.5 h-3.5" />
                        <span>{leaderSpeed} KM/H</span>
                      </div>
                    </div>
                  </div>

                  {/* Thanh tiến trình cắt video */}
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-[8.5px] font-mono text-slate-400">
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Radio className="w-2 h-2" />
                        Video #{instance.currentVideoChunkIndex}
                      </span>
                      <span>Còn {remainingSecs}s</span>
                    </div>
                    <div className="w-full h-1 bg-slate-800/90 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 via-purple-500 to-emerald-400 transition-all duration-300"
                        style={{ width: `${progressPct}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Driver List Overlay - Professional Broadcast Starting Grid from Second 3 to Second 6 (Compact, Thu nhỏ, Chính xác 5 Tay Đua Nổi Tiếng Nhất) */}
                {instance.chunkTimeElapsed >= 3.0 && instance.chunkTimeElapsed <= 6.0 && (
                  <div className="absolute top-2.5 left-2.5 w-[165px] bg-slate-950/90 backdrop-blur-md z-40 p-2 flex flex-col rounded-lg border border-cyan-500/30 shadow-2xl animate-fade-in font-sans pointer-events-none">
                    <div className="mb-1.5 border-b border-cyan-500/30 pb-1 shrink-0">
                      <div className="text-[7.5px] font-mono tracking-[0.1em] text-cyan-400 font-bold uppercase flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                        STARTING GRID
                      </div>
                      <h3 className="text-[9px] font-black text-white uppercase tracking-wide">
                        5 Tay Đua Huyền Thoại
                      </h3>
                      <p className="text-[6.5px] text-slate-400 font-mono">
                        LUỒNG #{instance.id.toString().padStart(2, '0')}
                      </p>
                    </div>

                    <div className="flex flex-col gap-1 pr-0.5">
                      {['Lionel Messi', 'Cristiano Ronaldo', 'Neymar Jr', 'David Beckham', 'Kylian Mbappe'].map((famousName, idx) => {
                        const carFound = instance.cars.find(c => (c.driverName || '').toLowerCase().includes(famousName.toLowerCase().slice(0, 5)));
                        const bgHex = carFound && carFound.hexColor !== undefined
                          ? `#${carFound.hexColor.toString(16).padStart(6, '0')}`
                          : (idx === 0 ? '#38bdf8' : idx === 1 ? '#dc2626' : idx === 2 ? '#eab308' : idx === 3 ? '#2563eb' : '#16a34a');

                        return (
                          <div
                            key={famousName}
                            className="flex items-center justify-between bg-slate-900/90 border border-slate-800/60 rounded px-1 py-0.5 shrink-0"
                          >
                            <div className="flex items-center gap-1 truncate">
                              {/* Grid Position */}
                              <div className="w-3.5 h-3.5 rounded bg-cyan-950 border border-cyan-500/20 flex items-center justify-center font-mono font-black text-cyan-400 text-[7.5px] shrink-0">
                                {idx + 1}
                              </div>
                              
                              {/* Team Color Pill */}
                              <div
                                className="w-0.5 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: bgHex }}
                              />

                              {/* Driver and Car Name */}
                              <div className="flex flex-col truncate leading-none">
                                <span className="font-bold text-white uppercase text-[7.5px] tracking-tight truncate">
                                  {famousName}
                                </span>
                                <span className="text-[6px] text-slate-400 font-mono truncate">
                                  {carFound?.name || `GT Supercar #${idx + 1}`}
                                </span>
                              </div>
                            </div>

                            {/* Category Badge */}
                            <div className="text-[6px] font-mono font-bold text-cyan-400/90 bg-cyan-950/40 px-1 rounded border border-cyan-500/10 shrink-0">
                              {idx % 2 === 0 ? 'HYPER' : 'F1'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
