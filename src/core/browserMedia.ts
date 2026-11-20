import { toArrayBuffer } from './crc32.ts';
import type { PixelGrid } from './stegCartridge.ts';

export interface PlaybackHandle {
  stop: () => void;
}

/**
 * Plays mono Float32Array PCM samples through Web Audio API with progress callback.
 */
export function playPcmAudio(
  samples: Float32Array,
  sampleRate: number,
  onProgress: (fraction: number) => void,
  onEnded: () => void,
): PlaybackHandle {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx({ sampleRate });
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
  let stopped = false;

  const rafTick = () => {
    if (stopped) return;
    const elapsed = performance.now() - startedAt;
    const frac = Math.min(1, elapsed / Math.max(1, durationMs));
    onProgress(frac);
    if (frac < 1) {
      requestAnimationFrame(rafTick);
    }
  };

  source.onended = () => {
    if (!stopped) {
      stopped = true;
      onProgress(1);
      onEnded();
      void ctx.close();
    }
  };

  source.start();
  requestAnimationFrame(rafTick);

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      try {
        source.stop();
      } catch {
        // already ended
      }
      void ctx.close();
      onEnded();
    },
  };
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

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
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
