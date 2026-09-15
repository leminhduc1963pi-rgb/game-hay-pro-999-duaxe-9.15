/**
 * webmClusterFixer.ts - WebM EBML Cluster & Timecode Stream Engine
 * 
 * Bộ xử lý WebM EBML chuyên biệt:
 * 1. Mở rộng WebmClusters: Trải rộng và kết nối các cụm dữ liệu video (Cluster & Timecode)
 *    phủ kín toàn bộ trục thời gian từ 00:00 đến 02:00:00 (120.000 ms).
 * 2. Chuẩn hóa siêu dữ liệu EBML Info Duration: Ghi chính xác Duration = 120.000 ms (Float64)
 *    và TimecodeScale = 1.000.000 ns (1 ms).
 * 3. Đảm bảo các trình phát video (VLC, Windows Media Player, Films & TV, QuickTime)
 *    hiển thị thanh tua chuẩn 0:00 / 2:00 và phát liên tục 120 giây không ngắt quãng.
 */

function readEbmlId(buf: Uint8Array, offset: number): { len: number; id: number } | null {
  if (offset >= buf.length) return null;
  const first = buf[offset];
  let len = 1;
  let mask = 0x80;
  while (len <= 4 && !(first & mask)) {
    mask >>= 1;
    len++;
  }
  if (len > 4) return null;
  let id = 0;
  for (let i = 0; i < len; i++) {
    id = (id << 8) | buf[offset + i];
  }
  return { len, id: (id >>> 0) };
}

function readVint(buf: Uint8Array, offset: number): { len: number; val: number; isUnknown: boolean } | null {
  if (offset >= buf.length) return null;
  const first = buf[offset];
  let len = 1;
  let mask = 0x80;
  while (len <= 8 && !(first & mask)) {
    mask >>= 1;
    len++;
  }
  if (len > 8) return null;
  let val = first & ~mask;
  let isUnknown = (first & ~mask) === (mask - 1);
  for (let i = 1; i < len; i++) {
    val = (val << 8) | buf[offset + i];
    if (buf[offset + i] !== 0xFF) isUnknown = false;
  }
  return { len, val, isUnknown };
}

function encodeVint(val: number, fixedLen?: number): Uint8Array {
  let len = fixedLen;
  if (!len) {
    if (val < 127) len = 1;
    else if (val < 16383) len = 2;
    else if (val < 2097151) len = 3;
    else if (val < 268435455) len = 4;
    else len = 8;
  }
  const out = new Uint8Array(len);
  let v = val;
  for (let i = len - 1; i >= 0; i--) {
    out[i] = v & 0xFF;
    v >>= 8;
  }
  out[0] |= (1 << (8 - len));
  return out;
}

function concatBuffers(buffers: Uint8Array[]): Uint8Array {
  let totalLen = 0;
  for (const b of buffers) totalLen += b.length;
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const b of buffers) {
    result.set(b, offset);
    offset += b.length;
  }
  return result;
}

/**
 * Xây dựng phần tử Info chuẩn với TimecodeScale = 1.000.000 ns và Duration = 120.000 ms (Float64)
 */
function buildStandardInfoElement(durationMs: number = 120000): Uint8Array {
  // 1. TimecodeScale: ID 0x2AD7B1, len 3, value 1000000 (0x0F4240)
  const timecodeScale = new Uint8Array([0x2A, 0xD7, 0xB1, 0x83, 0x0F, 0x42, 0x40]);

  // 2. Duration: ID 0x4489, len 8 (Float64 IEEE 754 Big Endian)
  const durationElem = new Uint8Array(11);
  durationElem[0] = 0x44;
  durationElem[1] = 0x89;
  durationElem[2] = 0x88; // 8 bytes Float64
  const view = new DataView(durationElem.buffer, durationElem.byteOffset, 11);
  view.setFloat64(3, durationMs, false); // Big endian

  // 3. MuxingApp / WritingApp string: "RacingVideoFactory"
  const appStr = 'RacingVideoFactory 120s F1 Pro';
  const encoder = new TextEncoder();
  const appBytes = encoder.encode(appStr);
  const muxingApp = concatBuffers([
    new Uint8Array([0x4D, 0x80]),
    encodeVint(appBytes.length),
    appBytes
  ]);
  const writingApp = concatBuffers([
    new Uint8Array([0x57, 0x41]),
    encodeVint(appBytes.length),
    appBytes
  ]);

  const infoPayload = concatBuffers([timecodeScale, durationElem, muxingApp, writingApp]);
  const infoLenVint = encodeVint(infoPayload.length);
  return concatBuffers([
    new Uint8Array([0x15, 0x49, 0xA9, 0x66]), // Info ID
    infoLenVint,
    infoPayload
  ]);
}

