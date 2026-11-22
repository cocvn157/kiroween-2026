# Technical Design Document — FRANKENWAVE

## 1. System Architecture
```
[Plaintext UTF-8 / Patch JSON]
        │
        ▼ (Optional Deflate-Raw if smaller)
[Crypto Envelope (cryptoEnvelope.ts)] ── PBKDF2(120k, SHA-256) + AES-256-GCM
        │
        ├──► Organ A: [FSK Cassette Modem (fskModem.ts)]
        │       ├── Frame: [Pilot 2400Hz] [0xAA, 0xAA] [0x4B57] [Ver/Baud] [Len u16] [Payload] [CRC32 u32]
        │       ├── Output: Float32Array @ 48000 Hz + RIFF WAVE PCM16 Blob
        │       └── Decode: Coarse Energy Scan -> Phase Offset Search -> Goertzel + Early-Late Clock Recovery -> CRC32
        │
        └──► Organ B: [LSB Sigil Cartridge (stegCartridge.ts)]
                ├── Art: 512x512 Deterministic Occult-PCB Sigil seeded by SHA-256(envelope)
                ├── Frame: ["KWST01" 6B] [Len u32] [CRC32 u32] [Payload]
                ├── Embed: 2 LSBs per R, G, B channel (6 bits/px), Alpha forced to 255
                └── Decode: Read header pixels -> extract Len bytes -> verify CRC32
```

## 2. Binary Wire Specifications

### 2.1 Crypto Envelope (`src/core/cryptoEnvelope.ts`)
| Offset | Size | Field | Notes |
|---|---|---|---|
| `0` | `1 B` | Magic | `0x4B` (`'K'`) |
| `1` | `1 B` | Flags | `bit 0`: `1 = AES-256-GCM encrypted`; `bit 1`: `1 = deflate-raw compressed` |
| `2` | `16 B` | Salt | Random PBKDF2 salt (present only when `bit 0 = 1`) |
| `18` | `12 B` | IV | Random AES-GCM 96-bit nonce (present only when `bit 0 = 1`) |
| `30` (or `2`) | `N B` | Body | Ciphertext+GCM tag (when encrypted) or raw/deflated UTF-8 bytes |

### 2.2 FSK Acoustic Frame (`src/core/fskModem.ts`)
- **Sample Rate:** `48,000 Hz`
- **Supported Baud Rates:**
  - `300 baud` -> `160` samples/bit (`f0 = 1200 Hz` = 4 cycles, `f1 = 2400 Hz` = 8 cycles)
  - `600 baud` -> `80` samples/bit (`f0 = 1200 Hz` = 2 cycles, `f1 = 2400 Hz` = 4 cycles)
  - `1200 baud` -> `40` samples/bit (`f0 = 1200 Hz` = 1 cycle, `f1 = 2400 Hz` = 2 cycles)
- **Preamble & Sync:**
  1. `100 ms` silence guard (`4800` zero samples)
  2. `120 ms` `2400 Hz` AGC/carrier pilot tone
  3. `16`-bit alternating training sequence `0xAA, 0xAA` (`10101010 10101010` MSB-first)
  4. `16`-bit sync marker `0x4B, 0x57` (`"KW"`)
- **Header & Payload (MSB-first bitstream):**
  - `1 B` Frame Version (`0x01`)
  - `2 B` Payload length `uint16 BE` (supports up to `65535` bytes; typical vault specimens `< 2048` bytes)
  - `N B` Envelope bytes
  - `4 B` IEEE 802.3 `CRC-32` computed over `[Version, LenHi, LenLo, ...Envelope]`
  - `80 ms` trailing `1200 Hz` tail-out + `60 ms` silence

