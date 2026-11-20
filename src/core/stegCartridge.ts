import { crc32 } from './crc32.ts';

export const STEG_MAGIC = [0x4b, 0x57, 0x53, 0x54, 0x30, 0x31] as const; // "KWST01"
export const STEG_HEADER_BYTES = 14; // 6B magic + 4B uint32 len + 4B uint32 crc32

export interface PixelGrid {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface StegEncodeResult {
  grid: PixelGrid;
  bytesUsed: number;
  capacityBytes: number;
  utilizationPct: number;
  crcHex: string;
}

export interface StegDecodeResult {
  payload: Uint8Array;
  crcHex: string;
  capacityBytes: number;
}

export function maxStegPayloadBytes(width: number, height: number): number {
  const totalBytes = Math.floor((width * height * 3) / 4);
  return Math.max(0, totalBytes - STEG_HEADER_BYTES);
}

function makePrng(seedBytes: Uint8Array): () => number {
  let state = 0x9e3779b9;
  for (let i = 0; i < seedBytes.length; i++) {
    state = Math.imul(state ^ (seedBytes[i] ?? 0), 0x85ebca6b) >>> 0;
    state = ((state << 13) | (state >>> 19)) >>> 0;
  }
  if (state === 0) state = 0x6d2b79f5;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

function blendPixel(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  alpha: number,
): void {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || ix >= width || iy < 0 || iy >= height) return;
  const idx = (iy * width + ix) * 4;
  const a = Math.max(0, Math.min(1, alpha));
  const inv = 1 - a;
  data[idx] = Math.min(255, Math.round((data[idx] ?? 0) * inv + r * a));
  data[idx + 1] = Math.min(255, Math.round((data[idx + 1] ?? 0) * inv + g * a));
  data[idx + 2] = Math.min(255, Math.round((data[idx + 2] ?? 0) * inv + b * a));
  data[idx + 3] = 255;
}

function drawGlowLine(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
  g: number,
  b: number,
  intensity = 0.85,
  glowRadius = 1,
): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = x0 + dx * t;
    const cy = y0 + dy * t;
    blendPixel(data, width, height, cx, cy, r, g, b, intensity);
    if (glowRadius > 0) {
      blendPixel(data, width, height, cx + 1, cy, r, g, b, intensity * 0.25);
      blendPixel(data, width, height, cx - 1, cy, r, g, b, intensity * 0.25);
      blendPixel(data, width, height, cx, cy + 1, r, g, b, intensity * 0.25);
      blendPixel(data, width, height, cx, cy - 1, r, g, b, intensity * 0.25);
    }
  }
}

function drawCircleRing(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  r: number,
  g: number,
  b: number,
  alpha: number,
): void {
  const steps = Math.max(48, Math.ceil(2 * Math.PI * radius * 1.4));
  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;
    const px = cx + Math.cos(theta) * radius;
    const py = cy + Math.sin(theta) * radius;
    blendPixel(data, width, height, px, py, r, g, b, alpha);
  }
}

function drawDisc(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number,
  r: number,
  g: number,
  b: number,
  alpha: number,
): void {
  const radSq = radius * radius;
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(width - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(height - 1, Math.ceil(cy + radius));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const distSq = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (distSq <= radSq) {
        const falloff = 1 - Math.sqrt(distSq) / (radius + 0.5);
        blendPixel(data, width, height, x, y, r, g, b, alpha * falloff);
      }
    }
  }
}

/**
 * Generates an opaque 512x512 (default) procedural Cyberpunk-Occult PCB Sigil deterministically from seed bytes.
 */
