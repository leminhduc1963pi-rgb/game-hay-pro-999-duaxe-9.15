/**
 * Video File Manager - Catalog & Batch Export Downloader
 */
import React, { useState } from 'react';
import { X, Film, Download, Play, CheckCircle2, FileText, Code, HardDrive, Sparkles, Loader2 } from 'lucide-react';
import { VideoRecordJob } from '../types';
import { videoRecorderService } from '../recorder/videoRecorderService';

interface VideoFileManagerProps {
  jobs: VideoRecordJob[];
  isOpen: boolean;
  onClose: () => void;
  onDownloadJob: (job: VideoRecordJob) => void;
}

export const VideoFileManager: React.FC<VideoFileManagerProps> = ({
  jobs,
  isOpen,
  onClose,
  onDownloadJob
}) => {
  const [selectedInstanceFilter, setSelectedInstanceFilter] = useState<number | 'all'>('all');
  const [playingJob, setPlayingJob] = useState<VideoRecordJob | null>(null);

  if (!isOpen) return null;

  const filteredJobs = selectedInstanceFilter === 'all'
    ? jobs
    : jobs.filter(j => j.instanceId === selectedInstanceFilter);

  const totalSizeMB = jobs.reduce((acc, curr) => acc + curr.sizeMB, 0);

  const exportMetadataJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(jobs, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `RacingVideoFactory_Catalog_${new Date().toISOString().slice(0, 10)}.json`);
    dlAnchor.click();
  };

  const generateWindowsFFmpegBat = () => {
    const batContent = `@echo off
REM ==========================================================
REM Racing Video Factory - Script chay FFmpeg NVENC tren Windows
REM Xuat video 60FPS cuc nhanh bang phan cung card do hoa GPU
REM ==========================================================

mkdir D:\\RacingVideoFactory\\Videos 2>nul
echo [*] Dang khoi dong pipeline encode video GPU...

REM Cau lenh encode truc tiep NVENC cho 1080x1920 60FPS (Full HD doc, 9:16, H.264 .mp4):
REM ffmpeg -y -f rawvideo -vcodec rawvideo -s 1080x1920 -pix_fmt rgba -r 60 -i - -c:v h264_nvenc -preset p7 -b:v 18M -maxrate 25M -bufsize 36M D:\\RacingVideoFactory\\Videos\\race_vertical_1080x1920.mp4

echo [*] He thong dang hoat dong tren Windows.
pause
`;
    const blob = new Blob([batContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const dlAnchor = document.createElement('a');
    dlAnchor.href = url;
    dlAnchor.download = 'run_nvenc_pipeline.bat';
    dlAnchor.click();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Kho Video Đã Xuất
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300 font-mono">
                  {jobs.length} video hoàn chỉnh
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Các clip MP4 2 phút được cắt tự động liên tục và lưu trữ kèm Seed độc lập
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {jobs.length > 0 && (
              <button
                onClick={() => videoRecorderService.downloadAllVerticalJobs(jobs.slice(0, 6))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white border border-emerald-500 transition cursor-pointer shadow-lg shadow-emerald-950"
                title="Tải đồng thời 6 video dọc độc lập chuẩn 1080x1920 (2 Phút)"
              >
                <Download className="w-3.5 h-3.5" />
                Tải 6 Video (2 Phút)
              </button>
            )}

            <button
              onClick={exportMetadataJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              Xuất Báo Cáo JSON
            </button>

            <button
              onClick={generateWindowsFFmpegBat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition cursor-pointer"
              title="Tải Script Batch FFmpeg NVENC"
            >
              <Code className="w-3.5 h-3.5 text-amber-400" />
              Tải Script .BAT
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Thanh lọc và tổng kết dung lượng */}
        <div className="px-6 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            <span className="text-slate-400 font-semibold mr-1">Lọc theo Instance:</span>
            <button
              onClick={() => setSelectedInstanceFilter('all')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                selectedInstanceFilter === 'all'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              Tất Cả
            </button>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(id => (
              <button
                key={id}
                onClick={() => setSelectedInstanceFilter(id)}
                className={`px-2 py-1 rounded text-xs font-mono font-bold transition cursor-pointer ${
                  selectedInstanceFilter === id
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                }`}
              >
                #{id.toString().padStart(2, '0')}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-slate-400 font-mono">
            <span className="flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5 text-slate-500" />
              Tổng dung lượng đã tạo: {totalSizeMB.toFixed(1)} MB
            </span>
          </div>
        </div>

        {/* Danh sách video */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredJobs.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
                <Film className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-300">
                Chưa có video nào hoàn thành trong bộ lọc này.
              </p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Bấm nút <strong>BẮT ĐẦU CHẠY</strong> ở thanh tiêu đề trên cùng. Hệ thống sẽ render các cuộc đua và tự động đóng file video xuất ra cứ mỗi 2 phút (hoặc 30s nếu chọn test nhanh).
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredJobs.map(job => {
                const isProcessing = job.status === 'processing';
                const percent = job.progressPercent !== undefined ? job.progressPercent : 100;

                return (
                  <div
                    key={job.id}
                    className={`bg-slate-950 border rounded-lg p-3.5 flex flex-col justify-between space-y-3 transition ${
                      isProcessing
                        ? 'border-cyan-500/50 shadow-lg shadow-cyan-950/40'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold border border-cyan-500/30 shrink-0">
                            CUỘC ĐUA #{job.instanceId.toString().padStart(2, '0')}
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-200 truncate">
                            {job.fileName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span>{job.biomeName}</span>
                          <span>&bull;</span>
                          <span className="text-amber-400">Về nhất: {job.winnerCar}</span>
                        </div>

                        {/* Thanh tiến trình % thời gian thực */}
                        {isProcessing && (
                          <div className="pt-1.5 pr-2">
                            <div className="flex items-center justify-between text-[10px] font-mono text-cyan-300 mb-1">
                              <span className="flex items-center gap-1 font-bold">
                                <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                                ĐANG KẾT XUẤT (PROCESSING)
                              </span>
                              <span className="font-bold text-cyan-400">{percent}%</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                              <div
                                className="bg-gradient-to-r from-cyan-500 via-sky-400 to-blue-500 h-full transition-all duration-200 rounded-full"
                                style={{ width: `${Math.max(4, percent)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="text-right font-mono text-[11px] text-slate-400 shrink-0">
                        <span className="block text-slate-200 font-bold">
                          {isProcessing ? 'Đang tạo...' : `${job.sizeMB} MB`}
                        </span>
                        <span className="text-cyan-400 font-bold">
                          {job.durationSeconds || 120} giây ({Math.round((job.durationSeconds || 120) / 60)} phút) @ {job.fps || 60} FPS
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-xs text-slate-400">
                      <div className="flex items-center gap-2">
                        {isProcessing ? (
                          <span className="flex items-center gap-1 font-mono text-[11px] text-cyan-400 font-semibold animate-pulse">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                            Đang xử lý khung hình ({percent}%)
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 font-mono text-[11px] text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Đã đóng file hoàn chỉnh
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-[11px] text-purple-300 font-mono">
                          <Sparkles className="w-3 h-3" />
                          Seed: #{job.seed}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isProcessing ? (
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-800/80 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ĐANG XUẤT {percent}%
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => setPlayingJob(job)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition cursor-pointer"
                            >
                              <Play className="w-3 h-3 text-cyan-400 fill-cyan-400" />
                              Xem thử
                            </button>

                            <button
                              onClick={() => onDownloadJob(job)}
                              className="flex items-center gap-1.5 px-3 py-1 rounded bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs transition cursor-pointer shadow-md"
                            >
                              <Download className="w-3 h-3" />
                              Tải Video ({job.durationSeconds || 120}s)
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal xem video thử */}
        {playingJob && (
          <div className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col">
              <div className="flex items-center justify-between p-3.5 border-b border-slate-800 bg-slate-950">
                <div className="flex items-center gap-2 truncate">
                  <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[11px] font-bold border border-cyan-500/30">
                    1080x1920 (9:16)
                  </span>
                  <span className="text-xs font-bold text-white truncate">
                    {playingJob.fileName}
                  </span>
                </div>
                <button
                  onClick={() => setPlayingJob(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Khung Video Dọc 9:16 */}
              <div className="p-4 bg-black/90 flex flex-col justify-center items-center gap-3">
                <video
                  src={playingJob.url}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="max-h-[60vh] aspect-[9/16] rounded-xl border border-slate-700 object-contain shadow-2xl bg-slate-950"
                />

                {/* Thông tin chi tiết video */}
                <div className="w-full bg-slate-800/80 rounded-xl p-3 border border-slate-700/60 flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Thời lượng chuẩn:</span>
                    <span className="font-mono font-bold text-cyan-300">120 giây (2 phút) @ 60 khung hình/giây</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Định dạng & Tỷ lệ:</span>
                    <span className="font-mono font-bold text-emerald-400">1080 x 1920 pixels (9:16 Full HD Dọc)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Tay đua & Xe:</span>
                    <span className="font-bold text-amber-300">{playingJob.winnerCar}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Bản đồ đua:</span>
                    <span className="font-medium text-cyan-300 truncate max-w-[280px]">{playingJob.biomeName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Tốc độ tối đa:</span>
                    <span className="font-mono font-bold text-orange-400">{playingJob.topSpeedKmh} KM/H</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Dung lượng:</span>
                    <span className="font-mono text-slate-300">{playingJob.sizeMB} MB</span>
                  </div>
                </div>

                {/* Nút tải video về máy */}
                <button
                  onClick={() => onDownloadJob(playingJob)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/50 transition active:scale-95 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Tải Video (2 Phút)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
          <span>
            Đường dẫn lưu trữ Windows: <code>D:\RacingVideoFactory\Videos\Instance_XX\</code>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-semibold transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
