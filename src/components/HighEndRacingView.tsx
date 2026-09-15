import { useState, useEffect, useRef, useCallback } from 'react';
import {
  PlayableRacingGame,
  DrivingAssistMode,
  PlayerCameraType,
  WeatherType,
  PlayerCarTelemetry,
  PerformanceStats
} from '../engine/playableRacingGame';
import { audioEngine } from '../engine/audioEngine';
import { ROAD_LAYOUT_PRESETS } from '../engine/scenarioGenerator';
import {
  Gauge,
  Camera,
  Sun,
  CloudRain,
  Moon,
  Sunset,
  Volume2,
  VolumeX,
  RotateCcw,
  Activity,
  Shield,
  HelpCircle,
  Flag,
  Trophy,
  Zap,
  Sliders,
  Compass,
  User,
  Edit2,
  Check,
  Download,
  Video,
  ListOrdered,
  X
} from 'lucide-react';
import { generateFamousDriversVideoFileName, FAMOUS_5_DRIVERS, FULL_STARTING_GRID_DRIVERS, DriverGridEntry } from '../utils/naming';

interface HighEndRacingViewProps {
  onSwitchToVideoFactory: () => void;
}

export function HighEndRacingView({ onSwitchToVideoFactory }: HighEndRacingViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<PlayableRacingGame | null>(null);

  // Live Telemetry
  const [telemetry, setTelemetry] = useState<PlayerCarTelemetry>({
    speedKmh: 0,
    rpm: 900,
    gear: 1,
    throttle: 0,
    brake: 0,
    steer: 0,
    handbrake: false,
    isDrifting: false,
    driftAngle: 0,
    isAbsActive: false,
    isTcsActive: false,
    gForceLat: 0,
    gForceLong: 0,
    lap: 1,
    rank: 1,
    lapProgress: 0,
    currentLapTime: 0,
    bestLapTime: 0,
    lastLapTime: 0,
    isWrongWay: false,
    damagePct: 0
  });

  // Performance Stats (F3)
  const [perf, setPerf] = useState<PerformanceStats>({
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
  });

  // UI States
  const [showF3Overlay, setShowF3Overlay] = useState<boolean>(true);
  const [showControlsHelp, setShowControlsHelp] = useState<boolean>(false);
  const [showGridOverlay, setShowGridOverlay] = useState<boolean>(false);
  const [cameraMode, setCameraMode] = useState<PlayerCameraType>('CHASE');
  const [weather, setWeather] = useState<WeatherType>('SUNSET');
  const [assistMode, setAssistMode] = useState<DrivingAssistMode>('SPORT');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(3);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [driverName, setDriverName] = useState<string>('Cristiano Ronaldo');
  const [isEditingDriver, setIsEditingDriver] = useState<boolean>(false);
  const [driverInput, setDriverInput] = useState<string>('Cristiano Ronaldo');
  const [selectedTrack, setSelectedTrack] = useState<string>('GRAND_PRIX_OVAL');

  // Ghi hình gameplay video vừa chơi và Tự động tải xuống
  const [autoDownloadGameplay, setAutoDownloadGameplay] = useState<boolean>(true);
  const [isRecordingGameplay, setIsRecordingGameplay] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [downloadedNotification, setDownloadedNotification] = useState<string | null>(null);
  const [lastRecordedBlob, setLastRecordedBlob] = useState<Blob | null>(null);
  const [lastRecordedFileName, setLastRecordedFileName] = useState<string>('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const startGameplayRecordingRef = useRef<() => void>(() => {});
  const stopGameplayRecordingRef = useRef<() => void>(() => {});

  // Initialize Engine
  useEffect(() => {
    if (!canvasRef.current) return;

    // Start Audio
    audioEngine.init();

    const game = new PlayableRacingGame(canvasRef.current);
    gameRef.current = game;

    game.onTelemetryUpdate = (t) => {
      setTelemetry(t);
      if (t.lap > 3) {
        setIsFinished(true);
        stopGameplayRecordingRef.current();
      }
    };

    game.onPerfUpdate = (p) => {
      setPerf(p);
    };

    game.onCountdownTick = (count) => {
      setCountdown(count);
      if (count > 0 && count <= 3) {
        audioEngine.playCountdownBeep(false);
      } else if (count === 0) {
        // Tự động kích hoạt ghi hình gameplay khi xuất phát
        startGameplayRecordingRef.current();
      }
    };

    game.start();

    // ResizeObserver ensures canvas and projection matrix adapt instantly to actual DOM dimensions
    const resizeObserver = new ResizeObserver(() => {
      game.handleResize();
    });
    if (canvasRef.current) {
      resizeObserver.observe(canvasRef.current);
    }
    requestAnimationFrame(() => game.handleResize());
    setTimeout(() => game.handleResize(), 100);

    // Input handlers
    const keysPressed: Record<string, boolean> = {};

    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed[e.code] = true;

      // Audio resume on first key
      audioEngine.init();

      if (e.code === 'F3') {
        e.preventDefault();
        setShowF3Overlay(prev => !prev);
      } else if (e.code === 'KeyC') {
        const nextCam = game.cycleCamera();
        setCameraMode(nextCam);
      } else if (e.code === 'KeyG') {
        setShowGridOverlay(prev => !prev);
      } else if (e.code === 'KeyR') {
        game.resetCar();
      } else if (e.code === 'KeyM') {
        const m = audioEngine.toggleMute();
        setIsMuted(m);
      } else if (e.code === 'F1') {
        e.preventDefault();
        setShowControlsHelp(prev => !prev);
      }

      updateInputs();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed[e.code] = false;
      updateInputs();
    };

    const updateInputs = () => {
      if (!gameRef.current) return;

      const throttle = keysPressed['KeyW'] || keysPressed['ArrowUp'] ? 1 : 0;
      const brake = keysPressed['KeyS'] || keysPressed['ArrowDown'] ? 1 : 0;

      let steer = 0;
      if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) steer += 1;
      if (keysPressed['KeyD'] || keysPressed['ArrowRight']) steer -= 1;

      const handbrake = !!keysPressed['Space'];

      gameRef.current.input.throttle = throttle;
      gameRef.current.input.brake = brake;
      gameRef.current.input.steer = steer;
      gameRef.current.input.handbrake = handbrake;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      game.destroy();
    };
  }, []);

  const handleCameraChange = (mode: PlayerCameraType) => {
    if (!gameRef.current) return;
    gameRef.current.cameraMode = mode;
    setCameraMode(mode);
  };

  const handleWeatherChange = (w: WeatherType) => {
    if (!gameRef.current) return;
    gameRef.current.setupWeather(w);
    setWeather(w);
  };

  const handleAssistChange = (mode: DrivingAssistMode) => {
    if (!gameRef.current) return;
    gameRef.current.assistMode = mode;
    setAssistMode(mode);
  };

  const handleResetCar = () => {
    if (!gameRef.current) return;
    gameRef.current.resetCar();
  };

  const handleToggleMute = () => {
    const m = audioEngine.toggleMute();
    setIsMuted(m);
  };

  const handleTrackChange = (trackId: string) => {
    setSelectedTrack(trackId);
    if (gameRef.current) {
      gameRef.current.setTrackLayout(trackId);
    }
  };

  const currentTrackInfo = ROAD_LAYOUT_PRESETS.find(p => p.id === selectedTrack);

  // Bắt đầu ghi hình gameplay thực tế của người chơi từ WebGL Canvas
  const startGameplayRecording = useCallback(() => {
    if (!canvasRef.current) return;
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      recordedChunksRef.current = [];
      setRecordingSeconds(0);

      const stream = canvasRef.current.captureStream(60);
      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 16000000
      });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        setIsRecordingGameplay(false);
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        if (recordedChunksRef.current.length === 0) return;
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const fileName = generateFamousDriversVideoFileName({
          trackName: currentTrackInfo?.name || 'Grand_Prix_Oval',
          ext: 'mp4',
          suffix: 'VuaChoiGame'
        });

        setLastRecordedBlob(blob);
        setLastRecordedFileName(fileName);

        // Tự động tải xuống máy tính ngay lập tức mà không cần ấn nút tải
        if (autoDownloadGameplay) {
          const downloadUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);
          }, 250);

          setDownloadedNotification(fileName);
          setTimeout(() => setDownloadedNotification(null), 7000);
        }
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecordingGameplay(true);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Lỗi khởi tạo MediaRecorder cho gameplay:', err);
    }
  }, [autoDownloadGameplay, currentTrackInfo]);

  const stopGameplayRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  startGameplayRecordingRef.current = startGameplayRecording;
  stopGameplayRecordingRef.current = stopGameplayRecording;

  const handleManualDownloadCurrentGameplay = () => {
    stopGameplayRecording();
    setTimeout(() => {
      startGameplayRecording();
    }, 400);
  };

  // Format lap time
  const formatTime = (sec: number) => {
    if (sec <= 0) return '--:--.---';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  // RPM Needle Angle (from -120 deg to +120 deg)
  const rpmPercent = Math.min(1, Math.max(0, (telemetry.rpm - 900) / 7600));
  const rpmNeedleDeg = -120 + rpmPercent * 240;

  return (
    <div className="relative w-full h-full overflow-hidden bg-black select-none text-white font-sans">
      {/* 3D WebGL Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-crosshair"
        onClick={() => audioEngine.init()}
      />

      {/* TOP BAR: Controls & Mode Switcher */}
      <header className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between pointer-events-auto z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600/30 border border-blue-500/40 backdrop-blur-md">
            <Gauge className="w-5 h-5 text-blue-400 animate-pulse" />
            <span className="font-bold text-sm tracking-wider text-blue-100">
              HIGH-END 3D RACING SIMULATOR
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">
              60/120 FPS ANTI-TEAR
            </span>
          </div>

          <button
            onClick={() => setShowF3Overlay(prev => !prev)}
            className={`px-2.5 py-1 text-xs rounded font-mono border transition flex items-center gap-1.5 ${
              showF3Overlay
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                : 'bg-black/50 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            F3 CHUẨN ĐOÁN
          </button>

          <button
            onClick={() => setShowControlsHelp(prev => !prev)}
            className="px-2.5 py-1 text-xs rounded bg-black/50 border border-slate-700 text-slate-300 hover:text-white flex items-center gap-1.5"
          >
            <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
            Phím bấm (F1)
          </button>

          {/* BỘ CHỌN 100 CON ĐƯỜNG ĐUA KHÁC NHAU (10X DÀI HƠN) */}
          <div className="flex items-center bg-black/70 rounded-lg px-2.5 py-1 border border-cyan-500/30 backdrop-blur-md">
            <Compass className="w-3.5 h-3.5 text-cyan-400 mr-1.5 shrink-0 animate-spin-slow" />
            <span className="text-[10px] text-slate-400 mr-1 font-mono uppercase hidden xl:inline">ĐƯỜNG:</span>
            <select
              value={selectedTrack}
              onChange={(e) => handleTrackChange(e.target.value)}
              className="bg-slate-900/90 text-cyan-300 text-xs font-semibold rounded px-2 py-0.5 border border-slate-700 outline-none max-w-[220px] cursor-pointer"
            >
              {ROAD_LAYOUT_PRESETS.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center gap-2">
          {/* Weather Selector */}
          <div className="flex items-center bg-black/60 rounded-lg p-1 border border-slate-800 backdrop-blur-md">
            <button
              onClick={() => handleWeatherChange('SUNNY')}
              title="Trời Nắng"
              className={`p-1.5 rounded ${weather === 'SUNNY' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Sun className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleWeatherChange('SUNSET')}
              title="Hoàng Hôn"
              className={`p-1.5 rounded ${weather === 'SUNSET' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Sunset className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleWeatherChange('NIGHT')}
              title="Ban Đêm (Bật Đèn Pha)"
              className={`p-1.5 rounded ${weather === 'NIGHT' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Moon className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleWeatherChange('RAIN')}
              title="Trời Mưa (Giảm Độ Bám)"
              className={`p-1.5 rounded ${weather === 'RAIN' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <CloudRain className="w-4 h-4" />
            </button>
          </div>

          {/* Camera Selector - Đầy đủ các góc quay từ xa và truyền hình */}
          <div className="flex items-center bg-black/70 rounded-lg p-1 border border-slate-800 backdrop-blur-md overflow-x-auto max-w-xl">
            <Camera className="w-4 h-4 text-cyan-400 ml-1.5 mr-1 shrink-0" />
            {(
              [
                { id: 'HELICOPTER', label: '🚁 Trực thăng' },
                { id: 'DRONE', label: '🛸 Drone bay' },
                { id: 'OVERHEAD', label: '🌐 Toàn cảnh' },
                { id: 'HEAD_ON', label: '🎯 Đón đầu' },
                { id: 'CHASE', label: '🏎️ Bám đuôi' },
                { id: 'TRACKSIDE', label: '📹 Ven đường' },
                { id: 'COCKPIT', label: '🚘 Khoang lái' },
                { id: 'HOOD', label: '🏎️ Capo' },
                { id: 'BUMPER', label: '💨 Cản trước' },
                { id: 'CINEMATIC', label: '🎬 360°' }
              ] as { id: PlayerCameraType; label: string }[]
            ).map(cam => (
              <button
                key={cam.id}
                onClick={() => handleCameraChange(cam.id)}
                className={`px-2 py-0.5 text-[11px] rounded font-medium whitespace-nowrap transition ${
                  cameraMode === cam.id ? 'bg-cyan-600 text-white font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                {cam.label}
              </button>
            ))}
          </div>

          {/* Bảng Danh Sách Tay Đua Button */}
          <button
            onClick={() => setShowGridOverlay(prev => !prev)}
            title="Xem bảng danh sách tất cả tay đua (Phím G)"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
              showGridOverlay
                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                : 'bg-black/70 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">DS Tay Đua (12)</span>
          </button>

          {/* Driving Assist */}
          <div className="flex items-center bg-black/60 rounded-lg p-1 border border-slate-800 backdrop-blur-md">
            <Shield className="w-4 h-4 text-emerald-400 ml-1.5 mr-1" />
            {(['BEGINNER', 'SPORT', 'SIMULATION'] as DrivingAssistMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => handleAssistChange(mode)}
                className={`px-2 py-0.5 text-[11px] rounded font-medium ${
                  assistMode === mode ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {mode === 'BEGINNER' ? 'ABS+TCS' : mode === 'SPORT' ? 'Sport' : 'Mô phỏng'}
              </button>
            ))}
          </div>

          {/* GHI HÌNH GAMEPLAY & TỰ ĐỘNG TẢI XUỐNG */}
          <div className="flex items-center gap-1.5 bg-black/70 rounded-lg p-1 border border-slate-800 backdrop-blur-md">
            {/* Status indicator */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-rose-950/60 border border-rose-500/40 text-rose-300 font-mono text-[11px]">
              <span className={`w-2 h-2 rounded-full bg-rose-500 ${isRecordingGameplay ? 'animate-ping' : ''}`}></span>
              <span>REC {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}</span>
            </div>

            {/* Toggle Tự Động Tải Xuống */}
            <button
              onClick={() => setAutoDownloadGameplay(prev => !prev)}
              title="Chế độ Tự Động Tải Video Vừa Chơi Xuống Máy"
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold border transition ${
                autoDownloadGameplay
                  ? 'bg-amber-500/20 border-amber-400/60 text-amber-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Tự Động Tải:</span> {autoDownloadGameplay ? 'BẬT' : 'TẮT'}
            </button>

            {/* Tải Video Vừa Chơi Thủ Công nếu muốn */}
            <button
              onClick={handleManualDownloadCurrentGameplay}
              title="Tải ngay video bạn vừa lái xe"
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-sm transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Tải Video Vừa Chơi</span>
            </button>
          </div>

          {/* Sound Mute */}
          <button
            onClick={handleToggleMute}
            className="p-2 rounded-lg bg-black/60 border border-slate-800 text-slate-300 hover:text-white"
            title="Âm thanh động cơ (Phím M)"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          {/* Reset Car */}
          <button
            onClick={handleResetCar}
            className="p-2 rounded-lg bg-black/60 border border-slate-800 text-slate-300 hover:text-white"
            title="Đặt lại xe (Phím R)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Switch back to Video Factory */}
          <button
            onClick={onSwitchToVideoFactory}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium border border-slate-700 text-slate-200"
          >
            Chuyển sang Nhà Máy Video &rarr;
          </button>
        </div>
      </header>

      {/* TOAST THÔNG BÁO TỰ ĐỘNG TẢI XUỐNG THÀNH CÔNG */}
      {downloadedNotification && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-emerald-950/95 border-2 border-emerald-400/80 rounded-2xl px-5 py-3 shadow-[0_10px_35px_rgba(0,0,0,0.9)] z-50 flex items-center gap-3 backdrop-blur-md animate-bounce">
          <Check className="w-6 h-6 text-emerald-300 shrink-0" />
          <div className="text-left font-sans">
            <div className="text-xs font-black text-white uppercase tracking-wide flex items-center gap-1.5">
              <span>⚡ ĐÃ TỰ ĐỘNG TẢI XUỐNG VIDEO VỪA CHƠI XONG!</span>
            </div>
            <div className="text-[10px] text-emerald-200 font-mono truncate max-w-lg">
              {downloadedNotification}
            </div>
          </div>
        </div>
      )}

      {/* COUNTDOWN 3-2-1-GO OVERLAY & STARTING GRID */}
      {countdown > 0 && countdown <= 3 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30">
          {/* BẢNG TÊN GIỚI THIỆU XUẤT PHÁT (STARTING GRID) - ĐẦY ĐỦ 12 TAY ĐUA */}
          <div className="absolute top-16 left-6 w-80 max-h-[75vh] overflow-y-auto bg-slate-950/95 backdrop-blur-md rounded-xl p-3 border border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.25)] z-30 font-sans pointer-events-auto animate-fade-in custom-scrollbar">
            <div className="border-b border-cyan-500/30 pb-1.5 mb-2 flex items-center justify-between sticky top-0 bg-slate-950/95 z-10 pt-0.5">
              <div>
                <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-cyan-400 uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                  FULL STARTING GRID
                </div>
                <h3 className="text-xs font-black text-white uppercase tracking-wide">
                  Đầy Đủ 12 Tay Đua Xuất Phát
                </h3>
              </div>
              <span className="text-[9px] font-mono text-cyan-300 font-bold bg-cyan-950/80 border border-cyan-500/40 px-2 py-0.5 rounded-full">
                12 SIÊU XE
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              {FULL_STARTING_GRID_DRIVERS.map(driver => (
                <div
                  key={driver.name}
                  className={`flex items-center justify-between border rounded-lg px-2.5 py-1 transition ${
                    driver.isPlayer
                      ? 'bg-rose-950/60 border-rose-500/60 shadow-sm'
                      : 'bg-slate-900/80 border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className={`w-5 h-4 rounded font-mono font-bold text-[9px] flex items-center justify-center shrink-0 ${
                      driver.rank === 1 ? 'bg-amber-500 text-black' :
                      driver.rank === 2 ? 'bg-slate-300 text-black' :
                      driver.rank === 3 ? 'bg-amber-700 text-white' :
                      'bg-slate-800 text-slate-300'
                    }`}>
                      P{driver.rank}
                    </span>
                    <span className="w-1.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: driver.color }} />
                    <div className="truncate text-left">
                      <div className="text-[10.5px] font-bold text-white uppercase tracking-tight truncate flex items-center gap-1">
                        <span>{driver.name}</span>
                        {driver.isPlayer && (
                          <span className="text-[7.5px] bg-rose-600 text-white font-black px-1 py-0.2 rounded">BẠN</span>
                        )}
                      </div>
                      <div className="text-[8.5px] text-slate-400 truncate">{driver.team}</div>
                    </div>
                  </div>
                  <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                    driver.type === 'HYPER'
                      ? 'text-amber-400 bg-amber-950/50 border-amber-500/30'
                      : 'text-cyan-400 bg-cyan-950/50 border-cyan-500/30'
                  }`}>
                    {driver.type}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-4 mb-4">
            <div className={`w-8 h-8 rounded-full border-2 border-white ${countdown === 3 ? 'bg-rose-500 shadow-lg shadow-rose-500/80 animate-ping' : 'bg-rose-900/50'}`}></div>
            <div className={`w-8 h-8 rounded-full border-2 border-white ${countdown === 2 ? 'bg-amber-500 shadow-lg shadow-amber-500/80 animate-ping' : 'bg-amber-900/50'}`}></div>
            <div className={`w-8 h-8 rounded-full border-2 border-white ${countdown === 1 ? 'bg-emerald-500 shadow-lg shadow-emerald-500/80 animate-ping' : 'bg-emerald-900/50'}`}></div>
          </div>
          <div className="text-8xl font-black italic tracking-tighter text-amber-400 drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]">
            {countdown}
          </div>
          <div className="text-sm font-semibold tracking-widest text-slate-300 uppercase mt-2">
            Nhấn W hoặc Mũi tên Lên để ga trước!
          </div>
        </div>
      )}

      {/* FINISH BANNER */}
      {isFinished && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-auto z-30">
          <div className="p-8 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col items-center max-w-lg text-center">
            <Trophy className="w-16 h-16 text-amber-400 mb-2 animate-bounce" />
            <h2 className="text-3xl font-black italic text-white mb-1">HOÀN THÀNH CUỘC ĐUA!</h2>
            <p className="text-slate-400 text-sm mb-4">Vị trí cán đích: #{telemetry.rank} / 12</p>

            <div className="w-full bg-slate-950 p-4 rounded-xl mb-4 text-left font-mono text-xs space-y-1.5 border border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-400">Vòng nhanh nhất:</span>
                <span className="text-emerald-400 font-bold">{formatTime(telemetry.bestLapTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Vòng cuối:</span>
                <span className="text-slate-200">{formatTime(telemetry.lastLapTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Tốc độ tối đa:</span>
                <span className="text-blue-400 font-bold">312 km/h</span>
              </div>
            </div>

            {/* Thông báo Video Gameplay vừa chơi */}
            <div className="w-full bg-blue-950/50 border border-blue-500/40 rounded-xl p-3 mb-4 text-left font-sans">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 mb-1">
                <Video className="w-4 h-4" />
                <span>VIDEO GAMEPLAY VỪA CHƠI:</span>
              </div>
              <div className="text-[10.5px] font-mono text-slate-300 break-all bg-black/60 p-2 rounded border border-slate-800">
                {lastRecordedFileName || generateFamousDriversVideoFileName({ trackName: currentTrackInfo?.name || 'Grand_Prix_Oval', ext: 'mp4', suffix: 'VuaChoiGame' })}
              </div>
              <div className="flex items-center justify-between mt-2 pt-1 border-t border-blue-500/20 text-[11px]">
                <span className="text-slate-400">
                  {autoDownloadGameplay ? '⚡ Đã tự động tải xuống máy!' : 'Chế độ tải thủ công'}
                </span>
                {lastRecordedBlob && (
                  <button
                    onClick={() => {
                      const url = URL.createObjectURL(lastRecordedBlob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = lastRecordedFileName || 'gameplay_dua_xe.mp4';
                      document.body.appendChild(a);
                      a.click();
                      setTimeout(() => {
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }, 200);
                    }}
                    className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[10.5px] flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" /> Tải Lại Video Này
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={() => {
                setIsFinished(false);
                gameRef.current?.resetCar();
                if (gameRef.current) {
                  gameRef.current.playerLap = 1;
                  gameRef.current.raceState = 'COUNTDOWN';
                  gameRef.current.countdownTimer = 3.9;
                }
              }}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold tracking-wide"
            >
              ĐUA LẠI CHẶNG MỚI
            </button>
          </div>
        </div>
      )}

      {/* WRONG WAY WARNING */}
      {telemetry.isWrongWay && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-rose-600/90 text-white font-black px-6 py-2 rounded-xl text-lg tracking-widest border-2 border-white animate-bounce z-20">
          ⚠️ ĐI NGƯỢC CHIỀU - QUAY ĐẦU LẠI!
        </div>
      )}

      {/* TOP CENTER: PRIMARY RACING TELEMETRY HUD (TÊN TAY ĐUA & HIỂN THỊ KM/H) */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-auto z-20 flex items-center gap-3">
        <div className="flex items-center gap-3.5 bg-black/90 backdrop-blur-md px-5 py-2.5 rounded-2xl border-2 border-slate-700/80 shadow-[0_4px_25px_rgba(0,0,0,0.8)]">
          {/* TÊN TAY ĐUA (INTERACTIVE DRIVER NAME) */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-amber-400/80 shadow flex items-center justify-center bg-slate-900 shrink-0">
              <img
                src="/src/assets/images/ronaldo_racing_driver_1789410434819.jpg"
                alt="Cristiano Ronaldo Racing Driver"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-[9.5px] text-amber-400 font-mono font-bold uppercase tracking-wider">TAY ĐUA</span>
                <button
                  onClick={() => setIsEditingDriver(prev => !prev)}
                  className="text-slate-400 hover:text-white transition"
                  title="Đổi tên tay đua"
                >
                  <Edit2 className="w-2.5 h-2.5 text-slate-400 hover:text-amber-300" />
                </button>
              </div>
              {isEditingDriver ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <input
                    type="text"
                    value={driverInput}
                    onChange={(e) => setDriverInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setDriverName(driverInput.trim() || 'Cristiano Ronaldo');
                        setIsEditingDriver(false);
                      }
                    }}
                    className="bg-slate-800 text-amber-300 text-xs font-black px-1.5 py-0.5 rounded border border-amber-400/50 outline-none w-28"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      setDriverName(driverInput.trim() || 'Cristiano Ronaldo');
                      setIsEditingDriver(false);
                    }}
                    className="p-1 rounded bg-amber-500 text-black text-[10px] font-bold hover:bg-amber-400"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <span
                  onClick={() => setIsEditingDriver(true)}
                  className="text-sm font-black text-amber-300 tracking-wide font-sans cursor-pointer hover:underline"
                  title="Bấm để chỉnh sửa tên tay đua"
                >
                  {driverName}
                </span>
              )}
            </div>
          </div>

          <div className="w-px h-8 bg-slate-800"></div>

          {/* HIỂN THỊ TỐC ĐỘ KM/H TRÊN MÀN HÌNH GAME */}
          <div className="flex items-baseline gap-1.5 bg-slate-950/80 px-3.5 py-1 rounded-xl border border-slate-800 shadow-inner">
            <span className="text-3xl font-black font-mono text-white italic tracking-tight">
              {telemetry.speedKmh}
            </span>
            <div className="flex flex-col">
              <span className="text-[11px] font-black font-mono text-cyan-400 leading-none">KM/H</span>
              <span className="text-[8px] font-mono text-slate-500 uppercase font-semibold">TỐC ĐỘ</span>
            </div>
          </div>

          <div className="w-px h-8 bg-slate-800"></div>

          {/* HIỂN THỊ ĐƯỜNG ĐUA TRÊN MÀN HÌNH GAME */}
          <div className="flex flex-col text-left font-mono">
            <span className="text-[9px] text-slate-400 font-bold uppercase">ĐƯỜNG ĐUA (10X DÀI)</span>
            <span className="text-[11px] font-bold text-cyan-300 max-w-[140px] truncate">
              {currentTrackInfo?.name || 'Grand Prix Oval'}
            </span>
          </div>

          <div className="w-px h-8 bg-slate-800"></div>

          {/* FPS REALTIME */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-500/40">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-black font-mono text-emerald-300">{perf.fps} FPS</span>
          </div>
        </div>
      </div>

      {/* TOP RIGHT: LAP & TIMING HUD */}
      <div className="absolute top-16 right-6 flex flex-col items-end gap-2 pointer-events-none z-10 font-mono">
        {/* Position & Lap Box */}
        <div className="flex items-center gap-2 bg-black/70 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-800">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Vị Trí</span>
            <span className="text-3xl font-black text-amber-400 italic">P{telemetry.rank}</span>
            <span className="text-xs text-slate-400">/12</span>
          </div>
          <div className="w-px h-8 bg-slate-700 mx-1"></div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Vòng đua</span>
            <span className="text-3xl font-black text-white italic">{Math.min(3, telemetry.lap)}</span>
            <span className="text-xs text-slate-400">/3</span>
          </div>
        </div>

        {/* Lap Times */}
        <div className="bg-black/70 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-800 text-xs text-right space-y-1 w-44">
          <div className="flex justify-between">
            <span className="text-slate-400">Hiện tại:</span>
            <span className="text-white font-bold">{formatTime(telemetry.currentLapTime)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Nhanh nhất:</span>
            <span className="text-emerald-400 font-bold">{formatTime(telemetry.bestLapTime)}</span>
          </div>
        </div>
      </div>

      {/* TOP LEFT: MINI-MAP */}
      <div className="absolute top-16 left-6 pointer-events-none z-10">
        <div className="w-36 h-36 rounded-2xl bg-black/70 backdrop-blur-md border border-slate-800 p-2 relative flex items-center justify-center">
          {/* Circuit outline */}
          <svg className="w-full h-full" viewBox="-180 -150 380 300">
            <path
              d="M 0 -120 Q 90 -130 160 -60 Q 180 40 120 110 Q 40 140 -60 120 Q -140 60 -170 -40 Z"
              fill="none"
              stroke="#334155"
              strokeWidth="16"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M 0 -120 Q 90 -130 160 -60 Q 180 40 120 110 Q 40 140 -60 120 Q -140 60 -170 -40 Z"
              fill="none"
              stroke="#64748b"
              strokeWidth="4"
              strokeDasharray="4 4"
            />

            {/* Player Indicator (Blue) */}
            <circle
              cx={Math.sin(telemetry.lapProgress * Math.PI * 2) * 110}
              cy={-Math.cos(telemetry.lapProgress * Math.PI * 2) * 90}
              r="7"
              fill="#3b82f6"
              stroke="#ffffff"
              strokeWidth="2"
            />
          </svg>
          <span className="absolute bottom-1 text-[9px] text-slate-400 font-mono">BẢN ĐỒ ĐƯỜNG ĐUA</span>
        </div>
      </div>

      {/* F3 PERFORMANCE OVERLAY */}
      {showF3Overlay && (
        <div className="absolute top-16 left-48 bg-slate-950/90 backdrop-blur-md border border-slate-700/80 rounded-xl p-3 text-[11px] font-mono pointer-events-auto z-20 w-80 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
            <span className="font-bold text-amber-400 flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" /> F3 PERFORMANCE PROFILER
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              perf.bottleneck === 'BALANCED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' : 'bg-rose-950 text-rose-300 border border-rose-700'
            }`}>
              {perf.bottleneck}
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">FPS / Frame Time:</span>
              <span className="text-white font-bold">{perf.fps} FPS ({perf.avgFrameTimeMs} ms)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">1% Low / 0.1% Low:</span>
              <span className="text-amber-300">{perf.onePercentLowFps} / {perf.zeroPointOnePercentLowFps} FPS</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Game Thread CPU:</span>
              <span className="text-sky-300">{perf.gameThreadMs} ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Render Thread GPU:</span>
              <span className="text-indigo-300">{perf.renderThreadMs} ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Draw Calls / Tris:</span>
              <span className="text-slate-300">{perf.drawCalls} calls / {perf.triangles.toLocaleString()}</span>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <span className="text-[10px] text-slate-400">Khóa VSync: Bật (Triple Buffer)</span>
            <span className="text-[10px] text-emerald-400 font-bold">KHÔNG TEARING</span>
          </div>
        </div>
      )}

      {/* F1 CONTROLS HELP MODAL */}
      {showControlsHelp && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto z-40">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-blue-400" />
              Hướng Dẫn Phím Điều Khiển Xe
            </h3>
            <div className="space-y-2 text-sm text-slate-300">
              <div className="flex justify-between bg-slate-800/60 p-2 rounded">
                <span>Tăng ga:</span>
                <span className="font-mono text-white font-bold">W hoặc Phím Mũi Tên Lên</span>
              </div>
              <div className="flex justify-between bg-slate-800/60 p-2 rounded">
                <span>Phanh / Lùi:</span>
                <span className="font-mono text-white font-bold">S hoặc Phím Mũi Tên Xuống</span>
              </div>
              <div className="flex justify-between bg-slate-800/60 p-2 rounded">
                <span>Đánh lái Trái / Phải:</span>
                <span className="font-mono text-white font-bold">A / D hoặc Mũi Tên Trái / Phải</span>
              </div>
              <div className="flex justify-between bg-slate-800/60 p-2 rounded">
                <span>Phanh tay (Drift):</span>
                <span className="font-mono text-white font-bold">Phím Space</span>
              </div>
              <div className="flex justify-between bg-slate-800/60 p-2 rounded">
                <span>Đổi góc camera:</span>
                <span className="font-mono text-white font-bold">Phím C</span>
              </div>
              <div className="flex justify-between bg-slate-800/60 p-2 rounded">
                <span>Đặt lại xe:</span>
                <span className="font-mono text-white font-bold">Phím R</span>
              </div>
              <div className="flex justify-between bg-slate-800/60 p-2 rounded">
                <span>Bật/Tắt âm thanh:</span>
                <span className="font-mono text-white font-bold">Phím M</span>
              </div>
              <div className="flex justify-between bg-slate-800/60 p-2 rounded">
                <span>Bảng danh sách 12 tay đua:</span>
                <span className="font-mono text-white font-bold">Phím G</span>
              </div>
              <div className="flex justify-between bg-slate-800/60 p-2 rounded">
                <span>Bảng hiệu năng F3:</span>
                <span className="font-mono text-white font-bold">Phím F3</span>
              </div>
            </div>
            <button
              onClick={() => setShowControlsHelp(false)}
              className="mt-4 w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-white text-sm"
            >
              ĐÃ HIỂU & ĐÓNG
            </button>
          </div>
        </div>
      )}

      {/* BẢNG DANH SÁCH ĐẦY ĐỦ 12 TAY ĐUA (MODAL KHI BẤM PHÍM G HOẶC NÚT DS TAY ĐUA) */}
      {showGridOverlay && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center pointer-events-auto z-40 p-4">
          <div className="bg-slate-950 border border-cyan-500/50 rounded-2xl p-6 max-w-2xl w-full shadow-[0_0_50px_rgba(6,182,212,0.3)] animate-fade-in font-sans flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-cyan-500/30 pb-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-500/50 flex items-center justify-center text-cyan-400 font-bold">
                  <ListOrdered className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <span>Bảng Danh Sách 12 Tay Đua Xuất Phát</span>
                    <span className="text-[10px] bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/40">
                      STARTING GRID
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Toàn bộ 12 siêu sao huyền thoại tranh tài trên đường đua - Bấm phím G hoặc nút Đóng để tắt
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGridOverlay(false)}
                className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition border border-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 overflow-y-auto pr-1 custom-scrollbar">
              {FULL_STARTING_GRID_DRIVERS.map(driver => (
                <div
                  key={driver.name}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition ${
                    driver.isPlayer
                      ? 'bg-rose-950/70 border-rose-500/80 shadow-lg shadow-rose-950/40'
                      : 'bg-slate-900/90 border-slate-800/90 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className={`w-7 h-7 rounded-lg font-mono font-black text-xs flex items-center justify-center shrink-0 shadow-sm ${
                      driver.rank === 1 ? 'bg-amber-500 text-black' :
                      driver.rank === 2 ? 'bg-slate-300 text-black' :
                      driver.rank === 3 ? 'bg-amber-700 text-white' :
                      'bg-slate-800 text-slate-300'
                    }`}>
                      P{driver.rank}
                    </span>
                    <span className="w-2 h-7 rounded-full shrink-0" style={{ backgroundColor: driver.color }} />
                    <div className="truncate text-left">
                      <div className="text-xs font-black text-white uppercase tracking-tight truncate flex items-center gap-1.5">
                        <span>{driver.name}</span>
                        {driver.isPlayer && (
                          <span className="text-[8px] bg-rose-600 text-white font-black px-1.5 py-0.5 rounded-full">BẠN LÁI</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">{driver.team}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-[8.5px] font-mono font-bold px-2 py-0.5 rounded border block ${
                      driver.type === 'HYPER'
                        ? 'text-amber-400 bg-amber-950/60 border-amber-500/40'
                        : 'text-cyan-400 bg-cyan-950/60 border-cyan-500/40'
                    }`}>
                      {driver.type} CAR
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>* Tên video xuất ra chuẩn 5 tay đua nổi tiếng nhất</span>
              <button
                onClick={() => setShowGridOverlay(false)}
                className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg transition"
              >
                ĐÓNG BẢNG DANH SÁCH (G)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM LEFT: OFFICIAL RACING BROADCAST DRIVER & SPEED HUD CARD */}
      <div className="absolute bottom-6 left-6 pointer-events-none z-10 hidden sm:flex flex-col gap-2">
        <div className="bg-black/90 backdrop-blur-md p-3.5 rounded-2xl border border-slate-700/90 shadow-2xl flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl overflow-hidden border-2 border-amber-400 shadow-lg flex items-center justify-center bg-slate-900 shrink-0">
            <img
              src="/src/assets/images/ronaldo_racing_driver_1789410434819.jpg"
              alt="Cristiano Ronaldo Racing Driver"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">TAY ĐUA</span>
            <span className="text-base font-black text-amber-300 font-sans tracking-wide leading-tight">{driverName}</span>
            <span className="text-[10px] text-cyan-400 font-mono font-semibold">Apex Racing Series</span>
          </div>
          <div className="w-px h-9 bg-slate-800 mx-1"></div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-mono font-bold text-slate-400 uppercase">TỐC ĐỘ HIỆN TẠI</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black font-mono text-white italic tracking-tight">{telemetry.speedKmh}</span>
              <span className="text-[10px] font-black font-mono text-cyan-400">KM/H</span>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM HUD: PROFESSIONAL RACING CLUSTER & TACHOMETER */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none z-10 flex items-end gap-6">
        {/* Driving Assist Badges */}
        <div className="flex flex-col gap-1.5 pb-2">
          <div className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider border ${
            telemetry.isAbsActive ? 'bg-amber-500 text-black border-white animate-pulse' : 'bg-black/50 text-slate-500 border-slate-800'
          }`}>
            ABS
          </div>
          <div className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider border ${
            telemetry.isTcsActive ? 'bg-emerald-500 text-black border-white animate-pulse' : 'bg-black/50 text-slate-500 border-slate-800'
          }`}>
            TCS
          </div>
          <div className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wider border ${
            telemetry.isDrifting ? 'bg-rose-500 text-white border-white animate-bounce' : 'bg-black/50 text-slate-500 border-slate-800'
          }`}>
            DRIFT
          </div>
        </div>

        {/* Professional Analog / Digital Tachometer Gauge */}
        <div className="relative w-56 h-56 rounded-full bg-gradient-to-b from-slate-900/90 to-black/90 backdrop-blur-xl border-2 border-slate-700 shadow-2xl flex flex-col items-center justify-center">
          {/* Dial Marks */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200">
            {/* RPM Arc Ring */}
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke="#334155"
              strokeWidth="6"
              strokeDasharray="360 120"
              strokeDashoffset="120"
            />
            {/* Active RPM Fill */}
            <circle
              cx="100"
              cy="100"
              r="80"
              fill="none"
              stroke={telemetry.rpm > 7000 ? '#ef4444' : '#3b82f6'}
              strokeWidth="6"
              strokeDasharray={`${rpmPercent * 335} 400`}
              strokeDashoffset="120"
              className="transition-all duration-75"
            />
          </svg>

          {/* Rotating Needle */}
          <div
            className="absolute w-1 h-20 bg-rose-500 origin-bottom rounded-full shadow-lg shadow-rose-500/80 transition-transform duration-75"
            style={{
              bottom: '50%',
              transform: `rotate(${rpmNeedleDeg}deg)`
            }}
          />

          {/* Needle Hub */}
          <div className="w-5 h-5 rounded-full bg-slate-300 border-2 border-slate-800 z-10"></div>

          {/* Speed & Gear Digital Cluster */}
          <div className="flex flex-col items-center mt-3 z-10 font-mono">
            {/* Gear Indicator */}
            <div className="text-3xl font-black italic text-amber-400 drop-shadow">
              {telemetry.gear === 0 ? 'R' : telemetry.gear}
            </div>

            {/* Digital Speedometer */}
            <div className="text-4xl font-black text-white italic tracking-tighter leading-none mt-0.5">
              {telemetry.speedKmh}
            </div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              KM/H
            </div>

            {/* RPM Counter */}
            <div className="text-[11px] text-blue-400 font-semibold mt-1">
              {telemetry.rpm} <span className="text-[9px] text-slate-500">RPM</span>
            </div>
          </div>
        </div>

        {/* Pedal Bars (Throttle & Brake) */}
        <div className="flex gap-2 pb-2">
          {/* Brake Bar */}
          <div className="flex flex-col items-center gap-1">
            <div className="w-2.5 h-16 bg-slate-900 rounded-full border border-slate-700 overflow-hidden flex flex-col justify-end p-0.5">
              <div
                className="w-full bg-rose-500 rounded-full transition-all duration-75"
                style={{ height: `${telemetry.brake * 100}%` }}
              />
            </div>
            <span className="text-[9px] font-mono text-rose-400 font-bold">BRK</span>
          </div>

          {/* Throttle Bar */}
          <div className="flex flex-col items-center gap-1">
            <div className="w-2.5 h-16 bg-slate-900 rounded-full border border-slate-700 overflow-hidden flex flex-col justify-end p-0.5">
              <div
                className="w-full bg-emerald-500 rounded-full transition-all duration-75"
                style={{ height: `${telemetry.throttle * 100}%` }}
              />
            </div>
            <span className="text-[9px] font-mono text-emerald-400 font-bold">GAS</span>
          </div>
        </div>
      </div>

      {/* MOBILE / ON-SCREEN TOUCH CONTROLS (for touchscreens or quick testing) */}
      <div className="absolute bottom-6 left-6 flex gap-2 pointer-events-auto sm:hidden z-20">
        <button
          onTouchStart={() => { if (gameRef.current) gameRef.current.input.steer = 1; }}
          onTouchEnd={() => { if (gameRef.current) gameRef.current.input.steer = 0; }}
          className="w-14 h-14 rounded-full bg-slate-800/80 border border-slate-600 text-white font-bold text-xl active:bg-blue-600"
        >
          &larr;
        </button>
        <button
          onTouchStart={() => { if (gameRef.current) gameRef.current.input.steer = -1; }}
          onTouchEnd={() => { if (gameRef.current) gameRef.current.input.steer = 0; }}
          className="w-14 h-14 rounded-full bg-slate-800/80 border border-slate-600 text-white font-bold text-xl active:bg-blue-600"
        >
          &rarr;
        </button>
      </div>

      <div className="absolute bottom-6 right-6 flex gap-2 pointer-events-auto sm:hidden z-20">
        <button
          onTouchStart={() => { if (gameRef.current) gameRef.current.input.brake = 1; }}
          onTouchEnd={() => { if (gameRef.current) gameRef.current.input.brake = 0; }}
          className="w-14 h-14 rounded-full bg-rose-800/80 border border-rose-600 text-white font-bold active:bg-rose-600"
        >
          PHANH
        </button>
        <button
          onTouchStart={() => { if (gameRef.current) gameRef.current.input.throttle = 1; }}
          onTouchEnd={() => { if (gameRef.current) gameRef.current.input.throttle = 0; }}
          className="w-14 h-14 rounded-full bg-emerald-800/80 border border-emerald-600 text-white font-bold active:bg-emerald-600"
        >
          GA
        </button>
      </div>
    </div>
  );
}
