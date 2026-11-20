export interface FrankenPatchV1 {
  kind: 'FRANKENPATCH_V1';
  label: string;
  carrierHz: number;
  modHz: number;
  symmetry: number;
  pulseBpm: number;
  palette: 'phosphor' | 'amber' | 'crimson';
}

export interface SpecimenPreset {
  id: string;
  title: string;
  badge: string;
  passphrase: string;
  payload: string;
  description: string;
}

export const SPECIMEN_PRESETS: readonly SpecimenPreset[] = [
  {
    id: 'vault-seed',
    title: 'AIR-GAPPED RECOVERY KEY',
    badge: 'CRYPTO VAULT',
    passphrase: 'kiroween',
    description: 'AES-256-GCM encrypted API backup & recovery shard safe for vinyl/tape or PNG storage.',
    payload: JSON.stringify(
      {
        vault: 'FRANKENWAVE-RECOVERY-01',
        issued: '2026-10-31T23:59:00Z',
        backup_token: 'kw_live_98f3a1c27d4e6b10_do_not_leak',
        shards: ['alpha-44100', 'phosphor-lsb', 'crc32-verified'],
        note: 'Air-gapped backup sealed with PBKDF2-SHA256 + AES-256-GCM.',
      },
      null,
      2,
    ),
  },
  {
    id: 'synth-patch',
    title: 'TESLA COIL HARMONIC PATCH',
    badge: 'EXECUTABLE PATCH',
    passphrase: 'kiroween',
    description: 'Sandboxed audio/visual harmonic synthesizer configuration run inside Autopsy Runner.',
    payload: JSON.stringify(
      {
        kind: 'FRANKENPATCH_V1',
        label: 'NECRO-RESONATOR MK.IV',
        carrierHz: 110,
        modHz: 4.5,
        symmetry: 7,
        pulseBpm: 92,
        palette: 'phosphor',
      } satisfies FrankenPatchV1,
      null,
      2,
    ),
  },
  {
    id: 'kiroween-capsule',
    title: 'KIROWEEN TIME CAPSULE',
    badge: 'PLAIN / PUBLIC',
    passphrase: '',
    description: 'Unencrypted public capsule demonstrating compression + lossless FSK & PNG extraction.',
    payload:
      'SPECIMEN LOG #2026-KW\n' +
      'Four incompatible organs stitched alive on the operating table:\n' +
      '1. WebCrypto AES-256-GCM + PBKDF2 (120k rounds)\n' +
      '2. 1970s 1200/2400 Hz FSK Cassette Audio Modem + Goertzel PLL\n' +
      '3. Opaque 2-bit/channel LSB PNG Circuit-Sigil Cartridge\n' +
      '4. Zero-eval Declarative Harmonic Micro-Patch Engine',
  },
];

function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.max(min, Math.min(max, val));
}

/**
 * Safely validates whether decoded plaintext represents a declarative FRANKENPATCH_V1 micro-patch.
 */
export function parseFrankenPatch(plaintext: string): FrankenPatchV1 | null {
  try {
    const parsed: unknown = JSON.parse(plaintext);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const rec = parsed as Record<string, unknown>;
    if (rec.kind !== 'FRANKENPATCH_V1') return null;

    const pal =
      rec.palette === 'amber' || rec.palette === 'crimson' || rec.palette === 'phosphor'
        ? rec.palette
        : 'phosphor';

    return {
      kind: 'FRANKENPATCH_V1',
      label: typeof rec.label === 'string' && rec.label.trim() ? rec.label.trim().slice(0, 48) : 'UNNAMED PATCH',
      carrierHz: clampNum(rec.carrierHz, 55, 880, 110),
      modHz: clampNum(rec.modHz, 0.25, 24, 4),
      symmetry: Math.round(clampNum(rec.symmetry, 3, 12, 6)),
      pulseBpm: clampNum(rec.pulseBpm, 30, 200, 90),
      palette: pal,
    };
  } catch {
    return null;
  }
}