/**
 * Xây dựng lại Cluster với Timecode mới (mili-giây)
 */
function rebuildClusterWithTimecode(timecodeMs: number, payloadRest: Uint8Array): Uint8Array {
  // Timecode ID: 0xE7, VINT len 4, 4-byte uint
  const tcBuf = new Uint8Array(6);
  tcBuf[0] = 0xE7;
  tcBuf[1] = 0x84;
  const view = new DataView(tcBuf.buffer, tcBuf.byteOffset, 6);
  view.setUint32(2, Math.max(0, Math.floor(timecodeMs)), false);

  const clusterPayload = concatBuffers([tcBuf, payloadRest]);
  const clusterLenVint = encodeVint(clusterPayload.length);
  return concatBuffers([
    new Uint8Array([0x1F, 0x43, 0xB6, 0x75]), // Cluster ID
    clusterLenVint,
    clusterPayload
  ]);
}

/**
 * Thuật toán tự động trải rộng và kết nối các cụm dữ liệu video (mở rộng WebmClusters)
 * phủ kín toàn bộ trục thời gian từ 00:00 đến 02:00:00 (120.000 ms),
 * ghi Duration = 120.000 ms vào Thông tin phân đoạn EBML.
 */
export async function expandWebmClustersAndDuration(
  blob: Blob,
  targetDurationMs: number = 120000
): Promise<Blob> {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const rawBuf = new Uint8Array(arrayBuffer);

    let pos = 0;
    let ebmlHeaderBuf: Uint8Array | null = null;
    let segmentOffset = -1;
    let segmentContentOffset = -1;

    // 1. Tìm EBML Header và vị trí bắt đầu của Segment
    while (pos < rawBuf.length) {
      const idInfo = readEbmlId(rawBuf, pos);
      if (!idInfo) break;
      const lenInfo = readVint(rawBuf, pos + idInfo.len);
      if (!lenInfo) break;

      if (idInfo.id === 0x1A45DFA3) { // EBML
        const headerEnd = pos + idInfo.len + lenInfo.len + lenInfo.val;
        ebmlHeaderBuf = rawBuf.slice(pos, headerEnd);
        pos = headerEnd;
        continue;
      }

      if (idInfo.id === 0x18538067) { // Segment
        segmentOffset = pos;
        segmentContentOffset = pos + idInfo.len + lenInfo.len;
        break;
      }

      pos += idInfo.len + lenInfo.len + (lenInfo.isUnknown ? 0 : lenInfo.val);
    }

    if (!ebmlHeaderBuf || segmentOffset === -1 || segmentContentOffset === -1) {
      console.warn('Không tìm thấy cấu trúc EBML Segment tiêu chuẩn, giữ nguyên blob ban đầu');
      return blob;
    }

    // 2. Quét các phần tử con của Segment (Tracks, Cụm dữ liệu Clusters)
    let segPos = segmentContentOffset;
    let tracksBuf: Uint8Array | null = null;
    const otherHeaderElements: Uint8Array[] = [];

    interface ClusterEntry {
      originalTimecode: number;
      payloadRest: Uint8Array;
    }
    const parsedClusters: ClusterEntry[] = [];

    while (segPos < rawBuf.length) {
      const idInfo = readEbmlId(rawBuf, segPos);
      if (!idInfo) break;
      const lenInfo = readVint(rawBuf, segPos + idInfo.len);
      if (!lenInfo) break;

      const elemHeaderLen = idInfo.len + lenInfo.len;
      let elemTotalLen = elemHeaderLen + lenInfo.val;

      // Xử lý trường hợp Unknown Length của MediaRecorder
      if (lenInfo.isUnknown) {
        let nextPos = segPos + elemHeaderLen;
        while (nextPos < rawBuf.length - 4) {
          if (
            rawBuf[nextPos] === 0x1F &&
            rawBuf[nextPos + 1] === 0x43 &&
            rawBuf[nextPos + 2] === 0xB6 &&
            rawBuf[nextPos + 3] === 0x75
          ) {
            break;
          }
          nextPos++;
        }
        elemTotalLen = nextPos - segPos;
      }

      const elemData = rawBuf.slice(segPos, Math.min(rawBuf.length, segPos + elemTotalLen));

      if (idInfo.id === 0x1654AE6B) { // Tracks
        tracksBuf = elemData;
      } else if (idInfo.id === 0x1F43B675) { // Cluster
        const clusterPayload = elemData.slice(elemHeaderLen);
        let tcVal = 0;
        let payloadRest = clusterPayload;

        // Trích xuất Timecode (ID 0xE7) bên trong Cluster
        let cPos = 0;
        while (cPos < clusterPayload.length) {
          const cId = readEbmlId(clusterPayload, cPos);
          if (!cId) break;
          const cLen = readVint(clusterPayload, cPos + cId.len);
          if (!cLen) break;

          if (cId.id === 0xE7) { // Timecode
            const tcStart = cPos + cId.len + cLen.len;
            let val = 0;
            for (let i = 0; i < cLen.val; i++) {
              val = (val << 8) | clusterPayload[tcStart + i];
            }
            tcVal = val;
            // Phần payload còn lại không chứa Timecode
            payloadRest = concatBuffers([
              clusterPayload.slice(0, cPos),
              clusterPayload.slice(tcStart + cLen.val)
            ]);
            break;
          }
          cPos += cId.len + cLen.len + cLen.val;
        }

        parsedClusters.push({ originalTimecode: tcVal, payloadRest });
      } else if (idInfo.id !== 0x1549A966) { // Không lưu Info cũ, ta sẽ thay bằng Info chuẩn 120s
        otherHeaderElements.push(elemData);
      }

      segPos += elemTotalLen;
    }

    // 3. Tạo phần tử Info chuẩn hóa với Duration = 120.000 ms
    const standardInfo = buildStandardInfoElement(targetDurationMs);

    // 4. Mở rộng WebmClusters: Tự động trải rộng và kết nối các cụm dữ liệu phủ kín đến 02:00:00
    const finalClusterBuffers: Uint8Array[] = [];

    if (parsedClusters.length === 0) {
      // Nếu không trích xuất được cluster con, giữ nguyên cấu trúc gốc
      return blob;
    }

    // Xác định khoảng thời gian của 1 chu kỳ cluster đã ghi nhận
    const firstTc = parsedClusters[0].originalTimecode;
    const lastTc = parsedClusters[parsedClusters.length - 1].originalTimecode;
    const recordedSpan = Math.max(1000, lastTc - firstTc);
    const avgStep = parsedClusters.length > 1
      ? Math.max(200, Math.floor(recordedSpan / (parsedClusters.length - 1)))
      : 1000;
    const cycleDuration = recordedSpan + avgStep;

    let currentTimestamp = 0;
    let cycleIndex = 0;

    while (currentTimestamp < targetDurationMs) {
      for (let i = 0; i < parsedClusters.length; i++) {
        const item = parsedClusters[i];
        const newTimecode = (cycleIndex * cycleDuration) + (item.originalTimecode - firstTc);
        if (newTimecode > targetDurationMs + 1000) break;

        const clusterBuf = rebuildClusterWithTimecode(newTimecode, item.payloadRest);
        finalClusterBuffers.push(clusterBuf);
        currentTimestamp = newTimecode;
      }
      cycleIndex++;
      // Ngăn vòng lặp vô hạn
      if (cycleIndex > 200) break;
    }

    // 5. Lắp ráp Segment hoàn chỉnh
    const segmentChildren = [
      standardInfo,
      ...(tracksBuf ? [tracksBuf] : []),
      ...otherHeaderElements,
      ...finalClusterBuffers
    ];

    const segmentPayload = concatBuffers(segmentChildren);
    // Sử dụng VINT 8-byte unknown length (chuẩn streaming mượt mà nhất của WebM)
    const segmentLenVint = new Uint8Array([0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]);
    const segmentElement = concatBuffers([
      new Uint8Array([0x18, 0x53, 0x80, 0x67]), // Segment ID
      segmentLenVint,
      segmentPayload
    ]);

    const finalBuffer = concatBuffers([ebmlHeaderBuf, segmentElement]);
    return new Blob([finalBuffer], { type: blob.type || 'video/webm' });
  } catch (err) {
    console.warn('expandWebmClustersAndDuration encountered an issue, returning original blob:', err);
    return blob;
  }
}
