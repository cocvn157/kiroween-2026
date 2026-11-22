import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Copy,
  Download,
  FileAudio,
  FileImage,
  FileJson,
  Mic,
  Play,
  Radio,
  Repeat,
  ShieldAlert,
  Square,
  Volume2,
  Waves,
} from 'lucide-react';
import {
  imageFileToPixelGrid,
  startMicCapture,
  startPatchDrone,
  triggerDownload,
  type MicSession,
  type PlaybackHandle,
} from '../core/browserMedia.ts';
import { renderFrankenPatchPcm } from '../core/patchSynth.ts';
import {
  autopsyFromAudioSamples,
  autopsyFromBundleJson,
  autopsyFromPixelGrid,
  autopsyFromWavBytes,
  type AutopsyReport,
} from '../core/pipeline.ts';
import { parseFrankenPatch, type FrankenPatchV1 } from '../core/presets.ts';

interface AutopsyWorkspaceProps {
  passphrase: string;
  onPassphraseChange: (v: string) => void;
  report: AutopsyReport | null;
  errorMsg: string | null;
  hasActiveChimera: boolean;
  onRunLoopback: (mode: 'loopback' | 'noisy-sim' | 'png') => void;
  onRunTamperDrill: () => void;
  onReportReady: (report: AutopsyReport) => void;
  onError: (msg: string) => void;
  onLoadRecoveredToStitch: (plaintext: string, title?: string) => void;
}

function FrankenPatchRunner({ patch }: { patch: FrankenPatchV1 }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [droneOn, setDroneOn] = useState(false);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);
  const audioRef = useRef<PlaybackHandle | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let rafId = 0;
    const started = performance.now();

    const paletteHex =
      patch.palette === 'amber'
        ? '#ffb020'
        : patch.palette === 'crimson'
          ? '#ff3b5c'
          : '#39ff88';

    const draw = () => {
      const w = canvas.clientWidth || 500;
      const h = canvas.clientHeight || 180;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.fillStyle = 'rgba(4, 7, 9, 0.28)';
      ctx.fillRect(0, 0, w, h);

      const t = (performance.now() - started) / 1000;
      const beatPhase = (t * patch.pulseBpm) / 60;
      const pulse = 0.72 + 0.28 * Math.sin(beatPhase * Math.PI * 2);

      const cx = w / 2;
      const cy = h / 2;
      const maxR = Math.min(w, h) * 0.38 * pulse;

      ctx.strokeStyle = paletteHex;
      ctx.lineWidth = 1.6;
      ctx.shadowColor = paletteHex;
      ctx.shadowBlur = 10;

      ctx.beginPath();
      const steps = 220;
      for (let i = 0; i <= steps; i++) {
        const theta = (i / steps) * Math.PI * 2;
        const r =
          maxR *
          (0.65 + 0.35 * Math.cos(patch.symmetry * theta + t * patch.modHz * 0.6));
        const px = cx + Math.cos(theta + t * 0.3) * r;
        const py = cy + Math.sin(theta + t * 0.3) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.font = '10.5px "JetBrains Mono", Consolas, monospace';
      ctx.fillStyle = '#e8f4ed';
      ctx.fillText(
        `PATCH // ${patch.label} • ${patch.carrierHz}Hz • MOD ${patch.modHz}Hz • ${patch.symmetry}-FOLD • ${patch.pulseBpm}BPM`,
        10,
        16,
      );
      ctx.restore();

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [patch]);

  useEffect(() => {
    return () => {
      audioRef.current?.stop();
      audioRef.current = null;
    };
  }, [patch]);

  const toggleDrone = () => {
    if (droneOn) {
      audioRef.current?.stop();
      audioRef.current = null;
      setDroneOn(false);
      return;
    }
    setAudioNotice(null);
    setDroneOn(true);
    audioRef.current = startPatchDrone(
      patch,
      () => {
        setDroneOn(false);
        audioRef.current = null;
      },
      (reason) => {
        setAudioNotice(reason);
        setDroneOn(false);
      },
    );
  };

  const handleExportSynthWav = () => {
    const rendered = renderFrankenPatchPcm(patch, 4);
    const slug = patch.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'patch';
    triggerDownload(rendered.wavBytes, `frankenpatch-${slug}.wav`, 'audio/wav');
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div className="panel-header" style={{ marginBottom: 8 }}>
        <span className="panel-title">
          <Volume2 size={14} color="#39ff88" />
          SANDBOXED MICRO-PATCH ENGINE (ZERO-EVAL)
        </span>
        <div className="btn-group">
          <button
            type="button"
            className="btn"
            style={{ padding: '5px 9px', fontSize: 11 }}
            onClick={handleExportSynthWav}
            title="Render 4s deterministic FM harmonic .WAV without external audio deps"
          >
            <Download size={12} />
            Render .WAV
          </button>
          <button type="button" className="btn btn-amber" style={{ padding: '5px 10px', fontSize: 11 }} onClick={toggleDrone}>
            {droneOn ? <Square size={12} /> : <Play size={12} />}
            {droneOn ? 'Mute Synth' : 'Energize Synth'}
          </button>
        </div>
      </div>
      {audioNotice && (
        <div className="alert-banner amber" style={{ marginTop: 0, marginBottom: 8 }} role="status">
          <AlertTriangle size={14} />
          <span>{audioNotice}</span>
        </div>
      )}
      <canvas ref={canvasRef} className="patch-canvas" aria-label={`Harmonic mandala visualizer for ${patch.label}`} />
    </div>
  );
}

