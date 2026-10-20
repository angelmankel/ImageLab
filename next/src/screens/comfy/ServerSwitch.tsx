/**
 * Rule 14: the server switch, Image · Video. A dot per side: green = answering, dim = unknown or
 * off. `compact` is the phone's small header version (30 high, content width).
 */
import { Dot } from '~/ui';
import type { ComfyKind } from './workflowStore';
import type { ComfyServerPick } from './useComfyServer';

export function ServerSwitch({ pick, online, up, compact }: { pick: ComfyServerPick; online: boolean | null; up: Record<string, boolean>; compact?: boolean }) {
  const items: Array<{ key: ComfyKind; label: string; up: boolean; none: boolean }> = [
    { key: 'image', label: 'Image', up: !!pick.imageServer && (pick.kind === 'image' ? !!online : !!up[pick.imageServer.id]), none: !pick.imageServer },
    { key: 'video', label: 'Video', up: !!pick.videoServer && (pick.kind === 'video' ? !!online : !!up[pick.videoServer.id]), none: !pick.videoServer },
  ];
  return (
    <div role="radiogroup" aria-label="Which ComfyUI server" style={{ display: 'flex', gap: 2, background: compact ? 'var(--il-elev)' : 'var(--il-card)', borderRadius: 999, padding: compact ? 3 : 4 }}>
      {items.map((it) => {
        const on = it.key === pick.kind;
        return (
          <button
            key={it.key}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={it.none}
            title={it.none ? `No ${it.label.toLowerCase()} server` : undefined}
            onClick={() => pick.setKind(it.key)}
            style={{
              flex: compact ? 'none' : 1, height: compact ? 30 : 36, padding: compact ? '0 12px' : '0 10px', border: 0, borderRadius: 999,
              background: on ? 'var(--il-card-on)' : 'transparent', color: on ? 'var(--il-fg)' : 'var(--il-muted)',
              fontWeight: 800, fontSize: compact ? 11 : 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: compact ? 6 : 8,
              cursor: it.none ? 'default' : 'pointer', opacity: it.none ? 0.45 : 1,
            }}
          >
            <Dot size={compact ? 7 : 8} color={it.up ? 'var(--il-ok)' : 'var(--il-dim)'} />
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
