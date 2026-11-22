# FRANKENWAVE Architecture & Coding Steering

## 1. Project Identity & Track
- **Track:** Kiroween 2026 — **Frankenstein**
- **Thesis:** Stitch four incompatible domains into a single zero-server, browser-native specimen:
  1. Modern authenticated cryptography (`Web Crypto API`: `PBKDF2-SHA256` + `AES-256-GCM`)
  2. 1970s Kansas-City / Bell-202 style FSK audio telemetry (`Web Audio API` + pure-TS Goertzel DSP modem)
  3. Lossless 2-bit/channel LSB PNG steganography (`Canvas 2D` opaque pixel-grid carrier + procedural Circuit-Occult Sigil generator)
  4. Sandboxed deterministic micro-patch evaluation (declarative audio/visual parameters executed without `eval` or arbitrary DOM scripts)

## 2. Core Architectural Invariants
1. **Zero Server / Zero API Key ($0 Operational Cost):** Every cryptographic, DSP, compression, rendering, and verification operation executes 100% locally in the browser and builds to static assets (`base: './'` for GitHub Pages).
2. **Platform-Agnostic Core (`src/core/`):** Pure TypeScript modules in `src/core/` (`crc32.ts`, `cryptoEnvelope.ts`, `fskModem.ts`, `stegCartridge.ts`, `presets.ts`, `bundle.ts`, `patchSynth.ts`, `pipeline.ts`) MUST NOT depend on React, DOM `HTMLCanvasElement`, or `AudioContext` (browser APIs live strictly in `src/core/browserMedia.ts`). Image manipulation takes `{ width, height, data: Uint8ClampedArray }`, and audio DSP takes `{ sampleRate, samples: Float32Array }`. This enables deterministic Node Vitest verification without browser mocks.
3. **Strict Alpha Channel Integrity for Steganography:** Never embed LSB payload bits into pixels with `alpha < 255`, because browser `Canvas2D` premultiplied-alpha compositing silently alters RGB values during `getImageData` / `toBlob`. Every carrier pixel modified by `encodeSteg` MUST keep `alpha = 255`.
4. **Phase-Continuous FSK Synthesis:** Both `1200 Hz` (`0` / space) and `2400 Hz` (`1` / mark) are synthesized with continuous accumulated phase across bit boundaries, at integer samples-per-bit (`48000 Hz / baudRate`), eliminating spectral splatter during playback and improving Goertzel SNR.
5. **Exact Failure Modes Over Silent Corruption:** Every envelope and carrier frame carries an IEEE 802.3 `CRC-32` checksum (plus AES-GCM authentication tag when encrypted). Any bit flip, wrong passphrase, truncated WAV, or non-carrier PNG MUST return a structured typed error rather than garbage plaintext.

## 3. Visual & UX Standards
- **Aesthetic:** Haunted Laboratory / CRT Surgical Telemetry (`#07090b` obsidian canvas, `#39ff88` phosphor lime traces, `#ffb020` Tesla amber warnings, `#ff3b5c` arterial crimson tamper alerts).
- **10-Second Time-to-Magic:** Five curated presets (`CRYPTO VAULT`, `TESLA PATCH`, `CRIMSON PATCH`, `AMBER PATCH`, `TIME CAPSULE`) plus a 1-Click 5-Step **JUDGE TOUR** allow judges to encrypt, inspect FSK spectra & LSB X-Ray bitplanes, run noisy/tamper autopsies, and execute 8 live browser checks with zero account creation.
- **Headless & Autoplay Resilience:** All WebAudio context instantiation (`createSafeAudioContext` in `browserMedia.ts`) degrades gracefully with informational UI feedback and zero uncaught console errors when audio output is blocked or absent.
- **No Unchecked Indexing:** `tsconfig.json` enforces `strict: true` and `noUncheckedIndexedAccess: true`.
