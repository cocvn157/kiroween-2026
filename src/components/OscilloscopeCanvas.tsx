import { useEffect, useRef } from 'react';
import { FSK_FREQ_MARK, FSK_FREQ_SPACE, type BaudRate } from '../core/fskModem.ts';

interface OscilloscopeCanvasProps {
  samples: Float32Array;
  sampleRate: number;
  baudRate: BaudRate;
  isPlaying: boolean;
  playProgress: number; // 0..1
}

function quickBandEnergy(
  samples: Float32Array,
  start: number,
  len: number,
  freq: number,
  sampleRate: number,
): number {
  const omega = (2 * Math.PI * freq) / sampleRate;
  const coeff = 2 * Math.cos(omega);
  let s1 = 0;
  let s2 = 0;
  const end = Math.min(samples.length, start + len);
  for (let i = start; i < end; i++) {
    const x = samples[i] ?? 0;
    const s0 = x + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return Math.max(0, s1 * s1 + s2 * s2 - coeff * s1 * s2);
}

export function OscilloscopeCanvas({
  samples,
  sampleRate,
  baudRate,
  isPlaying,
  playProgress,
}: OscilloscopeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = canvas.clientWidth || 600;
    const height = canvas.clientHeight || 156;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#040709';
    ctx.fillRect(0, 0, width, height);

    const waveAreaH = height - 34;
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

    if (samples.length === 0) return;

    // Pick a ~10-bit zoomed time window right in the active preamble/data region (or tracking playProgress)
    const spb = Math.max(40, Math.round(sampleRate / baudRate));
    const zoomSamples = Math.min(samples.length, spb * 10);
    const defaultStart = Math.min(
      Math.max(0, samples.length - zoomSamples),
      Math.round(0.18 * sampleRate), // lands right on 0xAA + 0x4B57 + early ciphertext transitions!
    );
    const activeFrac = isPlaying ? playProgress : 0.28;
    const windowStart = isPlaying
      ? Math.min(Math.max(0, samples.length - zoomSamples), Math.floor(activeFrac * samples.length))
      : defaultStart;

    // Faint bit-boundary vertical ticks + digital demodulation step trace (Channel 2 amber)
    ctx.strokeStyle = 'rgba(255, 176, 32, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const numBitsInView = Math.floor(zoomSamples / spb);
    for (let b = 0; b < numBitsInView; b++) {
      const bitStart = windowStart + b * spb;
      const e0 = quickBandEnergy(samples, bitStart, spb, FSK_FREQ_SPACE, sampleRate);
      const e1 = quickBandEnergy(samples, bitStart, spb, FSK_FREQ_MARK, sampleRate);
      const isOne = e1 >= e0;
      const x0 = ((b * spb) / zoomSamples) * width;
      const x1 = (((b + 1) * spb) / zoomSamples) * width;
      const stepY = isOne ? 24 : waveAreaH - 12;
      if (b === 0) ctx.moveTo(x0, stepY);
      else ctx.lineTo(x0, stepY);
      ctx.lineTo(x1, stepY);
    }
    ctx.stroke();

    // Primary zoomed glowing FSK sine trace (Channel 1 phosphor lime)
    ctx.beginPath();
    ctx.strokeStyle = '#39ff88';
    ctx.lineWidth = 1.75;
    ctx.shadowColor = 'rgba(57, 255, 136, 0.72)';
    ctx.shadowBlur = 7;

    const tracePoints = Math.min(width * 2, zoomSamples);
    const ampScale = midY - 16;
    for (let p = 0; p < tracePoints; p++) {
      const sampleIdx = windowStart + Math.floor((p / (tracePoints - 1)) * (zoomSamples - 1));
      const v = samples[sampleIdx] ?? 0;
      const px = (p / (tracePoints - 1)) * width;
      const py = midY - v * ampScale;
      if (p === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Bottom spectrum & progress strip
    const barTop = waveAreaH + 2;
    ctx.fillStyle = '#070c10';
    ctx.fillRect(0, barTop, width, 32);
    ctx.strokeStyle = 'rgba(28, 42, 51, 0.9)';
    ctx.beginPath();
    ctx.moveTo(0, barTop);
    ctx.lineTo(width, barTop);
    ctx.stroke();

    // Mini full-tape scrubber bar at top edge of spectrum strip
    ctx.fillStyle = 'rgba(57, 255, 136, 0.25)';
    ctx.fillRect(0, barTop, width * activeFrac, 2);

    const winLen = spb * 2;
    const sampleCenter = Math.min(
      windowStart + Math.floor(zoomSamples * 0.4),
      Math.max(0, samples.length - winLen),
    );
    const eSpace = quickBandEnergy(samples, sampleCenter, winLen, FSK_FREQ_SPACE, sampleRate);
    const eMark = quickBandEnergy(samples, sampleCenter, winLen, FSK_FREQ_MARK, sampleRate);
    const tot = eSpace + eMark + 1e-6;
    const ratio0 = eSpace / tot;
    const ratio1 = eMark / tot;

    ctx.font = '10px "JetBrains Mono", Consolas, monospace';
    ctx.fillStyle = '#7f968b';
    ctx.fillText('1200Hz [0]', 10, barTop + 21);
    ctx.fillText('2400Hz [1]', width * 0.52, barTop + 21);

    const barW = Math.max(40, width * 0.31);
    ctx.fillStyle = '#111b22';
    ctx.fillRect(82, barTop + 11, barW, 11);
    ctx.fillRect(width * 0.52 + 74, barTop + 11, barW, 11);

    ctx.fillStyle = '#ffb020';
    ctx.fillRect(82, barTop + 11, barW * ratio0, 11);

    ctx.fillStyle = '#39ff88';
    ctx.fillRect(width * 0.52 + 74, barTop + 11, barW * ratio1, 11);

    // Corner telemetry HUD
    ctx.fillStyle = 'rgba(232, 244, 237, 0.78)';
    ctx.fillText(
      `CH1 FSK SINE • CH2 DEMOD BITS // ${baudRate} BAUD // ${(samples.length / sampleRate).toFixed(2)}s @ ${sampleRate / 1000}kHz`,
      10,
      15,
    );
  }, [samples, sampleRate, baudRate, isPlaying, playProgress]);

  return (
    <div className="oscilloscope-wrap">
      <canvas ref={canvasRef} className="oscilloscope-canvas" />
    </div>
  );
}