export function generateSigilGrid(seedBytes: Uint8Array, size = 512): PixelGrid {
  const data = new Uint8ClampedArray(size * size * 4);
  const rand = makePrng(seedBytes);

  // Base obsidian substrate with faint radial phosphor aura & surgical grid
  const cx = size * 0.5;
  const cy = size * 0.48;
  const maxR = size * 0.52;

  for (let y = 0; y < size; y++) {
    const isScan = y % 3 === 0 ? 0.88 : 1;
    const dy = y - cy;
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dist = Math.hypot(dx, dy);
      const radial = Math.max(0, 1 - dist / maxR);
      const aura = radial * radial;

      let r = Math.round((7 + aura * 10) * isScan);
      let g = Math.round((10 + aura * 34) * isScan);
      let b = Math.round((13 + aura * 20) * isScan);

      // Millimeter grid
      if (x % 32 === 0 || y % 32 === 0) {
        r += 5;
        g += 18;
        b += 14;
      } else if (x % 16 === 0 || y % 16 === 0) {
        r += 2;
        g += 7;
        b += 6;
      }

      const idx = (y * size + x) * 4;
      data[idx] = Math.min(255, r);
      data[idx + 1] = Math.min(255, g);
      data[idx + 2] = Math.min(255, b);
      data[idx + 3] = 255;
    }
  }

  // Palette accent chosen deterministically per specimen
  const mode = Math.floor(rand() * 3);
  const primary: [number, number, number] =
    mode === 0 ? [57, 255, 136] : mode === 1 ? [62, 240, 200] : [120, 255, 96];
  const secondary: [number, number, number] = [255, 176, 32]; // Tesla amber
  const danger: [number, number, number] = [255, 59, 92]; // Arterial crimson

  const scale = size / 512;

  // Outer surgical frame brackets
  const pad = Math.round(18 * scale);
  const br = Math.round(38 * scale);
  const edges: Array<[number, number, number, number]> = [
    [pad, pad, pad + br, pad],
    [pad, pad, pad, pad + br],
    [size - pad, pad, size - pad - br, pad],
    [size - pad, pad, size - pad, pad + br],
    [pad, size - pad, pad + br, size - pad],
    [pad, size - pad, pad, size - pad - br],
    [size - pad, size - pad, size - pad - br, size - pad],
    [size - pad, size - pad, size - pad, size - pad - br],
  ];
  for (const [x0, y0, x1, y1] of edges) {
    drawGlowLine(data, size, size, x0, y0, x1, y1, ...secondary, 0.85, 1);
  }

  // Concentric calibration rings
  const ringRadii = [174 * scale, 156 * scale, 114 * scale, 64 * scale];
  drawCircleRing(data, size, size, cx, cy, ringRadii[0] ?? 174, ...primary, 0.55);
  drawCircleRing(data, size, size, cx, cy, ringRadii[1] ?? 156, ...secondary, 0.42);
  drawCircleRing(data, size, size, cx, cy, ringRadii[2] ?? 114, ...primary, 0.72);
  drawCircleRing(data, size, size, cx, cy, ringRadii[3] ?? 64, ...danger, 0.65);

  // Radial dial tick marks
  const ticks = 48;
  for (let i = 0; i < ticks; i++) {
    const theta = (i / ticks) * 2 * Math.PI;
    const inner = (i % 4 === 0 ? 156 : 165) * scale;
    const outer = 174 * scale;
    const [r, g, b] = i % 8 === 0 ? secondary : primary;
    drawGlowLine(
      data,
      size,
      size,
      cx + Math.cos(theta) * inner,
      cy + Math.sin(theta) * inner,
      cx + Math.cos(theta) * outer,
      cy + Math.sin(theta) * outer,
      r,
      g,
      b,
      i % 4 === 0 ? 0.85 : 0.4,
      0,
    );
  }

  // Symmetric occult-PCB geometric star + solder nodes
  const symmetry = 5 + Math.floor(rand() * 4); // 5..8 fold
  const rotOffset = rand() * Math.PI * 2;
  const starStep = symmetry >= 7 ? 3 : 2;
  const outerVertices: Array<[number, number]> = [];
  const midVertices: Array<[number, number]> = [];

  for (let i = 0; i < symmetry; i++) {
    const a = rotOffset + (i / symmetry) * Math.PI * 2;
    const rOut = (114 + rand() * 34) * scale;
    const rMid = (44 + rand() * 40) * scale;
    outerVertices.push([cx + Math.cos(a) * rOut, cy + Math.sin(a) * rOut]);
    midVertices.push([
      cx + Math.cos(a + Math.PI / symmetry) * rMid,
      cy + Math.sin(a + Math.PI / symmetry) * rMid,
    ]);
  }

  for (let i = 0; i < symmetry; i++) {
    const pA = outerVertices[i];
    const pB = outerVertices[(i + starStep) % symmetry];
    const pMid = midVertices[i];
    if (pA && pB) {
      drawGlowLine(data, size, size, pA[0], pA[1], pB[0], pB[1], ...primary, 0.85, 1);
      drawDisc(data, size, size, pA[0], pA[1], 4.5 * scale, ...secondary, 0.95);
    }
    if (pA && pMid) {
      drawGlowLine(data, size, size, pA[0], pA[1], pMid[0], pMid[1], ...secondary, 0.55, 0);
      drawGlowLine(data, size, size, cx, cy, pMid[0], pMid[1], ...danger, 0.5, 0);
      drawDisc(data, size, size, pMid[0], pMid[1], 3.2 * scale, ...primary, 0.9);
    }
  }

  // Central stitched lightning / Frankenstein core mark
  const corePts: Array<[number, number]> = [
    [cx - 10 * scale, cy - 28 * scale],
    [cx + 12 * scale, cy - 4 * scale],
    [cx - 4 * scale, cy + 2 * scale],
    [cx + 10 * scale, cy + 28 * scale],
  ];
  for (let i = 0; i < corePts.length - 1; i++) {
    const a = corePts[i];
    const b = corePts[i + 1];
    if (a && b) {
      drawGlowLine(data, size, size, a[0], a[1], b[0], b[1], ...primary, 0.95, 1);
    }
  }
  drawDisc(data, size, size, cx, cy, 8 * scale, ...primary, 0.55);

  // Lower waveform telemetry band derived directly from seedBytes
  const bandY = size * 0.88;
  const bandLeft = size * 0.12;
  const bandWidth = size * 0.76;
  const sampleCount = Math.max(24, Math.min(64, seedBytes.length * 2));
  let prevWx = bandLeft;
  let prevWy = bandY;
  for (let i = 0; i < sampleCount; i++) {
    const byteVal = seedBytes[i % Math.max(1, seedBytes.length)] ?? 128;
    const norm = (byteVal - 127.5) / 127.5;
    const wx = bandLeft + (i / (sampleCount - 1)) * bandWidth;
    const wy = bandY + norm * (16 * scale);
    if (i > 0) {
      drawGlowLine(data, size, size, prevWx, prevWy, wx, wy, ...primary, 0.8, 1);
    }
    prevWx = wx;
    prevWy = wy;
  }

  // Corner binary hash glyphs
  const glyphStart = Math.round(32 * scale);
  for (let row = 0; row < 4; row++) {
    const b = seedBytes[row] ?? 0x5a;
    for (let bit = 0; bit < 8; bit++) {
      if (((b >>> (7 - bit)) & 1) === 1) {
        drawDisc(
          data,
          size,
          size,
          glyphStart + bit * 7 * scale,
          glyphStart + row * 7 * scale,
          2 * scale,
          ...primary,
          0.75,
        );
      }
    }
  }

  return { width: size, height: size, data };
}

