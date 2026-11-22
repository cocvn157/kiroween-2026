import { toArrayBuffer } from './crc32.ts';
import type { FrankenPatchV1 } from './presets.ts';
import type { PixelGrid } from './stegCartridge.ts';

export interface PlaybackHandle {
  stop: () => void;
}

function createSafeAudioContext(sampleRate?: number): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  try {
    const ctx = sampleRate ? new AudioCtx({ sampleRate }) : new AudioCtx();
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {
        // Ignore headless/autoplay suspension without emitting console errors
      });
    }
    return ctx;
  } catch {
    return null;
  }
}

/**
 * Plays mono Float32Array PCM samples through Web Audio API with progress callback and headless-safe cleanup.
 */
export function playPcmAudio(
  samples: Float32Array,
  sampleRate: number,
  onProgress: (fraction: number) => void,
  onEnded: () => void,
  onBlocked?: (reason: string) => void,
): PlaybackHandle {
  const ctx = createSafeAudioContext(sampleRate);
  if (!ctx || samples.length === 0) {
    onBlocked?.('WebAudio output device unavailable in this environment (use Export .WAV instead).');
    onEnded();
    return { stop: () => {} };
  }

  let stopped = false;
  let rafId = 0;
  try {
    const buffer = ctx.createBuffer(1, samples.length, sampleRate);
    buffer.getChannelData(0).set(samples);

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.value = 0.42;

    source.connect(gain);
    gain.connect(ctx.destination);

    const durationMs = (samples.length / sampleRate) * 1000;
    const startedAt = performance.now();

    const rafTick = () => {
      if (stopped) return;
      const elapsed = performance.now() - startedAt;
      const frac = Math.min(1, elapsed / Math.max(1, durationMs));
      onProgress(frac);
      if (frac < 1) {
        rafId = requestAnimationFrame(rafTick);
      }
    };

    source.onended = () => {
      if (!stopped) {
        stopped = true;
        cancelAnimationFrame(rafId);
        onProgress(1);
        onEnded();
        void ctx.close().catch(() => {});
      }
    };

    source.start();
    rafId = requestAnimationFrame(rafTick);

    return {
      stop: () => {
        if (stopped) return;
        stopped = true;
        cancelAnimationFrame(rafId);
        try {
          source.stop();
        } catch {
          // already ended
        }
        void ctx.close().catch(() => {});
        onEnded();
      },
    };
  } catch {
    void ctx.close().catch(() => {});
    onBlocked?.('Audio playback blocked by browser policy.');
    onEnded();
    return { stop: () => {} };
  }
}

/**
 * Starts a sandboxed FM harmonic drone from a validated FRANKENPATCH_V1 definition.
 */
export function startPatchDrone(
  patch: FrankenPatchV1,
  onStopped?: () => void,
  onBlocked?: (reason: string) => void,
): PlaybackHandle {
  const ctx = createSafeAudioContext();
  if (!ctx) {
    onBlocked?.('WebAudio synth output unavailable in this browser context (use Export Synth .WAV).');
    onStopped?.();
    return { stop: () => {} };
  }

  let stopped = false;
  try {
    const carrier = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const master = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    carrier.type = 'sawtooth';
    carrier.frequency.value = patch.carrierHz;

    lfo.type = 'sine';
    lfo.frequency.value = patch.modHz;
    lfoGain.gain.value = patch.carrierHz * 0.12;

    filter.type = 'lowpass';
    filter.frequency.value = patch.carrierHz * 4;

    master.gain.value = 0.08;

    lfo.connect(lfoGain);
    lfoGain.connect(carrier.frequency);
    carrier.connect(filter);
    filter.connect(master);
    master.connect(ctx.destination);

    carrier.start();
    lfo.start();

    return {
      stop: () => {
        if (stopped) return;
        stopped = true;
        try {
          carrier.stop();
          lfo.stop();
        } catch {
          // ignore
        }
        void ctx.close().catch(() => {});
        onStopped?.();
      },
    };
  } catch {
    void ctx.close().catch(() => {});
    onBlocked?.('Synth playback blocked by browser audio policy.');
    onStopped?.();
    return { stop: () => {} };
  }
}

export interface MicSession {
  stop: () => Promise<{ samples: Float32Array; sampleRate: number }>;
}

/**
 * Captures raw mono microphone audio with browser voice-processing disabled to preserve FSK tones.
 */
export async function startMicCapture(): Promise<MicSession> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Browser microphone capture API is unavailable in this context.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });

  const ctx = createSafeAudioContext();
  if (!ctx) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error('WebAudio context could not be initialized for microphone capture.');
  }
  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];

  processor.onaudioprocess = (ev) => {
    const input = ev.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(input));
  };

  source.connect(processor);
  processor.connect(ctx.destination);

  return {
    stop: async () => {
      processor.disconnect();
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      const sampleRate = ctx.sampleRate;
      await ctx.close();

      let totalLen = 0;
      for (const c of chunks) totalLen += c.length;
      const merged = new Float32Array(totalLen);
      let offset = 0;
      for (const c of chunks) {
        merged.set(c, offset);
        offset += c.length;
      }
      return { samples: merged, sampleRate };
    },
  };
}

/**
 * Renders a PixelGrid to an offscreen canvas and encodes a lossless PNG Blob.
 */
export async function pixelGridToPngBlob(grid: PixelGrid): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = grid.width;
  canvas.height = grid.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Failed to acquire Canvas 2D context for PNG export.');
  }
  const imgData = new ImageData(new Uint8ClampedArray(grid.data), grid.width, grid.height);
  ctx.putImageData(imgData, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas PNG serialization failed.'));
      } else {
        resolve(blob);
      }
    }, 'image/png');
  });
}

/**
 * Decodes an uploaded PNG/image File into an exact PixelGrid without alpha premultiplication loss.
 */
export async function imageFileToPixelGrid(
  file: File,
  targetSquareSize?: number,
): Promise<PixelGrid> {
  const bitmap = await createImageBitmap(file, {
    colorSpaceConversion: 'none',
    premultiplyAlpha: 'none',
  });
  const w = targetSquareSize ?? bitmap.width;
  const h = targetSquareSize ?? bitmap.height;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    throw new Error('Failed to acquire Canvas 2D context for PNG import.');
  }

  if (targetSquareSize) {
    ctx.fillStyle = '#070a0d';
    ctx.fillRect(0, 0, w, h);
    const scale = Math.max(w / bitmap.width, h / bitmap.height);
    const dw = bitmap.width * scale;
    const dh = bitmap.height * scale;
    ctx.drawImage(bitmap, (w - dw) / 2, (h - dh) / 2, dw, dh);
  } else {
    ctx.drawImage(bitmap, 0, 0);
  }
  bitmap.close();

  const imgData = ctx.getImageData(0, 0, w, h);
  return {
    width: w,
    height: h,
    data: new Uint8ClampedArray(imgData.data),
  };
}

export function triggerDownload(bytesOrBlob: Uint8Array | Blob, filename: string, mime = 'application/octet-stream'): void {
  const blob =
    bytesOrBlob instanceof Blob ? bytesOrBlob : new Blob([toArrayBuffer(bytesOrBlob)], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
