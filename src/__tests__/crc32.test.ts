import { describe, expect, it } from 'vitest';
import { bytesToHex, crc32, sha256Bytes } from '../core/crc32.ts';

describe('crc32 & binary helpers', () => {
  it('matches the IEEE 802.3 standard test vector "123456789"', () => {
    const input = new TextEncoder().encode('123456789');
    expect(crc32(input)).toBe(0xcbf43926);
  });

  it('detects single-bit corruption in payload buffers', () => {
    const clean = new Uint8Array([0x4b, 0x57, 0x01, 0xaa, 0x55, 0x99]);
    const flipped = new Uint8Array(clean);
    flipped[3] = (flipped[3] ?? 0) ^ 0x04;
    expect(crc32(clean)).not.toBe(crc32(flipped));
  });

  it('formats hex previews cleanly with truncation marker', () => {
    const data = new Uint8Array([0x0a, 0xff, 0x10, 0x20]);
    expect(bytesToHex(data, 2)).toBe('0A FF …(+2B)');
    expect(bytesToHex(data, 8)).toBe('0A FF 10 20');
  });

  it('computes deterministic 32-byte SHA-256 digests', async () => {
    const d1 = await sha256Bytes(new TextEncoder().encode('frankenwave'));
    const d2 = await sha256Bytes(new TextEncoder().encode('frankenwave'));
    expect(d1.length).toBe(32);
    expect(d1).toEqual(d2);
  });
});
