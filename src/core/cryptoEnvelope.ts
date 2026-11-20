import { sha256Bytes, toArrayBuffer } from './crc32.ts';

export const ENVELOPE_MAGIC = 0x4b; // 'K'
export const FLAG_ENCRYPTED = 0x01;
export const FLAG_COMPRESSED = 0x02;
const PBKDF2_ITERATIONS = 120_000;
const SALT_LEN = 16;
const IV_LEN = 12;

export interface SealedEnvelopeResult {
  envelope: Uint8Array;
  encrypted: boolean;
  compressed: boolean;
  rawUtf8Bytes: number;
  compressedBytes: number;
  fingerprintHex: string;
}

export interface OpenedEnvelopeResult {
  plaintext: string;
  encrypted: boolean;
  compressed: boolean;
  envelopeBytes: number;
  fingerprintHex: string;
}

async function compressDeflateRaw(input: Uint8Array): Promise<Uint8Array | null> {
  if (typeof globalThis.CompressionStream === 'undefined') {
    return null;
  }
  try {
    const stream = new Blob([toArrayBuffer(input)])
      .stream()
      .pipeThrough(new globalThis.CompressionStream('deflate-raw'));
    const ab = await new Response(stream).arrayBuffer();
    return new Uint8Array(ab);
  } catch {
    return null;
  }
}

async function decompressDeflateRaw(input: Uint8Array): Promise<Uint8Array> {
  if (typeof globalThis.DecompressionStream === 'undefined') {
    throw new Error('Browser lacks DecompressionStream support for compressed specimen.');
  }
  const stream = new Blob([toArrayBuffer(input)])
    .stream()
    .pipeThrough(new globalThis.DecompressionStream('deflate-raw'));
  const ab = await new Response(stream).arrayBuffer();
  return new Uint8Array(ab);
}

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return globalThis.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function digestToShortHex(digest: Uint8Array): string {
  const parts: string[] = [];
  for (let i = 0; i < Math.min(8, digest.length); i++) {
    parts.push((digest[i] ?? 0).toString(16).padStart(2, '0').toUpperCase());
  }
  return parts.join('');
}

/**
 * Serializes UTF-8 plaintext into an optionally compressed, optionally AES-256-GCM encrypted envelope.
 */
export async function sealEnvelope(
  plaintext: string,
  passphrase: string,
  options: { compress?: boolean } = {},
): Promise<SealedEnvelopeResult> {
  const rawBytes = new TextEncoder().encode(plaintext);
  const shouldCompress = options.compress ?? true;
  let body: Uint8Array = rawBytes;
  let compressed = false;

  if (shouldCompress && rawBytes.length >= 24) {
    const deflated = await compressDeflateRaw(rawBytes);
    if (deflated !== null && deflated.length < rawBytes.length) {
      body = deflated;
      compressed = true;
    }
  }

  const encrypted = passphrase.length > 0;
  let flags = 0;
  if (encrypted) flags |= FLAG_ENCRYPTED;
  if (compressed) flags |= FLAG_COMPRESSED;

  let envelope: Uint8Array;
  if (encrypted) {
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_LEN));
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LEN));
    const key = await deriveAesKey(passphrase, salt);
    const cipherBuf = await globalThis.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(body),
    );
    const cipher = new Uint8Array(cipherBuf);
    envelope = new Uint8Array(2 + SALT_LEN + IV_LEN + cipher.length);
    envelope[0] = ENVELOPE_MAGIC;
    envelope[1] = flags;
    envelope.set(salt, 2);
    envelope.set(iv, 2 + SALT_LEN);
    envelope.set(cipher, 2 + SALT_LEN + IV_LEN);
  } else {
    envelope = new Uint8Array(2 + body.length);
    envelope[0] = ENVELOPE_MAGIC;
    envelope[1] = flags;
    envelope.set(body, 2);
  }

  const digest = await sha256Bytes(envelope);
  return {
    envelope,
    encrypted,
    compressed,
    rawUtf8Bytes: rawBytes.length,
    compressedBytes: body.length,
    fingerprintHex: digestToShortHex(digest),
  };
}

/**
 * Opens a binary envelope, verifying AES-GCM auth tag when encrypted and decompressing if flagged.
 */
export async function openEnvelope(
  envelope: Uint8Array,
  passphrase: string,
): Promise<OpenedEnvelopeResult> {
  if (envelope.length < 3 || envelope[0] !== ENVELOPE_MAGIC) {
    throw new Error('Invalid specimen envelope header (missing 0x4B magic byte).');
  }

  const flags = envelope[1] ?? 0;
  const encrypted = (flags & FLAG_ENCRYPTED) !== 0;
  const compressed = (flags & FLAG_COMPRESSED) !== 0;

  let body: Uint8Array;
  if (encrypted) {
    const minLen = 2 + SALT_LEN + IV_LEN + 16; // 16B GCM auth tag minimum
    if (envelope.length < minLen) {
      throw new Error('Encrypted envelope is truncated.');
    }
    if (passphrase.length === 0) {
      throw new Error('Specimen is AES-256-GCM sealed. Enter the passphrase to unlock.');
    }
    const salt = envelope.slice(2, 2 + SALT_LEN);
    const iv = envelope.slice(2 + SALT_LEN, 2 + SALT_LEN + IV_LEN);
    const cipher = envelope.slice(2 + SALT_LEN + IV_LEN);
    const key = await deriveAesKey(passphrase, salt);
    try {
      const plainBuf = await globalThis.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: toArrayBuffer(iv) },
        key,
        toArrayBuffer(cipher),
      );
      body = new Uint8Array(plainBuf);
    } catch {
      throw new Error('AES-256-GCM authentication failed: wrong passphrase or tampered carrier.');
    }
  } else {
    body = envelope.slice(2);
  }

  const rawBytes = compressed ? await decompressDeflateRaw(body) : body;
  const plaintext = new TextDecoder('utf-8', { fatal: true }).decode(rawBytes);
  const digest = await sha256Bytes(envelope);

  return {
    plaintext,
    encrypted,
    compressed,
    envelopeBytes: envelope.length,
    fingerprintHex: digestToShortHex(digest),
  };
}
