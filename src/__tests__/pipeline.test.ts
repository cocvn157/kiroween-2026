import { describe, expect, it } from 'vitest';
import {
  autopsyFromAudioSamples,
  autopsyFromBundleJson,
  autopsyFromPixelGrid,
  autopsyFromWavBytes,
  simulateAcousticChannel,
  stitchChimera,
} from '../core/pipeline.ts';
import { serializeChimeraBundle } from '../core/bundle.ts';
import { parseFrankenPatch, SPECIMEN_PRESETS } from '../core/presets.ts';

describe('FRANKENWAVE end-to-end Chimera pipeline', () => {
  it('stitches a specimen into dual organs and recovers identical plaintext from both WAV and PNG', async () => {
    const preset = SPECIMEN_PRESETS[0]!;
    const chimera = await stitchChimera({
      title: preset.title,
      plaintext: preset.payload,
      passphrase: preset.passphrase,
      baudRate: 600,
    });

    const fromWav = await autopsyFromWavBytes(chimera.fsk.wavBytes, preset.passphrase);
    const fromPng = await autopsyFromPixelGrid(chimera.steg.grid, preset.passphrase);

    expect(fromWav.opened.plaintext).toBe(preset.payload);
    expect(fromPng.opened.plaintext).toBe(preset.payload);
    expect(fromWav.opened.fingerprintHex).toBe(chimera.sealed.fingerprintHex);
    expect(fromPng.opened.fingerprintHex).toBe(chimera.sealed.fingerprintHex);
  });

  it('recovers executable FRANKENPATCH_V1 presets through simulated acoustic degradation', async () => {
    const patchPreset = SPECIMEN_PRESETS[1]!;
    const chimera = await stitchChimera({
      title: patchPreset.title,
      plaintext: patchPreset.payload,
      passphrase: patchPreset.passphrase,
      baudRate: 600,
    });

    const noisySamples = simulateAcousticChannel(chimera.fsk.samples, chimera.fsk.sampleRate, {
      snrDb: 14,
      clockDriftRatio: 1.004,
      leadingSilenceSamples: 451,
    });

    const recovered = await autopsyFromAudioSamples(
      noisySamples,
      chimera.fsk.sampleRate,
      patchPreset.passphrase,
      'noisy-sim',
      600,
    );

    expect(recovered.opened.plaintext).toBe(patchPreset.payload);
    const parsedPatch = parseFrankenPatch(recovered.opened.plaintext);
    expect(parsedPatch).not.toBeNull();
    expect(parsedPatch?.kind).toBe('FRANKENPATCH_V1');
    expect(parsedPatch?.carrierHz).toBe(110);
  });

  it('exports and restores encrypted crimson patch via .franken.json bundle while blocking wrong keys', async () => {
    const crimsonPreset = SPECIMEN_PRESETS[2]!;
    const chimera = await stitchChimera({
      title: crimsonPreset.title,
      plaintext: crimsonPreset.payload,
      passphrase: crimsonPreset.passphrase,
      baudRate: 1200,
    });

    const bundleJson = serializeChimeraBundle(chimera);
    const recovered = await autopsyFromBundleJson(bundleJson, crimsonPreset.passphrase);
    expect(recovered.source).toBe('bundle');
    expect(recovered.opened.plaintext).toBe(crimsonPreset.payload);
    expect(recovered.bundleMeta?.baudRate).toBe(1200);

    await expect(autopsyFromBundleJson(bundleJson, 'wrong-key')).rejects.toThrow(/authentication failed/);
  });
});