function writeTwoBitSlot(data: Uint8ClampedArray, slotIdx: number, twoBits: number): void {
  const pxIdx = Math.floor(slotIdx / 3);
  const channel = slotIdx % 3;
  const offset = pxIdx * 4 + channel;
  const orig = data[offset] ?? 0;
  data[offset] = (orig & 0xfc) | (twoBits & 0x03);
  // Keep alpha 255 strictly to prevent Canvas premultiplied-alpha LSB corruption
  data[pxIdx * 4 + 3] = 255;
}

function readTwoBitSlot(data: Uint8ClampedArray, slotIdx: number): number {
  const pxIdx = Math.floor(slotIdx / 3);
  const channel = slotIdx % 3;
  const offset = pxIdx * 4 + channel;
  return (data[offset] ?? 0) & 0x03;
}

/**
 * Splices a framed payload into the 2 least significant RGB bits of a PixelGrid, enforcing alpha=255.
 */
export function encodeSteg(sourceGrid: PixelGrid, payload: Uint8Array): StegEncodeResult {
  const capacityBytes = maxStegPayloadBytes(sourceGrid.width, sourceGrid.height);
  if (payload.length > capacityBytes) {
    throw new Error(
      `Payload (${payload.length} B) exceeds carrier PNG capacity (${capacityBytes} B for ${sourceGrid.width}x${sourceGrid.height}).`,
    );
  }

  const outData = new Uint8ClampedArray(sourceGrid.data);
  const checksum = crc32(payload);
  const crcHex = checksum.toString(16).padStart(8, '0').toUpperCase();

  const frame = new Uint8Array(STEG_HEADER_BYTES + payload.length);
  for (let i = 0; i < STEG_MAGIC.length; i++) {
    frame[i] = STEG_MAGIC[i] ?? 0;
  }
  frame[6] = (payload.length >>> 24) & 0xff;
  frame[7] = (payload.length >>> 16) & 0xff;
  frame[8] = (payload.length >>> 8) & 0xff;
  frame[9] = payload.length & 0xff;
  frame[10] = (checksum >>> 24) & 0xff;
  frame[11] = (checksum >>> 16) & 0xff;
  frame[12] = (checksum >>> 8) & 0xff;
  frame[13] = checksum & 0xff;
  frame.set(payload, STEG_HEADER_BYTES);

  let slot = 0;
  for (let i = 0; i < frame.length; i++) {
    const b = frame[i] ?? 0;
    writeTwoBitSlot(outData, slot++, (b >>> 6) & 0x03);
    writeTwoBitSlot(outData, slot++, (b >>> 4) & 0x03);
    writeTwoBitSlot(outData, slot++, (b >>> 2) & 0x03);
    writeTwoBitSlot(outData, slot++, b & 0x03);
  }

  return {
    grid: {
      width: sourceGrid.width,
      height: sourceGrid.height,
      data: outData,
    },
    bytesUsed: frame.length,
    capacityBytes,
    utilizationPct: Number(((payload.length / Math.max(1, capacityBytes)) * 100).toFixed(2)),
    crcHex,
  };
}

