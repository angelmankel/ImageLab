/**
 * Style tab: the quiet servers strip on top (mockup style-tab.html A/B). Folded it reads
 * "Servers · SDXL · Ready" (or what is wrong); it opens by itself when a server lacks something the
 * model type could use, listing per server what runs and what is missing, with Check again
 * (re-reads every server's /object_info after installing nodes and restarting ComfyUI).
 */
import { useState } from 'react';
import { IconRefresh } from '@tabler/icons-react';
import { TYPE_INFO, type StyleFamily } from '@/lib/styleRefs';
import { CollapseHeader } from '~/ui';
import { Collapse as MCollapse } from '@mantine/core';
import { useIsPhone } from '~/app/useIsPhone';
import { T } from '~/theme/tokens';
import { readiness, type ServerRow } from './styleTabLogic';
import { recheckServers } from './useStyleServers';

const pill = (ok: boolean) => ({
  height: 20, padding: '0 7px', borderRadius: 999, fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' as const,
  background: ok ? 'var(--il-ok-soft)' : 'var(--il-elev)', color: ok ? 'var(--il-ok)' : 'var(--il-warn)', boxShadow: `inset 0 0 0 1px ${ok ? 'var(--il-ok-line)' : 'var(--il-line-strong)'}`,
});

export function ServerStrip({ rows, typeName, fam }: { rows: ServerRow[]; typeName: string; fam: StyleFamily }) {
  const phone = useIsPhone();
  const state = readiness(rows, fam);
  const [open, setOpen] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = open ?? (state !== 'ready');
  const word = state === 'ready' ? `Ready${rows.filter((r) => r.online).length > 1 ? ` on ${rows.filter((r) => r.online).length}` : ''}` : state === 'partial' ? 'Partly ready' : state === 'offline' ? 'No server online' : 'Needs nodes';
  const check = async () => { setBusy(true); try { await recheckServers(); } finally { setBusy(false); } };
  return (
    <div style={{ background: 'var(--il-elev)', borderRadius: T.radius.md, padding: '4px 10px', flex: 'none' }}>
      <CollapseHeader open={shown} onToggle={() => setOpen(!shown)} label={`Servers · ${typeName}`}
        extra={<span style={{ ...pill(state === 'ready'), marginLeft: 4 }}>{word}</span>} />
      <MCollapse in={shown}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0 8px' }}>
          {rows.map((r) => (
            <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: !r.online ? 'var(--il-dim)' : r.lacks.length ? 'var(--il-warn)' : 'var(--il-ok)' }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--il-fg)' }}>{r.name}</span>
                <span style={{ flex: 1 }} />
                {!r.online ? <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-dim)' }}>offline</span>
                  : r.ready.map((t) => <span key={t} style={pill(true)}>✓ {TYPE_INFO[t].title}</span>)}
              </div>
              {r.online && r.lacks.length > 0 && (
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-fg2)', lineHeight: 1.5, paddingLeft: 16 }}>
                  Missing: {r.lacks.map((m, i) => <span key={m}>{i ? ' · ' : ''}<b style={{ color: 'var(--il-warn)', fontWeight: 800 }}>{m}</b></span>)}
                </div>
              )}
            </div>
          ))}
          {!rows.length && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)' }}>No image server set up.</div>}
          <button type="button" onClick={() => void check()} disabled={busy}
            style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: phone ? 40 : 28, padding: '0 10px', borderRadius: 999, border: 0, background: 'var(--il-card)', color: 'var(--il-fg2)', fontSize: 11, fontWeight: 800, cursor: busy ? 'wait' : 'pointer' }}>
            <IconRefresh size={13} stroke={2.4} style={{ animation: busy ? 'spin 1s linear infinite' : undefined }} />{busy ? 'Checking…' : 'Check again'}
          </button>
        </div>
      </MCollapse>
    </div>
  );
}
