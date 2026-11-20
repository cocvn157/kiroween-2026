import { describe, expect, it } from 'vitest';
import {
  decodeSteg,
  encodeSteg,
  generateSigilGrid,
  maxStegPayloadBytes,
} from '../core/stegCartridge.ts';

describe('stegCartridge (Opaque 2-bit LSB Steganography & Sigil Art)', () => {
  it('generates opaque 512x512 procedural sigil with alpha=255 on every pixel', () => {
    const seed = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const sigil = generateSigilGrid(seed, 512);
    expect(sigil.width).toBe(512);
    expect(sigil.height).toBe(512);
    expect(sigil.data.length).toBe(512 * 512 * 4);

    for (let i = 3; i < sigil.data.length; i += 4) {
      if (sigil.data[i] !== 255) {
        throw new Error(`Expected opaque alpha 255 at byte ${i}, got ${sigil.data[i]}`);
      }
    }
  });

  it('embeds and extracts multi-kilobyte payloads bit-exactly while preserving opacity', () => {
    const sigil = generateSigilGrid(new Uint8Array([0xab, 0xcd, 0xef]), 256);
    const payload = new Uint8Array(4096);
    for (let i = 0; i < payload.length; i++) {
      payload[i] = (i * 73 + 19) & 0xff;
    }

    const encoded = encodeSteg(sigil, payload);
    expect(encoded.utilizationPct).toBeGreaterThan(0);
    expect(encoded.utilizationPct).toBeLessThan(20);

    // Check every written pixel keeps alpha=255
    for (let i = 3; i < encoded.grid.data.length; i += 4) {
      expect(encoded.grid.data[i]).toBe(255);
    }

    const decoded = decodeSteg(encoded.grid);
    expect(decoded.payload).toEqual(payload);
    expect(decoded.crcHex).toBe(encoded.crcHex);
  });

  it('rejects payloads exceeding carrier pixel capacity', () => {
    const tiny = generateSigilGrid(new Uint8Array([1, 2]), 64);
    const cap = maxStegPayloadBytes(64, 64);
    const oversized = new Uint8Array(cap + 1);
    expect(() => encodeSteg(tiny, oversized)).toThrow(/exceeds carrier PNG capacity/);
  });

  it('detects image tampering or recompression via CRC-32 mismatch', () => {
    const sigil = generateSigilGrid(new Uint8Array([9, 8, 7]), 128);
    const payload = new TextEncoder().encode('tamper-check-payload');
    const encoded = encodeSteg(sigil, payload);
    const corrupted = {
      ...encoded.grid,
      data: new Uint8ClampedArray(encoded.grid.data),
    };
    // Flip LSB in payload area (past 14B header = past 56 slots = past pixel 19)
    corrupted.data[25 * 4] = (corrupted.data[25 * 4] ?? 0) ^ 0x02;
    expect(() => decodeSteg(corrupted)).toThrow(/CRC-32 mismatch/);
  });
});
