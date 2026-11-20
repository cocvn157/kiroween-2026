import { describe, expect, it } from 'vitest';
import {
  decodeFSK,
  decodeWavPcm16,
  encodeFSK,
  resampleLinear,
  type BaudRate,
} from '../core/fskModem.ts';
import { simulateAcousticChannel } from '../core/pipeline.ts';

describe('fskModem (Kansas-City FSK DSP + Clock Recovery)', () => {
  const samplePayload = new TextEncoder().encode(
    'FRANKENWAVE-DSP-TEST::{"key":"kw_2026","nodes":[1,2,3,4,5],"alive":true}',
  );

  it.each([300, 600, 1200] as BaudRate[])(
    'cleanly encodes and decodes at %i baud',
    (baud) => {
      const encoded = encodeFSK(samplePayload, baud);
      const decoded = decodeFSK(encoded.samples, encoded.sampleRate, baud);
      expect(decoded.payload).toEqual(samplePayload);
      expect(decoded.baudRate).toBe(baud);
      expect(decoded.crcHex).toBe(encoded.crcHex);
    },
  );

  it('auto-detects baud rate without preferred hint', () => {
    const encoded = encodeFSK(samplePayload, 300);
    const decoded = decodeFSK(encoded.samples, encoded.sampleRate);
    expect(decoded.payload).toEqual(samplePayload);
    expect(decoded.baudRate).toBe(300);
  });

  it('survives RIFF/WAVE PCM16 serialization and 44.1 kHz hardware sample-rate resampling', () => {
    const encoded = encodeFSK(samplePayload, 600);
    const { samples, sampleRate } = decodeWavPcm16(encoded.wavBytes);
    expect(sampleRate).toBe(48_000);

    // Simulate OS/microphone playback captured at 44100 Hz
    const at44k = resampleLinear(samples, 48_000, 44_100);
    const decoded = decodeFSK(at44k, 44_100, 600);
    expect(decoded.payload).toEqual(samplePayload);
  });

  it('recovers bit boundaries with arbitrary leading silence, AWGN (12 dB SNR), and +0.6% clock drift', () => {
    const encoded = encodeFSK(samplePayload, 600);
    const degraded = simulateAcousticChannel(encoded.samples, encoded.sampleRate, {
      snrDb: 12,
      clockDriftRatio: 1.006,
      leadingSilenceSamples: 2117,
      seed: 0x13572468,
    });
    const decoded = decodeFSK(degraded, encoded.sampleRate, 600);
    expect(decoded.payload).toEqual(samplePayload);
  });

  it('recovers bit boundaries under -0.6% negative clock drift + noise', () => {
    const encoded = encodeFSK(samplePayload, 600);
    const degraded = simulateAcousticChannel(encoded.samples, encoded.sampleRate, {
      snrDb: 13,
      clockDriftRatio: 0.994,
      leadingSilenceSamples: 37,
      seed: 0x99887766,
    });
    const decoded = decodeFSK(degraded, encoded.sampleRate, 600);
    expect(decoded.payload).toEqual(samplePayload);
  });

  it('rejects severely corrupted audio frames cleanly', () => {
    const encoded = encodeFSK(samplePayload, 600);
    const mangled = new Float32Array(encoded.samples);
    // Zero out middle 60% of signal data
    const midStart = Math.floor(mangled.length * 0.25);
    const midEnd = Math.floor(mangled.length * 0.85);
    for (let i = midStart; i < midEnd; i++) {
      mangled[i] = 0;
    }
    expect(() => decodeFSK(mangled, encoded.sampleRate, 600)).toThrow(/No valid FRANKENWAVE/);
  });
});