export function AutopsyWorkspace({
  passphrase,
  onPassphraseChange,
  report,
  errorMsg,
  hasActiveChimera,
  onRunLoopback,
  onRunTamperDrill,
  onReportReady,
  onError,
  onLoadRecoveredToStitch,
}: AutopsyWorkspaceProps) {
  const wavInputRef = useRef<HTMLInputElement | null>(null);
  const pngInputRef = useRef<HTMLInputElement | null>(null);
  const bundleInputRef = useRef<HTMLInputElement | null>(null);
  const micRef = useRef<MicSession | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return () => {
      if (micRef.current) {
        void micRef.current.stop();
      }
    };
  }, []);

  const handleWavFile = async (ev: ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const res = await autopsyFromWavBytes(buf, passphrase);
      onReportReady(res);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'WAV decoding failed.');
    }
    ev.target.value = '';
  };

  const handlePngFile = async (ev: ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      const grid = await imageFileToPixelGrid(file);
      const res = await autopsyFromPixelGrid(grid, passphrase);
      onReportReady(res);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'PNG steganography extraction failed.');
    }
    ev.target.value = '';
  };

  const handleBundleFile = async (ev: ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      const jsonText = await file.text();
      const res = await autopsyFromBundleJson(jsonText, passphrase);
      onReportReady(res);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Bundle import failed.');
    }
    ev.target.value = '';
  };

  const handleToggleMic = async () => {
    if (isRecording && micRef.current) {
      try {
        const { samples, sampleRate } = await micRef.current.stop();
        micRef.current = null;
        setIsRecording(false);
        const res = await autopsyFromAudioSamples(samples, sampleRate, passphrase, 'microphone');
        onReportReady(res);
      } catch (err) {
        setIsRecording(false);
        onError(err instanceof Error ? err.message : 'Microphone demodulation failed.');
      }
      return;
    }

    try {
      const session = await startMicCapture();
      micRef.current = session;
      setIsRecording(true);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not open microphone.');
    }
  };

  const handleCopy = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report.opened.plaintext);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // ignore clipboard errors in headless mode
    }
  };

  const parsedPatch = report ? parseFrankenPatch(report.opened.plaintext) : null;

  return (
    <div className="autopsy-grid">
      <section className="panel-card">
        <div className="panel-header">
          <span className="panel-title">
            <Radio size={15} color="#ffb020" />
            AUTOPSY INTAKE // EXTRACT &amp; DECRYPT
          </span>
          <span className="panel-badge amber">GOERTZEL PLL + LSB</span>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label className="field-label" htmlFor="autopsy-pass">
            <span>DECRYPTION PASSPHRASE</span>
            <span>{passphrase ? 'PBKDF2-SHA256' : 'NONE'}</span>
          </label>
          <input
            id="autopsy-pass"
            className="text-input"
            value={passphrase}
            onChange={(e) => onPassphraseChange(e.target.value)}
            placeholder="Enter passphrase (leave blank for plain capsules)"
          />
        </div>

        <div className="field-label">INSTANT LOOPBACK &amp; TAMPER DIAGNOSTICS</div>
        <div className="btn-group" style={{ marginBottom: 14 }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: '1 1 150px' }}
            onClick={() => onRunLoopback('loopback')}
            disabled={!hasActiveChimera}
          >
            <Repeat size={13} />
            Clean FSK Loopback
          </button>
          <button
            type="button"
            className="btn btn-amber"
            onClick={() => onRunLoopback('noisy-sim')}
            disabled={!hasActiveChimera}
          >
            <Waves size={13} />
            14dB Noise + Skew
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => onRunLoopback('png')}
            disabled={!hasActiveChimera}
          >
            <FileImage size={13} />
            Sigil PNG Extract
          </button>
          <button
            type="button"
            className="btn btn-crimson"
            onClick={onRunTamperDrill}
            disabled={!hasActiveChimera}
            title="Verify explicit rejection when passphrase is wrong or carrier bytes are mutated"
          >
            <ShieldAlert size={13} />
            Tamper Drill
          </button>
        </div>

        <div className="field-label">EXTERNAL CARRIER FILES &amp; ACOUSTIC CAPTURE</div>
        <div style={{ display: 'grid', gap: 9 }}>
          <input
            ref={wavInputRef}
            type="file"
            accept=".wav,audio/wav"
            style={{ display: 'none' }}
            onChange={handleWavFile}
          />
          <button
            type="button"
            className="dropzone"
            onClick={() => wavInputRef.current?.click()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#e8f4ed', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              <FileAudio size={16} color="#39ff88" />
              Import Cassette .WAV File (Auto-detects 300/600/1200 baud)
            </div>
          </button>

          <input
            ref={pngInputRef}
            type="file"
            accept="image/png"
            style={{ display: 'none' }}
            onChange={handlePngFile}
          />
          <button
            type="button"
            className="dropzone"
            onClick={() => pngInputRef.current?.click()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#e8f4ed', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              <FileImage size={16} color="#ffb020" />
              Import Sigil Cartridge .PNG File (Lossless LSB Extraction)
            </div>
          </button>

          <input
            ref={bundleInputRef}
            type="file"
            accept=".json,.franken.json,application/json"
            style={{ display: 'none' }}
            onChange={handleBundleFile}
          />
          <button
            type="button"
            className="dropzone"
            onClick={() => bundleInputRef.current?.click()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#e8f4ed', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              <FileJson size={16} color="#38e8d8" />
              Import .FRANKEN.JSON Shareable Specimen Bundle
            </div>
          </button>

          <button
            type="button"
            className={`btn ${isRecording ? 'btn-crimson' : ''}`}
            onClick={handleToggleMic}
            style={{ width: '100%', padding: '10px 12px' }}
          >
            {isRecording ? <Square size={14} /> : <Mic size={14} />}
            {isRecording
              ? 'Stop Mic Capture & Demodulate FSK Signal'
              : 'Capture Live Speaker Audio via Microphone'}
          </button>
        </div>
      </section>

      <section className="panel-card">
        <div className="panel-header">
          <span className="panel-title">
            <CheckCircle2 size={15} color={errorMsg ? '#ff3b5c' : '#39ff88'} />
            FORENSIC AUTOPSY READOUT
          </span>
          {report && (
            <span className="panel-badge lime">
              SOURCE: {report.source.toUpperCase()}
            </span>
          )}
        </div>

        {errorMsg && (
          <div className="alert-banner error" role="alert" style={{ marginTop: 0, marginBottom: 12 }}>
            <AlertTriangle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}

        {report ? (
          <>
            <div className="alert-banner success" style={{ marginTop: 0, marginBottom: 12 }}>
              <CheckCircle2 size={15} />
              <span>
                INTEGRITY VERIFIED • CRC-32 OK •{' '}
                {report.opened.encrypted ? 'AES-256-GCM AUTHENTICATED' : 'UNENCRYPTED SPECIMEN'}
              </span>
            </div>

            <div className="anatomy-metrics" style={{ marginBottom: 12 }}>
              <div className="metric-cell">
                <div className="metric-k">FINGERPRINT</div>
                <div className="metric-v">{report.opened.fingerprintHex}</div>
              </div>
              <div className="metric-cell">
                <div className="metric-k">CARRIER CRC-32</div>
                <div className="metric-v" style={{ color: '#ffb020' }}>
                  0x
                  {report.fskMeta?.crcHex ??
                    report.stegMeta?.crcHex ??
                    report.bundleMeta?.envelopeCrcHex ??
                    '--------'}
                </div>
              </div>
              <div className="metric-cell">
                <div className="metric-k">
                  {report.fskMeta ? 'BAUD / DRIFT' : report.bundleMeta ? 'BUNDLE BAUD' : 'STEG CAPACITY'}
                </div>
                <div className="metric-v">
                  {report.fskMeta
                    ? `${report.fskMeta.baudRate} (${report.fskMeta.clockDriftPct > 0 ? '+' : ''}${report.fskMeta.clockDriftPct}%)`
                    : report.bundleMeta
                      ? `${report.bundleMeta.baudRate} BD`
                      : `${Math.round((report.stegMeta?.capacityBytes ?? 0) / 1024)} KB`}
                </div>
              </div>
              <div className="metric-cell">
                <div className="metric-k">{report.fskMeta ? 'EST. SNR' : 'COMPRESSION'}</div>
                <div className="metric-v">
                  {report.fskMeta
                    ? `${report.fskMeta.snrEstimateDb} dB`
                    : report.opened.compressed
                      ? 'DEFLATE'
                      : 'RAW'}
                </div>
              </div>
            </div>

            <div className="field-label">
              <span>RECOVERED PAYLOAD</span>
              <div className="btn-group">
                <button
                  type="button"
                  className="btn"
                  style={{ padding: '3px 8px', fontSize: 10.5 }}
                  onClick={() =>
                    onLoadRecoveredToStitch(report.opened.plaintext, report.bundleMeta?.title)
                  }
                  title="Send recovered payload back to Operating Table for editing or re-suturing"
                >
                  <ArrowUpRight size={11} />
                  LOAD TO STITCH
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ padding: '3px 8px', fontSize: 10.5 }}
                  onClick={handleCopy}
                >
                  <Copy size={11} />
                  {copied ? 'COPIED' : 'COPY'}
                </button>
              </div>
            </div>
            <pre
              style={{
                margin: 0,
                padding: '10px 12px',
                borderRadius: 6,
                background: '#05080b',
                border: '1px solid var(--border-grid)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                lineHeight: 1.5,
                color: '#d9f8e6',
                maxHeight: 210,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {report.opened.plaintext}
            </pre>

            {parsedPatch && <FrankenPatchRunner patch={parsedPatch} />}
          </>
        ) : (
          <div
            style={{
              padding: '38px 16px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
            }}
          >
            Select a loopback channel on the left, drop a `.WAV` / `.PNG` / `.FRANKEN.JSON` carrier, or capture live FSK audio from your microphone.
          </div>
        )}
      </section>
    </div>
  );
}
