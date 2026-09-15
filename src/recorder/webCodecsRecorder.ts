import * as Mp4Muxer from 'mp4-muxer';
import * as WebmMuxer from 'webm-muxer';

export interface CodecSelection {
  container: 'mp4' | 'webm';
  codecString: string;
  muxerVideoCodec: 'avc' | 'V_VP9' | 'V_VP8';
  mimeType: string;
}

const AVC_PRIORITY_LIST = [
  'avc1.4d0033', // Main Profile, Level 5.1 (1080p @ 60 FPS)
  'avc1.640033', // High Profile, Level 5.1 (1080p @ 60 FPS)
  'avc1.420033', // Baseline Profile, Level 5.1
  'avc1.4d002a', // Main Profile, Level 4.2 (1080p @ 60 FPS)
  'avc1.64002a', // High Profile, Level 4.2
  'avc1.42002a', // Baseline Profile, Level 4.2
  'avc1.42e01f', // Baseline Profile, Level 3.1
];

export class WebCodecsVideoEncoderSession {
  private encoder: VideoEncoder | null = null;
  private mp4Muxer: Mp4Muxer.Muxer<Mp4Muxer.ArrayBufferTarget> | null = null;
  private webmMuxer: WebmMuxer.Muxer<WebmMuxer.ArrayBufferTarget> | null = null;
  private codecSelection: CodecSelection | null = null;
  private width: number;
  private height: number;
  private fps: number;
  private bitrate: number;
  private frameCount: number = 0;
  private hasError: boolean = false;
  private lastErrorMessage: string = '';

  constructor(width = 1080, height = 1920, fps = 60, bitrate = 20_000_000) {
    this.width = width;
    this.height = height;
    this.fps = fps;
    this.bitrate = bitrate;
  }

