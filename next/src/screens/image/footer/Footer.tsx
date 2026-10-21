/**
 * The tiny footer along the bottom of the whole desktop screen (fix list 19). Left: Shortcuts
 * (always), then the optional parts — Hints on / off (item 26's switch), the job line with its
 * progress (engine's `useJobProgress`), model downloads. Right: the "⋯" menu that switches the optional parts on / off
 * (remembered, `footerStore.ts`), then the clock (always). 24px tall, its own row: it never
 * covers the picture.
 */
import type { ReactNode } from 'react';
import { Menu } from '@mantine/core';
import { IconCheck, IconDots, IconKeyboard } from '@tabler/icons-react';
import { useJobProgress } from '~/app/jobProgress';
import { useSaid } from '~/app/notify';
import { HintsToggle } from '~/ui/HintsToggle';
import { Tip } from '~/ui/Tip';
import { T } from '~/theme/tokens';
import { Clock } from '../topbar/Clock';
import { ShortcutsCard } from '../topbar/ShortcutsCard';
import { FOOTER_PARTS, useFooter, type FooterPart } from './footerStore';

const PART: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 20, padding: '0 6px', borderRadius: 6, border: 0,
  background: 'transparent', color: 'inherit', font: 'inherit', whiteSpace: 'nowrap', flex: 'none',
};

function Part({ children, onClick, label, on }: { children: ReactNode; onClick?: () => void; label: string; on?: boolean }) {
  const el = onClick
    ? <button type="button" className="il-foot-part" onClick={onClick} aria-label={label} aria-pressed={on} style={{ ...PART, cursor: 'pointer', color: on ? 'var(--il-ember-hi)' : undefined }}>{children}</button>
    : <span className="il-foot-part" style={PART}>{children}</span>;
  return <Tip label={label} position="top">{el}</Tip>;
}

function HintsPart() {
  return <HintsToggle size={20} withLabel />;
}

/** The live job line (engine's `useJobProgress`): "▶ 42% · step 2 · 3 queued" with a bar; Done / Error / Offline flash. */
function JobPart() {
  const state = useJobProgress((p) => p.state);
  const percent = useJobProgress((p) => p.percent);
  const label = useJobProgress((p) => p.label);
  const color = state === 'error' || state === 'offline' ? 'var(--il-err)' : state === 'done' ? 'var(--il-ok)' : 'var(--il-ember)';
  return (
    <Part label="The current job (switch off in ⋯)">
      <span style={{ color }}>{state === 'running' ? '▶' : state === 'done' ? '✓' : state === 'error' || state === 'offline' ? '⚠' : state === 'queued' ? '…' : '●'}</span>
      <span style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }}>{label}</span>
      {state === 'running' && (
        <span aria-hidden style={{ width: 90, height: 4, borderRadius: 2, background: 'var(--il-line)', overflow: 'hidden' }}>
          <i style={{ display: 'block', height: '100%', width: `${percent ?? 0}%`, background: 'var(--il-ember)', transition: 'width .3s' }} />
        </span>
      )}
    </Part>
  );
}

/** Model downloads in flight (only while there are some). */
function DownloadsPart() {
  const n = useJobProgress((p) => p.downloads);
  const pct = useJobProgress((p) => p.downloadPercent);
  if (!n) return null;
  return <Part label="Model downloads">↓ {n}{pct != null ? ` · ${Math.round(pct)}%` : ''}</Part>;
}

/** The status line (`say()`, list 2 #12): routine confirmations live here instead of toasts. */
function SaidPart() {
  const text = useSaid((s) => s.text);
  const tone = useSaid((s) => s.tone);
  if (!text) return null;
  const color = tone === 'warn' ? 'var(--il-warn)' : tone === 'busy' ? 'var(--il-fg2)' : 'var(--il-ok)';
  return (
    <span role="status" aria-live="polite" className="il-foot-part" style={{ ...PART, color, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {tone === 'ok' ? <IconCheck size={13} stroke={2.6} /> : tone === 'warn' ? '⚠' : '…'} {text}
    </span>
  );
}

const RENDER: Record<FooterPart, () => ReactNode> = { hints: () => <HintsPart />, job: () => <JobPart />, downloads: () => <DownloadsPart /> };

export function Footer() {
  const shown = useFooter((s) => s.shown);
  const toggle = useFooter((s) => s.toggle);
  return (
    <footer style={{
      height: 24, flex: 'none', display: 'flex', alignItems: 'center', gap: T.gap.sm, padding: '0 10px',
      borderTop: '1px solid var(--il-line)', background: 'var(--il-bg-deep)', color: 'var(--il-muted)', fontSize: 11, fontWeight: 700,
    }}>
      <ShortcutsCard position="top-start" trigger={(open, t) => (
        <button type="button" className="il-foot-part" onClick={t} aria-pressed={open} style={{ ...PART, cursor: 'pointer', color: open ? 'var(--il-ember-hi)' : undefined }}>
          <IconKeyboard size={14} /> Shortcuts
        </button>
      )} />
      {FOOTER_PARTS.filter((p) => shown[p.id]).map((p) => <span key={p.id} style={{ display: 'contents' }}>{RENDER[p.id]()}</span>)}
      <SaidPart />
      <span style={{ flex: 1 }} />
      <Menu position="top-end" shadow="lg" width={220} withinPortal zIndex={T.z.popover}>
        <Menu.Target>
          <button type="button" className="il-foot-part" aria-label="Choose what the footer shows" style={{ ...PART, cursor: 'pointer' }}><IconDots size={14} /></button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>Show in the footer</Menu.Label>
          {FOOTER_PARTS.map((p) => (
            <Menu.Item key={p.id} closeMenuOnClick={false} onClick={() => toggle(p.id)}
              leftSection={<IconCheck size={14} style={{ opacity: shown[p.id] ? 1 : 0 }} />}>{p.label}</Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
      <span style={{ display: 'inline-flex', alignItems: 'center' }}><Clock /></span>
    </footer>
  );
}
