import { useCallback, useEffect, useRef, useState } from 'react';
import { AutopsyWorkspace } from './components/AutopsyWorkspace.tsx';
import { BenchmarkWorkspace } from './components/BenchmarkWorkspace.tsx';
import { HeaderBar, type WorkspaceTab } from './components/HeaderBar.tsx';
import { StitchWorkspace } from './components/StitchWorkspace.tsx';
import { playPcmAudio, type PlaybackHandle } from './core/browserMedia.ts';
import type { BaudRate } from './core/fskModem.ts';
import {
  autopsyFromAudioSamples,
  autopsyFromPixelGrid,
  autopsyFromWavBytes,
  simulateAcousticChannel,
  stitchChimera,
  type AutopsyReport,
  type StitchedChimera,
} from './core/pipeline.ts';
import { SPECIMEN_PRESETS } from './core/presets.ts';
import type { PixelGrid } from './core/stegCartridge.ts';

export function App() {
  const initialPreset = SPECIMEN_PRESETS[0]!;

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('stitch');
  const [selectedPresetId, setSelectedPresetId] = useState<string>(initialPreset.id);
  const [title, setTitle] = useState<string>(initialPreset.title);
  const [plaintext, setPlaintext] = useState<string>(initialPreset.payload);
  const [passphrase, setPassphrase] = useState<string>(initialPreset.passphrase);
  const [baudRate, setBaudRate] = useState<BaudRate>(600);
  const [compress, setCompress] = useState<boolean>(true);
  const [customCarrier, setCustomCarrier] = useState<PixelGrid | null>(null);

  const [chimera, setChimera] = useState<StitchedChimera | null>(null);
  const [isStitching, setIsStitching] = useState<boolean>(false);
  const [stitchError, setStitchError] = useState<string | null>(null);

  const [autopsyReport, setAutopsyReport] = useState<AutopsyReport | null>(null);
  const [autopsyError, setAutopsyError] = useState<string | null>(null);

  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [playProgress, setPlayProgress] = useState<number>(0);
  const playbackRef = useRef<PlaybackHandle | null>(null);

  const runStitch = useCallback(
    async (opts?: {
      title?: string;
      plaintext?: string;
      passphrase?: string;
      baudRate?: BaudRate;
      compress?: boolean;
      customCarrierGrid?: PixelGrid | null;
    }) => {
      setIsStitching(true);
      setStitchError(null);
      try {
        const res = await stitchChimera({
          title: opts?.title ?? title,
          plaintext: opts?.plaintext ?? plaintext,
          passphrase: opts?.passphrase ?? passphrase,
          baudRate: opts?.baudRate ?? baudRate,
          compress: opts?.compress ?? compress,
          customCarrierGrid:
            opts && 'customCarrierGrid' in opts ? opts.customCarrierGrid : customCarrier,
        });
        setChimera(res);
      } catch (err) {
        setStitchError(err instanceof Error ? err.message : 'Failed to stitch chimera.');
      } finally {
        setIsStitching(false);
      }
    },
    [title, plaintext, passphrase, baudRate, compress, customCarrier],
  );

  // Auto-stitch default specimen on initial boot so the oscilloscope & sigil are alive immediately
  useEffect(() => {
    void runStitch({
      title: initialPreset.title,
      plaintext: initialPreset.payload,
      passphrase: initialPreset.passphrase,
      baudRate: 600,
      compress: true,
      customCarrierGrid: null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      playbackRef.current?.stop();
    };
  }, []);

  const handleSelectPreset = (id: string) => {
    const found = SPECIMEN_PRESETS.find((p) => p.id === id);
    if (!found) return;
    setSelectedPresetId(found.id);
    setTitle(found.title);
    setPlaintext(found.payload);
    setPassphrase(found.passphrase);
    void runStitch({
      title: found.title,
      plaintext: found.payload,
      passphrase: found.passphrase,
      baudRate,
      compress,
      customCarrierGrid: customCarrier,
    });
  };

  const handleCustomCarrierChange = (grid: PixelGrid | null) => {
    setCustomCarrier(grid);
    void runStitch({ customCarrierGrid: grid });
  };

  const handleTogglePlay = () => {
    if (isPlayingAudio) {
      playbackRef.current?.stop();
      playbackRef.current = null;
      setIsPlayingAudio(false);
      return;
    }
    if (!chimera) return;
    setIsPlayingAudio(true);
    setPlayProgress(0);
    playbackRef.current = playPcmAudio(
      chimera.fsk.samples,
      chimera.fsk.sampleRate,
      (frac) => setPlayProgress(frac),
      () => {
        setIsPlayingAudio(false);
        playbackRef.current = null;
      },
    );
  };

  const handleRunLoopback = async (mode: 'loopback' | 'noisy-sim' | 'png') => {
    if (!chimera) return;
    setActiveTab('autopsy');
    setAutopsyError(null);
    try {
      let report: AutopsyReport;
      if (mode === 'png') {
        report = await autopsyFromPixelGrid(chimera.steg.grid, passphrase);
      } else if (mode === 'noisy-sim') {
        const degraded = simulateAcousticChannel(chimera.fsk.samples, chimera.fsk.sampleRate, {
          snrDb: 14,
          clockDriftRatio: 1.004,
          leadingSilenceSamples: 451,
        });
        report = await autopsyFromAudioSamples(
          degraded,
          chimera.fsk.sampleRate,
          passphrase,
          'noisy-sim',
          chimera.fsk.baudRate,
        );
      } else {
        report = await autopsyFromWavBytes(chimera.fsk.wavBytes, passphrase);
        report = { ...report, source: 'loopback' };
      }
      setAutopsyReport(report);
    } catch (err) {
      setAutopsyReport(null);
      setAutopsyError(err instanceof Error ? err.message : 'Autopsy failed.');
    }
  };

  return (
    <div className="app-shell">
      <HeaderBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        baudRate={chimera?.fsk.baudRate ?? baudRate}
        encrypted={Boolean(passphrase)}
        fingerprintHex={chimera?.sealed.fingerprintHex ?? '--------'}
      />

      <main className="workspace-main">
        {activeTab === 'stitch' && (
          <StitchWorkspace
            title={title}
            onTitleChange={setTitle}
            plaintext={plaintext}
            onPlaintextChange={(v) => {
              setSelectedPresetId('custom');
              setPlaintext(v);
            }}
            passphrase={passphrase}
            onPassphraseChange={setPassphrase}
            baudRate={baudRate}
            onBaudRateChange={setBaudRate}
            compress={compress}
            onCompressChange={setCompress}
            selectedPresetId={selectedPresetId}
            onSelectPreset={handleSelectPreset}
            customCarrier={customCarrier}
            onCustomCarrierChange={handleCustomCarrierChange}
            chimera={chimera}
            isStitching={isStitching}
            errorMsg={stitchError}
            onStitch={() => void runStitch()}
            isPlayingAudio={isPlayingAudio}
            playProgress={playProgress}
            onTogglePlay={handleTogglePlay}
            onLoopbackAutopsy={(mode) => void handleRunLoopback(mode)}
          />
        )}

        {activeTab === 'autopsy' && (
          <AutopsyWorkspace
            passphrase={passphrase}
            onPassphraseChange={setPassphrase}
            report={autopsyReport}
            errorMsg={autopsyError}
            hasActiveChimera={Boolean(chimera)}
            onRunLoopback={(mode) => void handleRunLoopback(mode)}
            onReportReady={(rep) => {
              setAutopsyError(null);
              setAutopsyReport(rep);
            }}
            onError={(msg) => {
              setAutopsyReport(null);
              setAutopsyError(msg);
            }}
          />
        )}

        {activeTab === 'benchmark' && <BenchmarkWorkspace />}
      </main>
    </div>
  );
}

export default App;
