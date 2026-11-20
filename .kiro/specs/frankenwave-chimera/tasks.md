# Implementation Tasks — FRANKENWAVE

## Wave 1: Pure Core Codecs & Integrity Primitives
- [x] **1.1** Implement IEEE 802.3 `CRC-32` table lookup and hex telemetry formatter (`src/core/crc32.ts`).
- [x] **1.2** Implement `Web Crypto` envelope (`PBKDF2-SHA256` 120k iterations + `AES-256-GCM` + optional `deflate-raw`) (`src/core/cryptoEnvelope.ts`).
- [x] **1.3** Implement phase-continuous FSK audio synthesizer, WAV RIFF PCM16 mux/demux, and Goertzel + Early-Late clock-recovery demodulator (`src/core/fskModem.ts`).
- [x] **1.4** Implement opaque 2-bit/channel LSB steganographic encoder/decoder + SHA-256-seeded procedural Occult-PCB Sigil generator (`src/core/stegCartridge.ts`).
- [x] **1.5** Implement instant specimen presets, sandboxed `FRANKENPATCH_V1` parser, and end-to-end Chimera stitch/autopsy pipeline with channel noise/drift simulator (`src/core/presets.ts`, `src/core/pipeline.ts`).

## Wave 2: Verification & Robustness Test Suite
- [x] **2.1** Unit tests for `CRC-32` standard vector and bit corruption detection (`crc32.test.ts`).
- [x] **2.2** Unit tests for `AES-GCM` encryption, compression flag, wrong-passphrase rejection, and ciphertext tamper detection (`cryptoEnvelope.test.ts`).
- [x] **2.3** Unit tests for `FSK` at `300/600/1200` baud, WAV round-trip, arbitrary leading silence, AWGN noise (`SNR ~ 12 dB`), `±0.6%` clock skew resampling, and CRC rejection (`fskModem.test.ts`).
- [x] **2.4** Unit tests for `LSB Steg` alpha-255 invariance, capacity overflow protection, and procedural sigil generation (`stegCartridge.test.ts`).
- [x] **2.5** End-to-end Chimera pipeline round-trip tests (`pipeline.test.ts`).

## Wave 3: Spooky Surgical Laboratory UI & Static Deployment
- [x] **3.1** Build Obsidian CRT theme CSS tokens, custom SVG header, and 3-mode navigation (`HeaderBar.tsx`, `index.css`).
- [x] **3.2** Build 60fps Phosphor Oscilloscope & live carrier spectrum canvas (`OscilloscopeCanvas.tsx`).
- [x] **3.3** Build interactive 512x512 Sigil Cartridge viewer with drag-and-drop PNG carrier upload & export (`SigilCartridgeView.tsx`).
- [x] **3.4** Build `Stitch & Encode`, `Autopsy & Decode` (WAV, Mic, Loopback, PNG, Patch Runner), and `Anatomy & Benchmark` workspaces.
- [x] **3.5** Add GitHub Pages workflow (`.github/workflows/deploy.yml`), verify `tsc`, `vitest`, `vite build`, and capture `1280x720` headless Edge screenshot.
