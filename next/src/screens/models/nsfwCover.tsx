/**
 * The NSFW opt-in (fix list 2 item 27). Default: every NSFW picture (R and up) is covered with
 * "NSFW · tap to show" (a tap reveals that one). "Always show NSFW images" removes the covers
 * everywhere; the first time it is turned on a short confirm asks, after that it simply toggles.
 * Saved in the Models store (browser, `imagelab.next.models.v1`: there is no user store on the
 * pod). Separate from the Max rating filter, which still decides what is fetched at all.
 *
 * `useNsfwCover()` → `(nsfwLevel) => boolean` for every place that covers pictures;
 * `NsfwToggle` is the switch: an eye button (the model viewer's top bar) or a settings row.
 */
import { useCallback, useState } from 'react';
import { IconEye, IconEyeOff } from '@tabler/icons-react';
import { IconBtn, Switch } from '~/ui';
import { coversNsfw } from './civitaiQuery';
import { useModels } from './modelsStore';

/** The cover rule with the user's Max rating and opt-in applied. */
export function useNsfwCover(): (nsfwLevel: number | string | undefined | null) => boolean {
  const mask = useModels((s) => s.filters.nsfwMask);
  const show = useModels((s) => s.showNsfw);
  return useCallback((lvl) => coversNsfw(lvl, mask, show), [mask, show]);
}

/** The first-time confirm, inline (no dialog over the viewer layer). */
function Confirm({ onYes, onNo, compact }: { onYes: () => void; onNo: () => void; compact?: boolean }) {
  const btn = (primary: boolean): React.CSSProperties => ({
    height: compact ? 28 : 32, padding: '0 12px', borderRadius: 999, border: primary ? 0 : '1px solid var(--il-line-strong)', cursor: 'pointer',
    background: primary ? 'var(--il-ember)' : 'transparent', color: primary ? 'var(--il-bg)' : 'var(--il-fg)', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap',
  });
  return (
    <span role="group" aria-label="Always show NSFW images?" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-fg2)', whiteSpace: compact ? 'nowrap' : undefined }}>Show NSFW everywhere, no covers?</span>
      <button type="button" style={btn(true)} onClick={onYes}>Show</button>
      <button type="button" style={btn(false)} onClick={onNo}>Cancel</button>
    </span>
  );
}

export function NsfwToggle({ variant }: { variant: 'icon' | 'row' }) {
  const on = useModels((s) => s.showNsfw);
  const confirmed = useModels((s) => s.nsfwConfirmed);
  const set = useModels((s) => s.setShowNsfw);
  const [asking, setAsking] = useState(false);
  const flip = (next: boolean) => {
    if (next && !confirmed) { setAsking(true); return; }
    set(next);
  };
  const yes = () => { setAsking(false); set(true); };
  const no = () => setAsking(false);

  if (variant === 'icon') {
    if (asking) return <Confirm compact onYes={yes} onNo={no} />;
    return (
      <IconBtn icon={on ? <IconEye size={17} stroke={2.2} /> : <IconEyeOff size={17} stroke={2.2} />} on={on}
        label={on ? 'Cover NSFW' : 'Show NSFW'} onClick={() => flip(!on)} />
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Switch label={on ? 'On · no covers' : 'Off · covered'} checked={on} onChange={flip} />
      {asking && <Confirm onYes={yes} onNo={no} />}
    </div>
  );
}
