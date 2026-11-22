import { describe, expect, it } from 'vitest';
import { decodeWavPcm16 } from '../core/fskModem.ts';
import { renderFrankenPatchPcm } from '../core/patchSynth.ts';
import { parseFrankenPatch, SPECIMEN_PRESETS, type FrankenPatchV1 } from '../core/presets.ts';

describe('patchSynth & presets (FRANKENPATCH_V1 validation + deterministic WAV render)', () => {
  it('exposes 5 curated specimens covering vault, phosphor/crimson/amber patches, and public capsule', () => {
    expect(SPECIMEN_PRESETS.length).toBe(5);
    const palettes = SPECIMEN_PRESETS.map((p) => parseFrankenPatch(p.payload)?.palette).filter(Boolean);
    expect(palettes).toEqual(['phosphor', 'crimson', 'amber']);
  });

  it('clamps out-of-range numeric parameters safely and rejects invalid patch JSON', () => {
    const clamped = parseFrankenPatch(
      JSON.stringify({
        kind: 'FRANKENPATCH_V1',
        label: '   OVERDRIVE   ',
        carrierHz: 99999,
        modHz: -5,
        symmetry: 99,
        pulseBpm: 500,
        palette: 'unknown',
      }),
    );
    expect(clamped).toEqual({
      kind: 'FRANKENPATCH_V1',
      label: 'OVERDRIVE',
      carrierHz: 880,
      modHz: 0.25,
      symmetry: 12,
      pulseBpm: 200,
      palette: 'phosphor',
    });

    expect(parseFrankenPatch('{"kind":"OTHER"}')).toBeNull();
    expect(parseFrankenPatch('not json')).toBeNull();
  });

  it('deterministically renders a valid RIFF/WAVE PCM16 buffer from FRANKENPATCH_V1', () => {
    const patch: FrankenPatchV1 = {
      kind: 'FRANKENPATCH_V1',
      label: 'UNIT-TEST-SYNTH',
      carrierHz: 110,
      modHz: 4.5,
      symmetry: 7,
      pulseBpm: 92,
      palette: 'phosphor',
    };

    const runA = renderFrankenPatchPcm(patch, 1.5, 48_000);
    const runB = renderFrankenPatchPcm(patch, 1.5, 48_000);

    expect(runA.durationSec).toBeCloseTo(1.5, 3);
    expect(runA.peakAmplitude).toBeGreaterThan(0.1);
    expect(runA.peakAmplitude).toBeLessThanOrEqual(0.95);
    expect(runA.wavBytes).toEqual(runB.wavBytes);

    const decoded = decodeWavPcm16(runA.wavBytes);
    expect(decoded.sampleRate).toBe(48_000);
    expect(decoded.samples.length).toBe(72_000);
  });
});
