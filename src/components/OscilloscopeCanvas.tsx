import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import {
  computeFskSpectrum,
  FSK_FREQ_MARK,
  FSK_FREQ_SPACE,
  goertzelPower,
  type BaudRate,
} from '../core/fskModem.ts';

interface OscilloscopeCanvasProps {
  samples: Float32Array;
  sampleRate: number;
  baudRate: BaudRate;
  isPlaying: boolean;
  playProgress: number; // 0..1
}

function classifyTapeRegion(cursorSec: number, totalSec: number): string {
  if (totalSec <= 0) return 'STANDBY';
  if (cursorSec < 0.08) return 'GUARD SILENCE';
  if (cursorSec < 0.18) return 'PILOT 2400Hz';
  if (cursorSec < 0.28) return 'PREAMBLE 0xAA + SYNC 0x4B57';
  if (cursorSec > Math.max(0.28, totalSec - 0.12)) return 'TAIL 1200Hz';
  return 'ENCRYPTED PAYLOAD + CRC32';
}

export function OscilloscopeCanvas({
  samples,
  sampleRate,
  baudRate,
  isPlaying,
  playProgress,
}: OscilloscopeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [inspectFrac, setInspectFrac] = useState<number>(0.046);
  const draggingRef = useRef<boolean>(false);

  const activeFrac = isPlaying ? playProgress : inspectFrac;

  const updateCursorFromClientX = (clientX: number, rect: DOMRect) => {
    if (rect.width <= 0) return;
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setInspectFrac(frac);
  };

  const handlePointerDown = (ev: PointerEvent<HTMLCanvasElement>) => {
    draggingRef.current = true;
    ev.currentTarget.setPointerCapture(ev.pointerId);
    updateCursorFromClientX(ev.clientX, ev.currentTarget.getBoundingClientRect());
  };

  const handlePointerMove = (ev: PointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current) return;
    updateCursorFromClientX(ev.clientX, ev.currentTarget.getBoundingClientRect());
  };

  const handlePointerUp = () => {
    draggingRef.current = false;
  };

  const handleKeyDown = (ev: KeyboardEvent<HTMLCanvasElement>) => {
    if (ev.key === 'ArrowRight') {
      ev.preventDefault();
      setInspectFrac((f) => Math.min(1, Number((f + 0.04).toFixed(3))));
    } else if (ev.key === 'ArrowLeft') {
      ev.preventDefault();
      setInspectFrac((f) => Math.max(0, Number((f - 0.04).toFixed(3))));
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = canvas.clientWidth || 600;
    const height = canvas.clientHeight || 168;
    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#040709';
    ctx.fillRect(0, 0, width, height);

    const spectrumH = 44;
    const waveAreaH = height - spectrumH;
    const midY = waveAreaH / 2;

    // Fine CRT reticle
    ctx.strokeStyle = 'rgba(57, 255, 136, 0.065)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, waveAreaH);
      ctx.stroke();
    }
    for (let y = 0; y < waveAreaH; y += 22) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Center crosshair line
    ctx.strokeStyle = 'rgba(57, 255, 136, 0.16)';
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();

    if (samples.length === 0) {
      ctx.restore();
      return;
    }

    const spb = Math.max(40, Math.round(sampleRate / baudRate));
    const zoomSamples = Math.min(samples.length, spb * 10);
    const maxStart = Math.max(0, samples.length - zoomSamples);
    const windowStart = Math.min(maxStart, Math.floor(activeFrac * maxStart));
    const cursorSec = windowStart / sampleRate;
    const totalSec = samples.length / sampleRate;
    const regionLabel = classifyTapeRegion(cursorSec, totalSec);

    // Channel 2 amber digital demodulation overlay
    ctx.strokeStyle = 'rgba(255, 176, 32, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const numBitsInView = Math.floor(zoomSamples / spb);
    for (let b = 0; b < numBitsInView; b++) {
      const bitStart = windowStart + b * spb;
      const e0 = goertzelPower(samples, bitStart, spb, FSK_FREQ_SPACE, sampleRate);
      const e1 = goertzelPower(samples, bitStart, spb, FSK_FREQ_MARK, sampleRate);
      const isOne = e1 >= e0;
      const x0 = ((b * spb) / zoomSamples) * width;
      const x1 = (((b + 1) * spb) / zoomSamples) * width;
      const stepY = isOne ? 24 : waveAreaH - 12;
      if (b === 0) ctx.moveTo(x0, stepY);
      else ctx.lineTo(x0, stepY);
      ctx.lineTo(x1, stepY);
    }
    ctx.stroke();

    // Channel 1 zoomed glowing FSK sine waveform
    ctx.beginPath();
    ctx.strokeStyle = '#39ff88';
    ctx.lineWidth = 1.75;
    ctx.shadowColor = 'rgba(57, 255, 136, 0.72)';
    ctx.shadowBlur = 7;

    const tracePoints = Math.min(width * 2, zoomSamples);
    const ampScale = midY - 16;
    for (let p = 0; p < tracePoints; p++) {
      const sampleIdx = windowStart + Math.floor((p / Math.max(1, tracePoints - 1)) * (zoomSamples - 1));
      const v = samples[sampleIdx] ?? 0;
      const px = (p / Math.max(1, tracePoints - 1)) * width;
      const py = midY - v * ampScale;
      if (p === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Bottom spectrum & interactive tape scrubber strip
    const barTop = waveAreaH;
    ctx.fillStyle = '#070c10';
    ctx.fillRect(0, barTop, width, spectrumH);
    ctx.strokeStyle = 'rgba(28, 42, 51, 0.95)';
    ctx.beginPath();
    ctx.moveTo(0, barTop);
    ctx.lineTo(width, barTop);
    ctx.stroke();

    // Full-tape scrub progress track
    ctx.fillStyle = 'rgba(57, 255, 136, 0.14)';
    ctx.fillRect(0, barTop, width, 4);
    ctx.fillStyle = isPlaying ? '#39ff88' : '#ffb020';
    ctx.fillRect(0, barTop, width * activeFrac, 4);

    // Multi-bin Goertzel Spectrum (600 Hz .. 3200 Hz, step 100 Hz)
    const specWinLen = Math.min(samples.length - windowStart, spb * 3);
    const bins = computeFskSpectrum(samples, windowStart, specWinLen, sampleRate, 600, 3200, 27);
    const specLeft = 10;
    const specWidth = Math.max(120, width * 0.54);
    const specBottom = height - 6;
    const maxBarH = spectrumH - 14;
    const slotW = specWidth / Math.max(1, bins.length);

    for (let i = 0; i < bins.length; i++) {
      const bin = bins[i];
      if (!bin) continue;
      const isSpace = Math.abs(bin.freqHz - FSK_FREQ_SPACE) <= 60;
      const isMark = Math.abs(bin.freqHz - FSK_FREQ_MARK) <= 60;
      const bh = Math.max(2, bin.magnitude * maxBarH);
      const bx = specLeft + i * slotW + 1;
      const bw = Math.max(2, slotW - 2.5);

      ctx.fillStyle = isSpace
        ? '#ffb020'
        : isMark
          ? '#39ff88'
          : 'rgba(56, 232, 216, 0.34)';
      ctx.fillRect(bx, specBottom - bh, bw, bh);
    }

    // Spectrum labels & instantaneous tone dominance
    const eSpace = goertzelPower(samples, windowStart, spb * 2, FSK_FREQ_SPACE, sampleRate);
    const eMark = goertzelPower(samples, windowStart, spb * 2, FSK_FREQ_MARK, sampleRate);
    const tot = eSpace + eMark + 1e-6;
    const pct0 = Math.round((eSpace / tot) * 100);
    const pct1 = 100 - pct0;

    ctx.font = '10px "JetBrains Mono", Consolas, monospace';
    const readoutX = specLeft + specWidth + 12;
    ctx.fillStyle = '#ffb020';
    ctx.fillText(`1200Hz[0]: ${pct0}%`, readoutX, barTop + 20);
    ctx.fillStyle = '#39ff88';
    ctx.fillText(`2400Hz[1]: ${pct1}%`, readoutX, barTop + 34);

    if (width > 520) {
      ctx.fillStyle = 'rgba(152, 176, 164, 0.78)';
      ctx.fillText('FFT 600–3200Hz', width - 108, barTop + 28);
    }

    // Top telemetry HUD
    ctx.fillStyle = 'rgba(232, 244, 237, 0.85)';
    ctx.fillText(
      `CH1 SINE • CH2 BITS // ${baudRate} BD // ${cursorSec.toFixed(2)}s/${totalSec.toFixed(2)}s [${regionLabel}]`,
      10,
      15,
    );

    ctx.restore();
  }, [samples, sampleRate, baudRate, isPlaying, activeFrac]);

  return (
    <div className="oscilloscope-wrap">
      <canvas
        ref={canvasRef}
        className="oscilloscope-canvas"
        tabIndex={0}
        role="slider"
        aria-label="FSK Cassette Oscilloscope and Goertzel Spectrum Scrubber (use Left/Right arrow keys or click to scrub tape position)"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(activeFrac * 100)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        style={{ cursor: 'ew-resize' }}
      />
    </div>
  );
}
