# Requirements Document — FRANKENWAVE Chimera Studio

## Introduction
FRANKENWAVE is a browser-native, zero-backend security and media laboratory built for the **Kiroween 2026 Hackathon (Frankenstein Track)**. It stitches together authenticated browser cryptography, 1970s-style audio-frequency-shift-keying (FSK) cassette telemetry, lossless LSB image steganography, and sandboxed micro-patch execution into one cohesive air-gapped vault.

## Functional Requirements (EARS Format)

### Requirement 1: Authenticated Specimen Envelope
- **1.1** WHEN a user provides UTF-8 plaintext (notes, secrets, JSON, or micro-patch definitions) and an optional passphrase, THE SYSTEM SHALL serialize a versioned binary envelope containing magic byte `0x4B`, flags (encryption + compression), optional PBKDF2 salt & AES-GCM IV, and ciphertext or UTF-8 body.
- **1.2** WHEN a non-empty passphrase is supplied, THE SYSTEM SHALL derive a 256-bit `AES-GCM` key via `PBKDF2` (`SHA-256`, `120,000` iterations, `16`-byte random salt) and encrypt with a fresh `12`-byte random IV.
- **1.3** WHEN decryption is attempted with an incorrect passphrase or modified ciphertext byte, THE SYSTEM SHALL fail explicitly with a descriptive authentication error and SHALL NOT emit partial or corrupted plaintext.

### Requirement 2: Dual-Organ Chimera Synthesis (FSK Audio + LSB Sigil PNG)
- **2.1** WHEN the user clicks **Suture Chimera**, THE SYSTEM SHALL synchronously encode the binary envelope into BOTH:
  - Organ A: A phase-continuous FSK cassette audio buffer (`48000 Hz` PCM, `1200 Hz` = `0`, `2400 Hz` = `1`) wrapped with a `2400 Hz` pilot tone, `0xAA 0xAA` alternating clock training preamble, `0x4B57` sync word, length header, and IEEE 802.3 `CRC-32` trailer.
  - Organ B: A procedural `512x512` opaque PNG Circuit-Tarot Sigil seeded deterministically from the envelope's `SHA-256` digest, with the framed envelope spliced into the 2 least significant bits of the `R, G, B` channels (`6 bits/pixel`) while keeping `Alpha = 255`.
- **2.2** WHEN the user selects a baud rate (`300`, `600`, or `1200` baud), THE SYSTEM SHALL synthesize exact integer samples-per-bit (`160`, `80`, or `40` at `48000 Hz`) and preserve waveform continuity across bit transitions.
- **2.3** WHEN the user drops a custom opaque PNG carrier (`>= 128x128`), THE SYSTEM SHALL verify capacity before encoding and embed the frame without distorting visible pixel structure beyond ±3 levels per RGB channel.

### Requirement 3: Multi-Channel Autopsy & Demodulation
- **3.1** WHEN the user feeds audio via **Direct Loopback**, **Simulated Acoustic Noise/Drift**, **Uploaded `.WAV` File**, or **Live Microphone Capture**, THE SYSTEM SHALL lock onto the pilot/preamble phase offset using Goertzel DFT energy discrimination (`E(2400) - E(1200)`), track fractional bit-clock drift via early-late timing adjustment, verify `CRC-32`, and pass the recovered envelope to decryption.
- **3.2** WHEN the user uploads or transfers a carrier `.PNG` image, THE SYSTEM SHALL extract the `KWST01` LSB carrier header, validate `CRC-32`, and decrypt the embedded payload.
- **3.3** WHEN the decoded specimen uses the `FRANKENPATCH_V1` declarative micro-patch schema, THE SYSTEM SHALL offer a sandboxed WebAudio + Canvas2D preview renderer without using `eval` or `new Function`.

### Requirement 4: Zero-Signup 10-Second Interactive Experience
- **4.1** WHEN the application boots, THE SYSTEM SHALL automatically load and suture a default specimen so the oscilloscope trace, carrier spectrum, and sigil cartridge are immediately alive and testable in `<1 second`.
- **4.2** THE SYSTEM SHALL include a dedicated **Anatomy & Benchmark** view allowing judges to execute deterministic loopback, noise, drift, tamper-detection, and steg-capacity benchmarks in-browser.
