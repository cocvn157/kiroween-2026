# Kiroween 2026 Devpost Submission Kit

## 1. Track & Eligibility Check
- **Recommended Track:** **Frankenstein** (`$5,000` track prize + eligible for `$30k` 1st / `$20k` 2nd / `$10k` 3rd Grand Prizes)
- **Deadline:** **December 4, 2026 at 2:00 PM PT**
- **Vietnam Eligibility:** Checked — Vietnam is NOT on the excluded/sanctioned countries list on `kiroween.devpost.com` (excluded jurisdictions include Quebec, Argentina, Brazil, Italy, Philippines, Russia, Belarus, UAE, and OFAC-sanctioned territories).

## 2. Live URLs & Local Demo Assets
- **GitHub Repository:** `https://github.com/cocvn157/kiroween-2026`
- **Live App (GitHub Pages):** `https://cocvn157.github.io/kiroween-2026/`
- **Recorded HD Demo Video (local untracked):** `demo/frankenwave-demo.mp4` (`1280x720`, H.264 `yuv420p`)

## 3. Mandatory Manual Steps Before Dec 4
1. **Open & Verify in Kiro IDE (`https://kiro.dev/`):**
   - Sign in to Kiro IDE to get your **Kiro User ID** (needed for Devpost & claiming the free 4,000 Kiroween Kiro credits).
   - Open `C:\Users\NITRO\.gemini\antigravity\scratch\kiroween-2026` in Kiro IDE, inspect `.kiro/specs/frankenwave-chimera/`, and verify a hook run inside Kiro IDE.
2. **Upload `demo/frankenwave-demo.mp4` to YouTube / Loom / Vimeo** and paste the video URL into Devpost.

---

## 4. Copy-Paste Devpost Fields

### Project Name
`FRANKENWAVE — Chimera Crypt-Tape & Steg Sigil Studio`

### Elevator Pitch (Short Tagline)
`Stitch WebCrypto AES-256-GCM, 1970s 1200/2400 Hz FSK cassette telemetry, and 2-bit LSB PNG sigil steganography into one air-gapped browser laboratory.`

### Inspiration
Most developer secrets and time-capsules live trapped inside brittle cloud databases or plain text files. For the **Frankenstein** track, we asked: *what if we stitched modern authenticated browser cryptography onto two completely incompatible analog-era/retro organs—1970s Kansas-City cassette audio telemetry and hidden pixel steganography—so a single secret or runnable micro-patch could survive as an eerie modem WAV tape, an occult PCB PNG image, and a portable integrity-checked `.franken.json` cartridge with zero servers?*

### What it does
- **Instant Dual-Organ Suture:** Takes any UTF-8 secret, `.env` backup, note, or declarative `FRANKENPATCH_V1` synth patch across 5 curated specimens, optionally compresses via `deflate-raw`, seals it with `PBKDF2-SHA256` (`120k` iterations) + `AES-256-GCM`, and simultaneously binds the ciphertext into:
  1. **Organ A (FSK Acoustic Cassette + 27-Bin Spectrum):** Phase-continuous `1200/2400 Hz` FSK PCM audio (`300/600/1200 baud`) with pilot tone, `0xAA` training preamble, `0x4B57` sync word, and `CRC-32`, featuring an interactive **Goertzel 600–3200 Hz Spectrum Scrubber**, live playback, and `.WAV` export.
  2. **Organ B (LSB Sigil Cartridge + LSB X-Ray):** A deterministic `512×512` procedural Occult-PCB Sigil seeded from the ciphertext's `SHA-256` digest (or any user-dropped PNG), carrying up to `~192 KB` in 2-bit RGB LSBs at strict `Alpha = 255`, plus a live **LSB X-Ray** inspector revealing the hidden `KWST01` data ribbon.
- **Portable `.FRANKEN.JSON` & Multi-Channel Autopsy:** Exports/imports CRC-32-validated `FRANKENWAVE_BUNDLE_V1` manifests and recovers specimens from clean loopback, simulated `14 dB` AWGN + `+0.4%` clock-skew audio, uploaded `.WAV`, `.PNG`, `.FRANKEN.JSON`, or live microphone capture—plus a 1-click **Tamper Drill** proving explicit rejection on forged keys/bytes.
- **Zero-Eval Patch Runner, Synth WAV Render & 1-Click Judge Tour:** Safely runs recovered `FRANKENPATCH_V1` specs as animated 60fps harmonic mandalas + headless-safe WebAudio FM drones + deterministic pure-TS `.WAV` synth renders, backed by a **5-step 1-Click Judge Tour** and an **8-case Live Browser Benchmark Suite**.

### How we built it (Kiro Spec-Driven Workflow)
Built spec-first using `.kiro/specs/frankenwave-chimera/` (`requirements.md` EARS requirements 1–7, `design.md` binary protocols, `tasks.md` waves 1–4), guided by `.kiro/steering/` architectural invariants (zero-DOM pure core in `src/core/`, strict `alpha = 255` Canvas LSB preservation, phase-continuous FSK synthesis, headless-safe WebAudio) and `.kiro/hooks/` automated Vitest + spec-sync triggers. Frontend built in React 18 + strict TypeScript (`noUncheckedIndexedAccess: true`) + Vite 6 + `33/33` Vitest unit & integration tests.

### Challenges we ran into
1. **Canvas Premultiplied Alpha Corruption:** Browsers silently alter RGB values of pixels with `alpha < 255` during `Canvas2D` PNG round-trips, destroying LSB steganography. We solved this by strictly clamping `alpha = 255` across all sigil and carrier pixels and writing payload bits *after* vector/canvas rasterization, then verified it visually via our non-destructive LSB X-Ray bitplane mode.
2. **Acoustic Clock Skew & Arbitrary Silence:** Microphone and speaker paths rarely share exact sample clocks. We implemented a 12-phase coarse search combined with a transition-centered Gardner/Mueller Goertzel timing-error loop (`±0.6%` drift tolerance at `12 dB SNR`), while resetting integral drift tracking during silent frames so room noise cannot poison clock lock.

### Accomplishments that we're proud of
- Zero-dependency pure-TypeScript FSK modem, LSB steganography, bundle manifest, and FM synth WAV codecs sharing 100% parity between Node Vitest (`33/33` passing) and live browser WebAudio/Canvas2D (`8/8` live browser checks passing).
- 100% serverless `$0` static bundle (`~73.5 kB` gzipped JS) verifiable in 10 seconds with zero signup, full keyboard shortcuts, and 1-click Judge Tour.

### What's next for FRANKENWAVE
- Optional Reed-Solomon FEC parity blocks for extreme acoustic room-echo recovery and mobile-to-laptop air-gapped QR/audio dual-transfer workflows.

### Built With
`Kiro` `TypeScript` `React` `Vite` `Vitest` `Web Crypto API` `Web Audio API` `Canvas 2D` `Goertzel DSP`
