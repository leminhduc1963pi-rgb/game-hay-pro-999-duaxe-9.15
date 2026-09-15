/**
 * Dashboard Header Component - Racing Video Factory
 */
import React from 'react';
import { Play, Square, Pause, HardDrive, Cpu, Film, Terminal, HelpCircle, Video, Loader2 } from 'lucide-react';
import { SystemConfig, SystemHardwareStats } from '../types';

interface DashboardHeaderProps {
  isRunning: boolean;
  isPaused: boolean;
  stats: SystemHardwareStats;
  config: SystemConfig;
  appMode: 'PLAYABLE_RACING' | 'VIDEO_FACTORY';
  onToggleAppMode: (mode: 'PLAYABLE_RACING' | 'VIDEO_FACTORY') => void;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onOpenLogs: () => void;
  onOpenGuide: () => void;
  onOpenVideoLibrary: () => void;
  onExport6Videos?: () => void;
  isExporting6Videos?: boolean;
  exportProgressText?: string | null;
  onSelectDuration?: (duration: number) => void;
  processingCount?: number;
  processingProgress?: number | null;
  completedVideosCount?: number;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  isRunning,
  isPaused,
  stats,
  config,
  appMode,
  onToggleAppMode,
  onStart,
  onStop,
  onPause,
  onOpenLogs,
  onOpenGuide,
  onOpenVideoLibrary,
  onExport6Videos,
  isExporting6Videos,
  exportProgressText,
  onSelectDuration,
  processingCount = 0,
  processingProgress = null,
  completedVideosCount
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 select-none">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Tên & Chuyển đổi Chế độ Game */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white uppercase">
                  HIGH-END 3D RACING & FACTORY
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded">
                  AAA SIMULATOR
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Vật lý bánh xe &bull; Âm thanh động cơ đa tầng &bull; 60/120 FPS Anti-Tearing
              </p>
            </div>
          </div>

