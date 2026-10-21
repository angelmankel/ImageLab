/**
 * Settings → Themes → Share (item 35): export the whole theme as a JSON file (or copy it),
 * import one (file or pasted text; our file, a bare theme, or a bare palette all work; the
 * imported palette is also saved under its name), and reset everything to Ember. Import and
 * reset offer Undo (3 s).
 */
import { useRef, useState } from 'react';
import { IconClipboard, IconDownload, IconFileImport, IconRestore } from '@tabler/icons-react';
import { pushUndo } from '~/app/undo';
import { notifyError, say } from '~/app/notify';
import { useTheme } from '~/theme/themeStore';
import { DEFAULT_THEME, exportTheme, parseThemeFile, PRESETS } from '~/theme/themeModel';
import { Button } from '~/ui';

const note = (message: string, err = false) => (err ? notifyError('Theme', undefined, { hint: message }) : say(message));

function currentName(): string {
  const { theme, saved } = useTheme.getState();
  return saved.find((p) => p.id === theme.paletteId)?.name ?? PRESETS.find((p) => p.id === theme.paletteId)?.name ?? 'My theme';
}

const fileText = () => JSON.stringify(exportTheme(useTheme.getState().theme, currentName()), null, 2);

function download() {
  const name = currentName().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'theme';
  const url = URL.createObjectURL(new Blob([fileText()], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.imagelab-theme.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copy() {
  try { await navigator.clipboard.writeText(fileText()); note('Theme copied as JSON'); } catch { note('Copy failed: this browser blocked the clipboard', true); }
}

function load(text: string): boolean {
  const r = parseThemeFile(text);
  if (!r.ok) { note(r.error, true); return false; }
  const before = { theme: useTheme.getState().theme, saved: useTheme.getState().saved };
  const st = useTheme.getState();
  st.replace(r.theme);
  st.savePalette(r.name);
  const after = { theme: useTheme.getState().theme, saved: useTheme.getState().saved };
  pushUndo({
    label: 'Apply theme',
    undo: () => { useTheme.setState({ saved: before.saved }); useTheme.getState().replace(before.theme); },
    redo: () => { useTheme.setState({ saved: after.saved }); useTheme.getState().replace(after.theme); },
  });
  say(`Theme “${r.name}” applied`);
  return true;
}

export function SharePanel() {
  const file = useRef<HTMLInputElement>(null);
  const [paste, setPaste] = useState<string | null>(null);
  const replace = useTheme((s) => s.replace);
  const reset = () => {
    const before = useTheme.getState().theme;
    replace(DEFAULT_THEME);
    pushUndo({ label: 'Reset theme', undo: () => replace(before), redo: () => replace(DEFAULT_THEME) });
  };
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Button size="sm" icon={<IconDownload size={14} />} onClick={download}>Export file</Button>
        <Button size="sm" icon={<IconClipboard size={14} />} onClick={copy}>Copy JSON</Button>
        <Button size="sm" icon={<IconFileImport size={14} />} onClick={() => file.current?.click()}>Import file</Button>
        <Button size="sm" on={paste !== null} onClick={() => setPaste(paste === null ? '' : null)}>Paste JSON</Button>
        <Button size="sm" tone="ghost" icon={<IconRestore size={14} />} onClick={reset}>Reset all</Button>
        <input ref={file} type="file" accept="application/json,.json" hidden
          onChange={async (e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (f) load(await f.text()); }} />
      </div>
      {paste !== null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <textarea value={paste} onChange={(e) => setPaste(e.currentTarget.value)} rows={5} aria-label="Theme JSON" placeholder='{"kind": "imagelab-theme", …}' spellCheck={false}
            style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', padding: 8, borderRadius: 'calc(10px * var(--il-corners, 1))', border: '1px solid var(--il-line-strong)', background: 'var(--il-elev)', color: 'var(--il-fg)', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11 }} />
          <div><Button size="sm" tone="primary" disabled={!paste.trim()} onClick={() => { if (load(paste)) setPaste(null); }}>Apply</Button></div>
        </div>
      )}
    </div>
  );
}
