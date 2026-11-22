import { Activity, Cpu, FlaskConical, Keyboard, Radio, Sparkles } from 'lucide-react';

export type WorkspaceTab = 'stitch' | 'autopsy' | 'benchmark';

interface HeaderBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  baudRate: number;
  encrypted: boolean;
  fingerprintHex: string;
  showcaseActive: boolean;
  onToggleShowcase: () => void;
  onOpenShortcuts: () => void;
}

export function HeaderBar({
  activeTab,
  onSelectTab,
  baudRate,
  encrypted,
  fingerprintHex,
  showcaseActive,
  onToggleShowcase,
  onOpenShortcuts,
}: HeaderBarProps) {
  return (
    <header className="header-bar">
      <div className="brand-group">
        <div className="brand-mark" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 12H6L8.5 5L12 19L15.5 8L18 12H21"
              stroke="#39ff88"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M7 4L10 6M14 18L17 20"
              stroke="#ffb020"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className="brand-title-wrap">
          <div className="brand-title">
            FRANKENWAVE
            <span className="track-chip">KIROWEEN</span>
          </div>
          <div className="brand-subtitle">
            WebCrypto • 1200/2400Hz FSK Modem • LSB Sigil
          </div>
        </div>
      </div>

      <nav className="nav-tabs" role="tablist" aria-label="Primary Workspace">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'stitch'}
          className={`nav-tab ${activeTab === 'stitch' ? 'active' : ''}`}
          onClick={() => onSelectTab('stitch')}
        >
          <FlaskConical size={14} />
          STITCH &amp; ENCODE
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'autopsy'}
          className={`nav-tab ${activeTab === 'autopsy' ? 'active' : ''}`}
          onClick={() => onSelectTab('autopsy')}
        >
          <Radio size={14} />
          AUTOPSY &amp; DECODE
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'benchmark'}
          className={`nav-tab ${activeTab === 'benchmark' ? 'active' : ''}`}
          onClick={() => onSelectTab('benchmark')}
        >
          <Cpu size={14} />
          ANATOMY &amp; BENCH
        </button>
      </nav>

      <div className="header-right-group">
        <button
          type="button"
          className={`btn tour-btn ${showcaseActive ? 'btn-primary' : 'btn-amber'}`}
          style={{ flex: 'none', padding: '5px 10px', fontSize: 11 }}
          onClick={onToggleShowcase}
          aria-pressed={showcaseActive}
          title="Run 1-Click Guided Judge Showcase (Shortcut: J)"
        >
          <Sparkles size={12} />
          {showcaseActive ? 'TOUR ACTIVE' : 'JUDGE TOUR'}
        </button>

        <button
          type="button"
          className="btn"
          style={{ padding: '5px 8px', fontSize: 11 }}
          onClick={onOpenShortcuts}
          aria-label="Keyboard shortcuts (?)"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard size={13} />
        </button>

        <div className="status-pills">
          <span className="status-pill">
            <span className="status-dot" />
            {encrypted ? 'AES-256-GCM' : 'PLAIN SPECIMEN'}
          </span>
          <span className="status-pill">
            <Activity size={12} color="#ffb020" />
            {baudRate} BAUD
          </span>
          <span className="status-pill" title={`Active Specimen SHA-256: ${fingerprintHex || '--------'}`}>
            FP:{fingerprintHex ? fingerprintHex.slice(0, 8) : '--------'}
          </span>
        </div>
      </div>
    </header>
  );
}
