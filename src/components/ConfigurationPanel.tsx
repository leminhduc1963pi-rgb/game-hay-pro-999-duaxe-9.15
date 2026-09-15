import React, { useState } from 'react';
import { Settings, Folder, Video, Sliders, Camera, Sparkles, FolderPlus, Download, Smartphone, Film, Check, Users, Gauge } from 'lucide-react';
import { AspectRatioOption, FPSOption, ResolutionPreset, SystemConfig, VideoFileFormat } from '../types';

interface ConfigurationPanelProps {
  config: SystemConfig;
  isRunning: boolean;
  onChangeConfig: (updates: Partial<SystemConfig>) => void;
  onApplyConfig?: (updates: Partial<SystemConfig>) => void;
  onPickDirectory: () => void;
  selectedDirectoryName?: string;
}

export const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({
  config,
  isRunning,
  onChangeConfig,
  onApplyConfig,
  onPickDirectory,
  selectedDirectoryName
}) => {
  const [selectedFps, setSelectedFps] = useState<FPSOption>(config.fps);
  const [selectedCars, setSelectedCars] = useState<number>(config.carsPerRace || 10);
  const [justApplied, setJustApplied] = useState<boolean>(false);

  const carScenarioOptions = [
    { count: 6, label: '6 Xe Đua', desc: 'Đua nhóm tinh gọn, bám đuổi kịch tính' },
    { count: 10, label: '10 Xe Đua', desc: 'Chuẩn Grand Prix, hỗn chiến cao độ' },
    { count: 15, label: '15 Xe Đua', desc: 'Tối đa 15 xe, nghẹt thở nghẽn đường' }
  ];

  const handleApplySettings = () => {
    const updates: Partial<SystemConfig> = {
      fps: selectedFps,
      carsPerRace: selectedCars
    };
    onChangeConfig(updates);
    if (onApplyConfig) {
      onApplyConfig(updates);
    }
    setJustApplied(true);
    setTimeout(() => setJustApplied(false), 2500);
  };
  const instanceOptions: (1 | 2 | 4 | 6 | 8 | 10)[] = [1, 2, 4, 6, 8, 10];
  const resolutionOptions: { label: string; value: ResolutionPreset; badge?: string }[] = [
    { label: '1080 x 1920 px', value: '1080x1920 (Full HD Dọc)', badge: 'Khuyên dùng' },
    { label: '720 x 1280 px', value: '720x1280 (HD Dọc)' },
    { label: '1440 x 2560 px', value: '1440x2560 (2K Dọc)' },
    { label: '2160 x 3840 px', value: '2160x3840 (4K Dọc)' },
    { label: '1920 x 1080 px', value: '1080p (Ngang)' },
  ];
  const aspectRatioOptions: { label: string; value: AspectRatioOption }[] = [
    { label: '9:16 (Full HD Dọc)', value: '9:16' },
    { label: '16:9 (Ngang)', value: '16:9' }
  ];
  const fileFormatOptions: { label: string; value: VideoFileFormat; desc: string }[] = [
    { label: '.mp4', value: 'mp4', desc: 'Khuyên dùng H.264 .mp4' },
    { label: '.mov', value: 'mov', desc: 'QuickTime .mov' }
  ];
  const fpsOptions: FPSOption[] = [60, 30, 120];
  const durationOptions = [
    { label: '30s (~60MB)', value: 30 },
    { label: '60s (Chuẩn 120MB)', value: 60 },
    { label: '120s (2 Phút)', value: 120 }
  ];

  const downloadCreateFolderBat = () => {
    const bat = `@echo off
title Tao Thu Muc D:\\RacingVideoFactory\\Videos
color 0A
echo ================================================================
echo   DANG TAO THU MUC LUU TRU VIDEO TREN O DIA D:\\ CHO BAN...
echo ================================================================
echo.

mkdir "D:\\RacingVideoFactory\\Videos" 2>nul

for /L %%i in (1,1,10) do (
    if %%i LSS 10 (
        mkdir "D:\\RacingVideoFactory\\Videos\\Instance_0%%i" 2>nul
    ) else (
        mkdir "D:\\RacingVideoFactory\\Videos\\Instance_%%i" 2>nul
    )
)

echo.
echo [THANH CONG!] Da tao xong thu muc:
echo D:\\RacingVideoFactory\\Videos\\
echo Gom cac thu muc con tu Instance_01 den Instance_10!
echo.
echo Ban co the mo thu muc ngay bay gio tren Windows Explorer:
explorer "D:\\RacingVideoFactory\\Videos"
pause
`;
    const blob = new Blob([bat], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Tao_Thu_Muc_O_D.bat';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="w-full lg:w-80 bg-slate-900/95 border-b lg:border-b-0 lg:border-r border-slate-800 p-4 space-y-4 text-sm text-slate-300 shrink-0 overflow-y-auto">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2 text-white font-bold text-xs tracking-wider uppercase">
          <Settings className="w-4 h-4 text-cyan-400" />
          Bảng Điều Khiển Cấu Hình
        </div>
        {isRunning && (
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            ĐANG CHẠY RENDER
          </span>
        )}
      </div>

      {/* 1. Số lượng Instance chạy đồng thời (1 đến 10) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-slate-300">
            Số Luồng Chạy Đồng Thời:
          </label>
          <span className="text-[10px] text-cyan-400 font-bold bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/30">
            {config.instanceCount} Luồng Video
          </span>
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {instanceOptions.map(count => (
            <button
              key={count}
              id={`btn-instance-${count}`}
              onClick={() => onChangeConfig({ instanceCount: count })}
              className={`py-1.5 rounded text-xs font-bold transition cursor-pointer ${
                config.instanceCount === count
                  ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-900/40 ring-1 ring-cyan-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
              }`}
            >
              {count}x
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-400">
          {config.instanceCount === 8
            ? '⭐ Chuẩn khuyên dùng: 8 luồng video Full HD dọc chạy song song'
            : `Đang render đồng thời ${config.instanceCount} cuộc đua độc lập`}
        </p>
      </div>

      {/* 2. Độ phân giải video & Tỷ lệ khung hình */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1 text-xs font-semibold text-slate-300">
          <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
          Độ Phân Giải:
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {resolutionOptions.map(res => (
            <button
              key={res.value}
              id={`btn-resolution-${res.value}`}
              onClick={() => onChangeConfig({ resolution: res.value })}
              className={`py-1.5 px-2 rounded text-xs font-semibold transition cursor-pointer text-left flex items-center justify-between ${
                config.resolution === res.value
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              <span>{res.label}</span>
              {res.badge && (
                <span className="text-[9px] bg-emerald-500/30 text-emerald-300 px-1 py-0.2 rounded font-bold border border-emerald-400/40">
                  {res.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Tỷ lệ khung hình (Aspect Ratio: 9:16 vs 16:9) */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1 text-xs font-semibold text-slate-300">
          <Sliders className="w-3.5 h-3.5 text-slate-400" />
          Tỷ Lệ Khung Hình:
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {aspectRatioOptions.map(aspect => (
            <button
              key={aspect.value}
              id={`btn-aspect-${aspect.value.replace(':', '-')}`}
              onClick={() => onChangeConfig({ aspectRatio: aspect.value })}
              className={`py-1.5 rounded text-xs font-bold transition cursor-pointer ${
                config.aspectRatio === aspect.value
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
              }`}
            >
              {aspect.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Định dạng tệp video: .mp4 (H.264) vs .mov */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1 text-xs font-semibold text-slate-300">
          <Film className="w-3.5 h-3.5 text-slate-400" />
          Định Dạng Tệp Video:
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {fileFormatOptions.map(fmt => (
            <button
              key={fmt.value}
              id={`btn-format-${fmt.value}`}
              onClick={() => onChangeConfig({ fileFormat: fmt.value })}
              className={`py-1.5 px-2 rounded text-xs font-bold transition cursor-pointer text-left ${
                config.fileFormat === fmt.value
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              <div className="uppercase tracking-wider">{fmt.label}</div>
              <div className="text-[9px] font-normal opacity-85 truncate">{fmt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 5. Kịch Bản Đua Xe (6 xe, 10 xe hoặc 15 xe đua cùng nhau) */}
      <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
            <Users className="w-3.5 h-3.5 text-amber-400" />
            Kịch Bản Số Lượng Xe Đua:
          </label>
          <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-500/40">
            {selectedCars} Xe Cùng Lúc
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {carScenarioOptions.map(opt => (
            <button
              key={opt.count}
              id={`btn-cars-${opt.count}`}
              onClick={() => {
                setSelectedCars(opt.count);
                onChangeConfig({ carsPerRace: opt.count as any });
                if (onApplyConfig) {
                  onApplyConfig({ carsPerRace: opt.count as any });
                }
              }}
              className={`py-2 px-1 rounded-lg text-xs font-bold transition cursor-pointer flex flex-col items-center justify-center ${
                selectedCars === opt.count
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-950 ring-1 ring-amber-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              <span className="text-xs">{opt.label}</span>
              <span className="text-[9px] opacity-80 font-normal mt-0.5">{opt.count === 15 ? 'Tối đa 15' : 'Hấp dẫn'}</span>
            </button>
          ))}
        </div>
        <p className="text-[10.5px] text-slate-400">
          Kịch bản các xe đua cạnh tranh, drift và vượt mặt nhau trên đường đua.
        </p>
      </div>

      {/* 6. Tốc độ khung hình (FPS) & Nút Áp Dụng */}
      <div className="space-y-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            Tốc Độ Khung Hình (FPS):
          </label>
          <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/40">
            {selectedFps} FPS {selectedFps === 120 ? 'Siêu mượt' : ''}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {fpsOptions.map(fps => (
            <button
              key={fps}
              id={`btn-fps-${fps}`}
              onClick={() => setSelectedFps(fps)}
              className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1 ${
                selectedFps === fps
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950 ring-1 ring-cyan-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
              }`}
            >
              <span>{fps} FPS</span>
              {fps === 60 && <span className="text-[10px]">⭐</span>}
              {fps === 120 && <span className="text-[10px]">⚡</span>}
            </button>
          ))}
        </div>

        {/* NÚT ÁP DỤNG THÔNG SỐ (FPS & SỐ XE) */}
        <button
          id="btn-apply-fps-settings"
          onClick={handleApplySettings}
          className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95 ${
            justApplied
              ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-400 shadow-emerald-950'
              : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-950 ring-1 ring-cyan-400/50'
          }`}
        >
          {justApplied ? (
            <>
              <Check className="w-4 h-4 text-slate-950 stroke-[3]" />
              <span>ĐÃ ÁP DỤNG THÀNH CÔNG! ({selectedFps} FPS • {selectedCars} XE)</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4 text-white stroke-[2.5]" />
              <span>ÁP DỤNG THÔNG SỐ ({selectedFps} FPS • {selectedCars} XE)</span>
            </>
          )}
        </button>

        <p className="text-[10.5px] text-slate-400 text-center">
          Bấm <strong>Áp dụng</strong> sau đó bấm <strong>Bắt đầu chạy</strong> để hệ thống hoạt động đúng theo các thông số đã chọn.
        </p>
      </div>

      {/* 4. Thời lượng cắt video tự động */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-slate-300">
          Chu Kỳ Tự Động Cắt Video:
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {durationOptions.map(d => (
            <button
              key={d.value}
              id={`btn-duration-${d.value}`}
              onClick={() => onChangeConfig({ durationSeconds: d.value })}
              className={`py-1 px-1 rounded text-[11px] font-semibold transition cursor-pointer truncate ${
                config.durationSeconds === d.value
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-400">
          Cứ sau {config.durationSeconds} giây, hệ thống tự động đóng file MP4, tạo Seed mới và quay video tiếp theo.
        </p>
      </div>

      {/* 5. Thư mục lưu trữ trên máy tính Windows */}
      <div className="space-y-2 p-3 rounded-lg bg-slate-950/80 border border-slate-800">
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
          <Folder className="w-4 h-4 text-cyan-400" />
          Thư Mục Lưu Trữ Trên Máy (Ổ D:\):
        </label>

        <div className="space-y-1.5">
          <input
            id="input-save-dir"
            type="text"
            value={config.saveDirectory}
            onChange={e => onChangeConfig({ saveDirectory: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
          />

          {selectedDirectoryName ? (
            <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-950/40 p-1.5 rounded border border-emerald-800/40">
              <span>✓ Đã liên kết thư mục Windows: <strong>{selectedDirectoryName}</strong></span>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={onPickDirectory}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-cyan-600/90 hover:bg-cyan-500 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                Chọn hoặc Tạo Thư Mục D:\ Trên Máy
              </button>

              <button
                type="button"
                onClick={downloadCreateFolderBat}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition cursor-pointer"
                title="Tải file .bat để tự động tạo D:\RacingVideoFactory\Videos"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                Tải File Tạo Nhanh Thư Mục D:\ (.bat)
              </button>
            </div>
          )}

          <p className="text-[10px] text-amber-400/90 leading-tight pt-1">
            💡 <em>Lý do máy chưa có:</em> Trình duyệt không được phép tự ý thâm nhập ổ D:\ nếu chưa có lệnh của bạn. Bạn hãy bấm nút trên hoặc chạy file .bat để Windows tạo thư mục ngay!
          </p>
        </div>

        <label className="flex items-center gap-2 pt-1 text-xs text-amber-300 font-semibold cursor-pointer select-none">
          <input
            type="checkbox"
            checked={config.autoDownloadToDevice ?? true}
            onChange={e => onChangeConfig({ autoDownloadToDevice: e.target.checked })}
            className="rounded text-amber-500 bg-slate-950 border-slate-700"
          />
          ⚡ Tự động tải video về máy ngay (Không cần ấn nút tải)
        </label>

        <label className="flex items-center gap-2 pt-0.5 text-xs text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={config.autoExportToDisk}
            onChange={e => onChangeConfig({ autoExportToDisk: e.target.checked })}
            className="rounded text-cyan-500 bg-slate-950 border-slate-700"
          />
          Tự động xuất / tải file về máy mỗi khi đủ thời lượng
        </label>
      </div>

      {/* 6. Mức độ hung hãn của AI */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="flex items-center gap-1 text-slate-300">
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
            Mức Độ Hung Hãn Của AI:
          </span>
          <span className="text-cyan-400 font-mono font-bold">
            {Math.round(config.aiAggressionGlobal * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0.2"
          max="1.0"
          step="0.05"
          value={config.aiAggressionGlobal}
          onChange={e => onChangeConfig({ aiAggressionGlobal: parseFloat(e.target.value) })}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
        />
        <div className="flex justify-between text-[10px] text-slate-400">
          <span>An toàn</span>
          <span>Cạnh tranh</span>
          <span>Quyết liệt & Drift</span>
        </div>
      </div>

      {/* 7. Đạo diễn Camera Truyền Hình 9 góc */}
      <div className="pt-1 border-t border-slate-800">
        <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer py-1">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-purple-400" />
            <span className="font-semibold">Đạo Diễn Tự Chuyển 9 Góc Truyền Hình</span>
          </div>
          <input
            type="checkbox"
            checked={config.cinematicAutoDirector}
            onChange={e => onChangeConfig({ cinematicAutoDirector: e.target.checked })}
            className="rounded text-cyan-500 bg-slate-950 border-slate-700"
          />
        </label>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Tự động chuyển đổi thông minh giữa 9 góc quay truyền hình chuyên nghiệp (Telephoto 85mm, Khán đài, Drone bám cao, Trực thăng F1, Mép cua Apex, Pit Wall...).
        </p>
      </div>

      {/* Seed Manager */}
      <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800 space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
          <Sparkles className="w-3.5 h-3.5" />
          Hệ Thống Seed Chống Trùng Lặp
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Tự động hoán đổi màu xe, loại xe, cung đường đua (Neo-Tokyo, Hẻm núi, Đỉnh núi tuyết...) đảm bảo các video không bao giờ bị lặp lại.
        </p>
      </div>
    </aside>
  );
};
