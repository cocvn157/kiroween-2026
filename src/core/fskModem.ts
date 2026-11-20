import { crc32 } from './crc32.ts';

export const FSK_SAMPLE_RATE = 48_000;
export const FSK_FREQ_SPACE = 1200; // bit 0
export const FSK_FREQ_MARK = 2400; // bit 1
export const FSK_SYNC_WORD = 0x4b57; // "KW"
export const FSK_FRAME_VERSION = 0x01;

export type BaudRate = 300 | 600 | 1200;

export interface FskEncodeResult {
  samples: Float32Array;
  wavBytes: Uint8Array;
  sampleRate: number;
  baudRate: BaudRate;
  durationSec: number;
  frameBytesLength: number;
  crcHex: string;
}

export interface FskDecodeResult {
  payload: Uint8Array;
  baudRate: BaudRate;
  crcHex: string;
  clockDriftPct: number;
  snrEstimateDb: number;
}

function samplesPerBitFor(baudRate: BaudRate, sampleRate = FSK_SAMPLE_RATE): number {
  return Math.round(sampleRate / baudRate);
}

/**
 * Linearly resamples a mono Float32Array PCM buffer from `fromRate` to `toRate`.
 */
export function resampleLinear(
  samples: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (fromRate === toRate || samples.length === 0) {
    return samples;
  }
  const ratio = fromRate / toRate;
  const outLen = Math.max(1, Math.floor(samples.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcPos = i * ratio;
    const idx0 = Math.floor(srcPos);
    const idx1 = Math.min(samples.length - 1, idx0 + 1);
    const frac = srcPos - idx0;
    const v0 = samples[idx0] ?? 0;
    const v1 = samples[idx1] ?? 0;
    out[i] = v0 + (v1 - v0) * frac;
  }
  return out;
}

/**
 * Modulates a binary envelope into phase-continuous 1200/2400 Hz FSK cassette audio + WAV PCM16.
 */
export function encodeFSK(payload: Uint8Array, baudRate: BaudRate = 600): FskEncodeResult {
  if (payload.length > 65_535) {
    throw new Error(`Payload too large for FSK frame (${payload.length} > 65535 bytes).`);
  }

  const body = new Uint8Array(3 + payload.length);
  body[0] = FSK_FRAME_VERSION;
  body[1] = (payload.length >>> 8) & 0xff;
  body[2] = payload.length & 0xff;
  body.set(payload, 3);

  const checksum = crc32(body);
  const crcHex = checksum.toString(16).padStart(8, '0').toUpperCase();

  const txBytes = new Uint8Array(5 + body.length + 4);
  // 24-bit alternating clock training + 16-bit sync word "KW"
  txBytes[0] = 0xaa;
  txBytes[1] = 0xaa;
  txBytes[2] = 0xaa;
  txBytes[3] = (FSK_SYNC_WORD >>> 8) & 0xff;
  txBytes[4] = FSK_SYNC_WORD & 0xff;
  txBytes.set(body, 5);
  txBytes[5 + body.length] = (checksum >>> 24) & 0xff;
  txBytes[5 + body.length + 1] = (checksum >>> 16) & 0xff;
  txBytes[5 + body.length + 2] = (checksum >>> 8) & 0xff;
  txBytes[5 + body.length + 3] = checksum & 0xff;

  const spb = samplesPerBitFor(baudRate, FSK_SAMPLE_RATE);
  const leadSilence = Math.round(0.08 * FSK_SAMPLE_RATE);
  const pilotLen = Math.round(0.1 * FSK_SAMPLE_RATE);
  const dataLen = txBytes.length * 8 * spb;
  const tailLen = Math.round(0.06 * FSK_SAMPLE_RATE);
  const endSilence = Math.round(0.06 * FSK_SAMPLE_RATE);

  const totalSamples = leadSilence + pilotLen + dataLen + tailLen + endSilence;
  const samples = new Float32Array(totalSamples);
  const amp = 0.85;
  const fadeSamples = Math.round(0.01 * FSK_SAMPLE_RATE);

  let cursor = leadSilence;
  let phase = 0;

  // 100ms 2400 Hz pilot tone for AGC & boundary lock
  const pilotStep = (2 * Math.PI * FSK_FREQ_MARK) / FSK_SAMPLE_RATE;
  for (let i = 0; i < pilotLen; i++) {
    const env = i < fadeSamples ? 0.5 * (1 - Math.cos((Math.PI * i) / fadeSamples)) : 1;
    samples[cursor++] = amp * env * Math.sin(phase);
    phase += pilotStep;
  }

  // Phase-continuous data bits (MSB first)
  const step0 = (2 * Math.PI * FSK_FREQ_SPACE) / FSK_SAMPLE_RATE;
  const step1 = (2 * Math.PI * FSK_FREQ_MARK) / FSK_SAMPLE_RATE;

  for (let byteIdx = 0; byteIdx < txBytes.length; byteIdx++) {
    const byteVal = txBytes[byteIdx] ?? 0;
    for (let bitIdx = 7; bitIdx >= 0; bitIdx--) {
      const bit = (byteVal >>> bitIdx) & 1;
      const step = bit === 1 ? step1 : step0;
      for (let s = 0; s < spb; s++) {
        samples[cursor++] = amp * Math.sin(phase);
        phase += step;
        if (phase > 2 * Math.PI) {
          phase -= 2 * Math.PI;
        }
      }
    }
  }

  // 60ms 1200 Hz tail with cosine fade-out
  for (let i = 0; i < tailLen; i++) {
    const remaining = tailLen - 1 - i;
    const env =
      remaining < fadeSamples ? 0.5 * (1 - Math.cos((Math.PI * remaining) / fadeSamples)) : 1;
    samples[cursor++] = amp * env * Math.sin(phase);
    phase += step0;
  }

  const wavBytes = encodeWavPcm16(samples, FSK_SAMPLE_RATE);
  return {
    samples,
    wavBytes,
    sampleRate: FSK_SAMPLE_RATE,
    baudRate,
    durationSec: totalSamples / FSK_SAMPLE_RATE,
    frameBytesLength: body.length + 4,
    crcHex,
  };
}

/**
 * Serializes mono Float32Array samples into a standard RIFF/WAVE 16-bit PCM byte array.
 */
export function encodeWavPcm16(samples: Float32Array, sampleRate = FSK_SAMPLE_RATE): Uint8Array {
  const dataBytes = samples.length * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buf);

  const writeAscii = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, Math.round(clamped * 32767), true);
    offset += 2;
  }

  return new Uint8Array(buf);
}