/**
 * Extracts and CRC-verifies a hidden payload from an opaque PNG PixelGrid.
 */
export function decodeSteg(grid: PixelGrid): StegDecodeResult {
  const capacityBytes = maxStegPayloadBytes(grid.width, grid.height);
  if (capacityBytes <= 0) {
    throw new Error('Carrier image is too small to hold a FRANKENWAVE header.');
  }

  const readByteAt = (byteIndex: number): number => {
    const baseSlot = byteIndex * 4;
    return (
      ((readTwoBitSlot(grid.data, baseSlot) << 6) |
        (readTwoBitSlot(grid.data, baseSlot + 1) << 4) |
        (readTwoBitSlot(grid.data, baseSlot + 2) << 2) |
        readTwoBitSlot(grid.data, baseSlot + 3)) &
      0xff
    );
  };

  for (let i = 0; i < STEG_MAGIC.length; i++) {
    if (readByteAt(i) !== STEG_MAGIC[i]) {
      throw new Error('No FRANKENWAVE sigil header (KWST01) found in image LSBs.');
    }
  }

  const payloadLen =
    (((readByteAt(6) << 24) | (readByteAt(7) << 16) | (readByteAt(8) << 8) | readByteAt(9)) >>> 0);

  if (payloadLen === 0 || payloadLen > capacityBytes) {
    throw new Error(`Invalid embedded payload length (${payloadLen} B).`);
  }

  const expectedCrc =
    (((readByteAt(10) << 24) |
      (readByteAt(11) << 16) |
      (readByteAt(12) << 8) |
      readByteAt(13)) >>>
      0);

  const payload = new Uint8Array(payloadLen);
  for (let i = 0; i < payloadLen; i++) {
    payload[i] = readByteAt(STEG_HEADER_BYTES + i);
  }

  const actualCrc = crc32(payload);
  if (actualCrc !== expectedCrc) {
    throw new Error(
      `Steganographic CRC-32 mismatch (expected ${expectedCrc.toString(16).toUpperCase()}, got ${actualCrc.toString(16).toUpperCase()}). Image may have been recompressed or alpha-premultiplied.`,
    );
  }

  return {
    payload,
    crcHex: actualCrc.toString(16).padStart(8, '0').toUpperCase(),
    capacityBytes,
  };
}
