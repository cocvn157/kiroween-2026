const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c >>> 0;
}

/**
 * Computes standard IEEE 802.3 CRC-32 over arbitrary bytes.
 */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    const byte = data[i] ?? 0;
    const tableVal = CRC_TABLE[(crc ^ byte) & 0xff] ?? 0;
    crc = (crc >>> 8) ^ tableVal;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Converts a Uint8Array into a standalone ArrayBuffer copy safe for WebCrypto & Blob APIs.
 */
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  return buf;
}

/**
 * Formats a byte buffer as space-separated uppercase hex for surgical telemetry readouts.
 */
export function bytesToHex(bytes: Uint8Array, maxBytes = 48): string {
  const count = Math.min(bytes.length, maxBytes);
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    parts.push((bytes[i] ?? 0).toString(16).padStart(2, '0').toUpperCase());
  }
  if (bytes.length > count) {
    parts.push(`…(+${bytes.length - count}B)`);
  }
  return parts.join(' ');
}

/**
 * Computes a SHA-256 digest using WebCrypto.
 */
export async function sha256Bytes(bytes: Uint8Array): Promise<Uint8Array> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', toArrayBuffer(bytes));
  return new Uint8Array(digest);
}