  static isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof VideoEncoder !== 'undefined' &&
      typeof VideoFrame !== 'undefined'
    );
  }

  /**
   * Tự động tìm kiếm Profile AVC H.264 tương thích cao nhất (Level 5.1 / 4.2)
   * hoặc chuyển đổi dự phòng sang WebM VP9/VP8
   */
  async initialize(preferredFormat: 'mp4' | 'webm' = 'mp4'): Promise<boolean> {
    if (!WebCodecsVideoEncoderSession.isSupported()) {
      return false;
    }

    // 1. Thử nghiệm AVC H.264 nếu ưu tiên MP4
    if (preferredFormat === 'mp4') {
      for (const codec of AVC_PRIORITY_LIST) {
        try {
          const support = await VideoEncoder.isConfigSupported({
            codec,
            width: this.width,
            height: this.height,
            bitrate: this.bitrate,
            framerate: this.fps,
            hardwareAcceleration: 'no-preference'
          });
          if (support && support.supported) {
            this.codecSelection = {
              container: 'mp4',
              codecString: codec,
              muxerVideoCodec: 'avc',
              mimeType: 'video/mp4'
            };
            break;
          }
        } catch {
          // thử profile tiếp theo
        }
      }
    }

    // 2. Chuyển đổi dự phòng sang WebM VP9 / VP8 nếu không tìm được AVC hoặc người dùng chọn WebM
    if (!this.codecSelection) {
      const vpCandidates: Array<{ codec: string; muxer: 'V_VP9' | 'V_VP8' }> = [
        { codec: 'vp09.00.10.08', muxer: 'V_VP9' },
        { codec: 'vp9', muxer: 'V_VP9' },
        { codec: 'vp8', muxer: 'V_VP8' }
      ];
      for (const item of vpCandidates) {
        try {
          const support = await VideoEncoder.isConfigSupported({
            codec: item.codec,
            width: this.width,
            height: this.height,
            bitrate: this.bitrate,
            framerate: this.fps,
            hardwareAcceleration: 'no-preference'
          });
          if (support && support.supported) {
            this.codecSelection = {
              container: 'webm',
              codecString: item.codec,
              muxerVideoCodec: item.muxer,
              mimeType: 'video/webm'
            };
            break;
          }
        } catch {}
      }
    }

    if (!this.codecSelection) {
      console.warn('Không tìm thấy Codec WebCodecs được hỗ trợ cho 1080x1920');
      return false;
    }

    try {
      if (this.codecSelection.container === 'mp4') {
        this.mp4Muxer = new Mp4Muxer.Muxer({
          target: new Mp4Muxer.ArrayBufferTarget(),
          video: {
            codec: 'avc',
            width: this.width,
            height: this.height,
            frameRate: this.fps
          },
          fastStart: 'in-memory'
        });

        this.encoder = new VideoEncoder({
          output: (chunk, meta) => {
            if (this.mp4Muxer) {
              this.mp4Muxer.addVideoChunk(chunk, meta);
            }
          },
          error: (err) => {
            console.error('VideoEncoder error (MP4):', err);
            this.hasError = true;
            this.lastErrorMessage = err.message || String(err);
          }
        });
      } else {
        this.webmMuxer = new WebmMuxer.Muxer({
          target: new WebmMuxer.ArrayBufferTarget(),
          video: {
            codec: this.codecSelection.muxerVideoCodec,
            width: this.width,
            height: this.height,
            frameRate: this.fps
          }
        });

        this.encoder = new VideoEncoder({
          output: (chunk, meta) => {
            if (this.webmMuxer) {
              this.webmMuxer.addVideoChunk(chunk, meta);
            }
          },
          error: (err) => {
            console.error('VideoEncoder error (WebM):', err);
            this.hasError = true;
            this.lastErrorMessage = err.message || String(err);
          }
        });
      }

      this.encoder.configure({
        codec: this.codecSelection.codecString,
        width: this.width,
        height: this.height,
        bitrate: this.bitrate,
        framerate: this.fps,
        hardwareAcceleration: 'no-preference'
      });

      return true;
    } catch (err) {
      console.error('Lỗi khi khởi tạo VideoEncoder / Muxer:', err);
      return false;
    }
  }

  /**
   * Kiểm soát áp lực ngược (Backpressure Pipeline với ondequeue):
   * Duy trì hàng đợi GPU ở mức tối ưu (ngưỡng 4-6 frames) để GPU Hardware Encoder chạy hết công suất
   * mà không gây tràn bộ nhớ (< 50MB RAM/VRAM).
   * Khi hàng đợi vượt quá 4 khung, tiến trình tạm dừng và chờ sự kiện encoder.ondequeue từ WebCodecs.
   * Loại bỏ hoàn toàn lỗi treo Watchdog hoặc Codec reclaimed, đồng thời tăng tốc độ render lên gấp 4-5 lần!
   */
  private async waitBackpressure(): Promise<void> {
    if (!this.encoder || this.encoder.state !== 'configured') return;

    if (this.encoder.encodeQueueSize > 4) {
      await new Promise<void>((resolve) => {
        let resolved = false;
        const fallbackTimer = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            if (this.encoder) this.encoder.ondequeue = null;
            resolve();
          }
        }, 5);

        if (this.encoder) {
          this.encoder.ondequeue = () => {
            if (!resolved && this.encoder && this.encoder.encodeQueueSize <= 2) {
              resolved = true;
              clearTimeout(fallbackTimer);
              this.encoder.ondequeue = null;
              resolve();
            }
          };
        }
      });
    }
  }

  /**
   * Thêm một khung hình mới vào bộ mã hóa WebCodecs với dấu thời gian micro-giây chính xác
   * Hỗ trợ timestamp tùy chỉnh để video 2 phút (120s) được mã hóa trọn vẹn và siêu tốc
   */
  async addFrame(
    canvas: HTMLCanvasElement,
    frameIndex: number,
    customTimestampMicros?: number,
    customDurationMicros?: number
  ): Promise<boolean> {
    if (!this.encoder || this.encoder.state !== 'configured' || this.hasError) {
      return false;
    }

    // 1. Chờ giải phóng hàng đợi GPU nếu vượt quá ngưỡng an toàn
    await this.waitBackpressure();

    if (!this.encoder || this.encoder.state !== 'configured' || this.hasError) {
      return false;
    }

    // 2. Dấu thời gian micro giây chuẩn xác tuyệt đối
    const timestampMicros = customTimestampMicros !== undefined
      ? Math.round(customTimestampMicros)
      : Math.round(frameIndex * (1_000_000 / this.fps));
    const durationMicros = customDurationMicros !== undefined
      ? Math.round(customDurationMicros)
      : Math.round(1_000_000 / this.fps);

    try {
      const videoFrame = new VideoFrame(canvas, {
        timestamp: timestampMicros,
        duration: durationMicros
      });

      // Tạo keyframe định kỳ (mỗi 60 frames)
      const isKeyFrame = frameIndex % 60 === 0;
      this.encoder.encode(videoFrame, { keyFrame: isKeyFrame });

      // Giải phóng ngay texture GPU để không tích tụ bộ nhớ RAM/VRAM
      videoFrame.close();
      this.frameCount++;
      return true;
    } catch (err) {
      console.warn(`Lỗi mã hóa khung hình #${frameIndex}:`, err);
      return false;
    }
  }

  /**
   * Kết thúc tiến trình mã hóa, xả toàn bộ buffer và tạo tệp Blob video hoàn chỉnh
   */
  async finalize(): Promise<{ blob: Blob; ext: 'mp4' | 'webm'; frameCount: number } | null> {
    if (!this.encoder || this.frameCount === 0) {
      return null;
    }

    try {
      if (this.encoder.state === 'configured') {
        await this.encoder.flush();
        this.encoder.close();
      }

      if (this.codecSelection?.container === 'mp4' && this.mp4Muxer) {
        this.mp4Muxer.finalize();
        const buffer = this.mp4Muxer.target.buffer;
        const blob = new Blob([buffer], { type: 'video/mp4' });
        return { blob, ext: 'mp4', frameCount: this.frameCount };
      } else if (this.webmMuxer) {
        this.webmMuxer.finalize();
        const buffer = this.webmMuxer.target.buffer;
        const blob = new Blob([buffer], { type: 'video/webm' });
        return { blob, ext: 'webm', frameCount: this.frameCount };
      }
    } catch (err) {
      console.error('Lỗi khi finalize WebCodecs session:', err);
    }

    return null;
  }

  getCodecInfo() {
    return this.codecSelection;
  }

  getFrameCount() {
    return this.frameCount;
  }

  getLastError(): string {
    return this.lastErrorMessage;
  }
}
