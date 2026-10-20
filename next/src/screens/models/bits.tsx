/**
 * Small pieces the Models screen is built from (the board's exact shapes): the ember filter chip,
 * cover badges, the "SORT / Most Downloaded ▾" pill with its menu, the segmented pill, stat rows,
 * avatars, the eyebrow and the two button kinds. Sizes come in `size: 'desktop' | 'phone'`.
 */
import type { CSSProperties, ReactNode } from 'react';
import { Menu } from '@mantine/core';
import { IconDownload, IconHeart, IconMessageCircle, IconStarFilled, IconThumbUp } from '@tabler/icons-react';
import { fmtCount } from './civitaiQuery';

export type Size = 'desktop' | 'phone';

/** Filter chip: outlined, filled ember when on. 28 high on desktop, 38 on the phone sheet, 40 in the phone row. */
export function FChip({ children, on, onClick, size = 'desktop', tall, dot, style, title }: {
  children: ReactNode; on?: boolean; onClick?: () => void; size?: Size; tall?: boolean; dot?: boolean; style?: CSSProperties; title?: string;
}) {
  const h = size === 'phone' ? (tall ? 40 : 38) : 28;
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      title={title}
      style={{
        height: h, padding: size === 'phone' ? '0 13px' : dot ? '0 11px 0 9px' : '0 11px', flex: 'none',
        border: on ? 0 : '1px solid var(--il-line-strong)', borderRadius: 999,
        background: on ? 'var(--il-ember)' : 'transparent', color: on ? 'var(--il-bg)' : 'var(--il-fg2)',
        fontWeight: on ? 800 : 700, fontSize: size === 'phone' ? 12 : 11, display: 'inline-flex', alignItems: 'center', gap: 6,
        whiteSpace: 'nowrap', cursor: 'pointer', ...style,
      }}
    >
      {dot && <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: on ? 'var(--il-bg)' : 'var(--il-dim)' }} />}
      {children}
    </button>
  );
}