/**
 * Parses a RIFF/WAVE PCM16 or IEEE Float32 WAV file into normalized mono Float32Array samples.
 */
export function decodeWavPcm16(wavBytes: Uint8Array): { samples: Float32Array; sampleRate: number } {
  if (wavBytes.length < 44) {
    throw new Error('WAV file is too short to contain a valid RIFF header.');
  }
  const view = new DataView(wavBytes.buffer, wavBytes.byteOffset, wavBytes.byteLength);
  const readTag = (offset: number) =>
    String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    );

  if (readTag(0) !== 'RIFF' || readTag(8) !== 'WAVE') {
    throw new Error('Unsupported audio format: expected RIFF/WAVE container.');
  }

  let audioFormat = 1;
  let numChannels = 1;
  let sampleRate = FSK_SAMPLE_RATE;
  let bitsPerSample = 16;
  let dataOffset = -1;
  let dataSize = 0;

  let pos = 12;
  while (pos + 8 <= wavBytes.length) {
    const chunkId = readTag(pos);
    const chunkSize = view.getUint32(pos + 4, true);
    const bodyStart = pos + 8;

    if (chunkId === 'fmt ' && bodyStart + 16 <= wavBytes.length) {
      audioFormat = view.getUint16(bodyStart, true);
      numChannels = view.getUint16(bodyStart + 2, true);
      sampleRate = view.getUint32(bodyStart + 4, true);
      bitsPerSample = view.getUint16(bodyStart + 14, true);
    } else if (chunkId === 'data') {
      dataOffset = bodyStart;
      dataSize = Math.min(chunkSize, wavBytes.length - bodyStart);
      break;
    }

    pos = bodyStart + chunkSize + (chunkSize & 1);
  }

  if (dataOffset < 0 || dataSize <= 0) {
    throw new Error('WAV file has no audio data chunk.');
  }
  if (numChannels < 1 || (audioFormat !== 1 && audioFormat !== 3)) {
    throw new Error(`Unsupported WAV encoding (format=${audioFormat}, channels=${numChannels}).`);
  }

  const bytesPerSample = bitsPerSample / 8;
  const frameStride = bytesPerSample * numChannels;
  const totalFrames = Math.floor(dataSize / frameStride);
  const samples = new Float32Array(totalFrames);

  for (let i = 0; i < totalFrames; i++) {
    let sum = 0;
    for (let ch = 0; ch < numChannels; ch++) {
      const sampleOffset = dataOffset + i * frameStride + ch * bytesPerSample;
      if (audioFormat === 3 && bitsPerSample === 32) {
        sum += view.getFloat32(sampleOffset, true);
      } else if (audioFormat === 1 && bitsPerSample === 16) {
        sum += view.getInt16(sampleOffset, true) / 32768;
      } else if (audioFormat === 1 && bitsPerSample === 8) {
        sum += (view.getUint8(sampleOffset) - 128) / 128;
      } else {
        throw new Error(`Unsupported WAV bit depth: ${bitsPerSample}-bit.`);
      }
    }
    samples[i] = sum / numChannels;
  }

  return { samples, sampleRate };
}

