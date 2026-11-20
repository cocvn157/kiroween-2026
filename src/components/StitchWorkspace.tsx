import { useRef, type ChangeEvent } from 'react';
import {
  AlertTriangle,
  Download,
  FlaskConical,
  ImagePlus,
  Play,
  RefreshCw,
  Repeat,
  RotateCcw,
  Square,
  Waves,
  Zap,
} from 'lucide-react';
import type { BaudRate } from '../core/fskModem.ts';
import type { StitchedChimera } from '../core/pipeline.ts';
import { SPECIMEN_PRESETS } from '../core/presets.ts';
import { imageFileToPixelGrid, pixelGridToPngBlob, triggerDownload } from '../core/browserMedia.ts';
import type { PixelGrid } from '../core/stegCartridge.ts';
import { OscilloscopeCanvas } from './OscilloscopeCanvas.tsx';
import { SigilCartridgeView } from './SigilCartridgeView.tsx';

interface StitchWorkspaceProps {
  title: string;
  onTitleChange: (v: string) => void;
  plaintext: string;
  onPlaintextChange: (v: string) => void;
  passphrase: string;
  onPassphraseChange: (v: string) => void;
  baudRate: BaudRate;
  onBaudRateChange: (b: BaudRate) => void;
  compress: boolean;
  onCompressChange: (c: boolean) => void;
  selectedPresetId: string;
  onSelectPreset: (id: string) => void;
  customCarrier: PixelGrid | null;
  onCustomCarrierChange: (grid: PixelGrid | null) => void;
  chimera: StitchedChimera | null;
  isStitching: boolean;
  errorMsg: string | null;
  onStitch: () => void;
  isPlayingAudio: boolean;
  playProgress: number;
  onTogglePlay: () => void;
  onLoopbackAutopsy: (mode: 'loopback' | 'noisy-sim' | 'png') => void;
}

