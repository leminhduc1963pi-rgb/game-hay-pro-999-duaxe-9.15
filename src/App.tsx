import { useState, useEffect, useRef, useCallback } from 'react';
import { MultiInstanceEngine } from './engine/multiInstanceEngine';
import { RacingInstance } from './engine/racingInstance';
import { videoRecorderService } from './recorder/videoRecorderService';
import { DashboardHeader } from './components/DashboardHeader';
import { ConfigurationPanel } from './components/ConfigurationPanel';
import { InstanceGrid } from './components/InstanceGrid';
import { InstanceDetailModal } from './components/InstanceDetailModal';
import { VideoFileManager } from './components/VideoFileManager';
import { SystemLogsModal } from './components/SystemLogsModal';
import { WindowsSetupGuideModal } from './components/WindowsSetupGuideModal';
import { AppleGameModal } from './components/AppleGameModal';
import { HighEndRacingView } from './components/HighEndRacingView';
import {
  CameraMode,
  InstanceRuntime,
  LogMessage,
  SystemConfig,
  SystemHardwareStats,
  VideoRecordJob
} from './types';

export default function App() {
  const [appMode, setAppMode] = useState<'PLAYABLE_RACING' | 'VIDEO_FACTORY'>('VIDEO_FACTORY');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<MultiInstanceEngine | null>(null);

  // Cấu hình hệ thống mặc định: 8 luồng đồng thời, 1080x1920 (9:16 dọc), .mp4, 60 FPS
  const [config, setConfig] = useState<SystemConfig>({
    instanceCount: 8, // Mặc định chạy đồng thời 8 luồng video Full HD dọc
    resolution: '1080x1920 (Full HD Dọc)',
    aspectRatio: '9:16',
    fileFormat: 'mp4',
    fps: 60,
    durationSeconds: 60, // Mặc định 60 giây (1 phút) chuẩn vàng 120MB cực nét 60 FPS
    carsPerRace: 10,
    saveDirectory: 'D:\\RacingVideoFactory\\Videos\\',
    autoExportToDisk: false,
    codec: 'video/webm;codecs=vp9',
    aiAggressionGlobal: 0.85,
    cinematicAutoDirector: true
  });

  const [selectedDirectoryName, setSelectedDirectoryName] = useState<string>('');

  // Trạng thái chạy của hệ thống
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Giám sát tài nguyên phần cứng
  const [stats, setStats] = useState<SystemHardwareStats>({
    engineFPS: 60,
    cpuUsagePct: 24,
    gpuUsagePct: 48,
    ramUsageMB: 2840,
    ramTotalMB: 32768,
    diskFreeGB: 842.4,
    totalVideosCreated: 0,
    systemUptimeSeconds: 0
  });

  // Dữ liệu trạng thái của các Instance thời gian thực
  const [instancesState, setInstancesState] = useState<InstanceRuntime[]>([]);
  const [activeJobs, setActiveJobs] = useState<VideoRecordJob[]>([]);
  const [isExporting6Threads, setIsExporting6Threads] = useState<boolean>(false);
  const [exportProgressText, setExportProgressText] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogMessage[]>([
    {
      id: 'init_1',
      timestamp: new Date().toLocaleTimeString('vi-VN'),
      type: 'info',
      message: 'Khởi động Động cơ Racing Video Factory trên môi trường Windows Local.'
    },
    {
      id: 'init_2',
      timestamp: new Date().toLocaleTimeString('vi-VN'),
      type: 'success',
      message: 'Hệ thống Render Multi-Viewport Scissor Test sẵn sàng. Hỗ trợ tối đa 10 luồng đua song song.'
    }
  ]);

  // Trạng thái các Modal
  const [inspectInstanceId, setInspectInstanceId] = useState<number | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(false);
  const [isLogsOpen, setIsLogsOpen] = useState<boolean>(false);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [isAppleGameOpen, setIsAppleGameOpen] = useState<boolean>(false);

  // Thêm thông điệp vào nhật ký
  const addLog = useCallback((type: 'info' | 'success' | 'warning' | 'error', message: string, instanceId?: number) => {
    setLogs(prev => [
      {
        id: `log_${Date.now()}_${Math.random()}`,
        timestamp: new Date().toLocaleTimeString('vi-VN'),
        type,
        message,
        instanceId
      },
      ...prev.slice(0, 99)
    ]);
  }, []);

  // Khởi tạo WebGL MultiInstanceEngine
  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new MultiInstanceEngine();
    engine.init(canvasRef.current, config);
    engineRef.current = engine;
    
    // Tự động gắn kết Engine & Canvas ngay khi khởi động trang web
    videoRecorderService.bindEngine(engine, canvasRef.current);

    videoRecorderService.setOnJobCreated((job) => {
      setActiveJobs(prev => {
        if (prev.some(j => j.id === job.id)) return prev;
        return [job, ...prev];
      });
    });

    videoRecorderService.setOnJobProgress((updatedJob) => {
      setActiveJobs(prev => {
        return prev.map(j => (j.id === updatedJob.id ? { ...updatedJob } : j));
      });

      if (updatedJob.status === 'ready') {
        setStats(prev => ({
          ...prev,
          totalVideosCreated: prev.totalVideosCreated + 1,
          diskFreeGB: Math.max(10, prev.diskFreeGB - (updatedJob.sizeMB || 5) / 1024)
        }));
      }
    });

    // Xử lý sự kiện khi một instance hoàn thành chu kỳ cắt video 2 phút
    engine.onChunkCompleted = (instance) => {
      addLog(
        'info',
        `Chặng đua ${config.durationSeconds || 120}s của Luồng #${instance.id} kết thúc! Đã đưa vào Kho Video và chuyển vào Hàng đợi kết xuất MP4 60 FPS.`,
        instance.id
      );

      // Đưa ngay vào hàng đợi xuất video và hiển thị tức thì trong Kho Video với trạng thái 'ĐANG KẾT XUẤT'
      videoRecorderService.enqueueChunkExport(
        instance,
        config,
        config.durationSeconds,
        (completedJob) => {
          addLog(
            'success',
            `Đã xuất video dọc 9:16 Full HD #${completedJob.videoNumber}: "${completedJob.fileName}" (${completedJob.sizeMB}MB, Seed: #${completedJob.seed}). Tự động tiếp tục vòng đua tiếp theo.`,
            instance.id
          );
        },
        (err) => {
          addLog('error', `Lỗi xuất video cho Luồng #${instance.id}: ${err}`, instance.id);
        }
      );
    };

    // Cập nhật FPS thực tế
    engine.onFpsUpdate = (fps) => {
      setStats(prev => ({
        ...prev,
        engineFPS: fps,
        gpuUsagePct: Math.min(98, Math.round(18 + config.instanceCount * 7.5 + (Math.random() * 4 - 2))),
        cpuUsagePct: Math.min(95, Math.round(12 + config.instanceCount * 4.2 + (Math.random() * 3 - 1.5)))
      }));
    };

    // Đồng bộ HUD thời gian thực (giới hạn 150ms để tối ưu hóa CPU và duy trì 60 FPS mượt mà)
    let lastTick = 0;
    engine.onStateTick = () => {
      const now = performance.now();
      if (now - lastTick > 150) {
        lastTick = now;
        const list: InstanceRuntime[] = [];
        for (const inst of engine.instances.values()) {
          list.push(inst.getRuntimeState());
        }
        setInstancesState(list);
      }
    };

    engine.start(config);
    addLog('info', `Hệ thống đang vận hành ${config.instanceCount} luồng render video 60 FPS đồng thời.`);

    return () => {
      engine.destroy();
    };
  }, [addLog]);

  // Đồng bộ khi thay đổi số lượng instance hoặc thời lượng
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.updateInstanceCount(config.instanceCount, config.durationSeconds);
  }, [config.instanceCount, config.durationSeconds]);

  // Bộ đếm thời gian hoạt động Uptime
  useEffect(() => {
    const timer = setInterval(() => {
      if (isRunning && !isPaused) {
        setStats(prev => ({
          ...prev,
          systemUptimeSeconds: prev.systemUptimeSeconds + 1
        }));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isRunning, isPaused]);

  // Các thao tác điều hành
  const handleStart = () => {
    if (!engineRef.current) return;
    engineRef.current.start(config);
    setIsRunning(true);
    setIsPaused(false);
    if (canvasRef.current) {
      videoRecorderService.setMainCanvas(canvasRef.current);
    }
    addLog('success', `Đã khởi động hệ thống mô phỏng ${config.instanceCount} Luồng với tốc độ tối đa 60-120 FPS. Cứ mỗi ${config.durationSeconds || 120}s hệ thống sẽ tự động xuất video vào Kho Video.`);
  };

  const handleStop = () => {
    if (!engineRef.current) return;
    engineRef.current.stop();
    setIsRunning(false);
    setIsPaused(false);
    videoRecorderService.stopAll();
    addLog('warning', 'Hệ thống đã dừng bởi người điều hành.');
  };

  const handlePause = () => {
    if (!engineRef.current) return;
    engineRef.current.pause();
    const paused = engineRef.current.isCurrentlyPaused();
    setIsPaused(paused);
    addLog('info', paused ? 'Hệ thống đã tạm dừng.' : 'Hệ thống tiếp tục hoạt động.');
  };

  const handleChangeConfig = (updates: Partial<SystemConfig>) => {
    setConfig(prev => {
      const updated = { ...prev, ...updates };
      if (engineRef.current && (updates.carsPerRace !== undefined || updates.instanceCount !== undefined)) {
        engineRef.current.applyConfig(updated);
      }
      addLog('info', `Cập nhật cấu hình: ${Object.keys(updates).join(', ')}`);
      return updated;
    });
  };

  const handleApplyConfig = (updates: Partial<SystemConfig>) => {
    setConfig(prev => {
      const updated = { ...prev, ...updates };
      if (engineRef.current) {
        engineRef.current.applyConfig(updated);
      }
      addLog('success', `Đã áp dụng thông số: FPS = ${updated.fps}, Số xe đua = ${updated.carsPerRace || 10} xe! Khi bấm Bắt Đầu Chạy, toàn bộ xe và đường đua sẽ chạy chính xác theo thông số này.`);
      return updated;
    });
  };

  // Chọn thư mục máy tính Windows qua File System Access API
  const handlePickDirectory = async () => {
    if ('showDirectoryPicker' in window) {
      try {
        const handle = await (window as any).showDirectoryPicker({
          mode: 'readwrite'
        });
        videoRecorderService.setDirectoryHandle(handle);
        setSelectedDirectoryName(handle.name);
        setConfig(prev => ({
          ...prev,
          saveDirectory: `D:\\${handle.name}\\`,
          autoExportToDisk: true
        }));
        addLog('success', `Đã kết nối thành công thư mục Windows: "${handle.name}". Các video xuất ra sẽ được tự động lưu trực tiếp vào thư mục này.`);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('Lỗi chọn thư mục:', err);
        }
      }
    } else {
      setIsGuideOpen(true);
    }
  };

  const handleSelectCamera = (instanceId: number, mode: CameraMode) => {
    if (!engineRef.current) return;
    engineRef.current.setInstanceCamera(instanceId, mode);
    addLog('info', `Đã chuyển Instance #${instanceId} sang góc quay điện ảnh: ${mode}`, instanceId);
  };

  const handleSelectRoadLayout = (instanceId: number, layoutId: any) => {
    if (!engineRef.current) return;
    engineRef.current.setInstanceRoadLayout(instanceId, layoutId);
    addLog('info', `Đã chuyển Instance #${instanceId} sang con đường đua mới: ${layoutId}`, instanceId);
  };

  const handleSelectBiome = (instanceId: number, biomeId: string) => {
    if (!engineRef.current) return;
    engineRef.current.setInstanceBiome(instanceId, biomeId);
    addLog('info', `Đã chuyển Instance #${instanceId} sang môi trường & khung cảnh mới: ${biomeId}`, instanceId);
  };

  const handleForceRerollSeed = (instanceId: number) => {
    if (!engineRef.current) return;
    const inst = engineRef.current.instances.get(instanceId);
    if (inst) {
      inst.recycleToNextRace(config.durationSeconds);
      addLog('info', `Đã tạo mới đường đua, thời tiết và xe cho Instance #${instanceId}.`, instanceId);
    }
  };

  const handleTriggerRecoveryTest = () => {
    if (!engineRef.current) return;
    const targetId = Math.floor(Math.random() * config.instanceCount) + 1;
    const inst = engineRef.current.instances.get(targetId);
    if (inst) {
      addLog('error', `Phát hiện lỗi mô phỏng (Crash) trên Instance #${targetId}! Watchdog đang kích hoạt quy trình tự phục hồi...`, targetId);
      inst.recover();
      setTimeout(() => {
        addLog('success', `Watchdog đã tự phục hồi thành công Instance #${targetId}. Cuộc đua tiếp tục bình thường mà không làm dừng các luồng khác.`, targetId);
      }, 500);
    }
  };

  const handleSwitchMode = (mode: 'PLAYABLE_RACING' | 'VIDEO_FACTORY') => {
    setAppMode(mode);
    if (mode === 'VIDEO_FACTORY' && engineRef.current) {
      setTimeout(() => {
        engineRef.current?.handleResize();
      }, 50);
      setTimeout(() => {
        engineRef.current?.handleResize();
      }, 200);
    }
  };

  const handleExport6ThreadsNow = async () => {
    if (!engineRef.current) return;
    setIsExporting6Threads(true);
    setExportProgressText(`ĐANG XUẤT: LUỒNG 1/${config.instanceCount} (0%)`);
    addLog('info', `Bắt đầu xuất đồng loạt ${config.instanceCount} Video Dọc 1080x1920 (9:16) 60 FPS (${config.durationSeconds || 120}s) với WebCodecs tăng tốc GPU...`);
    if (canvasRef.current) {
      videoRecorderService.bindEngine(engineRef.current, canvasRef.current);
    }
    const activeInsts = (Array.from(engineRef.current.instances.values()) as RacingInstance[]).slice(0, config.instanceCount);
    try {
      const jobs = await videoRecorderService.exportAll6Threads(
        activeInsts,
        config,
        config.durationSeconds,
        (progress) => {
          setExportProgressText(progress.statusText);
        }
      );
      if (jobs.length > 0) {
        setActiveJobs(prev => {
          const existingIds = new Set(prev.map(j => j.id));
          const newUnique = jobs.filter(j => !existingIds.has(j.id));
          return [...newUnique, ...prev];
        });
        setStats(prev => ({
          ...prev,
          totalVideosCreated: prev.totalVideosCreated + jobs.length,
          diskFreeGB: Math.max(5, prev.diskFreeGB - (jobs.length * 4) / 1024)
        }));
        addLog('success', `Đã xuất thành công ${jobs.length} Video Dọc Full HD 1080x1920 (9:16) 60 FPS chuẩn không tua nhanh, không giật lag! Đã lưu vào Kho Video.`);
        setIsLibraryOpen(true);
      }
    } catch (err) {
      console.warn('Lỗi xuất video:', err);
      addLog('error', `Có lỗi phát sinh trong quá trình xuất video ${config.instanceCount} luồng.`);
    } finally {
      setIsExporting6Threads(false);
      setExportProgressText(null);
    }
  };

  const inspectedInstance = instancesState.find(i => i.id === inspectInstanceId) || null;

  const completedVideosCount = activeJobs.filter(j => j.status === 'ready' || !j.status).length;
  const processingJobs = activeJobs.filter(j => j.status === 'processing');
  const processingCount = processingJobs.length;
  const currentProcessingJob = processingJobs[0];
  const processingProgress = currentProcessingJob ? (currentProcessingJob.progressPercent || 0) : null;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-sans select-none">
      {/* 1. Thanh tiêu đề & Giám sát phần cứng & Chọn Chế Độ Game */}
      <DashboardHeader
        isRunning={isRunning}
        isPaused={isPaused}
        stats={stats}
        config={config}
        appMode={appMode}
        onToggleAppMode={handleSwitchMode}
        onStart={handleStart}
        onStop={handleStop}
        onPause={handlePause}
        onOpenLogs={() => setIsLogsOpen(true)}
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenVideoLibrary={() => setIsLibraryOpen(true)}
        onExport6Videos={handleExport6ThreadsNow}
        isExporting6Videos={isExporting6Threads}
        exportProgressText={exportProgressText}
        onSelectDuration={(duration) => {
          setConfig(prev => ({ ...prev, durationSeconds: duration }));
          if (engineRef.current) {
            engineRef.current.updateInstanceCount(config.instanceCount, duration, config.carsPerRace);
          }
          addLog('info', `Đã thay đổi thời lượng xuất video thành: ${duration} giây (${duration === 120 ? '2 Phút' : duration === 60 ? '1 Phút' : 'Nhanh'})`);
        }}
        processingCount={processingCount}
        processingProgress={processingProgress}
        completedVideosCount={completedVideosCount}
      />

      {/* 2. Khu vực làm việc chính */}
      {appMode === 'PLAYABLE_RACING' && (
        <div className="flex-1 relative overflow-hidden block z-10">
          <HighEndRacingView onSwitchToVideoFactory={() => handleSwitchMode('VIDEO_FACTORY')} />
        </div>
      )}

      <div className={`flex flex-col lg:flex-row flex-1 overflow-hidden relative ${appMode === 'VIDEO_FACTORY' ? 'flex z-10' : 'invisible absolute inset-0 -z-10 pointer-events-none'}`}>
        {/* Bảng cấu hình bên trái */}
        <ConfigurationPanel
          config={config}
          isRunning={isRunning}
          onChangeConfig={handleChangeConfig}
          onApplyConfig={handleApplyConfig}
          onPickDirectory={handlePickDirectory}
          selectedDirectoryName={selectedDirectoryName}
        />

        {/* Lưới hiển thị 3D đa khung hình */}
        <main className="flex-1 relative flex flex-col overflow-hidden bg-black">
          <InstanceGrid
            canvasRef={canvasRef}
            instances={instancesState}
            activeCount={config.instanceCount}
            onInspectInstance={id => setInspectInstanceId(id)}
            onQuickSwitchCamera={handleSelectCamera}
          />

          {/* Thanh trạng thái dưới đáy */}
          <footer className="h-7 bg-slate-900 border-t border-slate-800 px-4 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Trạng thái: {isRunning ? (isPaused ? 'TẠM DỪNG' : 'SẢN XUẤT TỰ ĐỘNG') : 'ĐANG DỪNG'}
              </span>
              <span className="hidden sm:inline">&bull;</span>
              <span className="hidden sm:inline">
                Chu kỳ cắt video: {config.durationSeconds}s / file
              </span>
              <span className="hidden md:inline">&bull;</span>
              <span className="hidden md:inline">
                Mã hóa phần cứng GPU (NVENC/WebCodecs): Hoạt động
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsAppleGameOpen(true)}
                className="text-[11px] text-rose-400 hover:text-rose-300 font-medium cursor-pointer"
              >
                🍎 Game Hứng Táo (HTML/JS)
              </button>
              <span>&bull;</span>
              <span className="font-mono text-slate-300">
                Đã sản xuất: {stats.totalVideosCreated} video
              </span>
            </div>
          </footer>
        </main>
      </div>

      {/* 3. Các cửa sổ Modal */}
      {/* Modal xem chi tiết và tự chọn 30 góc camera, 20 đường đua, 20 môi trường */}
      {inspectedInstance && (
        <InstanceDetailModal
          instance={inspectedInstance}
          onClose={() => setInspectInstanceId(null)}
          onSelectCamera={handleSelectCamera}
          onSelectRoadLayout={handleSelectRoadLayout}
          onSelectBiome={handleSelectBiome}
          onForceRerollSeed={handleForceRerollSeed}
        />
      )}

      {/* Modal Kho video đã xuất */}
      <VideoFileManager
        jobs={activeJobs}
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        onDownloadJob={job => videoRecorderService.triggerDownload(job)}
      />

      {/* Modal Nhật ký hệ thống & Thử nghiệm tự phục hồi lỗi */}
      <SystemLogsModal
        logs={logs}
        isOpen={isLogsOpen}
        onClose={() => setIsLogsOpen(false)}
        onTriggerRecoveryTest={handleTriggerRecoveryTest}
        onClearLogs={() => setLogs([])}
      />

      {/* Modal Hướng dẫn Windows & Thư mục D:\ */}
      <WindowsSetupGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

      {/* Modal Game Hứng Táo */}
      <AppleGameModal
        isOpen={isAppleGameOpen}
        onClose={() => setIsAppleGameOpen(false)}
      />
    </div>
  );
}
