import * as THREE from 'three';
import { RacingInstance } from '../engine/racingInstance';
import { MultiInstanceEngine } from '../engine/multiInstanceEngine';
import { SystemConfig, VideoRecordJob } from '../types';
import { WebCodecsVideoEncoderSession } from './webCodecsRecorder';
import { generateFamousDriversVideoFileName } from '../utils/naming';
import fixWebmDuration from 'fix-webm-duration';

export interface ExportProgressEvent {
  currentThread: number;
  totalThreads: number;
  currentFrame: number;
  totalFrames: number;
  percent: number;
  statusText: string;
}

interface ActiveInstanceRecorder {
  instanceId: number;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  stream: MediaStream;
  mediaRecorder: MediaRecorder | null;
  chunks: Blob[];
  mimeType: string;
  lastRecordTime: number;
  frameCount: number;
  startTime: number;
  isRecording: boolean;
}

interface ExportQueueItem {
  job: VideoRecordJob;
  instance: RacingInstance;
  config: SystemConfig;
  customDurationSeconds?: number;
  resolve: (job: VideoRecordJob) => void;
  reject: (err: any) => void;
}

export class VideoRecorderService {
  private activeRecorders: Map<number, ActiveInstanceRecorder> = new Map();
  private videoJobs: VideoRecordJob[] = [];
  private onJobCreatedCallback?: (job: VideoRecordJob) => void;
  private onJobProgressCallback?: (job: VideoRecordJob) => void;
  public directoryHandle: any = null; // FileSystemDirectoryHandle from showDirectoryPicker
  public mainCanvas: HTMLCanvasElement | null = null;
  public engine: MultiInstanceEngine | null = null;

  // Hàng đợi xử lý tuần tự (Export Queue) để loại bỏ hoàn toàn tranh chấp GPU/VideoEncoder
  private exportQueue: ExportQueueItem[] = [];
  private isProcessingQueue: boolean = false;

  // Render 3D độc lập chuyên dụng cho kết xuất Video Dọc 1080x1920 (9:16 Full HD)
  private directCanvas: HTMLCanvasElement | null = null;
  private directRenderer: THREE.WebGLRenderer | null = null;

  // Composite 2D Canvas trung gian để hòa trộn 3D + HUD không bị phụ thuộc DOM
  private compCanvas: HTMLCanvasElement | null = null;
  private compCtx: CanvasRenderingContext2D | null = null;

  // Bộ đệm Gradient cho HUD để tránh cấp phát bộ nhớ liên tục trong mỗi frame render
  private cachedTopGrad: CanvasGradient | null = null;
  private cachedBottomGrad: CanvasGradient | null = null;
  private cachedRpmGrad: CanvasGradient | null = null;

  constructor() {}

  setOnJobCreated(callback: (job: VideoRecordJob) => void) {
    this.onJobCreatedCallback = callback;
  }

  setOnJobProgress(callback: (job: VideoRecordJob) => void) {
    this.onJobProgressCallback = callback;
  }

  setDirectoryHandle(handle: any) {
    this.directoryHandle = handle;
  }

  setMainCanvas(canvas: HTMLCanvasElement) {
    this.mainCanvas = canvas;
  }

  bindEngine(engine: MultiInstanceEngine, mainCanvas?: HTMLCanvasElement) {
    this.engine = engine;
    if (mainCanvas) {
      this.mainCanvas = mainCanvas;
    }
  }

  getVideoJobs(): VideoRecordJob[] {
    return this.videoJobs;
  }

  getProcessingJobs(): VideoRecordJob[] {
    return this.videoJobs.filter(j => j.status === 'processing');
  }

  getProcessingCount(): number {
    return this.videoJobs.filter(j => j.status === 'processing').length;
  }

  /**
   * Khởi tạo WebGL Renderer độc lập chuyên dụng ở chuẩn 1080x1920 (9:16 Full HD)
   * Kết nối trực tiếp với Scene của từng luồng để không bao giờ bị phụ thuộc vào kích thước màn hình
   */
  private getDirectRenderer(): { canvas: HTMLCanvasElement; renderer: THREE.WebGLRenderer } {
    if (!this.directCanvas || !this.directRenderer) {
      this.directCanvas = document.createElement('canvas');
      this.directCanvas.width = 1080;
      this.directCanvas.height = 1920;
      this.directRenderer = new THREE.WebGLRenderer({
        canvas: this.directCanvas,
        antialias: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
        alpha: false
      });
      this.directRenderer.setSize(1080, 1920, false);
      this.directRenderer.setPixelRatio(1);
    }
    return { canvas: this.directCanvas, renderer: this.directRenderer };
  }

