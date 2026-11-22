import { useEffect, useRef } from 'react';
import { Eye } from 'lucide-react';
import type { PixelGrid } from '../core/stegCartridge.ts';

interface SigilCartridgeViewProps {
  grid: PixelGrid;
  xrayMode: boolean;
  onToggleXray: () => void;
}

/**
 * Renders the opaque 512x512 PCB Sigil PNG or an amplified 2-bit LSB X-Ray bitplane inspection view.
 */
export function SigilCartridgeView({ grid, xrayMode, onToggleXray }: SigilCartridgeViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = grid.width;
    canvas.height = grid.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pixels = new Uint8ClampedArray(grid.data.length);
    if (xrayMode) {
      // Amplify 2 LSBs per channel (0..3 -> 0..255) to visualize the hidden KWST01 payload strip
      for (let i = 0; i < grid.data.length; i += 4) {
        pixels[i] = ((grid.data[i] ?? 0) & 0x03) * 85;
        pixels[i + 1] = ((grid.data[i + 1] ?? 0) & 0x03) * 85;
        pixels[i + 2] = ((grid.data[i + 2] ?? 0) & 0x03) * 85;
        pixels[i + 3] = 255;
      }
    } else {
      pixels.set(grid.data);
    }

    const imgData = new ImageData(pixels, grid.width, grid.height);
    ctx.putImageData(imgData, 0, 0);
  }, [grid, xrayMode]);

  return (
    <div className="sigil-frame">
      <canvas
        ref={canvasRef}
        className="sigil-canvas"
        aria-label={
          xrayMode
            ? 'LSB X-Ray Bitplane Visualization exposing hidden 2-bit payload pixels'
            : 'LSB Steganography Sigil Cartridge'
        }
      />
      <button
        type="button"
        className={`sigil-xray-btn ${xrayMode ? 'active' : ''}`}
        onClick={onToggleXray}
        aria-pressed={xrayMode}
        title="Toggle 2-bit LSB X-Ray view to inspect hidden ciphertext pixel bands"
      >
        <Eye size={11} />
        {xrayMode ? 'LSB X-RAY ON' : 'LSB X-RAY'}
      </button>
    </div>
  );
}
