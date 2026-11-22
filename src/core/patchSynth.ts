import { encodeWavPcm16, FSK_SAMPLE_RATE } from './fskModem.ts';
import type { FrankenPatchV1 } from './presets.ts';

export interface RenderedPatchWav {
  samples: Float32Array;
  wavBytes: Uint8Array;
  sampleRate: number;
  durationSec: number;
  peakAmplitude: number;
}

/**
 * Deterministically synthesizes a 16-bit RIFF/WAVE FM harmonic audio render from a validated FRANKENPATCH_V1 spec.
 * Zero DOM or WebAudio dependencies so it runs identically in Node Vitest and browser export.
 */
export function renderFrankenPatchPcm(
  patch: FrankenPatchV1,
  durationSec = 4,
  sampleRate = FSK_SAMPLE_RATE,
): RenderedPatchWav {
  const safeDuration = Math.max(0.5, Math.min(12, durationSec));
  const totalSamples = Math.floor(safeDuration * sampleRate);
  const samples = new Float32Array(totalSamples);

  const fadeSamples = Math.max(1, Math.min(Math.floor(totalSamples / 6), Math.round(0.06 * sampleRate)));
  const beatFreq = patch.pulseBpm / 60;
  const modDepthHz = patch.carrierHz * 0.14;
  const symFactor = 0.08 + (patch.symmetry / 12) * 0.14;

  let carrierPhase = 0;
  let overtonePhase = 0;
  let peakAmplitude = 0;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const lfo = Math.sin(2 * Math.PI * patch.modHz * t);
    const instFreq = Math.max(25, patch.carrierHz + lfo * modDepthHz);

    carrierPhase += (2 * Math.PI * instFreq) / sampleRate;
    overtonePhase += (2 * Math.PI * instFreq * 2) / sampleRate;
    if (carrierPhase > Math.PI * 2) carrierPhase -= Math.PI * 2;
    if (overtonePhase > Math.PI * 2) overtonePhase -= Math.PI * 2;

    // Rhythmic laboratory pulse envelope + warm harmonic overtones
    const pulse = 0.58 + 0.42 * (0.5 + 0.5 * Math.sin(2 * Math.PI * beatFreq * t));
    const wave =
      0.72 * Math.sin(carrierPhase) +
      symFactor * Math.sin(overtonePhase) +
      0.1 * Math.sin(carrierPhase * 1.5);

    let fade = 1;
    if (i < fadeSamples) {
      fade = 0.5 * (1 - Math.cos((Math.PI * i) / fadeSamples));
    } else if (i >= totalSamples - fadeSamples) {
      const rem = totalSamples - 1 - i;
      fade = 0.5 * (1 - Math.cos((Math.PI * rem) / fadeSamples));
    }

    const v = Math.max(-0.95, Math.min(0.95, wave * pulse * fade * 0.72));
    samples[i] = v;
    const abs = Math.abs(v);
    if (abs > peakAmplitude) peakAmplitude = abs;
  }

  const wavBytes = encodeWavPcm16(samples, sampleRate);
  return {
    samples,
    wavBytes,
    sampleRate,
    durationSec: totalSamples / sampleRate,
    peakAmplitude: Number(peakAmplitude.toFixed(4)),
  };
}