export function StitchWorkspace({
  title,
  onTitleChange,
  plaintext,
  onPlaintextChange,
  passphrase,
  onPassphraseChange,
  baudRate,
  onBaudRateChange,
  compress,
  onCompressChange,
  selectedPresetId,
  onSelectPreset,
  customCarrier,
  onCustomCarrierChange,
  chimera,
  isStitching,
  errorMsg,
  onStitch,
  isPlayingAudio,
  playProgress,
  onTogglePlay,
  onLoopbackAutopsy,
}: StitchWorkspaceProps) {
  const carrierInputRef = useRef<HTMLInputElement | null>(null);
  const utf8ByteCount = new TextEncoder().encode(plaintext).length;

  const handleCarrierUpload = async (ev: ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      const grid = await imageFileToPixelGrid(file, 512);
      onCustomCarrierChange(grid);
    } catch {
      // ignore invalid image
    }
    ev.target.value = '';
  };

  const handleDownloadWav = () => {
    if (!chimera) return;
    const slug = (chimera.title || 'specimen').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    triggerDownload(chimera.fsk.wavBytes, `frankenwave-${slug}.wav`, 'audio/wav');
  };

  const handleDownloadPng = async () => {
    if (!chimera) return;
    const blob = await pixelGridToPngBlob(chimera.steg.grid);
    const slug = (chimera.title || 'specimen').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    triggerDownload(blob, `frankenwave-${slug}-sigil.png`, 'image/png');
  };

  return (
    <div className="stitch-grid">
      {/* Left Column: Operating Table Input & Crypto Suture */}
      <section className="panel-card">
        <div className="panel-header">
          <span className="panel-title">
            <FlaskConical size={15} color="#39ff88" />
            OPERATING TABLE // SPECIMEN INPUT
          </span>
          <span className={`panel-badge ${passphrase ? 'lime' : 'amber'}`}>
            {passphrase ? 'AES-256-GCM SEALED' : 'UNENCRYPTED CAPSULE'}
          </span>
        </div>

        <div className="preset-row" aria-label="Specimen Presets">
          {SPECIMEN_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`preset-btn ${selectedPresetId === preset.id ? 'selected' : ''}`}
              onClick={() => onSelectPreset(preset.id)}
              title={preset.description}
            >
              <Zap size={11} />
              {preset.badge}
            </button>
          ))}
        </div>

        <div className="field-row-2">
          <div>
            <label className="field-label" htmlFor="specimen-title">
              <span>SPECIMEN LABEL</span>
            </label>
            <input
              id="specimen-title"
              className="text-input"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="AIR-GAPPED RECOVERY KEY"
              maxLength={48}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="specimen-pass">
              <span>PBKDF2 PASSPHRASE</span>
              <span>{passphrase ? 'LOCKED' : 'OPEN'}</span>
            </label>
            <input
              id="specimen-pass"
              type="text"
              className="text-input"
              value={passphrase}
              onChange={(e) => onPassphraseChange(e.target.value)}
              placeholder="Leave empty for public specimen"
            />
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="specimen-payload">
            <span>PAYLOAD (TEXT, .ENV, JSON OR FRANKENPATCH_V1)</span>
            <span>{utf8ByteCount} B UTF-8</span>
          </label>
          <textarea
            id="specimen-payload"
            className="text-area"
            value={plaintext}
            onChange={(e) => onPlaintextChange(e.target.value)}
            placeholder="Paste an API key, JSON secret, note, or FRANKENPATCH_V1 definition..."
          />
        </div>

        <div className="controls-strip">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="field-label" style={{ margin: 0 }}>
              FSK BAUD:
            </span>
            <div className="baud-group" role="group" aria-label="FSK Baud Rate">
              {([300, 600, 1200] as BaudRate[]).map((b) => (
                <button
                  key={b}
                  type="button"
                  className={`baud-btn ${baudRate === b ? 'active' : ''}`}
                  onClick={() => onBaudRateChange(b)}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <label className="checkbox-pill">
            <input
              type="checkbox"
              checked={compress}
              onChange={(e) => onCompressChange(e.target.checked)}
            />
            Deflate-Raw Compression
          </label>
        </div>

        <div className="cta-row">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onStitch}
            disabled={isStitching || plaintext.length === 0}
          >
            <Zap size={14} />
            {isStitching ? 'SUTURING CHIMERA...' : 'SUTURE CHIMERA'}
          </button>
          <button
            type="button"
            className="btn btn-amber"
            onClick={() => onLoopbackAutopsy('loopback')}
            disabled={!chimera || isStitching}
            title="Decode the generated FSK audio directly in Autopsy & Decode"
          >
            <Repeat size={14} />
            LOOPBACK AUTOPSY
          </button>
        </div>

        {errorMsg && (
          <div className="alert-banner error">
            <AlertTriangle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}

        {chimera && (
          <div className="anatomy-strip">
            <div className="anatomy-metrics">
              <div className="metric-cell">
                <div className="metric-k">RAW UTF-8</div>
                <div className="metric-v">{chimera.sealed.rawUtf8Bytes} B</div>
              </div>
              <div className="metric-cell">
                <div className="metric-k">ENVELOPE</div>
                <div className="metric-v">{chimera.sealed.envelope.length} B</div>
              </div>
              <div className="metric-cell">
                <div className="metric-k">AUDIO TAPE</div>
                <div className="metric-v">{chimera.fsk.durationSec.toFixed(2)} s</div>
              </div>
              <div className="metric-cell">
                <div className="metric-k">CRC-32</div>
                <div className="metric-v" style={{ color: '#ffb020' }}>
                  0x{chimera.fsk.crcHex}
                </div>
              </div>
            </div>
            <div className="hex-line">ENVELOPE HEX: {chimera.envelopeHexPreview}</div>
          </div>
        )}
      </section>

      {/* Right Column: Dual Living Organs */}
      <div className="organs-stack">
        {/* Organ A: Acoustic Cassette FSK */}
        <section className="panel-card">
          <div className="panel-header">
            <span className="panel-title">
              <Waves size={15} color="#39ff88" />
              ORGAN A // 1970s FSK CASSETTE TELEMETRY
            </span>
            <span className="panel-badge lime">
              {chimera ? `${chimera.fsk.baudRate} BAUD • 1200/2400 Hz` : 'STANDBY'}
            </span>
          </div>

          <OscilloscopeCanvas
            samples={chimera?.fsk.samples ?? new Float32Array(0)}
            sampleRate={chimera?.fsk.sampleRate ?? 48_000}
            baudRate={chimera?.fsk.baudRate ?? baudRate}
            isPlaying={isPlayingAudio}
            playProgress={playProgress}
          />

          <div className="organ-actions">
            <div className="btn-group">
              <button
                type="button"
                className="btn"
                onClick={onTogglePlay}
                disabled={!chimera}
              >
                {isPlayingAudio ? <Square size={13} /> : <Play size={13} />}
                {isPlayingAudio ? 'Stop Tape' : 'Play Cassette'}
              </button>
              <button
                type="button"
                className="btn btn-amber"
                onClick={() => onLoopbackAutopsy('noisy-sim')}
                disabled={!chimera}
                title="Add 14dB AWGN noise, +0.4% clock skew, and leading silence then demodulate"
              >
                <RefreshCw size={13} />
                Sim Noise + Drift
              </button>
            </div>
            <button
              type="button"
              className="btn"
              onClick={handleDownloadWav}
              disabled={!chimera}
            >
              <Download size={13} />
              Export .WAV
            </button>
          </div>
        </section>

        {/* Organ B: LSB Steganographic Sigil Cartridge */}
        <section className="panel-card">
          <div className="panel-header">
            <span className="panel-title">
              <ImagePlus size={15} color="#ffb020" />
              ORGAN B // OPAQUE LSB SIGIL CARTRIDGE (.PNG)
            </span>
            <span className="panel-badge amber">
              {chimera
                ? `${chimera.steg.utilizationPct}% OF ${(chimera.steg.capacityBytes / 1024).toFixed(0)} KB`
                : 'STANDBY'}
            </span>
          </div>

          <div className="sigil-layout">
            {chimera ? (
              <SigilCartridgeView grid={chimera.steg.grid} />
            ) : (
              <div className="sigil-frame" />
            )}

            <div className="sigil-meta-list">
              <div className="meta-kv">
                <span>CARRIER ART</span>
                <span>{customCarrier ? 'CUSTOM USER PNG' : 'SHA-256 PCB SIGIL'}</span>
              </div>
              <div className="meta-kv">
                <span>STEG SCHEME</span>
                <span>2-BIT RGB LSB (A=255)</span>
              </div>
              <div className="meta-kv">
                <span>BYTES EMBEDDED</span>
                <span>{chimera ? `${chimera.steg.bytesUsed} / ${chimera.steg.capacityBytes} B` : '-'}</span>
              </div>
              <div className="meta-kv">
                <span>SIGIL CRC-32</span>
                <span style={{ color: '#39ff88' }}>
                  {chimera ? `0x${chimera.steg.crcHex}` : '-'}
                </span>
              </div>

              <div className="btn-group" style={{ marginTop: 4 }}>
                <input
                  ref={carrierInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: 'none' }}
                  onChange={handleCarrierUpload}
                />
                <button
                  type="button"
                  className="btn"
                  onClick={() => carrierInputRef.current?.click()}
                >
                  <ImagePlus size={13} />
                  Custom PNG
                </button>
                {customCarrier && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => onCustomCarrierChange(null)}
                  >
                    <RotateCcw size={13} />
                    Reset Sigil
                  </button>
                )}
                <button
                  type="button"
                  className="btn"
                  onClick={handleDownloadPng}
                  disabled={!chimera}
                >
                  <Download size={13} />
                  Export .PNG
                </button>
                <button
                  type="button"
                  className="btn btn-amber"
                  onClick={() => onLoopbackAutopsy('png')}
                  disabled={!chimera}
                >
                  Decode PNG
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
