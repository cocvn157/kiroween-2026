# Kiroween 2026 Devpost Submission Kit

## 1. Track & Eligibility Check
- **Recommended Track:** **Frankenstein** (`$5,000` track prize + eligible for `$30k` 1st / `$20k` 2nd / `$10k` 3rd Grand Prizes)
- **Deadline:** **December 4, 2026 at 2:00 PM PT**
- **Vietnam Eligibility:** Checked — Vietnam is NOT on the excluded/sanctioned countries list on `kiroween.devpost.com` (excluded jurisdictions include Quebec, Argentina, Brazil, Italy, Philippines, Russia, Belarus, UAE, and OFAC-sanctioned territories).

## 2. Mandatory Manual Steps Before Dec 4
1. **Open & Verify in Kiro IDE (`https://kiro.dev/`):**
   - Sign in to Kiro IDE to get your **Kiro User ID** (needed for Devpost & claiming the free 4,000 Kiroween Kiro credits).
   - Open `C:\Users\NITRO\.gemini\antigravity\scratch\kiroween-2026` in Kiro IDE, inspect `.kiro/specs/frankenwave-chimera/`, and verify/test a hook run inside Kiro IDE.
2. **Create Public GitHub Repository & Enable GitHub Pages:**
   - Create public repo `https://github.com/cocvn157/kiroween-2026` (ensure `.kiro/` is committed — `.gitignore` intentionally preserves `.kiro/`).
   - Push `main` branch (`git push -u origin main`).
   - On GitHub repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
   - Live URL will publish to `https://cocvn157.github.io/kiroween-2026/`.
3. **Record `< 3 min` Demo Video (YouTube / Loom / Vimeo):**
   - 0:00–0:30: Open live app, click **Suture Chimera** on preset `AIR-GAPPED RECOVERY KEY`, show glowing FSK oscilloscope & SHA-256 PCB Sigil PNG.
   - 0:30–1:15: Play cassette FSK chirps, click **Sim Noise + Drift** (`14 dB` AWGN + `+0.4%` skew) -> show clean CRC-32 + AES-GCM recovery in **Autopsy & Decode**.
   - 1:15–2:00: Select **EXECUTABLE PATCH**, suture -> export/decode `.PNG` Sigil Cartridge -> click **Energize Synth** to run the sandboxed harmonic mandala + WebAudio drone.
   - 2:00–2:45: Open **Anatomy & Bench** -> run all 6 live browser tests, then switch to Kiro IDE showing `.kiro/specs/`, `.kiro/steering/`, and `.kiro/hooks/`.

---

## 3. Copy-Paste Devpost Fields

### Project Name
`FRANKENWAVE — Chimera Crypt-Tape & Steg Sigil Studio`

### Elevator Pitch (Short Tagline)
`Stitch WebCrypto AES-256-GCM, 1970s 1200/2400 Hz FSK cassette telemetry, and 2-bit LSB PNG sigil steganography into one air-gapped browser laboratory.`

### Inspiration
Most developer secrets and time-capsules live trapped inside brittle cloud databases or plain text files. For the **Frankenstein** track, we asked: *what if we stitched modern authenticated browser cryptography onto two completely incompatible analog-era/retro organs—1970s Kansas-City cassette audio telemetry and hidden pixel steganography—so a single secret or runnable micro-patch could survive both as an eerie modem WAV tape and an occult PCB PNG image with zero servers?*

### What it does
- **Instant Dual-Organ Suture:** Takes any UTF-8 secret, `.env` backup, note, or declarative `FRANKENPATCH_V1` synth patch, optionally compresses via `deflate-raw`, seals it with `PBKDF2-SHA256` (`120k` iterations) + `AES-256-GCM`, and simultaneously binds the ciphertext into:
  1. **Organ A (FSK Acoustic Cassette):** Phase-continuous `1200/2400 Hz` FSK PCM audio (`300/600/1200 baud`) with pilot tone, `0xAA` clock-training preamble, `0x4B57` sync word, and `CRC-32`, playable live and exportable as `.WAV`.
  2. **Organ B (LSB Sigil Cartridge):** A deterministic `512×512` procedural Occult-PCB Sigil seeded from the ciphertext's `SHA-256` digest (or any user-dropped PNG), carrying up to `~192 KB` in 2-bit RGB LSBs at strict `Alpha = 255`.
- **Multi-Channel Autopsy:** Recovers specimens from clean loopback, simulated `14 dB` AWGN + `+0.4%` clock-skew audio, uploaded `.WAV` files, uploaded `.PNG` sigils, or live microphone capture via a Goertzel DFT + transition-centered timing recovery loop.
- **Zero-Eval Patch Runner & Live Browser Benchmark:** Safely runs recovered `FRANKENPATCH_V1` specs as animated harmonic mandalas + WebAudio FM drones, and includes a 6-case live browser DSP/Crypto benchmark suite.

### How we built it (Kiro Spec-Driven Workflow)
Built spec-first using `.kiro/specs/frankenwave-chimera/` (`requirements.md` in EARS notation, `design.md` wire protocols, and `tasks.md` waves), guided by `.kiro/steering/` architectural invariants (zero DOM dependencies in `src/core/`, strict `alpha = 255` Canvas LSB preservation, phase-continuous FSK bins) and `.kiro/hooks/` automated Vitest + spec-sync triggers. Frontend built in React 18 + strict TypeScript (`noUncheckedIndexedAccess: true`) + Vite 6.

### Challenges we ran into
1. **Canvas Premultiplied Alpha Corruption:** Browsers silently alter RGB values of pixels with `alpha < 255` during `Canvas2D` PNG round-trips, destroying LSB steganography. We solved this by strictly clamping `alpha = 255` across all sigil and carrier pixels and writing payload bits *after* vector/canvas rasterization.
2. **Acoustic Clock Skew & Arbitrary Silence:** Microphone and speaker paths rarely share exact sample clocks. We implemented a 12-phase coarse search combined with a transition-centered Gardner/Mueller Goertzel timing-error loop (`±0.6%` drift tolerance at `12 dB SNR`), while resetting integral drift tracking during silent frames so room noise cannot poison clock lock.

### Accomplishments that we're proud of
- Zero-dependency pure-TypeScript FSK modem and LSB steganography codecs sharing 100% parity between Node Vitest and live browser WebAudio/Canvas2D.
- 100% serverless `$0` static bundle (`~66 kB` gzipped JS) verifiable in 10 seconds with zero signup.

### What's next for FRANKENWAVE
- Optional Reed-Solomon FEC parity blocks for extreme acoustic room-echo recovery and mobile-to-laptop air-gapped QR/audio dual-transfer workflows.

### Built With
`Kiro` `TypeScript` `React` `Vite` `Vitest` `Web Crypto API` `Web Audio API` `Canvas 2D` `Goertzel DSP`