  private getCompositeCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    if (!this.compCanvas || !this.compCtx) {
      this.compCanvas = document.createElement('canvas');
      this.compCanvas.width = 1080;
      this.compCanvas.height = 1920;
      this.compCtx = this.compCanvas.getContext('2d', { alpha: false }) || this.compCanvas.getContext('2d')!;
    }
    return { canvas: this.compCanvas, ctx: this.compCtx };
  }

  private getOptimalMimeType(): string {
    if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
      return 'video/webm';
    }
    const candidates = [
      'video/mp4;codecs=avc1',
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    for (const t of candidates) {
      if (MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return 'video/webm';
  }

  startRecording(canvas: HTMLCanvasElement, instanceId?: number, config?: SystemConfig) {
    if (canvas) this.mainCanvas = canvas;
  }

  startInstanceRecording(instance: RacingInstance, config?: SystemConfig): ActiveInstanceRecorder {
    const existing = this.activeRecorders.get(instance.id);
    if (existing && existing.mediaRecorder && existing.mediaRecorder.state !== 'inactive') {
      return existing;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d', { alpha: false }) || canvas.getContext('2d')!;

    ctx.fillStyle = '#05070e';
    ctx.fillRect(0, 0, 1080, 1920);

    const mimeType = this.getOptimalMimeType();
    const chunks: Blob[] = [];

    let stream: MediaStream | null = null;
    let mediaRecorder: MediaRecorder | null = null;

    try {
      const targetFps = (config && config.fps) ? config.fps : 60;
      stream = canvas.captureStream(targetFps);
      mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 8_000_000
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.start(1000);
    } catch (err) {
      console.warn(`Khởi tạo MediaRecorder cho Instance #${instance.id}:`, err);
    }

    const recorderSession: ActiveInstanceRecorder = {
      instanceId: instance.id,
      canvas,
      ctx,
      stream: stream || new MediaStream(),
      mediaRecorder,
      chunks,
      mimeType,
      lastRecordTime: performance.now(),
      frameCount: 0,
      startTime: performance.now(),
      isRecording: true
    };

    this.activeRecorders.set(instance.id, recorderSession);

    if (config) {
      this.captureInstanceFrame(instance, config);
    }

    return recorderSession;
  }

  captureInstanceFrame(instance: RacingInstance, config: SystemConfig) {
    let rec = this.activeRecorders.get(instance.id);
    if (!rec || !rec.mediaRecorder || rec.mediaRecorder.state === 'inactive') {
      rec = this.startInstanceRecording(instance, config);
    }

    const targetFps = config.fps || 60;
    const minFrameInterval = 1000 / (targetFps * 1.1);
    const now = performance.now();
    if (now - rec.lastRecordTime < minFrameInterval) return;
    rec.lastRecordTime = now;
    rec.frameCount++;

    const ctx = rec.ctx;
    let rendered3D = false;

    try {
      const { canvas: dCanvas, renderer: dRenderer } = this.getDirectRenderer();
      const cam = instance.cameraDirector.camera;
      const oldAspect = cam.aspect;
      cam.aspect = 1080 / 1920;
      cam.updateProjectionMatrix();

      dRenderer.render(instance.scene, cam);

      cam.aspect = oldAspect;
      cam.updateProjectionMatrix();

      ctx.drawImage(dCanvas, 0, 0, 1080, 1920);
      rendered3D = true;
    } catch (err) {
      console.warn('Direct 3D render fallback to main canvas:', err);
    }

    if (!rendered3D && this.mainCanvas && this.mainCanvas.width > 50 && this.mainCanvas.height > 50) {
      const vp = instance.lastViewport;
      if (vp && vp.w > 10 && vp.h > 10) {
        const H = this.mainCanvas.height;
        const sx = Math.max(0, Math.min(this.mainCanvas.width - 1, vp.x));
        const sy = Math.max(0, Math.min(H - 1, H - (vp.y + vp.h)));
        const sw = Math.max(1, Math.min(vp.w, this.mainCanvas.width - sx));
        const sh = Math.max(1, Math.min(vp.h, H - sy));

        try {
          ctx.drawImage(this.mainCanvas, sx, sy, sw, sh, 0, 0, 1080, 1920);
          rendered3D = true;
        } catch {}
      }
    }

    if (!rendered3D) {
      ctx.fillStyle = '#080c18';
      ctx.fillRect(0, 0, 1080, 1920);
    }

    this.drawBroadcastHUD(ctx, instance, config);
  }

  /**
   * Vẽ lớp phủ thông số HUD truyền hình lên video 1080x1920 (9:16)
   * Đồng hồ tiến trình cuộc đua được tính toán tuần tự từ khung hiện tại (00:00 / 02:00)
   */
  public drawBroadcastHUD(
    ctx: CanvasRenderingContext2D,
    instance: RacingInstance,
    config: SystemConfig,
    customElapsedSecs?: number,
    customTotalSecs?: number
  ) {
    const leaderCar = instance.cars.find(c => c.state.rank === 1) || instance.cars[0];
    const speed = Math.round(leaderCar?.state.speed || 430);
    const rpm = Math.round(3200 + (speed / 500) * 7800);
    const driverName = (leaderCar?.state.driverName || 'CRISTIANO RONALDO').toUpperCase();
    const carName = (leaderCar?.state.name || 'F1 HYPERCAR').toUpperCase();
    const carCount = instance.cars.length || 10;
    const biomeName = (instance.seedData?.biome?.name || 'EMERALD HIGHWAY').toUpperCase();
    const roadLayout = (instance.seedData?.biome?.roadLayoutType || 'MONZA GP').replace(/_/g, ' ').toUpperCase();
    const seed = instance.seedData?.seed || 632585;

    const pad = (n: number) => n.toString().padStart(2, '0');
    const elapsedSecs = customElapsedSecs !== undefined ? customElapsedSecs : Math.floor(instance.chunkTimeElapsed);
    const totalSecs = customTotalSecs !== undefined ? customTotalSecs : (config.durationSeconds || 120);
    const curTimeStr = `${pad(Math.floor(elapsedSecs / 60))}:${pad(Math.floor(elapsedSecs) % 60)}`;
    const totalTimeStr = `${pad(Math.floor(totalSecs / 60))}:${pad(Math.floor(totalSecs) % 60)}`;
    const distKm = ((elapsedSecs / Math.max(1, totalSecs)) * 35.0).toFixed(1);

    // OVERLAY BẢNG TÊN GIỚI THIỆU XUẤT PHÁT (Từ giây thứ 3 đến giây thứ 6)
    // Thiết kế thu nhỏ gọn gàng, trong suốt cao cấp chuẩn truyền hình, không che khuất màn hình
    if (elapsedSecs >= 3.0 && elapsedSecs <= 6.0) {
      ctx.save();
      const cardX = 45;
      const cardY = 220;
      const cardW = 540;
      const cardH = 590;

      // Nền kính tối mờ thanh lịch
      ctx.fillStyle = 'rgba(7, 11, 22, 0.88)';
      ctx.beginPath();
      if ((ctx as any).roundRect) {
        (ctx as any).roundRect(cardX, cardY, cardW, cardH, 16);
      } else {
        ctx.rect(cardX, cardY, cardW, cardH);
      }
      ctx.fill();

      // Viền neon cyan mảnh tinh tế
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Header Bảng tên
      ctx.fillStyle = '#06b6d4';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('● STARTING GRID • DANH SÁCH XUẤT PHÁT', cardX + 24, cardY + 36);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('5 TAY ĐUA HUYỀN THOẠI DẪN ĐẦU', cardX + 24, cardY + 70);

      ctx.fillStyle = '#64748b';
      ctx.font = '14px monospace';
      ctx.fillText(`LUỒNG ĐUA #${instance.id.toString().padStart(2, '0')} • SEED #${seed}`, cardX + 24, cardY + 95);

      // Đường kẻ phân cách
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cardX + 24, cardY + 110);
      ctx.lineTo(cardX + cardW - 24, cardY + 110);
      ctx.stroke();

      // Danh sách chính xác 5 tay đua nổi tiếng nhất
      const FAMOUS_ORDER = ['Lionel Messi', 'Cristiano Ronaldo', 'Neymar Jr', 'David Beckham', 'Kylian Mbappe'];
      const top5Drivers = FAMOUS_ORDER.map((name, i) => {
        const carFound = instance.cars.find(c => (c.state.driverName || '').toLowerCase().includes(name.toLowerCase().slice(0, 5)));
        return {
          pos: i + 1,
          driverName: name,
          carName: carFound ? carFound.state.name : `Supercar GT #${i + 1}`,
          colorHex: carFound && carFound.state.hexColor !== undefined 
            ? `#${carFound.state.hexColor.toString(16).padStart(6, '0')}` 
            : (i === 0 ? '#38bdf8' : i === 1 ? '#dc2626' : i === 2 ? '#eab308' : i === 3 ? '#2563eb' : '#16a34a'),
          type: carFound ? carFound.state.type : (i % 2 === 0 ? 'hypercar' : 'formula')
        };
      });

      const startY = cardY + 125;
      const rowH = 86;

      top5Drivers.forEach((driver, idx) => {
        const y = startY + idx * rowH;

        // Row background
        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.beginPath();
        if ((ctx as any).roundRect) {
          (ctx as any).roundRect(cardX + 16, y, cardW - 32, 74, 8);
        } else {
          ctx.rect(cardX + 16, y, cardW - 32, 74);
        }
        ctx.fill();

        ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Position Badge
        ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
        ctx.fillRect(cardX + 26, y + 14, 46, 46);
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
        ctx.strokeRect(cardX + 26, y + 14, 46, 46);

        ctx.fillStyle = '#06b6d4';
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`P${driver.pos}`, cardX + 49, y + 37);

        // Color Pill
        ctx.fillStyle = driver.colorHex;
        ctx.fillRect(cardX + 84, y + 14, 8, 46);

        // Driver Name
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 21px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(driver.driverName.toUpperCase(), cardX + 104, y + 16);

        // Car Subtitle
        ctx.fillStyle = '#94a3b8';
        ctx.font = '15px monospace';
        ctx.fillText(driver.carName.toUpperCase(), cardX + 104, y + 43);

        // Category Badge
        ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
        ctx.fillRect(cardX + cardW - 100, y + 22, 68, 30);
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
        ctx.strokeRect(cardX + cardW - 100, y + 22, 68, 30);

        ctx.fillStyle = '#06b6d4';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(driver.type === 'hypercar' ? 'HYPER' : 'F1', cardX + cardW - 66, y + 37);
      });

      ctx.restore();
    }

    // Dải gradient trên và dưới bảo đảm tương phản sắc nét (Sử dụng cache để không lag CPU)
    if (!this.cachedTopGrad) {
      this.cachedTopGrad = ctx.createLinearGradient(0, 0, 0, 260);
      this.cachedTopGrad.addColorStop(0, 'rgba(0, 0, 0, 0.88)');
      this.cachedTopGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.45)');
      this.cachedTopGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    }
    ctx.fillStyle = this.cachedTopGrad;
    ctx.fillRect(0, 0, 1080, 260);

    if (!this.cachedBottomGrad) {
      this.cachedBottomGrad = ctx.createLinearGradient(0, 1600, 0, 1920);
      this.cachedBottomGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      this.cachedBottomGrad.addColorStop(0.3, 'rgba(0, 0, 0, 0.65)');
      this.cachedBottomGrad.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
    }
    ctx.fillStyle = this.cachedBottomGrad;
    ctx.fillRect(0, 1600, 0, 320);

    ctx.save();

    // BANNER PHÍA TRÊN
    ctx.fillStyle = '#06b6d4';
    ctx.font = 'bold 30px monospace';
    ctx.fillText(`LUỒNG ĐUA #${instance.id.toString().padStart(2, '0')} • 1080x1920 (9:16 FULL HD 60 FPS)`, 40, 60);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`TAY ĐUA: ${driverName}`, 40, 96);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '20px monospace';
    ctx.fillText(`Xe: ${carName} • ${carCount} Xe Tranh Tài`, 40, 126);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '18px sans-serif';
    ctx.fillText(`Bản đồ: ${biomeName} • ${roadLayout}`, 40, 154);

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`THỜI LƯỢNG: ${totalTimeStr} (CHUẨN ${Math.round(totalSecs)} GIÂY) • SEED: #${seed}`, 40, 182);

    // HUD TỐC ĐỘ PHÍA DƯỚI
    const barW = 1000;
    const barH = 14;
    const barX = 40;
    const barY = 1670;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.fillRect(barX, barY, barW, barH);

    const rpmRatio = Math.min(1.0, Math.max(0.2, (rpm - 3000) / 7500));
    const fillW = barW * rpmRatio;
    if (!this.cachedRpmGrad) {
      this.cachedRpmGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      this.cachedRpmGrad.addColorStop(0, '#10b981');
      this.cachedRpmGrad.addColorStop(0.65, '#f59e0b');
      this.cachedRpmGrad.addColorStop(1, '#ef4444');
    }
    ctx.fillStyle = this.cachedRpmGrad;
    ctx.fillRect(barX, barY, fillW, barH);

    // Đồng hồ tốc độ lớn
    ctx.fillStyle = '#f59e0b';
    ctx.font = '900 84px sans-serif';
    ctx.fillText(`${speed}`, 40, 1775);

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 24px monospace';
    ctx.fillText('KM/H', 220, 1755);

    const gear = Math.min(8, Math.max(1, Math.floor((speed / 500) * 8) + 1));
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 26px monospace';
    ctx.fillText(`SỐ ${gear} • RPM ${rpm}`, 320, 1755);

    // Hạng & Vòng
    const currentLap = Math.min(3, Math.floor((elapsedSecs / Math.max(1, totalSecs)) * 3) + 1);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(`HẠNG: P1 / ${carCount} • VÒNG: ${currentLap}/3`, 40, 1820);

    // Đồng hồ đếm thời gian thực tế chuẩn xác
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '22px monospace';
    ctx.fillText(`THỜI GIAN: ${curTimeStr} / ${totalTimeStr} • ĐÃ ĐUA: ${distKm} / 35.0 KM`, 40, 1855);

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('⚡ KÍCH HOẠT NITRO BOOST +60 KM/H • VƯỢT XE AN TOÀN', 40, 1890);

    ctx.restore();
  }

  /**
   * Đưa cuộc đua hoàn thành vào Kho Video ngay lập tức với trạng thái PROCESSING (0% -> 100%)
   * và đẩy vào Export Queue để xử lý tuần tự, loại bỏ hoàn toàn tranh chấp phần cứng GPU
   */
  enqueueChunkExport(
    instance: RacingInstance,
    config: SystemConfig,
    customDurationSeconds?: number,
    onComplete?: (job: VideoRecordJob) => void,
    onError?: (err: any) => void
  ): VideoRecordJob {
    const targetDuration = customDurationSeconds || config.durationSeconds || 120;
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const instStr = `Luong${pad(instance.id)}`;
    const vidNumStr = `Vid${instance.videoChunkIndex.toString().padStart(4, '0')}`;
    const ext = config.fileFormat === 'webm' ? 'webm' : 'mp4';
    const fileName = generateFamousDriversVideoFileName({
      trackName: instance.seedData?.biome?.name || 'Monza_GP',
      ext,
      suffix: `${instStr}_${vidNumStr}`
    });

    const leaderCar = instance.cars.find(c => c.state.rank === 1) || instance.cars[0];
    const winnerCar = leaderCar ? `${leaderCar.state.driverName || 'CRISTIANO RONALDO'} (${leaderCar.state.name})` : 'PHANTOM APEX V12';
    const topSpeed = Math.round(Math.max(...instance.cars.map(c => c.state.speed || 450), 490));

    // 1. TẠO NGAY JOB VỚI TRẠNG THÁI 'processing' ĐỂ UI HIỂN THỊ TỨC THÌ
    const job: VideoRecordJob = {
      id: `job_${instance.id}_${instance.videoChunkIndex}_${Date.now()}`,
      instanceId: instance.id,
      videoNumber: instance.videoChunkIndex,
      fileName,
      url: '',
      sizeMB: 0,
      durationSeconds: targetDuration,
      timestamp: dateStr,
      seed: instance.seedData?.seed || 632585,
      biomeName: instance.seedData?.biome?.name || 'Emerald Highway',
      winnerCar,
      topSpeedKmh: topSpeed,
      resolution: '1080x1920 (Full HD Dọc)',
      fps: config.fps || 60,
      status: 'processing',
      progressPercent: 0
    };

    // Đưa ngay vào danh sách video hiển thị
    this.videoJobs.unshift(job);
    if (this.onJobCreatedCallback) {
      this.onJobCreatedCallback(job);
    }

    // 2. ĐƯA VÀO HÀNG ĐỢI XỬ LÝ TUẦN TỰ (Export Queue)
    this.exportQueue.push({
      job,
      instance,
      config,
      customDurationSeconds,
      resolve: (completedJob) => {
        if (onComplete) onComplete(completedJob);
      },
      reject: (err) => {
        if (onError) onError(err);
      }
    });

    // Kích hoạt tiến trình xử lý hàng đợi
    this.processQueue();

    return job;
  }

  /**
   * Xử lý hàng đợi tuần tự (Sequential FIFO) để GPU và VideoEncoder không bị quá tải
   */
  private async processQueue() {
    if (this.isProcessingQueue || this.exportQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    const item = this.exportQueue.shift();
    if (!item) {
      this.isProcessingQueue = false;
      return;
    }

    const { job, instance, config, customDurationSeconds, resolve, reject } = item;

    try {
      // Khóa an toàn chống đếm thời gian của vòng lặp:
      // Bật isOfflineExport = true và đặt lại chunkTimeElapsed = 0 ngay sau khi kết thúc cuộc đua
      instance.isOfflineExport = true;
      instance.chunkTimeElapsed = 0;
      instance.status = 'exporting';

      await this.exportInstanceVideoWebCodecs(
        instance,
        config,
        customDurationSeconds,
        (currentFrame, totalFrames, percent) => {
          job.progressPercent = percent;
          if (this.onJobProgressCallback) {
            this.onJobProgressCallback(job);
          }
        },
        job
      );

      job.status = 'ready';
      job.progressPercent = 100;
      if (this.onJobProgressCallback) {
        this.onJobProgressCallback(job);
      }

      if (config.autoExportToDisk || config.autoDownloadToDevice) {
        if (this.directoryHandle) {
          this.saveDirectlyToDirectory(job);
        }
        // Tự động tải xuống máy tính ngay lập tức khi hoàn thành mà không cần bấm nút
        if (config.autoDownloadToDevice || (!this.directoryHandle && config.autoExportToDisk)) {
          this.triggerDownload(job);
        }
      }

      resolve(job);
    } catch (err) {
      console.warn('Lỗi xử lý queue xuất video:', err);
      job.status = 'failed';
      if (this.onJobProgressCallback) {
        this.onJobProgressCallback(job);
      }
      reject(err);
    } finally {
      // Mở khóa an toàn cho instance tiếp tục cuộc đua
      instance.isOfflineExport = false;
      instance.status = 'rendering';
      this.isProcessingQueue = false;

      // Xử lý mục tiếp theo trong hàng đợi
      this.processQueue();
    }
  }

  /**
   * Xuất 1 video hoàn chỉnh cho 1 Instance sử dụng WebCodecs (MP4 H.264 AVC Level 5.1/4.2)
   * với Backpressure Pipeline, đồng bộ delta = 1/FPS (60 FPS), không bỏ khung hình,
   * không giật lag, không tua nhanh!
   */
  async exportInstanceVideoWebCodecs(
    instance: RacingInstance,
    config: SystemConfig,
    customDurationSeconds?: number,
    onFrameProgress?: (currentFrame: number, totalFrames: number, percent: number) => void,
    existingJob?: VideoRecordJob
  ): Promise<VideoRecordJob> {
    const fps = config.fps || 60;
    
    // Chuẩn 60 FPS vật lý: mỗi khung hình tiến chính xác fixedDelta = 1 / fps (0.01667s)
    // Đảm bảo không bao giờ bị xé hình, không giật lag, bánh xe quay đều, camera tracking êm ái y hệt trong live game
    const fixedDelta = 1 / fps;
    const frameDurationMicros = 1_000_000 / fps;

    // Thời lượng video chuẩn sắc nét:
    // Hỗ trợ đầy đủ: 30s (1.800 frames), 60s (3.600 frames ~120MB) và 120s (7.200 frames chuẩn 2 phút không cắt ngắn)
    const requestedDuration = customDurationSeconds || config.durationSeconds || 120;
    const effectiveDuration = Math.max(15, requestedDuration);
    const renderFrames = Math.round(effectiveDuration * fps);

    // Tạo một instance mô phỏng ngoại tuyến độc lập để không can thiệp vào cuộc đua đang chạy trên màn hình
    const simSeed = existingJob?.seed || instance.seedData?.seed || 632585;
    const simCars = instance.desiredCarCount || 10;
    let offlineInstance: RacingInstance;
    try {
      offlineInstance = new RacingInstance(instance.id, effectiveDuration, simSeed, simCars);
      if (instance.seedData?.biome?.id) {
        offlineInstance.setBiome(instance.seedData.biome.id);
      }
      if (instance.seedData?.biome?.roadLayoutType) {
        offlineInstance.setRoadLayout(instance.seedData.biome.roadLayoutType);
      }
    } catch {
      offlineInstance = instance;
    }

    const { canvas: compCanvas, ctx: compCtx } = this.getCompositeCanvas();
    const { canvas: dCanvas, renderer: dRenderer } = this.getDirectRenderer();

    // 1. Thử nghiệm WebCodecs Pipeline với MP4 AVC hoặc WebM VP9/VP8 ở Bitrate cao (20 Mbps) cho video cực nét ~120MB
    let webCodecsSuccess = false;
    let finalBlob: Blob | null = null;
    let fileExt: 'mp4' | 'webm' = 'mp4';

    if (WebCodecsVideoEncoderSession.isSupported()) {
      try {
        const preferredFormat = config.fileFormat === 'webm' ? 'webm' : 'mp4';
        const session = new WebCodecsVideoEncoderSession(1080, 1920, fps, 20_000_000);
        const initialized = await session.initialize(preferredFormat);

        if (initialized) {
          for (let f = 0; f < renderFrames; f++) {
            // Cập nhật vật lý xe đua với delta đồng bộ chuẩn 60 FPS (0.01667s)
            offlineInstance.update(fixedDelta, config.aiAggressionGlobal || 0.85, true);

            // Render 3D trực tiếp 1080x1920
            const cam = offlineInstance.cameraDirector.camera;
            const oldAspect = cam.aspect;
            cam.aspect = 1080 / 1920;
            cam.updateProjectionMatrix();

            dRenderer.render(offlineInstance.scene, cam);

            cam.aspect = oldAspect;
            cam.updateProjectionMatrix();

            // Sao chép sang 2D Canvas và vẽ HUD
            compCtx.drawImage(dCanvas, 0, 0, 1080, 1920);
            const simulatedElapsedSecs = (f + 1) * fixedDelta;
            this.drawBroadcastHUD(compCtx, offlineInstance, config, simulatedElapsedSecs, effectiveDuration);

            // Đưa khung hình vào bộ mã hóa với kiểm soát áp lực ngược (Backpressure Pipeline)
            const timestampMicros = f * frameDurationMicros;
            const ok = await session.addFrame(compCanvas, f, timestampMicros, frameDurationMicros);
            if (!ok) {
              throw new Error(`VideoEncoder lỗi khung hình: ${session.getLastError() || 'Codec error'}`);
            }

            // Thông báo tiến trình thời gian thực
            if (onFrameProgress && (f % 15 === 0 || f === renderFrames - 1)) {
              const pct = Math.round(((f + 1) / renderFrames) * 100);
              onFrameProgress(f + 1, renderFrames, pct);
            }

            // Giải phóng luồng CPU định kỳ mỗi 60 frames (1 giây video)
            if (f % 60 === 0) {
              await new Promise(r => setTimeout(r, 0));
            }
          }

          const finalizeRes = await session.finalize();
          if (finalizeRes && finalizeRes.blob) {
            finalBlob = finalizeRes.blob;
            fileExt = finalizeRes.ext;
            webCodecsSuccess = true;
          }
        }
      } catch (err) {
        console.warn('WebCodecs MP4 gặp lỗi, chuyển đổi dự phòng thông minh (Fault-Tolerant Fallback):', err);
        // Thử nghiệm WebCodecs WebM VP9 trước khi fallback sang MediaRecorder
        try {
          const webmSession = new WebCodecsVideoEncoderSession(1080, 1920, fps, 20_000_000);
          const webmInit = await webmSession.initialize('webm');
          if (webmInit) {
            for (let f = 0; f < renderFrames; f++) {
              offlineInstance.update(fixedDelta, config.aiAggressionGlobal || 0.85, true);
              const cam = offlineInstance.cameraDirector.camera;
              const oldAspect = cam.aspect;
              cam.aspect = 1080 / 1920;
              cam.updateProjectionMatrix();
              dRenderer.render(offlineInstance.scene, cam);
              cam.aspect = oldAspect;
              cam.updateProjectionMatrix();

              compCtx.drawImage(dCanvas, 0, 0, 1080, 1920);
              const simulatedElapsedSecs = (f + 1) * fixedDelta;
              this.drawBroadcastHUD(compCtx, offlineInstance, config, simulatedElapsedSecs, effectiveDuration);

              const timestampMicros = f * frameDurationMicros;
              const ok = await webmSession.addFrame(compCanvas, f, timestampMicros, frameDurationMicros);
              if (!ok) break;

              if (onFrameProgress && (f % 15 === 0 || f === renderFrames - 1)) {
                const pct = Math.round(((f + 1) / renderFrames) * 100);
                onFrameProgress(f + 1, renderFrames, pct);
              }
              if (f % 60 === 0) await new Promise(r => setTimeout(r, 0));
            }
            const finalizeRes = await webmSession.finalize();
            if (finalizeRes && finalizeRes.blob) {
              finalBlob = finalizeRes.blob;
              fileExt = finalizeRes.ext;
              webCodecsSuccess = true;
            }
          }
        } catch (webmErr) {
          console.warn('WebCodecs WebM cũng gặp sự cố, kích hoạt MediaRecorder fallback:', webmErr);
        }
      }
    }

    // 2. Cơ chế chuyển đổi dự phòng thông minh (Fault-Tolerant Fallback)
    if (!webCodecsSuccess || !finalBlob) {
      console.log(`Chuyển đổi dự phòng sang MediaRecorder cho Luồng #${instance.id}`);
      finalBlob = await this.recordWithMediaRecorderFallback(
        offlineInstance,
        config,
        effectiveDuration,
        fps,
        onFrameProgress
      );
      fileExt = finalBlob.type.includes('mp4') ? 'mp4' : 'webm';
    }

    // Dọn dẹp offline scene nếu tạo riêng
    if (offlineInstance !== instance) {
      try {
        offlineInstance.cars.forEach(c => offlineInstance.scene.remove(c.group));
        offlineInstance.scene.remove(offlineInstance.track.trackMesh);
        offlineInstance.scene.remove(offlineInstance.track.sceneryGroup);
      } catch {}
    }

    // 3. Đóng gói hoặc cập nhật VideoRecordJob
    const sizeMB = Number((finalBlob.size / (1024 * 1024)).toFixed(2));
    const url = URL.createObjectURL(finalBlob);

    if (existingJob) {
      existingJob.blob = finalBlob;
      existingJob.url = url;
      existingJob.sizeMB = Math.max(0.5, sizeMB);
      existingJob.status = 'ready';
      existingJob.progressPercent = 100;
      return existingJob;
    }

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const instStr = `Luong${pad(instance.id)}`;
    const vidNumStr = `Vid${instance.videoChunkIndex.toString().padStart(4, '0')}`;
    const fileName = generateFamousDriversVideoFileName({
      trackName: instance.seedData?.biome?.name || 'Monza_GP',
      ext: fileExt,
      suffix: `${instStr}_${vidNumStr}`
    });

    const leaderCar = instance.cars.find(c => c.state.rank === 1) || instance.cars[0];
    const winnerCar = leaderCar ? `${leaderCar.state.driverName || 'CRISTIANO RONALDO'} (${leaderCar.state.name})` : 'PHANTOM APEX V12';
    const topSpeed = Math.round(Math.max(...instance.cars.map(c => c.state.speed || 450), 490));

    const job: VideoRecordJob = {
      id: `job_${instance.id}_${instance.videoChunkIndex}_${Date.now()}`,
      instanceId: instance.id,
      videoNumber: instance.videoChunkIndex,
      fileName,
      url,
      blob: finalBlob,
      sizeMB: Math.max(0.5, sizeMB),
      durationSeconds: effectiveDuration,
      timestamp: dateStr,
      seed: instance.seedData?.seed || 632585,
      biomeName: instance.seedData?.biome?.name || 'Emerald Highway',
      winnerCar,
      topSpeedKmh: topSpeed,
      resolution: '1080x1920 (Full HD Dọc)',
      fps,
      status: 'ready',
      progressPercent: 100
    };

    this.videoJobs.unshift(job);
    if (this.onJobCreatedCallback) {
      this.onJobCreatedCallback(job);
    }

    return job;
  }

  /**
   * Dự phòng ghi hình bằng MediaRecorder khi WebCodecs không khả dụng
   */
  private async recordWithMediaRecorderFallback(
    instance: RacingInstance,
    config: SystemConfig,
    targetDuration: number,
    fps: number,
    onFrameProgress?: (currentFrame: number, totalFrames: number, percent: number) => void
  ): Promise<Blob> {
    const effectiveDuration = Math.max(15, targetDuration);
    const renderFrames = Math.round(effectiveDuration * fps);
    const fixedDelta = 1 / fps;
    const { canvas: compCanvas, ctx: compCtx } = this.getCompositeCanvas();
    const { canvas: dCanvas, renderer: dRenderer } = this.getDirectRenderer();

    const stream = compCanvas.captureStream(fps);
    const mimeType = this.getOptimalMimeType();
    const chunks: Blob[] = [];

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 20_000_000
    });

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    recorder.start(500);

    for (let f = 0; f < renderFrames; f++) {
      instance.update(fixedDelta, config.aiAggressionGlobal || 0.85, true);

      const cam = instance.cameraDirector.camera;
      const oldAspect = cam.aspect;
      cam.aspect = 1080 / 1920;
      cam.updateProjectionMatrix();

      dRenderer.render(instance.scene, cam);

      cam.aspect = oldAspect;
      cam.updateProjectionMatrix();

      compCtx.drawImage(dCanvas, 0, 0, 1080, 1920);
      const simulatedElapsedSecs = (f + 1) * fixedDelta;
      this.drawBroadcastHUD(compCtx, instance, config, simulatedElapsedSecs, effectiveDuration);

      if (onFrameProgress && (f % 15 === 0 || f === renderFrames - 1)) {
        const pct = Math.round(((f + 1) / renderFrames) * 100);
        onFrameProgress(f + 1, renderFrames, pct);
      }

      if (f % 30 === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
    }

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const raw = new Blob(chunks, { type: mimeType });
        resolve(raw);
      };
      recorder.stop();
    });

    // Chuẩn hóa thời lượng nếu là webm
    if (blob.type.includes('webm')) {
      try {
        return await fixWebmDuration(blob, effectiveDuration * 1000);
      } catch {
        return blob;
      }
    }
    return blob;
  }

  /**
   * Kết thúc một chu kỳ ghi hình và đưa vào Kho Video ngay với tiến trình thời gian thực
   */
  async finalizeChunkAsync(instance: RacingInstance, config: SystemConfig): Promise<VideoRecordJob> {
    return new Promise((resolve, reject) => {
      this.enqueueChunkExport(instance, config, config.durationSeconds, resolve, reject);
    });
  }

  /**
   * Xuất đồng loạt 6 video dọc 1080x1920 cho cả 6 luồng Video Factory ngay lập tức!
   * Hiển thị chi tiết quá trình kết xuất thời gian thực cho từng luồng:
   * "ĐANG XUẤT: LUỒNG 1/6 (45%) -> LUỒNG 2/6..."
   */
  async exportAll6Threads(
    instances: RacingInstance[],
    config: SystemConfig,
    customDurationSeconds?: number,
    onProgress?: (progress: ExportProgressEvent) => void
  ): Promise<VideoRecordJob[]> {
    const targetCount = config?.instanceCount || 8;
    const activeInstances = instances.slice(0, targetCount);
    const jobs: VideoRecordJob[] = [];
    const total = activeInstances.length;

    for (let i = 0; i < total; i++) {
      const inst = activeInstances[i];
      const threadNum = i + 1;

      if (onProgress) {
        onProgress({
          currentThread: threadNum,
          totalThreads: total,
          currentFrame: 0,
          totalFrames: 0,
          percent: 0,
          statusText: `ĐANG XUẤT: LUỒNG ${threadNum}/${total} (0%)`
        });
      }

      // Khóa an toàn chống vòng lặp
      inst.isOfflineExport = true;
      inst.chunkTimeElapsed = 0;

      // Tạo job trước để xuất hiện ngay trong Kho Video
      const targetDuration = customDurationSeconds || config.durationSeconds || 120;
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
      const instStr = `Luong${pad(inst.id)}`;
      const vidNumStr = `Vid${inst.videoChunkIndex.toString().padStart(4, '0')}`;
      const ext = config.fileFormat === 'webm' ? 'webm' : 'mp4';
      const fileName = generateFamousDriversVideoFileName({
        trackName: inst.seedData?.biome?.name || 'Monza_GP',
        ext,
        suffix: `${instStr}_${vidNumStr}`
      });

      const leaderCar = inst.cars.find(c => c.state.rank === 1) || inst.cars[0];
      const winnerCar = leaderCar ? `${leaderCar.state.driverName || 'CRISTIANO RONALDO'} (${leaderCar.state.name})` : 'PHANTOM APEX V12';

      const job: VideoRecordJob = {
        id: `job_${inst.id}_${inst.videoChunkIndex}_${Date.now()}`,
        instanceId: inst.id,
        videoNumber: inst.videoChunkIndex,
        fileName,
        url: '',
        sizeMB: 0,
        durationSeconds: targetDuration,
        timestamp: dateStr,
        seed: inst.seedData?.seed || 632585,
        biomeName: inst.seedData?.biome?.name || 'Emerald Highway',
        winnerCar,
        topSpeedKmh: 490,
        resolution: '1080x1920 (Full HD Dọc)',
        fps: config.fps || 60,
        status: 'processing',
        progressPercent: 0
      };

      this.videoJobs.unshift(job);
      if (this.onJobCreatedCallback) {
        this.onJobCreatedCallback(job);
      }

      await this.exportInstanceVideoWebCodecs(
        inst,
        config,
        customDurationSeconds,
        (currentFrame, totalFrames, percent) => {
          job.progressPercent = percent;
          if (this.onJobProgressCallback) {
            this.onJobProgressCallback(job);
          }
          if (onProgress) {
            onProgress({
              currentThread: threadNum,
              totalThreads: total,
              currentFrame,
              totalFrames,
              percent,
              statusText: `ĐANG XUẤT: LUỒNG ${threadNum}/${total} (${percent}%)`
            });
          }
        },
        job
      );

      job.status = 'ready';
      job.progressPercent = 100;
      if (this.onJobProgressCallback) {
        this.onJobProgressCallback(job);
      }

      inst.isOfflineExport = false;
      jobs.push(job);
    }

    if (config.autoExportToDisk) {
      this.downloadAllVerticalJobs(jobs);
    }

    return jobs;
  }

  finalizeChunk(instance: RacingInstance, config: SystemConfig): VideoRecordJob {
    return this.enqueueChunkExport(instance, config);
  }

  async saveDirectlyToDirectory(job: VideoRecordJob): Promise<boolean> {
    if (!this.directoryHandle || !job.blob) return false;
    try {
      const subDirName = `Instance_${job.instanceId.toString().padStart(2, '0')}`;
      const subDirHandle = await this.directoryHandle.getDirectoryHandle(subDirName, { create: true });
      const fileHandle = await subDirHandle.getFileHandle(job.fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(job.blob);
      await writable.close();
      return true;
    } catch (err) {
      console.warn('Lỗi ghi file trực tiếp qua File System Access API:', err);
      this.triggerDownload(job);
      return false;
    }
  }

  triggerDownload(job: VideoRecordJob) {
    if (!job.url && !job.blob) return;
    const downloadUrl = job.url || (job.blob ? URL.createObjectURL(job.blob) : '');
    if (!downloadUrl) return;

    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = job.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => {
      document.body.removeChild(anchor);
    }, 150);
  }

  downloadAllVerticalJobs(jobs: VideoRecordJob[]) {
    jobs.forEach((job, index) => {
      setTimeout(() => {
        this.triggerDownload(job);
      }, index * 300);
    });
  }

  stopAll() {
    this.activeRecorders.forEach(rec => {
      if (rec.mediaRecorder && rec.mediaRecorder.state !== 'inactive') {
        try { rec.mediaRecorder.stop(); } catch {}
      }
    });
    this.activeRecorders.clear();
  }
}

export const videoRecorderService = new VideoRecorderService();
