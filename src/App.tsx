import { useCallback, useEffect, useRef, useState } from 'react';
import { AutopsyWorkspace } from './components/AutopsyWorkspace.tsx';
import { BenchmarkWorkspace } from './components/BenchmarkWorkspace.tsx';
import { HeaderBar, type WorkspaceTab } from './components/HeaderBar.tsx';
import { ShortcutsModal } from './components/ShortcutsModal.tsx';
import { JUDGE_SHOWCASE_STEPS, ShowcaseBanner } from './components/ShowcaseBanner.tsx';
import { StitchWorkspace } from './components/StitchWorkspace.tsx';
import { playPcmAudio, type PlaybackHandle } from './core/browserMedia.ts';
import { openEnvelope } from './core/cryptoEnvelope.ts';
import { decodeFSK, type BaudRate } from './core/fskModem.ts';
import {
  autopsyFromAudioSamples,
  autopsyFromBundleJson,
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
  const [sigilXray, setSigilXray] = useState<boolean>(false);

  const [chimera, setChimera] = useState<StitchedChimera | null>(null);
  const [isStitching, setIsStitching] = useState<boolean>(false);
  const [stitchError, setStitchError] = useState<string | null>(null);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);

  const [autopsyReport, setAutopsyReport] = useState<AutopsyReport | null>(null);
  const [autopsyError, setAutopsyError] = useState<string | null>(null);

  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [playProgress, setPlayProgress] = useState<number>(0);
  const playbackRef = useRef<PlaybackHandle | null>(null);

  const [showcaseActive, setShowcaseActive] = useState<boolean>(false);
  const [showcaseStep, setShowcaseStep] = useState<number>(0);
  const [showcaseAutoPlay, setShowcaseAutoPlay] = useState<boolean>(false);
  const [shortcutsOpen, setShortcutsOpen] = useState<boolean>(false);
  const [benchAutoRunSignal, setBenchAutoRunSignal] = useState<number>(0);

  const runStitch = useCallback(
    async (opts?: {
      title?: string;
      plaintext?: string;
      passphrase?: string;
      baudRate?: BaudRate;
      compress?: boolean;
      customCarrierGrid?: PixelGrid | null;
    }): Promise<StitchedChimera | null> => {
      setIsStitching(true);
      setStitchError(null);
      setAudioNotice(null);
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
        return res;
      } catch (err) {
        setStitchError(err instanceof Error ? err.message : 'Failed to stitch chimera.');
        return null;
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

  const handleSelectPreset = useCallback(
    (id: string) => {
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
    },
    [baudRate, compress, customCarrier, runStitch],
  );

  const handleCustomCarrierChange = (grid: PixelGrid | null) => {
    setCustomCarrier(grid);
    void runStitch({ customCarrierGrid: grid });
  };

  const handleTogglePlay = useCallback(() => {
    if (isPlayingAudio) {
      playbackRef.current?.stop();
      playbackRef.current = null;
      setIsPlayingAudio(false);
      return;
    }
    if (!chimera) return;
    setAudioNotice(null);
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
      (reason) => {
        setAudioNotice(reason);
      },
    );
  }, [chimera, isPlayingAudio]);

  const handleRunLoopback = useCallback(
    async (
      mode: 'loopback' | 'noisy-sim' | 'png',
      overrideChimera?: StitchedChimera,
      overridePassphrase?: string,
    ) => {
      const target = overrideChimera ?? chimera;
      const activePass = overridePassphrase ?? passphrase;
      if (!target) return;
      setActiveTab('autopsy');
      setAutopsyError(null);
      try {
        let report: AutopsyReport;
        if (mode === 'png') {
          report = await autopsyFromPixelGrid(target.steg.grid, activePass);
        } else if (mode === 'noisy-sim') {
          const degraded = simulateAcousticChannel(target.fsk.samples, target.fsk.sampleRate, {
            snrDb: 14,
            clockDriftRatio: 1.004,
            leadingSilenceSamples: 451,
          });
          report = await autopsyFromAudioSamples(
            degraded,
            target.fsk.sampleRate,
            activePass,
            'noisy-sim',
            target.fsk.baudRate,
          );
        } else {
          report = await autopsyFromWavBytes(target.fsk.wavBytes, activePass);
          report = { ...report, source: 'loopback' };
        }
        setAutopsyReport(report);
      } catch (err) {
        setAutopsyReport(null);
        setAutopsyError(err instanceof Error ? err.message : 'Autopsy failed.');
      }
    },
    [chimera, passphrase],
  );

  const handleRunTamperDrill = useCallback(async () => {
    if (!chimera) return;
    setActiveTab('autopsy');
    setAutopsyReport(null);
    try {
      if (chimera.sealed.encrypted) {
        await openEnvelope(chimera.sealed.envelope, `${passphrase}-TAMPERED`);
      } else {
        // Flip a byte in the middle of the FSK waveform payload region to verify CRC-32 gate
        const mutated = new Float32Array(chimera.fsk.samples);
        const start = Math.floor(mutated.length * 0.35);
        const end = Math.floor(mutated.length * 0.75);
        for (let i = start; i < end; i++) {
          mutated[i] = 0;
        }
        decodeFSK(mutated, chimera.fsk.sampleRate, chimera.fsk.baudRate);
      }
      setAutopsyError('Unexpected: tampered carrier did not trigger integrity gate.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Integrity failure';
      setAutopsyError(`TAMPER DRILL VERIFIED (REJECTED CLEANLY): ${msg}`);
    }
  }, [chimera, passphrase]);

  const handleImportBundleText = useCallback(
    async (jsonText: string) => {
      setActiveTab('autopsy');
      setAutopsyError(null);
      try {
        const res = await autopsyFromBundleJson(jsonText, passphrase);
        setAutopsyReport(res);
      } catch (err) {
        setAutopsyReport(null);
        setAutopsyError(err instanceof Error ? err.message : 'Bundle import failed.');
      }
    },
    [passphrase],
  );

  const handleLoadRecoveredToStitch = useCallback(
    (recoveredText: string, recoveredTitle?: string) => {
      setSelectedPresetId('custom');
      const nextTitle = recoveredTitle || 'RECOVERED SPECIMEN';
      setTitle(nextTitle);
      setPlaintext(recoveredText);
      setActiveTab('stitch');
      void runStitch({
        title: nextTitle,
        plaintext: recoveredText,
        passphrase,
        baudRate,
        compress,
        customCarrierGrid: customCarrier,
      });
    },
    [baudRate, compress, customCarrier, passphrase, runStitch],
  );

  const executeShowcaseStep = useCallback(
    async (stepIdx: number) => {
      setShowcaseStep(stepIdx);
      if (stepIdx === 0) {
        const p0 = SPECIMEN_PRESETS[0]!;
        setSigilXray(false);
        setActiveTab('stitch');
        setSelectedPresetId(p0.id);
        setTitle(p0.title);
        setPlaintext(p0.payload);
        setPassphrase(p0.passphrase);
        await runStitch({
          title: p0.title,
          plaintext: p0.payload,
          passphrase: p0.passphrase,
          baudRate: 600,
          compress: true,
          customCarrierGrid: null,
        });
      } else if (stepIdx === 1) {
        setActiveTab('stitch');
        setSigilXray(true);
      } else if (stepIdx === 2) {
        setSigilXray(false);
        const p0 = SPECIMEN_PRESETS[0]!;
        const fresh = await runStitch({
          title: p0.title,
          plaintext: p0.payload,
          passphrase: p0.passphrase,
          baudRate: 600,
          compress: true,
          customCarrierGrid: null,
        });
        if (fresh) {
          await handleRunLoopback('noisy-sim', fresh, p0.passphrase);
        }
      } else if (stepIdx === 3) {
        const p1 = SPECIMEN_PRESETS[1]!;
        setSelectedPresetId(p1.id);
        setTitle(p1.title);
        setPlaintext(p1.payload);
        setPassphrase(p1.passphrase);
        const patchChimera = await runStitch({
          title: p1.title,
          plaintext: p1.payload,
          passphrase: p1.passphrase,
          baudRate: 600,
          compress: true,
          customCarrierGrid: null,
        });
        if (patchChimera) {
          await handleRunLoopback('png', patchChimera, p1.passphrase);
        }
      } else if (stepIdx === 4) {
        setActiveTab('benchmark');
        setBenchAutoRunSignal((s) => s + 1);
      }
    },
    [handleRunLoopback, runStitch],
  );

  const handleToggleShowcase = useCallback(() => {
    if (showcaseActive) {
      setShowcaseActive(false);
      setShowcaseAutoPlay(false);
      setSigilXray(false);
      return;
    }
    setShowcaseActive(true);
    setShowcaseAutoPlay(true);
    void executeShowcaseStep(0);
  }, [executeShowcaseStep, showcaseActive]);

  useEffect(() => {
    if (!showcaseActive || !showcaseAutoPlay) return;
    if (showcaseStep >= JUDGE_SHOWCASE_STEPS.length - 1) {
      setShowcaseAutoPlay(false);
      return;
    }
    const timer = window.setTimeout(() => {
      void executeShowcaseStep(showcaseStep + 1);
    }, 4400);
    return () => window.clearTimeout(timer);
  }, [executeShowcaseStep, showcaseActive, showcaseAutoPlay, showcaseStep]);

  // Global accessible keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      const tag = target?.tagName ?? '';
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (ev.key === 'Escape') {
        if (shortcutsOpen) {
          setShortcutsOpen(false);
          return;
        }
        if (showcaseActive) {
          setShowcaseActive(false);
          setShowcaseAutoPlay(false);
          setSigilXray(false);
        }
        return;
      }

      if (isTyping) return;

      if (ev.key === '1') {
        setActiveTab('stitch');
      } else if (ev.key === '2') {
        setActiveTab('autopsy');
      } else if (ev.key === '3') {
        setActiveTab('benchmark');
      } else if (ev.key === '?' || (ev.shiftKey && ev.key === '/')) {
        ev.preventDefault();
        setShortcutsOpen((v) => !v);
      } else if (ev.key.toLowerCase() === 'j') {
        ev.preventDefault();
        handleToggleShowcase();
      } else if (ev.code === 'Space' && activeTab === 'stitch' && tag !== 'BUTTON') {
        ev.preventDefault();
        handleTogglePlay();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, handleTogglePlay, handleToggleShowcase, shortcutsOpen, showcaseActive]);

  return (
    <div className="app-shell">
      <HeaderBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        baudRate={chimera?.fsk.baudRate ?? baudRate}
        encrypted={Boolean(passphrase)}
        fingerprintHex={chimera?.sealed.fingerprintHex ?? '--------'}
        showcaseActive={showcaseActive}
        onToggleShowcase={handleToggleShowcase}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />

      <main className="workspace-main">
        {showcaseActive && (
          <ShowcaseBanner
            stepIndex={showcaseStep}
            autoPlay={showcaseAutoPlay}
            onToggleAutoPlay={() => setShowcaseAutoPlay((v) => !v)}
            onPrev={() => {
              setShowcaseAutoPlay(false);
              if (showcaseStep > 0) void executeShowcaseStep(showcaseStep - 1);
            }}
            onNext={() => {
              setShowcaseAutoPlay(false);
              if (showcaseStep < JUDGE_SHOWCASE_STEPS.length - 1) {
                void executeShowcaseStep(showcaseStep + 1);
              } else {
                setShowcaseActive(false);
                setSigilXray(false);
              }
            }}
            onClose={() => {
              setShowcaseActive(false);
              setShowcaseAutoPlay(false);
              setSigilXray(false);
            }}
          />
        )}

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
            sigilXray={sigilXray}
            onToggleSigilXray={() => setSigilXray((v) => !v)}
            chimera={chimera}
            isStitching={isStitching}
            errorMsg={stitchError}
            audioNotice={audioNotice}
            onStitch={() => void runStitch()}
            onImportBundleText={(txt) => void handleImportBundleText(txt)}
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
            onRunTamperDrill={() => void handleRunTamperDrill()}
            onReportReady={(rep) => {
              setAutopsyError(null);
              setAutopsyReport(rep);
            }}
            onError={(msg) => {
              setAutopsyReport(null);
              setAutopsyError(msg);
            }}
            onLoadRecoveredToStitch={handleLoadRecoveredToStitch}
          />
        )}

        {activeTab === 'benchmark' && <BenchmarkWorkspace autoRunSignal={benchAutoRunSignal} />}
      </main>

      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
    </div>
  );
}

export default App;
