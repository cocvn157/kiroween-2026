import { describe, expect, it } from 'vitest';
import {
  base64ToUint8,
  BUNDLE_SCHEMA,
  exportChimeraBundle,
  parseChimeraBundle,
  serializeChimeraBundle,
  uint8ToBase64,
} from '../core/bundle.ts';
import { stitchChimera } from '../core/pipeline.ts';
import { SPECIMEN_PRESETS } from '../core/presets.ts';

describe('bundle (FRANKENWAVE_BUNDLE_V1 export, validation & tamper guard)', () => {
  it('round-trips all 256 byte values through Base64 safely', () => {
    const allBytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) allBytes[i] = i;
    const encoded = uint8ToBase64(allBytes);
    const decoded = base64ToUint8(encoded);
    expect(decoded).toEqual(allBytes);
  });

  it('throws on empty or malformed Base64', () => {
    expect(() => base64ToUint8('   ')).toThrow(/empty/);
    expect(() => base64ToUint8('!!!not-valid-base64!!!')).toThrow(/malformed Base64/);
  });

  it('serializes and parses a stitched Chimera bundle bit-exactly', async () => {
    const preset = SPECIMEN_PRESETS[0]!;
    const chimera = await stitchChimera({
      title: preset.title,
      plaintext: preset.payload,
      passphrase: preset.passphrase,
      baudRate: 600,
    });
    const manifest = exportChimeraBundle(chimera, '2026-11-22T00:00:00.000Z');
    expect(manifest.schema).toBe(BUNDLE_SCHEMA);
    expect(manifest.encrypted).toBe(true);
    expect(manifest.baudRate).toBe(600);

    const json = serializeChimeraBundle(chimera, '2026-11-22T00:00:00.000Z');
    const parsed = parseChimeraBundle(json);
    expect(parsed.bundle.fingerprintHex).toBe(chimera.sealed.fingerprintHex);
    expect(parsed.envelope).toEqual(chimera.sealed.envelope);
  });

  it('rejects tampered bundle envelopes via CRC-32 verification', async () => {
    const preset = SPECIMEN_PRESETS[4]!;
    const chimera = await stitchChimera({
      title: preset.title,
      plaintext: preset.payload,
      passphrase: preset.passphrase,
      baudRate: 300,
    });
    const bundle = exportChimeraBundle(chimera);
    // Flip a byte inside the base64 envelope while keeping 0x4B magic intact
    const mutatedEnv = new Uint8Array(chimera.sealed.envelope);
    mutatedEnv[mutatedEnv.length - 1] = (mutatedEnv[mutatedEnv.length - 1] ?? 0) ^ 0xff;
    const tamperedJson = JSON.stringify({
      ...bundle,
      envelopeBase64: uint8ToBase64(mutatedEnv),
    });

    expect(() => parseChimeraBundle(tamperedJson)).toThrow(/CRC-32 mismatch/);
  });

  it('rejects invalid schema or baud rate cleanly', () => {
    expect(() =>
      parseChimeraBundle(JSON.stringify({ schema: 'OTHER_V1', baudRate: 600 })),
    ).toThrow(/Unsupported bundle schema/);
    expect(() =>
      parseChimeraBundle(JSON.stringify({ schema: BUNDLE_SCHEMA, baudRate: 9600 })),
    ).toThrow(/Invalid bundle baudRate/);
  });
});
