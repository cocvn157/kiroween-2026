import { useEffect, useRef } from 'react';
import type { PixelGrid } from '../core/stegCartridge.ts';

interface SigilCartridgeViewProps {
  grid: PixelGrid;
}

export function SigilCartridgeView({ grid }: SigilCartridgeViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = grid.width;
    canvas.height = grid.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgData = new ImageData(new Uint8ClampedArray(grid.data), grid.width, grid.height);
    ctx.putImageData(imgData, 0, 0);
  }, [grid]);

  return (
    <div className="sigil-frame">
      <canvas ref={canvasRef} className="sigil-canvas" aria-label="LSB Steganography Sigil Cartridge" />
    </div>
  );
}
