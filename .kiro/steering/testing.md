# FRANKENWAVE Testing & Verification Steering

## Mandatory Verification Gate
Before any feature or PR is considered complete, all three commands MUST pass cleanly:
1. `npx.cmd tsc --noEmit` (zero TypeScript errors under strict mode + `noUncheckedIndexedAccess`)
2. `npm.cmd test` (all Vitest suites green with zero skipped assertions)
3. `npm.cmd run build` (clean Vite static bundle in `dist/`)

## Core Invariants Covered by Automated Tests
- **CRC-32 (`crc32.test.ts`):** Matches standard IEEE 802.3 test vector `"123456789" -> 0xCBF43926`.
- **Crypto Envelope (`cryptoEnvelope.test.ts`):**
  - Round-trip AES-256-GCM encryption + optional deflate compression with UTF-8 / emoji / JSON payloads.
  - Wrong passphrase fails explicitly with an authentication error (never returns corrupted data).
  - Tampered ciphertext byte fails explicitly.
  - Unencrypted ("public specimen") envelope mode cleanly round-trips with magic + version flags preserved.
- **FSK Acoustic Modem (`fskModem.test.ts`):**
  - Exact clean loopback across `300`, `600`, and `1200` baud.
  - WAV RIFF PCM16 mux/demux round-trip produces matching decoded payload.
  - Leading/trailing arbitrary silence offsets (`+37` samples, `+2117` samples) lock cleanly via pilot + preamble + `0x4B57` sync frame.
  - Additive white Gaussian noise (`SNR ~ 12 dB`) decodes bit-exactly.
  - Sample-rate clock drift (`0.994x` and `1.006x` linear resample) recovers clock and passes CRC-32.
  - Corrupted frame bit-flip is rejected by CRC-32.
- **LSB Sigil Steganography (`stegCartridge.test.ts`):**
  - Procedural `512x512` sigil generation yields `alpha === 255` on every pixel.
  - Encode/decode round-trips payloads up to multi-kilobyte size bit-exactly.
  - Capacity guard rejects oversized payloads gracefully without buffer overflow.
  - Custom non-opaque carrier regions get normalized to `alpha = 255` before LSB write so Canvas round-trips remain lossless.
- **End-to-End Pipeline (`pipeline.test.ts`):**
  - Full specimen stitch -> FSK WAV + Sigil PNG -> independent decode from both organs yields identical plaintext & verified SHA-256 fingerprint.