function goertzelPower(
  samples: Float32Array,
  startIdx: number,
  windowLen: number,
  freqHz: number,
  sampleRate: number,
): number {
  const omega = (2 * Math.PI * freqHz) / sampleRate;
  const coeff = 2 * Math.cos(omega);
  let s1 = 0;
  let s2 = 0;
  const end = Math.min(samples.length, startIdx + windowLen);
  for (let i = startIdx; i < end; i++) {
    const x = samples[i] ?? 0;
    const s0 = x + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return Math.max(0, s1 * s1 + s2 * s2 - coeff * s1 * s2);
}

interface BitEval {
  bit: 0 | 1;
  metric: number;
  signalPower: number;
  purity: number;
}

function evaluateBitWindow(
  samples: Float32Array,
  startIdx: number,
  windowLen: number,
  sampleRate: number,
): BitEval {
  const p0 = goertzelPower(samples, startIdx, windowLen, FSK_FREQ_SPACE, sampleRate);
  const p1 = goertzelPower(samples, startIdx, windowLen, FSK_FREQ_MARK, sampleRate);
  const total = p0 + p1 + 1e-12;
  const metric = (p1 - p0) / total;
  return {
    bit: metric >= 0 ? 1 : 0,
    metric,
    signalPower: total / Math.max(1, windowLen * windowLen),
    purity: Math.abs(metric),
  };
}

function findActiveBounds(samples: Float32Array): { start: number; end: number; peakPower: number } {
  const blockSize = 480; // 10ms at 48kHz
  let peakPower = 0;
  const powers: number[] = [];

  for (let i = 0; i < samples.length; i += blockSize) {
    const limit = Math.min(samples.length, i + blockSize);
    let sumSq = 0;
    for (let j = i; j < limit; j++) {
      const s = samples[j] ?? 0;
      sumSq += s * s;
    }
    const p = sumSq / Math.max(1, limit - i);
    powers.push(p);
    if (p > peakPower) {
      peakPower = p;
    }
  }

  if (peakPower < 1e-7) {
    return { start: 0, end: samples.length, peakPower };
  }

  const threshold = peakPower * 0.04;
  let firstBlock = 0;
  while (firstBlock < powers.length && (powers[firstBlock] ?? 0) < threshold) {
    firstBlock++;
  }
  let lastBlock = powers.length - 1;
  while (lastBlock > firstBlock && (powers[lastBlock] ?? 0) < threshold) {
    lastBlock--;
  }

  const margin = 4800; // 100ms guard
  return {
    start: Math.max(0, firstBlock * blockSize - margin),
    end: Math.min(samples.length, (lastBlock + 1) * blockSize + margin),
    peakPower,
  };
}

function extractFrameFromBitStream(
  bits: number[],
): { payload: Uint8Array; crcHex: string } | null {
  let shiftReg = 0;

  for (let i = 0; i < bits.length; i++) {
    shiftReg = ((shiftReg << 1) | (bits[i] ?? 0)) & 0xffff;
    if (shiftReg !== FSK_SYNC_WORD) {
      continue;
    }

    const headerStart = i + 1;
    // Need at least 3 header bytes + 4 CRC bytes = 56 bits
    if (headerStart + 56 > bits.length) {
      continue;
    }

    const readByte = (bitPos: number): number => {
      let v = 0;
      for (let b = 0; b < 8; b++) {
        v = (v << 1) | (bits[bitPos + b] ?? 0);
      }
      return v;
    };

    const version = readByte(headerStart);
    if (version !== FSK_FRAME_VERSION) {
      continue;
    }
    const lenHi = readByte(headerStart + 8);
    const lenLo = readByte(headerStart + 16);
    const payloadLen = (lenHi << 8) | lenLo;

    const totalFrameBits = (3 + payloadLen + 4) * 8;
    if (payloadLen === 0 || headerStart + totalFrameBits > bits.length) {
      continue;
    }

    const body = new Uint8Array(3 + payloadLen);
    body[0] = version;
    body[1] = lenHi;
    body[2] = lenLo;
    for (let p = 0; p < payloadLen; p++) {
      body[3 + p] = readByte(headerStart + (3 + p) * 8);
    }

    const crcStart = headerStart + (3 + payloadLen) * 8;
    const rxCrc =
      (((readByte(crcStart) << 24) |
        (readByte(crcStart + 8) << 16) |
        (readByte(crcStart + 16) << 8) |
        readByte(crcStart + 24)) >>>
        0);

    const calcCrc = crc32(body);
    if (calcCrc === rxCrc) {
      return {
        payload: body.slice(3),
        crcHex: calcCrc.toString(16).padStart(8, '0').toUpperCase(),
      };
    }
  }

  return null;
}

function tryDecodeAtBaud(
  samples: Float32Array,
  baudRate: BaudRate,
  bounds: { start: number; end: number; peakPower: number },
): FskDecodeResult | null {
  const nominalSpb = samplesPerBitFor(baudRate, FSK_SAMPLE_RATE);
  const numPhases = 12;
  const gatePower = bounds.peakPower * 0.025;
  const kp = 0.14 * nominalSpb;
  const ki = 0.005 * nominalSpb;

  for (let phaseIdx = 0; phaseIdx < numPhases; phaseIdx++) {
    const initialOffset = Math.round((phaseIdx * nominalSpb) / numPhases);
    let pos = bounds.start + initialOffset;
    let spbEst = nominalSpb;

    const bits: number[] = [];
    let hasPrev = false;
    let prevBit: 0 | 1 = 0;
    let prevPower = 0;
    let signalSum = 0;
    let signalCount = 0;
    let noiseSum = 0;
    let noiseCount = 0;

    while (pos + nominalSpb <= bounds.end) {
      const idx = Math.max(0, Math.round(pos));
      const evalRes = evaluateBitWindow(samples, idx, nominalSpb, FSK_SAMPLE_RATE);
      bits.push(evalRes.bit);

      if (evalRes.signalPower > gatePower) {
        signalSum += evalRes.purity;
        signalCount++;
      } else {
        noiseSum += evalRes.signalPower;
        noiseCount++;
        spbEst = nominalSpb;
      }

      // Transition-centered Gardner/Mueller timing recovery
      if (
        hasPrev &&
        evalRes.bit !== prevBit &&
        evalRes.signalPower > gatePower &&
        prevPower > gatePower &&
        idx >= Math.round(nominalSpb / 2)
      ) {
        const halfWinStart = Math.round(pos - nominalSpb / 2);
        const edgeEval = evaluateBitWindow(samples, halfWinStart, nominalSpb, FSK_SAMPLE_RATE);
        const currSign = evalRes.bit === 1 ? 1 : -1;
        const timingError = currSign * edgeEval.metric;

        pos -= kp * timingError;
        spbEst = Math.max(
          nominalSpb * 0.975,
          Math.min(nominalSpb * 1.025, spbEst - ki * timingError),
        );
      }

      hasPrev = true;
      prevBit = evalRes.bit;
      prevPower = evalRes.signalPower;
      pos += spbEst;
    }

    const match = extractFrameFromBitStream(bits);
    if (match !== null) {
      const driftPct = ((spbEst - nominalSpb) / nominalSpb) * 100;
      const avgPurity = signalCount > 0 ? signalSum / signalCount : 0.9;
      const avgNoise = noiseCount > 0 ? noiseSum / noiseCount : 1e-5;
      const snrEstimateDb = Math.max(
        6,
        Math.min(
          42,
          10 * Math.log10(Math.max(1e-6, bounds.peakPower * avgPurity) / Math.max(1e-6, avgNoise)),
        ),
      );
      return {
        payload: match.payload,
        baudRate,
        crcHex: match.crcHex,
        clockDriftPct: Number(driftPct.toFixed(3)),
        snrEstimateDb: Number(snrEstimateDb.toFixed(1)),
      };
    }
  }

  return null;
}

/**
 * Demodulates an FSK audio signal with Goertzel frequency discrimination and transition-centered clock recovery.
 */
export function decodeFSK(
  rawSamples: Float32Array,
  sampleRate = FSK_SAMPLE_RATE,
  preferredBaudRate?: BaudRate,
): FskDecodeResult {
  if (rawSamples.length < 1600) {
    throw new Error('Audio buffer is too short to contain a FRANKENWAVE FSK carrier.');
  }

  const samples =
    sampleRate === FSK_SAMPLE_RATE
      ? rawSamples
      : resampleLinear(rawSamples, sampleRate, FSK_SAMPLE_RATE);

  const bounds = findActiveBounds(samples);
  if (bounds.peakPower < 1e-6) {
    throw new Error('Audio signal is silent or below noise floor.');
  }

  const candidates: BaudRate[] = preferredBaudRate
    ? [preferredBaudRate, ...([600, 300, 1200] as BaudRate[]).filter((b) => b !== preferredBaudRate)]
    : [600, 300, 1200];

  for (const baud of candidates) {
    const decoded = tryDecodeAtBaud(samples, baud, bounds);
    if (decoded !== null) {
      return decoded;
    }
  }

  throw new Error(
    'No valid FRANKENWAVE FSK frame detected (sync 0x4B57 missing or CRC-32 mismatch).',
  );
}
