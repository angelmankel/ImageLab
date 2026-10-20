/**
 * "Use same models as step 1" (fix list item 40), the look: the switch on top of a step 2+'s
 * Model tab (`FollowBar`) and the strip on a selected entry's card (`LinkStrip`) — linked (follows
 * step 1 live, "Set here" un-links it), un-linked ("Follow step 1" links it back), or blocked
 * (step 1's file is not offered by this loader, so the slot keeps its own).
 */
import { IconAlertTriangle, IconLink, IconLinkOff } from '@tabler/icons-react';
import { T } from '~/theme/tokens';
import { modelLabel } from '@/components/models/modelInfo';

export type LinkState = 'linked' | 'unlinked' | 'blocked';

export function FollowBar({ on, setHere, onChange }: { on: boolean; setHere: number; onChange: (on: boolean) => void }) {
  const sub = !on ? 'This step picks its own models' : setHere ? `Follows 1 · Image live · ${setHere} set here` : 'Follows 1 · Image live · change one to set it here';
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 48, padding: '8px 12px', borderRadius: T.radius.lg, cursor: 'pointer', textAlign: 'left',
        border: `1px solid ${on ? 'var(--il-ember-line)' : 'var(--il-line-strong)'}`, background: on ? 'var(--il-ember-soft)' : 'var(--il-elev)', color: 'var(--il-fg)' }}>
      <span style={{ width: 30, height: 30, flex: 'none', borderRadius: '50%', display: 'grid', placeItems: 'center', background: on ? 'var(--il-ember)' : 'var(--il-card-on)', color: on ? 'var(--il-bg)' : 'var(--il-muted)' }}>
        {on ? <IconLink size={16} stroke={2.6} /> : <IconLinkOff size={16} stroke={2.4} />}
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{ fontSize: 12, fontWeight: 800 }}>Same models as step 1</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>
      </span>
      <span aria-hidden style={{ width: 34, height: 20, flex: 'none', borderRadius: 999, position: 'relative', background: on ? 'var(--il-ember)' : 'var(--il-card-on)', transition: 'background .15s' }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: on ? 'var(--il-bg)' : 'var(--il-muted)', transition: 'left .15s' }} />
      </span>
    </button>
  );
}

export function LinkStrip({ state, expected, onUnlink, onRelink }: { state: LinkState; expected?: string; onUnlink: () => void; onRelink: () => void }) {
  const tone = state === 'linked' ? 'var(--il-ember-hi)' : state === 'blocked' ? 'var(--il-warn)' : 'var(--il-muted)';
  const text = state === 'linked' ? 'Same as step 1 · changes with it'
    : state === 'blocked' ? `Step 1 uses ${expected ? modelLabel(expected) : 'a model'} · this loader does not offer it`
    : 'Set here · not following step 1';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px 4px 10px', minHeight: 36, borderRadius: T.radius.md, background: 'var(--il-elev)', border: '1px solid var(--il-line-soft)', fontSize: 11, fontWeight: 700, color: tone }}>
      {state === 'blocked' ? <IconAlertTriangle size={13} style={{ flex: 'none' }} /> : state === 'linked' ? <IconLink size={13} style={{ flex: 'none' }} /> : <IconLinkOff size={13} style={{ flex: 'none' }} />}
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={text}>{text}</span>
      <button type="button" onClick={state === 'unlinked' ? onRelink : onUnlink}
        style={{ flex: 'none', height: 28, padding: '0 10px', border: 0, borderRadius: 999, cursor: 'pointer', fontSize: 11, fontWeight: 800, background: 'var(--il-card-on)', color: 'var(--il-fg)' }}>
        {state === 'unlinked' ? 'Follow step 1' : 'Set here'}
      </button>
    </div>
  );
}
