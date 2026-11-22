import { parseChimeraBundle, type FrankenBundleV1 } from './bundle.ts';
import { bytesToHex, sha256Bytes } from './crc32.ts';
import { openEnvelope, sealEnvelope, type OpenedEnvelopeResult, type SealedEnvelopeResult } from './cryptoEnvelope.ts';
import {
  decodeFSK,
  decodeWavPcm16,
  encodeFSK,
  resampleLinear,
  type BaudRate,
  type FskDecodeResult,
  type FskEncodeResult,
} from './fskModem.ts';
import {
  decodeSteg,
  encodeSteg,
  generateSigilGrid,
  type PixelGrid,
  type StegDecodeResult,
  type StegEncodeResult,
} from './stegCartridge.ts';

export interface StitchedChimera {
  title: string;
  sealed: SealedEnvelopeResult;
  fsk: FskEncodeResult;
  steg: StegEncodeResult;
  envelopeHexPreview: string;
  customCarrierUsed: boolean;
}

export interface AutopsyReport {
  source: 'loopback' | 'wav' | 'microphone' | 'png' | 'noisy-sim' | 'bundle';
  opened: OpenedEnvelopeResult;
  fskMeta?: Omit<FskDecodeResult, 'payload'>;
  stegMeta?: Omit<StegDecodeResult, 'payload'>;
  bundleMeta?: Omit<FrankenBundleV1, 'envelopeBase64'>;
  envelopeHexPreview: string;
}

/**
 * Stitches plaintext into an encrypted/compressed envelope and binds it into BOTH FSK audio and LSB PNG sigil organs.
 */
export async function stitchChimera(params: {
  title: string;
  plaintext: string;
  passphrase: string;
  baudRate: BaudRate;
  compress?: boolean;
  customCarrierGrid?: PixelGrid | null;
}): Promise<StitchedChimera> {
  if (params.plaintext.length === 0) {
    throw new Error('Specimen payload cannot be empty.');
  }

  const sealed = await sealEnvelope(params.plaintext, params.passphrase, {
    compress: params.compress ?? true,
  });

  const fsk = encodeFSK(sealed.envelope, params.baudRate);
  const seedDigest = await sha256Bytes(sealed.envelope);
  const carrierGrid = params.customCarrierGrid ?? generateSigilGrid(seedDigest, 512);
  const steg = encodeSteg(carrierGrid, sealed.envelope);

  return {
    title: params.title.trim() || 'UNTITLED SPECIMEN',
    sealed,
    fsk,
    steg,
    envelopeHexPreview: bytesToHex(sealed.envelope, 40),
    customCarrierUsed: Boolean(params.customCarrierGrid),
  };
}

/**
 * Simulates acoustic channel degradation (leading silence, white noise, and sample-rate clock skew).
 */
export function simulateAcousticChannel(
  samples: Float32Array,
  sampleRate: number,
  options: {
    snrDb?: number;
    clockDriftRatio?: number;
    leadingSilenceSamples?: number;
    seed?: number;
  } = {},
): Float32Array {
  const snrDb = options.snrDb ?? 16;
  const driftRatio = options.clockDriftRatio ?? 1.003;
  const leadPad = options.leadingSilenceSamples ?? 137;

  // Drift simulation via linear resample
  const drifted =
    driftRatio === 1
      ? samples
      : resampleLinear(samples, sampleRate, Math.round(sampleRate * driftRatio));

  // Measure signal RMS over active portion
  let sumSq = 0;
  let activeCount = 0;
  for (let i = 0; i < drifted.length; i++) {
    const v = drifted[i] ?? 0;
    if (Math.abs(v) > 0.05) {
      sumSq += v * v;
      activeCount++;
    }
  }
  const signalRms = Math.sqrt(sumSq / Math.max(1, activeCount));
  const noiseSigma = signalRms / Math.pow(10, snrDb / 20);

  let rng = (options.seed ?? 0xdeadbeef) >>> 0;
  const nextGauss = () => {
    const uniform = () => {
      rng = (Math.imul(1664525, rng) + 1013904223) >>> 0;
      return Math.max(1e-7, rng / 0x100000000);
    };
    return Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform());
  };

  const out = new Float32Array(leadPad + drifted.length + 200);
  for (let i = 0; i < out.length; i++) {
    const clean = i >= leadPad && i - leadPad < drifted.length ? (drifted[i - leadPad] ?? 0) : 0;
    out[i] = Math.max(-1, Math.min(1, clean + nextGauss() * noiseSigma));
  }
  return out;
}

/**
 * Decodes and decrypts a specimen from raw audio PCM samples.
 */
export async function autopsyFromAudioSamples(
  samples: Float32Array,
  sampleRate: number,
  passphrase: string,
  source: 'loopback' | 'wav' | 'microphone' | 'noisy-sim',
  preferredBaudRate?: BaudRate,
): Promise<AutopsyReport> {
  const fsk = decodeFSK(samples, sampleRate, preferredBaudRate);
  const opened = await openEnvelope(fsk.payload, passphrase);
  return {
    source,
    opened,
    fskMeta: {
      baudRate: fsk.baudRate,
      crcHex: fsk.crcHex,
      clockDriftPct: fsk.clockDriftPct,
      snrEstimateDb: fsk.snrEstimateDb,
    },
    envelopeHexPreview: bytesToHex(fsk.payload, 40),
  };
}

/**
 * Decodes and decrypts a specimen from an uploaded RIFF/WAVE byte buffer.
 */
export async function autopsyFromWavBytes(
  wavBytes: Uint8Array,
  passphrase: string,
): Promise<AutopsyReport> {
  const { samples, sampleRate } = decodeWavPcm16(wavBytes);
  return autopsyFromAudioSamples(samples, sampleRate, passphrase, 'wav');
}

/**
 * Decodes and decrypts a specimen from an opaque PNG PixelGrid.
 */
export async function autopsyFromPixelGrid(
  grid: PixelGrid,
  passphrase: string,
): Promise<AutopsyReport> {
  const steg = decodeSteg(grid);
  const opened = await openEnvelope(steg.payload, passphrase);
  return {
    source: 'png',
    opened,
    stegMeta: {
      crcHex: steg.crcHex,
      capacityBytes: steg.capacityBytes,
    },
    envelopeHexPreview: bytesToHex(steg.payload, 40),
  };
}

/**
 * Validates and decrypts a specimen from a shareable `.franken.json` FRANKENWAVE_BUNDLE_V1 manifest.
 */
export async function autopsyFromBundleJson(
  jsonText: string,
  passphrase: string,
): Promise<AutopsyReport> {
  const { bundle, envelope } = parseChimeraBundle(jsonText);
  const opened = await openEnvelope(envelope, passphrase);
  const { envelopeBase64: _unused, ...bundleMeta } = bundle;
  void _unused;
  return {
    source: 'bundle',
    opened,
    bundleMeta,
    envelopeHexPreview: bytesToHex(envelope, 40),
  };
}
