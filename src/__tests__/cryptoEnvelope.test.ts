import { describe, expect, it } from 'vitest';
import { openEnvelope, sealEnvelope } from '../core/cryptoEnvelope.ts';

describe('cryptoEnvelope (WebCrypto PBKDF2 + AES-256-GCM)', () => {
  it('round-trips UTF-8 & emoji payload with passphrase encryption and compression', async () => {
    const secret =
      'FRANKENWAVE // Kiroween 2026 💀⚡\n' +
      'Repeated payload block for compression ratio check: '.repeat(5);
    const sealed = await sealEnvelope(secret, 'suture-secret-key', { compress: true });
    expect(sealed.encrypted).toBe(true);
    expect(sealed.compressed).toBe(true);
    expect(sealed.compressedBytes).toBeLessThan(sealed.rawUtf8Bytes);

    const opened = await openEnvelope(sealed.envelope, 'suture-secret-key');
    expect(opened.plaintext).toBe(secret);
    expect(opened.encrypted).toBe(true);
    expect(opened.compressed).toBe(true);
    expect(opened.fingerprintHex).toBe(sealed.fingerprintHex);
  });

  it('rejects wrong passphrase explicitly via AES-GCM auth tag failure', async () => {
    const sealed = await sealEnvelope('sensitive-api-key-12345', 'correct-horse');
    await expect(openEnvelope(sealed.envelope, 'wrong-horse')).rejects.toThrow(/authentication failed/i);
  });

  it('rejects empty passphrase for encrypted specimens', async () => {
    const sealed = await sealEnvelope('vault-seed-phrase', 'my-pass');
    await expect(openEnvelope(sealed.envelope, '')).rejects.toThrow(/passphrase/i);
  });

  it('rejects tampered ciphertext bytes', async () => {
    const sealed = await sealEnvelope('integrity-protected-message', 'pass-123');
    const tampered = new Uint8Array(sealed.envelope);
    const lastIdx = tampered.length - 1;
    tampered[lastIdx] = (tampered[lastIdx] ?? 0) ^ 0x01;
    await expect(openEnvelope(tampered, 'pass-123')).rejects.toThrow(/authentication failed/i);
  });

  it('supports unencrypted public specimen envelopes without passphrase', async () => {
    const text = 'Public Kiroween time capsule specimen';
    const sealed = await sealEnvelope(text, '');
    expect(sealed.encrypted).toBe(false);
    const opened = await openEnvelope(sealed.envelope, '');
    expect(opened.plaintext).toBe(text);
    expect(opened.encrypted).toBe(false);
  });
});
