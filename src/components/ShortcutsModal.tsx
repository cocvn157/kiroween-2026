import { Keyboard, X } from 'lucide-react';

interface ShortcutsModalProps {
  onClose: () => void;
}

const SHORTCUTS: Array<[string, string]> = [
  ['1 / 2 / 3', 'Switch between Stitch, Autopsy, and Bench tabs'],
  ['Ctrl + Enter', 'Suture active specimen into FSK Audio + Sigil PNG'],
  ['Space', 'Play / Stop active FSK cassette tape (outside inputs)'],
  ['← / →', 'Scrub oscilloscope tape position when waveform is focused'],
  ['J', 'Start / Stop 1-Click Judge Showcase Tour'],
  ['?', 'Toggle this Keyboard Shortcuts reference'],
  ['Esc', 'Close overlay or exit Judge Showcase Tour'],
];

export function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      onClick={onClose}
    >
      <div className="panel-card modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <span className="panel-title" id="shortcuts-modal-title">
            <Keyboard size={15} color="#39ff88" />
            KEYBOARD TELEMETRY SHORTCUTS
          </span>
          <button
            type="button"
            className="btn"
            style={{ padding: '4px 8px' }}
            onClick={onClose}
            aria-label="Close shortcuts dialog"
          >
            <X size={13} />
          </button>
        </div>

        <div className="shortcuts-list">
          {SHORTCUTS.map(([combo, desc]) => (
            <div key={combo} className="shortcut-row">
              <kbd className="kbd-chip">{combo}</kbd>
              <span>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