/** The group label before a chip row: "TYPE", "BASE". */
export function Label({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.5px', color: 'var(--il-muted)', flex: 'none', ...style }}>{children}</span>;
}

/** A translucent badge on a cover ("CHECKPOINT", "Illustrious", "v3 · 3 versions"). */
export function CoverBadge({ children, at, tone = 'fg' }: { children: ReactNode; at: 'tl' | 'tr' | 'bl' | 'br'; tone?: 'fg' | 'ember' | 'muted' }) {
  const pos: CSSProperties = { [at[0] === 't' ? 'top' : 'bottom']: 8, [at[1] === 'l' ? 'left' : 'right']: 8 };
  const color = tone === 'ember' ? 'var(--il-ember-hi)' : tone === 'muted' ? 'var(--il-fg2)' : 'var(--il-fg)';
  return (
    <span style={{
      position: 'absolute', ...pos, height: 20, padding: '0 7px', borderRadius: 999, background: 'rgba(20,20,22,.72)', color,
      fontSize: tone === 'muted' ? 10 : 9, fontWeight: tone === 'muted' ? 700 : 800, letterSpacing: tone === 'fg' ? '.5px' : undefined,
      display: 'flex', alignItems: 'center', maxWidth: 'calc(100% - 16px)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', pointerEvents: 'none',
    }}>{children}</span>
  );
}

/** The small chip in a list row / the detail head ("Illustrious", "CHECKPOINT", "NSFW"). */
export function Tag({ children, tone = 'fg', outlined, size = 'desktop', onClick }: { children: ReactNode; tone?: 'fg' | 'ember' | 'muted' | 'emberLine'; outlined?: boolean; size?: Size; onClick?: () => void }) {
  const h = size === 'phone' ? 24 : 22;
  const color = tone === 'ember' ? 'var(--il-ember-hi)' : tone === 'emberLine' ? 'var(--il-ember)' : tone === 'muted' ? 'var(--il-muted)' : 'var(--il-fg)';
  const style: CSSProperties = {
    height: h, padding: '0 9px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: size === 'phone' ? 11 : 10,
    fontWeight: tone === 'muted' ? 700 : 800, color, whiteSpace: 'nowrap',
    background: outlined ? 'transparent' : 'var(--il-card-on)', border: outlined ? `1px solid ${tone === 'emberLine' ? 'var(--il-ember)' : 'var(--il-line-strong)'}` : 0,
    cursor: onClick ? 'pointer' : undefined,
  };
  return onClick ? <button type="button" onClick={onClick} style={style}>{children}</button> : <span style={style}>{children}</span>;
}

/** "SORT / Most Downloaded ▾": a pill that opens a menu of options. */
export function MenuPill<K extends string>({ label, value, options, onChange, size = 'desktop', grow }: {
  label: string; value: K; options: Array<{ key: K; label: string }>; onChange: (k: K) => void; size?: Size; grow?: boolean;
}) {
  const current = options.find((o) => o.key === value)?.label ?? value;
  return (
    <Menu position="bottom-start" withinPortal shadow="md" width={200} zIndex={300}>
      <Menu.Target>
        <button
          type="button"
          aria-label={`${label}: ${current}`}
          style={{
            height: size === 'phone' ? 44 : 36, padding: size === 'phone' ? '0 10px' : '0 12px', border: 0, borderRadius: size === 'phone' ? 14 : 999,
            background: size === 'phone' ? 'var(--il-card)' : 'var(--il-elev)', color: 'var(--il-fg)', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 8, flex: grow ? 1 : 'none', minWidth: 0, textAlign: 'left', cursor: 'pointer',
          }}
        >
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, minWidth: 0 }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.5px', color: 'var(--il-muted)' }}>{label.toUpperCase()}</span>
            <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{current}</span>
          </span>
          <span style={{ color: 'var(--il-muted)' }}>▾</span>
        </button>
      </Menu.Target>
      <Menu.Dropdown style={{ background: 'var(--il-card)', border: '1px solid var(--il-line-strong)', borderRadius: 12, padding: 4 }}>
        {options.map((o) => (
          <Menu.Item key={o.key} onClick={() => onChange(o.key)} style={{ borderRadius: 8, fontWeight: o.key === value ? 800 : 600, fontSize: 12, color: o.key === value ? 'var(--il-ember-hi)' : 'var(--il-fg)' }}>
            {o.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

/** The segmented pill (Source, Period, NSFW level, Version): dark track, ember active. */
export function SegPill<K extends string>({ items, value, onChange, size = 'desktop', fill, label, small }: {
  items: Array<{ key: K; label: ReactNode }>; value: K; onChange: (k: K) => void; size?: Size; fill?: boolean; label: string; small?: boolean;
}) {
  const h = size === 'phone' ? 38 : small ? 24 : 30;
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', gap: 2, background: size === 'phone' ? 'var(--il-panel)' : 'var(--il-elev)', borderRadius: 999, padding: small ? 2 : 3, flex: fill ? 1 : 'none', width: fill ? '100%' : undefined }}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <button
            key={it.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(it.key)}
            style={{
              flex: fill ? 1 : 'none', height: h, padding: small ? '0 10px' : '0 12px', border: 0, borderRadius: 999,
              background: on ? 'var(--il-ember)' : 'transparent', color: on ? 'var(--il-bg)' : 'var(--il-muted)',
              fontWeight: on ? 800 : 700, fontSize: small ? 11 : 12, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

/** Downloads · likes · comments · rating. */
export function Stats({ stats, size = 'desktop', gap = 8, full }: {
  stats: { downloadCount?: number; thumbsUpCount?: number; commentCount?: number; rating?: number; ratingCount?: number; favoriteCount?: number; tippedAmountCount?: number } | undefined;
  size?: Size; gap?: number; full?: boolean;
}) {
  const s = stats ?? {};
  const icon = size === 'phone' ? 11 : 12;
  const Item = ({ children, color }: { children: ReactNode; color?: string }) => (
    <span style={{ display: 'flex', alignItems: 'center', gap: 3, color }}>{children}</span>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap, fontSize: 11, fontWeight: 700, color: 'var(--il-muted)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
      <Item><IconDownload size={icon} stroke={2.4} />{fmtCount(s.downloadCount)}</Item>
      <Item><IconThumbUp size={icon} stroke={2.2} />{fmtCount(s.thumbsUpCount)}</Item>
      {(full || size === 'desktop') && <Item><IconMessageCircle size={icon} stroke={2.2} />{fmtCount(s.commentCount)}</Item>}
      {s.rating != null && s.rating > 0 && (
        <Item color="var(--il-ember-hi)"><IconStarFilled size={icon} />{s.rating.toFixed(1)}{full && s.ratingCount ? <span style={{ color: 'var(--il-muted)' }}>({fmtCount(s.ratingCount)})</span> : null}</Item>
      )}
      {full && s.favoriteCount != null && <Item><IconHeart size={icon} stroke={2.2} />{fmtCount(s.favoriteCount)}</Item>}
    </div>
  );
}

/** A creator's round avatar (letter when there is no picture). */
export function Avatar({ creator, size = 16 }: { creator: { username?: string; image?: string | null } | undefined; size?: number }) {
  const letter = (creator?.username ?? '?').slice(0, 1).toUpperCase();
  return creator?.image
    ? <img src={creator.image} alt="" width={size} height={size} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flex: 'none' }} />
    : <span aria-hidden style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg, var(--il-ember-line), var(--il-ember-soft))', display: 'grid', placeItems: 'center', fontSize: Math.round(size * 0.55), fontWeight: 800, color: 'var(--il-fg)', flex: 'none' }}>{letter}</span>;
}

/** The ember action button ("Download", "Use in step 1", "Show 128 models"). */
export function EmberBtn({ children, onClick, size = 'desktop', h, disabled, style, label, round }: {
  children: ReactNode; onClick?: () => void; size?: Size; h?: number; disabled?: boolean; style?: CSSProperties; label?: string; round?: boolean;
}) {
  const height = h ?? (size === 'phone' ? 44 : 28);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{
        height, width: round ? height : undefined, padding: round ? 0 : '0 12px', border: 0, borderRadius: round ? '50%' : height >= 40 ? 12 : 999,
        background: 'var(--il-ember)', color: 'var(--il-bg)', fontWeight: 800, fontSize: size === 'phone' ? 12 : 11, flex: 'none',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap', ...style,
      }}
    >
      {children}
    </button>
  );
}

/** The outlined button ("Use", "Follow", "Open on CivitAI"). */
export function GhostBtn({ children, onClick, size = 'desktop', h, style, label, round, tone = 'fg', href }: {
  children: ReactNode; onClick?: () => void; size?: Size; h?: number; style?: CSSProperties; label?: string; round?: boolean; tone?: 'fg' | 'ember' | 'err' | 'muted'; href?: string;
}) {
  const height = h ?? (size === 'phone' ? 44 : 28);
  const color = tone === 'ember' ? 'var(--il-ember)' : tone === 'err' ? 'var(--il-err)' : tone === 'muted' ? 'var(--il-fg2)' : 'var(--il-fg)';
  const base: CSSProperties = {
    height, width: round ? height : undefined, padding: round ? 0 : '0 10px', border: tone === 'err' ? 0 : '1px solid var(--il-line-strong)', borderRadius: round ? '50%' : height >= 40 ? 12 : 999,
    background: 'transparent', color, fontWeight: 700, fontSize: size === 'phone' ? 12 : 11, flex: 'none', textDecoration: 'none',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap', ...style,
  };
  if (href) return <a href={href} target="_blank" rel="noreferrer" aria-label={label} title={label} style={base}>{children}</a>;
  return <button type="button" onClick={onClick} aria-label={label} title={label} style={base}>{children}</button>;
}

/** The 44px round action at the end of a phone row (download / installed). */
export function RoundAction({ children, onClick, label, tone = 'ember', disabled }: { children: ReactNode; onClick?: () => void; label: string; tone?: 'ember' | 'ok' | 'ghost'; disabled?: boolean }) {
  const style: CSSProperties = {
    width: 44, height: 44, padding: 0, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center',
    border: tone === 'ghost' ? '1px solid var(--il-line-strong)' : 0,
    background: tone === 'ember' ? 'var(--il-ember)' : tone === 'ok' ? 'var(--il-panel)' : 'transparent',
    color: tone === 'ember' ? 'var(--il-bg)' : tone === 'ok' ? 'var(--il-ok)' : 'var(--il-ember)',
    cursor: onClick && !disabled ? 'pointer' : 'default', opacity: disabled ? 0.5 : 1,
  };
  return onClick
    ? <button type="button" onClick={onClick} aria-label={label} title={label} disabled={disabled} style={style}>{children}</button>
    : <span aria-label={label} title={label} style={style}>{children}</span>;
}

/** A soft placeholder gradient for a cover that has no image yet. */
export const COVER_FALLBACK = 'linear-gradient(135deg, #2B2B33, #1C1C21)';
