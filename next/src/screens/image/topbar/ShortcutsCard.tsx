/**
 * Top-bar keyboard button + the shortcuts card (rule 9). The card lists ONLY keys the next UI
 * really handles; each row names where. Keep it in sync when a shortcut is added or removed:
 *   Ctrl/⌘+Enter generate ........ screens/image/GenerateBar.tsx (useShortcut 'cmd+Enter')
 *   ← → on the stage ............. screens/image/Stage.tsx (useShortcut ArrowLeft/ArrowRight)
 *   viewer Esc ← → S ............. @/components/FullscreenImage.tsx (+ VideoFullscreen Esc)
 *   library ← → Enter Delete Esc . screens/library/LibraryScreen.tsx, SearchBox.tsx (Esc clears)
 *   model preview Esc ← → ........ screens/modelViewer/useViewerKeys.ts
 *   Write it Ctrl/⌘+Enter ........ screens/image/WriteItModal.tsx
 *   models search Enter / Esc .... screens/models/FilterBar.tsx
 *   dialogs Esc .................. Mantine Modal default (closeOnEscape)
 *   H hints on / off ............. ui/UiEffects.tsx (useShortcut 'h')
 */
import { useState, type ReactNode } from 'react';
import { Popover } from '@mantine/core';
import { IconKeyboard } from '@tabler/icons-react';
import { IconBtn } from '~/ui';
import { T } from '~/theme/tokens';

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';

type Row = { keys: string[][]; what: string };
const GROUPS: { title: string; rows: Row[] }[] = [
  { title: 'Step', rows: [
    { keys: [[MOD, 'Enter']], what: 'Generate (also while typing)' },
    { keys: [['←'], ['→']], what: 'Step through the results' },
    { keys: [['Delete'], ['Backspace']], what: 'Delete the shown result (Undo in the note)' },
  ] },
  { title: 'Fullscreen viewer', rows: [
    { keys: [['←'], ['→']], what: 'Previous / next' },
    { keys: [['S']], what: 'Play / pause slideshow' },
    { keys: [['Esc']], what: 'Close' },
  ] },
  { title: 'Library', rows: [
    { keys: [['←'], ['→']], what: 'Move the selection' },
    { keys: [['Enter']], what: 'Open in the viewer' },
    { keys: [['Delete']], what: 'Delete (asks first)' },
    { keys: [['Esc']], what: 'Leave Select · clear the search box' },
  ] },
  { title: 'Models', rows: [
    { keys: [['Enter']], what: 'Search' },
    { keys: [['Esc']], what: 'Clear the search' },
    { keys: [['←'], ['→']], what: 'Preview: previous / next image' },
    { keys: [['Esc']], what: 'Preview: close' },
  ] },
  { title: 'App', rows: [
    { keys: [['H']], what: 'Hints on / off' },
  ] },
  { title: 'Dialogs', rows: [
    { keys: [[MOD, 'Enter']], what: '“Write it”: run' },
    { keys: [['Esc']], what: 'Close a dialog' },
  ] },
];

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd style={{
      minWidth: 20, height: 20, padding: '0 6px', borderRadius: T.radius.xs, display: 'inline-grid', placeItems: 'center',
      background: 'var(--il-elev)', border: '1px solid var(--il-line-strong)', color: 'var(--il-fg)',
      fontFamily: 'inherit', fontSize: 11, fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap',
    }}>{children}</kbd>
  );
}

function Keys({ keys }: { keys: string[][] }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: T.gap.xs, flex: 'none' }}>
      {keys.map((combo, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          {i > 0 && <span style={{ color: 'var(--il-dim)', fontSize: 11, marginRight: 1 }}>/</span>}
          {combo.map((k, j) => (
            <span key={j} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              {j > 0 && <span style={{ color: 'var(--il-dim)', fontSize: 11 }}>+</span>}
              <Kbd>{k}</Kbd>
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}

export function ShortcutsCard() {
  const [open, setOpen] = useState(false);
  return (
    <Popover opened={open} onChange={setOpen} position="bottom-end" shadow="lg" withinPortal zIndex={T.z.modal}>
      <Popover.Target>
        <span style={{ display: 'inline-flex' }}>
          <IconBtn icon={<IconKeyboard size={18} />} label="Keyboard shortcuts" onClick={() => setOpen((o) => !o)} on={open} tooltip={!open} />
        </span>
      </Popover.Target>
      <Popover.Dropdown style={{
        width: 'min(560px, calc(100vw - 32px))', background: 'var(--il-panel)', border: '1px solid var(--il-line-soft)',
        borderRadius: T.radius.xl, padding: T.pad.panel,
      }}>
        <div className="il-eyebrow" style={{ margin: '2px 2px 8px' }}>Keyboard shortcuts</div>
        <div className="il-scroll" style={{ maxHeight: 'calc(100dvh - 120px)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: T.gap.md }}>
          {GROUPS.map((g) => (
            <section key={g.title} style={{ background: 'var(--il-card)', border: '1px solid var(--il-line-soft)', borderRadius: T.radius.lg, padding: T.pad.card }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--il-fg)', marginBottom: T.gap.sm }}>{g.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: T.gap.sm }}>
                {g.rows.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: T.gap.md }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-fg2)', minWidth: 0 }}>{r.what}</span>
                    <Keys keys={r.keys} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}
