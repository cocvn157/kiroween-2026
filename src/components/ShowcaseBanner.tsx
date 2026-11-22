import { ChevronLeft, ChevronRight, Pause, Play, Sparkles, X } from 'lucide-react';

export interface ShowcaseStepMeta {
  id: string;
  title: string;
  summary: string;
  organTag: string;
}

export const JUDGE_SHOWCASE_STEPS: readonly ShowcaseStepMeta[] = [
  {
    id: 'stitch-vault',
    organTag: 'STEP 1/5 // CRYPTO + DUAL SUTURE',
    title: 'Seal Vault into Cassette FSK & Occult PCB Sigil',
    summary:
      'PBKDF2-SHA256 (120k) + AES-256-GCM seals the recovery key, then synthesizes phase-continuous 600-baud FSK audio and a deterministic 512×512 PNG sigil.',
  },
  {
    id: 'lsb-xray',
    organTag: 'STEP 2/5 // STEGANOGRAPHY X-RAY',
    title: 'Expose Hidden 2-Bit RGB LSB Payload Pixels',
    summary:
      'LSB X-Ray amplifies the 2 least-significant bits per channel, revealing the KWST01 header & ciphertext strip while keeping Alpha=255 for lossless Canvas PNG export.',
  },
  {
    id: 'noisy-autopsy',
    organTag: 'STEP 3/5 // ACOUSTIC CHANNEL AUTOPSY',
    title: 'Survive 14 dB AWGN Noise + +0.4% Clock Skew',
    summary:
      'Simulated cassette tape drift, leading silence, and broadband noise are demodulated via Goertzel DFT + transition-centered timing recovery, passing CRC-32 & GCM.',
  },
  {
    id: 'patch-runner',
    organTag: 'STEP 4/5 // ZERO-EVAL PATCH ENGINE',
    title: 'Extract & Run Sandboxed FRANKENPATCH_V1 Synth',
    summary:
      'Decodes the TESLA COIL patch from the PNG sigil and drives a 60fps harmonic mandala + deterministic pure-TS WAV synth without eval or new Function.',
  },
  {
    id: 'live-bench',
    organTag: 'STEP 5/5 // IN-BROWSER VERIFICATION',
    title: 'Execute All 8 Live Crypto, DSP & Steg Benchmarks',
    summary:
      'Runs real end-to-end WebCrypto, 12 dB AWGN, 44.1 kHz resample, LSB capacity, and bundle/patch verification directly inside the browser.',
  },
];

interface ShowcaseBannerProps {
  stepIndex: number;
  autoPlay: boolean;
  onToggleAutoPlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

export function ShowcaseBanner({
  stepIndex,
  autoPlay,
  onToggleAutoPlay,
  onPrev,
  onNext,
  onClose,
}: ShowcaseBannerProps) {
  const step = JUDGE_SHOWCASE_STEPS[stepIndex] ?? JUDGE_SHOWCASE_STEPS[0]!;

  return (
    <aside
      className="showcase-banner"
      role="region"
      aria-label="Guided Judge Showcase Tour"
      aria-live="polite"
    >
      <div className="showcase-meta">
        <span className="panel-badge lime" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Sparkles size={11} />
          {step.organTag}
        </span>
        <strong className="showcase-title">{step.title}</strong>
        <span className="showcase-summary">{step.summary}</span>
      </div>

      <div className="showcase-controls">
        <button
          type="button"
          className="btn"
          onClick={onPrev}
          disabled={stepIndex === 0}
          aria-label="Previous showcase step"
        >
          <ChevronLeft size={13} />
          Prev
        </button>
        <button
          type="button"
          className="btn btn-amber"
          onClick={onToggleAutoPlay}
          aria-pressed={autoPlay}
        >
          {autoPlay ? <Pause size={13} /> : <Play size={13} />}
          {autoPlay ? 'Pause' : 'Auto'}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          style={{ flex: 'none' }}
          onClick={onNext}
          aria-label={stepIndex >= JUDGE_SHOWCASE_STEPS.length - 1 ? 'Finish showcase' : 'Next showcase step'}
        >
          {stepIndex >= JUDGE_SHOWCASE_STEPS.length - 1 ? 'Finish' : 'Next'}
          <ChevronRight size={13} />
        </button>
        <button
          type="button"
          className="btn"
          onClick={onClose}
          aria-label="Close showcase tour (Escape)"
          title="Close showcase (Esc)"
        >
          <X size={13} />
        </button>
      </div>
    </aside>
  );
}