#### Demodulation Algorithm (Deterministic + Drift-Tolerant)
1. **Windowed Goertzel Energy:** Compute normalized power $P_{1200}$ and $P_{2400}$ per bit window using exact Goertzel recurrence $s[n] = x[n] + 2\cos(\omega) s[n-1] - s[n-2]$. Bit metric $d = (P_{2400} - P_{1200}) / (P_{2400} + P_{1200} + \epsilon) \in [-1, +1]$.
2. **Coarse Carrier Detection + Phase Lock:** Scan sliding windows across active signal regions to locate `0xAA 0xAA` transitions; refine sample phase offset $\phi \in [0, N_{\text{spb}}-1]$ by maximizing $|d|$ across the alternating training bits.
3. **Sync Hunt & Early-Late Tracking:** Slide bit stream until exact `0x4B57` sync word aligns (scanning across ±1 sample step corrections and half-bit early/late metric bias to absorb up to `±1.5%` sample-rate clock skew).
4. **Integrity Gate:** Read header length, extract payload + 4-byte CRC-32, reject immediately if length exceeds remaining bits or CRC-32 mismatches.

### 2.3 Steganographic PNG Cartridge (`src/core/stegCartridge.ts`)
- **Pixel Grid:** `RGBA Uint8ClampedArray` (`512x512` default = `262,144` pixels -> `196,608` bytes max capacity at 6 bits/px).
- **Header + Body Stream:**
  - `6 B` Magic: `"KWST01"` (`[0x4B, 0x57, 0x53, 0x54, 0x30, 0x31]`)
  - `4 B` Payload Length `uint32 BE`
  - `4 B` IEEE 802.3 `CRC-32` of payload
  - `N B` Envelope bytes
- **Embedding Order:** Sequential pixel scan (`idx = 0..width*height-1`), 3 channels (`R, G, B`) per pixel, 2 bits per channel (`bits 7..6`, `5..4`, `3..2` packed MSB-first across 4 triplets = 3 bytes per 4 pixels). Alpha channel forced to `255` on every written pixel (and across entire generated sigil) so Canvas PNG round-trips remain bit-exact.

## 3. Sandboxed Micro-Patch Schema (`FRANKENPATCH_V1`) & Deterministic Synth
Specimens carrying JSON with `"kind": "FRANKENPATCH_V1"` safely configure a real-time procedural visual harmonic + WebAudio drone synthesizer using numeric parameters (`carrierHz`, `modHz`, `symmetry`, `palette`, `pulseBpm`, `label`) validated through TypeScript type guards (`parseFrankenPatch`) — zero dynamic code execution.
- **Pure-TS Synth Render (`src/core/patchSynth.ts`):** `renderFrankenPatchPcm` deterministically generates FM-modulated harmonic sine + overtone samples (`pulseBpm` amplitude envelope + cosine fade-in/out, peak `<= 0.95`) serialized to RIFF/WAVE PCM16 via `encodeWavPcm16`.

## 4. Shareable Cartridge Bundle (`FRANKENWAVE_BUNDLE_V1`, `src/core/bundle.ts`)
- **Fields:** `schema` (`"FRANKENWAVE_BUNDLE_V1"`), `title`, `createdAt`, `baudRate` (`300 | 600 | 1200`), `encrypted`, `compressed`, `fingerprintHex`, `fskCrcHex`, `stegCrcHex`, `envelopeCrcHex`, `envelopeBase64`.
- **Validation Gate:** `parseChimeraBundle` verifies schema, baud rate, Base64 decoding, `0x4B` envelope magic byte, and IEEE 802.3 `CRC-32` match against `envelopeCrcHex` before passing to `openEnvelope`.

## 5. Multi-Bin Goertzel Spectrum & Non-Destructive LSB X-Ray
- **27-Bin Spectrum (`computeFskSpectrum` in `src/core/fskModem.ts`):** Evaluates `sqrt(goertzelPower)` from `600 Hz` to `3200 Hz` (`100 Hz` step, aligning exact bins on `1200 Hz` Space and `2400 Hz` Mark) at the active playback/scrub window.
- **LSB X-Ray (`src/components/SigilCartridgeView.tsx`):** Amplifies `(channel & 0x03) * 85` into a separate display `ImageData` buffer (`alpha = 255`), preserving `chimera.steg.grid` unaltered for lossless PNG export.
- **Headless-Safe WebAudio (`src/core/browserMedia.ts`):** `createSafeAudioContext` wraps `AudioContext` instantiation and `resume()` safely so automated/muted environments never raise uncaught exceptions.
