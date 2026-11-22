import { crc32 } from './crc32.ts';
import { ENVELOPE_MAGIC } from './cryptoEnvelope.ts';
import type { BaudRate } from './fskModem.ts';
import type { StitchedChimera } from './pipeline.ts';

export const BUNDLE_SCHEMA = 'FRANKENWAVE_BUNDLE_V1' as const;

export interface FrankenBundleV1 {
  schema: typeof BUNDLE_SCHEMA;
  title: string;
  createdAt: string;
  baudRate: BaudRate;
  encrypted: boolean;
  compressed: boolean;
  fingerprintHex: string;
  fskCrcHex: string;
  stegCrcHex: string;
  envelopeCrcHex: string;
  envelopeBase64: string;
}

/**
 * Encodes arbitrary bytes to standard Base64 safely in both Node and Browser without Node Buffer.
 */
export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x4000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    let part = '';
    for (let j = 0; j < slice.length; j++) {
      part += String.fromCharCode(slice[j] ?? 0);
    }
    binary += part;
  }
  return btoa(binary);
}

/**
 * Decodes standard Base64 back into Uint8Array, throwing on malformed characters.
 */
export function base64ToUint8(base64: string): Uint8Array {
  const cleaned = base64.trim();
  if (cleaned.length === 0) {
    throw new Error('Bundle envelopeBase64 is empty.');
  }
  let binary: string;
  try {
    binary = atob(cleaned);
  } catch {
    throw new Error('Bundle contains malformed Base64 envelope data.');
  }
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i) & 0xff;
  }
  return out;
}

function formatCrcHex(bytes: Uint8Array): string {
  return crc32(bytes).toString(16).padStart(8, '0').toUpperCase();
}

/**
 * Builds a shareable, integrity-checked FRANKENWAVE_BUNDLE_V1 manifest from a stitched Chimera.
 */
export function exportChimeraBundle(chimera: StitchedChimera, createdAt?: string): FrankenBundleV1 {
  return {
    schema: BUNDLE_SCHEMA,
    title: chimera.title,
    createdAt: createdAt ?? new Date().toISOString(),
    baudRate: chimera.fsk.baudRate,
    encrypted: chimera.sealed.encrypted,
    compressed: chimera.sealed.compressed,
    fingerprintHex: chimera.sealed.fingerprintHex,
    fskCrcHex: chimera.fsk.crcHex,
    stegCrcHex: chimera.steg.crcHex,
    envelopeCrcHex: formatCrcHex(chimera.sealed.envelope),
    envelopeBase64: uint8ToBase64(chimera.sealed.envelope),
  };
}

export function serializeChimeraBundle(chimera: StitchedChimera, createdAt?: string): string {
  return JSON.stringify(exportChimeraBundle(chimera, createdAt), null, 2);
}

/**
 * Validates and parses a `.franken.json` bundle, verifying schema, envelope magic, and CRC-32 checksum.
 */
export function parseChimeraBundle(jsonText: string): {
  bundle: FrankenBundleV1;
  envelope: Uint8Array;
} {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    throw new Error('Invalid JSON syntax in .franken.json bundle.');
  }
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Bundle root must be a JSON object.');
  }
  const rec = raw as Record<string, unknown>;
  if (rec.schema !== BUNDLE_SCHEMA) {
    throw new Error(`Unsupported bundle schema (expected ${BUNDLE_SCHEMA}).`);
  }
  const baud = rec.baudRate;
  if (baud !== 300 && baud !== 600 && baud !== 1200) {
    throw new Error('Invalid bundle baudRate (expected 300, 600, or 1200).');
  }
  if (typeof rec.envelopeBase64 !== 'string') {
    throw new Error('Bundle is missing envelopeBase64 payload.');
  }
  if (typeof rec.envelopeCrcHex !== 'string' || !/^[0-9A-Fa-f]{8}$/.test(rec.envelopeCrcHex)) {
    throw new Error('Bundle is missing valid 8-hex-char envelopeCrcHex.');
  }

  const envelope = base64ToUint8(rec.envelopeBase64);
  if (envelope.length < 3 || envelope[0] !== ENVELOPE_MAGIC) {
    throw new Error('Bundle envelope lacks FRANKENWAVE 0x4B magic header.');
  }

  const actualCrc = formatCrcHex(envelope);
  const expectedCrc = rec.envelopeCrcHex.toUpperCase();
  if (actualCrc !== expectedCrc) {
    throw new Error(
      `Bundle CRC-32 mismatch (expected 0x${expectedCrc}, got 0x${actualCrc}). Cartridge JSON may be corrupted.`,
    );
  }

  const bundle: FrankenBundleV1 = {
    schema: BUNDLE_SCHEMA,
    title: typeof rec.title === 'string' && rec.title.trim() ? rec.title.trim().slice(0, 48) : 'IMPORTED BUNDLE',
    createdAt: typeof rec.createdAt === 'string' ? rec.createdAt : new Date().toISOString(),
    baudRate: baud,
    encrypted: Boolean(rec.encrypted),
    compressed: Boolean(rec.compressed),
    fingerprintHex: typeof rec.fingerprintHex === 'string' ? rec.fingerprintHex : '--------',
    fskCrcHex: typeof rec.fskCrcHex === 'string' ? rec.fskCrcHex : '--------',
    stegCrcHex: typeof rec.stegCrcHex === 'string' ? rec.stegCrcHex : actualCrc,
    envelopeCrcHex: expectedCrc,
    envelopeBase64: rec.envelopeBase64.trim(),
  };

  return { bundle, envelope };
}