          {/* Tab Switcher: Chế độ Game Trực Tiếp vs Nhà Máy Video */}
          <div className="flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              onClick={() => onToggleAppMode('PLAYABLE_RACING')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                appMode === 'PLAYABLE_RACING'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🎮 CHẾ ĐỘ LÁI XE 3D
            </button>
            <button
              onClick={() => onToggleAppMode('VIDEO_FACTORY')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                appMode === 'VIDEO_FACTORY'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🏭 NHÀ MÁY VIDEO ({config.instanceCount} LUỒNG)
            </button>
          </div>

          <div className="flex items-center gap-1 md:hidden">
            <button
              onClick={onOpenGuide}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded"
              title="Hướng dẫn Windows & Thư mục D:\"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button
              onClick={onOpenLogs}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded"
              title="Nhật ký hệ thống"
            >
              <Terminal className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cụm nút điều khiển chính */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-center">
          {!isRunning ? (
            <button
              id="btn-start-system"
              onClick={onStart}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-900/40 transition active:scale-95 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              BẮT ĐẦU CHẠY
            </button>
          ) : (
            <>
              <button
                id="btn-pause-system"
                onClick={onPause}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition active:scale-95 cursor-pointer ${
                  isPaused
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold'
                    : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/40'
                }`}
              >
                <Pause className="w-4 h-4" />
                {isPaused ? 'TIẾP TỤC' : 'TẠM DỪNG'}
              </button>

              <button
                id="btn-stop-system"
                onClick={onStop}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold shadow-lg shadow-rose-900/40 transition active:scale-95 cursor-pointer"
              >
                <Square className="w-4 h-4 fill-white" />
                DỪNG HỆ THỐNG
              </button>
            </>
          )}

          {onExport6Videos && appMode === 'VIDEO_FACTORY' && (
            <div className="flex items-center gap-1.5">
              <button
                id="btn-export-6-vertical-videos"
                onClick={onExport6Videos}
                disabled={isExporting6Videos}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-cyan-950/60 transition active:scale-95 cursor-pointer disabled:cursor-wait"
                title={`Xuất ngay ${config.instanceCount} Video Dọc 1080x1920 (9:16) 60 FPS chuẩn không giật lag, tua nhanh`}
              >
                {isExporting6Videos ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-200" />
                    <span className="font-mono text-cyan-100 font-bold tracking-wide">
                      {exportProgressText || `ĐANG XUẤT: LUỒNG 1/${config.instanceCount} (0%)`}
                    </span>
                  </>
                ) : (
                  <>
                    <Video className="w-4 h-4 text-cyan-200" />
                    <span>XUẤT {config.instanceCount} VIDEO DỌC (9:16)</span>
                  </>
                )}
              </button>

              {!isExporting6Videos && onSelectDuration && (
                <select
                  value={config.durationSeconds || 120}
                  onChange={(e) => onSelectDuration(Number(e.target.value))}
                  className="bg-slate-800 text-cyan-300 text-xs font-mono font-bold rounded-lg px-2 py-2 border border-slate-700 hover:border-cyan-500/60 cursor-pointer outline-none transition"
                  title="Chọn thời lượng xuất video (giây)"
                >
                  <option value={30}>30s (Nhanh)</option>
                  <option value={60}>60s (1 Phút)</option>
                  <option value={120}>120s (2 Phút)</option>
                </select>
              )}
            </div>
          )}

          <button
            id="btn-open-video-library"
            onClick={onOpenVideoLibrary}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition cursor-pointer"
            title="Mở Kho Video để xem thử và tải các video đã xuất"
          >
            <Film className="w-4 h-4 text-cyan-400" />
            <span>Kho Video ({completedVideosCount !== undefined ? completedVideosCount : stats.totalVideosCreated})</span>
            {processingCount > 0 && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/50 text-[10px] font-mono font-bold animate-pulse">
                <Loader2 className="w-2.5 h-2.5 animate-spin text-cyan-400" />
                {processingProgress !== null
                  ? `[${processingCount} đang xuất: ${processingProgress}%]`
                  : `[${processingCount} đang xuất...]`}
              </span>
            )}
          </button>
        </div>

        {/* Thông số phần cứng theo thời gian thực */}
        <div className="hidden lg:flex items-center gap-3">
          {/* FPS Engine */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/60" title="Tốc độ khung hình Render">
            <span className="text-[10px] text-slate-400 uppercase font-mono">FPS</span>
            <span className={`text-xs font-mono font-bold ${stats.engineFPS >= 55 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {stats.engineFPS}
            </span>
          </div>

          {/* Tải GPU */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/60" title="Ước tính mức sử dụng GPU">
            <span className="text-[10px] text-slate-400 uppercase font-mono">GPU</span>
            <span className="text-xs font-mono font-bold text-cyan-400">
              {stats.gpuUsagePct}%
            </span>
          </div>

          {/* Tải CPU */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/60" title="Mức sử dụng CPU">
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-mono text-slate-300">
              {stats.cpuUsagePct}%
            </span>
          </div>

          {/* RAM */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/60" title="Bộ nhớ RAM đang sử dụng">
            <span className="text-[10px] text-slate-400 uppercase font-mono">RAM</span>
            <span className="text-xs font-mono text-slate-300">
              {(stats.ramUsageMB / 1024).toFixed(1)}GB
            </span>
          </div>

          {/* Ổ đĩa trống */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/60" title={`Lưu tại thư mục: ${config.saveDirectory}`}>
            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-mono text-slate-300">
              {stats.diskFreeGB.toFixed(0)}GB
            </span>
          </div>

          {/* Nút Hướng dẫn & Nhật ký */}
          <button
            onClick={onOpenGuide}
            className="px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:text-white bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-700/60 rounded transition cursor-pointer"
          >
            HD Thư mục D:\ & Windows
          </button>
          <button
            onClick={onOpenLogs}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition cursor-pointer"
            title="Nhật ký hệ thống"
          >
            <Terminal className="w-4 h-4" />
          </button>
        </div>

      </div>
    </header>
  );
};
