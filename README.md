# FRANKENWAVE — Chimera Crypt-Tape & Steg Sigil Studio

> **Kiroween 2026 Submission — Frankenstein Track**
> *Stitching incompatible technologies into one living, zero-server specimen.*

![FRANKENWAVE Workspace Preview](./screenshot.png)

## Live Demo
- **GitHub Pages:** `https://cocvn157.github.io/kiroween-2026/` *(100% static client-side, `$0` server cost)*

## What FRANKENWAVE Stitches Together
FRANKENWAVE combines **four unrelated engineering worlds** into a cohesive, air-gapped browser laboratory running at **\$0 operational cost** (zero backend, zero database, zero paid API keys):

1. **Modern Authenticated Cryptography (`Web Crypto API` + `.franken.json` Bundles)** — `PBKDF2-SHA256` (`120,000` iterations) + `AES-256-GCM` authenticated encryption + optional `deflate-raw` compression + CRC-32-verified shareable `FRANKENWAVE_BUNDLE_V1` JSON cartridges.
2. **1970s Acoustic Cassette Telemetry (`Web Audio API` + Pure-TS Goertzel DSP)** — Phase-continuous `1200 Hz` / `2400 Hz` FSK modulation (`300 / 600 / 1200 baud`) serialized to `RIFF/WAVE PCM16`, analyzed live via a **27-bin Goertzel Spectrum Scrubber (`600–3200 Hz`)**, and decoded by a transition-centered Gardner/Mueller timing recovery loop (`±0.6%` clock-skew resilient at `12 dB` SNR) with IEEE 802.3 `CRC-32`.
3. **Opaque 2-Bit/Channel LSB Image Steganography (`Canvas 2D` + LSB X-Ray)** — Deterministically generates a `512×512` Cyberpunk-Occult PCB Sigil seeded from the envelope's `SHA-256` digest (or accepts any custom PNG carrier), embedding up to `~192 KB` across R/G/B LSBs with `Alpha = 255` invariance, plus a live non-destructive **LSB X-Ray Bitplane Inspector** exposing hidden `KWST01` pixel bands.
4. **Zero-Eval Sandboxed Micro-Patch Synth (`FRANKENPATCH_V1`)** — Validated declarative patch presets (`TESLA PATCH`, `CRIMSON PATCH`, `AMBER PATCH`) safely drive a 60fps harmonic Canvas2D mandala, headless-safe WebAudio FM drone, and deterministic pure-TS **4s `.WAV` Synth Render**.

## Highlighted Features
- **5 Curated Specimen Presets:** `CRYPTO VAULT`, `TESLA PATCH` (`phosphor`), `CRIMSON PATCH` (`crimson`), `AMBER PATCH` (`amber`), and `TIME CAPSULE`.
- **1-Click 5-Step Judge Tour (`JUDGE TOUR` / Shortcut `J`):** Walks step-by-step through Dual Suture, LSB X-Ray inspection, `14 dB` AWGN + `+0.4%` skew recovery, `FRANKENPATCH_V1` mandala & synth, and the **8-Case Live In-Browser Benchmark Suite**.
- **Forensic Autopsy & Tamper Drill:** Recover from clean loopback, simulated acoustic noise/drift, `.WAV`, `.PNG`, `.FRANKEN.JSON`, or live microphone capture, test wrong-key/tamper rejection via **Tamper Drill**, and send recovered payloads back to the Operating Table.
- **Keyboard Accessible:** Semantic ARIA roles (`tablist`, `tab`, `slider`, `alert`, `dialog`), `:focus-visible` indicators, and global shortcuts (`1/2/3`, `Ctrl+Enter`, `Space`, `←/→`, `J`, `?`, `Esc`).

## `.kiro/` Spec-Driven Architecture
This repository maintains its complete Kiro spec-driven paper trail inside `.kiro/`:
- `.kiro/specs/frankenwave-chimera/requirements.md` — EARS functional requirements (`Requirements 1–7`)
- `.kiro/specs/frankenwave-chimera/design.md` — Binary wire specs, FSK DSP math, LSB frame layout, `FRANKENWAVE_BUNDLE_V1`, and `FRANKENPATCH_V1` synth design
- `.kiro/specs/frankenwave-chimera/tasks.md` — Sequenced implementation waves (`Wave 1–4`)
- `.kiro/steering/architecture.md` & `.kiro/steering/testing.md` — Zero-DOM core purity, alpha-255, headless audio resilience & test invariants
- `.kiro/hooks/test-on-codec-edit.kiro.hook` & `.kiro/hooks/spec-sync-check.kiro.hook` — Automated test & spec-sync hooks

## Local Development & Verification
```powershell
npm.cmd install
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

Verified test suite: **33/33 Vitest unit & integration tests passing** across 7 test modules (`crc32`, `cryptoEnvelope`, `fskModem`, `stegCartridge`, `bundle`, `patchSynth`, `pipeline`).

## Static Deployment (GitHub Pages)
Included `.github/workflows/deploy.yml` builds `dist/` (`base: './'`) and deploys automatically when pushed to `main` on a public GitHub repository with **Settings → Pages → Source: GitHub Actions**.
