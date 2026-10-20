/**
 * The "Change ▾" picker (rule 4): a grid of the server's models of one kind — CivitAI thumbnail,
 * name, base-model badge — with a search box and base-model chips. Picked ones carry an ember
 * ring; files a server does not have are dimmed. Exported on its own so the Models screen can
 * reuse it. Pure presentation + filtering: the caller says what happens on a pick.
 */
import { useEffect, useMemo, useState } from 'react';
import { TextInput } from '@mantine/core';
import { IconSearch, IconX } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { BASE_MODEL_BUCKETS, type BaseModelBucket } from '@/lib/modelHash';
import type { Availability } from '@/hooks/useResourceAvailability';
import { Chip } from '~/ui';
import { T } from '~/theme/tokens';
import { Thumb } from './Thumb';
import { readModelMeta, type ModelMeta } from './useModelMeta';
import { openModelViewer } from './viewerBridge';

export function ModelPickerGrid({ files, selected, onPick, fits, availability, tile = 104, maxHeight }: {
  /** Every file of this kind the servers offer. */
  files: string[];
  /** Files already in the workflow (ember ring, sorted first). */
  selected?: string[];
  onPick: (file: string) => void;
  /** Only files whose base-model bucket fits the checkpoint's type show, until "Show all". */
  fits?: { label: string; fits: (bucket: BaseModelBucket) => boolean };
  availability?: (file: string) => Availability;
  /** Tile width in px; the grid fits as many as the width allows. */
  tile?: number;
  /** The grid scrolls inside this height when set. */
  maxHeight?: number | string;
}) {
  const [search, setSearch] = useState('');
  const [bucket, setBucket] = useState<BaseModelBucket | null>(null);
  const [showAll, setShowAll] = useState(false);
  const hashes = useStore((s) => s.modelHashes);
  const civitai = useStore((s) => s.civitaiByHash);

  const metas = useMemo(() => {
    const m = new Map<string, ModelMeta>();
    for (const f of files) m.set(f, readModelMeta(f, hashes, civitai));
    return m;
  }, [files, hashes, civitai]);

  const fitting = useMemo(() => (fits && !showAll ? files.filter((f) => fits.fits(metas.get(f)!.bucket)) : files), [files, fits, showAll, metas]);
  const hidden = files.length - fitting.length;

  const buckets = useMemo(() => {
    const present = new Set<BaseModelBucket>();
    for (const f of fitting) present.add(metas.get(f)!.bucket);
    return BASE_MODEL_BUCKETS.filter((b) => present.has(b));
  }, [fitting, metas]);
  useEffect(() => { if (bucket && !buckets.includes(bucket)) setBucket(null); }, [buckets, bucket]);

  // Selected first (read once per file list so a pick never shuffles the grid under the finger), then by name.
  const pinned = useMemo(() => new Set(selected ?? []), [files]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return fitting
      .filter((f) => {
        const m = metas.get(f)!;
        if (bucket && m.bucket !== bucket) return false;
        return !q || f.toLowerCase().includes(q) || (m.name ?? '').toLowerCase().includes(q);
      })
      .sort((a, b) => Number(pinned.has(b)) - Number(pinned.has(a)) || metas.get(a)!.label.localeCompare(metas.get(b)!.label));
  }, [fitting, search, bucket, metas, pinned]);

  const isSelected = (f: string) => !!selected?.includes(f);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
      <TextInput
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        placeholder="Search models"
        aria-label="Search models"
        size="sm"
        radius="xl"
        leftSection={<IconSearch size={14} />}
        rightSection={search ? <button type="button" aria-label="Clear" onClick={() => setSearch('')} style={{ border: 0, background: 'transparent', color: 'var(--il-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><IconX size={14} /></button> : null}
        styles={{ input: { background: 'var(--il-elev)', borderColor: 'var(--il-line-strong)', fontWeight: 600, fontSize: 12 } }}
      />
      {(buckets.length > 1 || hidden > 0) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {buckets.length > 1 && <Chip small on={!bucket} onClick={() => setBucket(null)}>All</Chip>}
          {buckets.length > 1 && buckets.map((b) => <Chip key={b} small on={bucket === b} onClick={() => setBucket(bucket === b ? null : b)}>{b}</Chip>)}
          {fits && hidden > 0 && !showAll && <Chip small dashed onClick={() => setShowAll(true)} title={`${hidden} that do not fit ${fits.label} are hidden`}>+ {hidden} other types</Chip>}
          {fits && showAll && hidden > 0 && <Chip small on onClick={() => setShowAll(false)}>✓ All types</Chip>}
        </div>
      )}
      <div className="il-scroll" style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${tile}px, 1fr))`, gap: 8, maxHeight, touchAction: 'pan-y', paddingBottom: 2 }}>
        {shown.map((f) => {
          const m = metas.get(f)!;
          const on = isSelected(f);
          const a = availability?.(f);
          const dim = a ? !a.enabled : false;
          const title = a && a.servers.length ? `${m.name ?? m.label}\nOn ${a.servers.join(', ')}` : a ? `${m.name ?? m.label}\nNot installed on the current server` : (m.name ?? m.label);
          return (
            <div key={f} style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, opacity: dim ? 0.45 : 1 }}>
              <button
                type="button"
                onClick={() => void openModelViewer({ file: f })}
                aria-label={`Open ${m.name ?? m.label} full screen`}
                title="Open full screen"
                style={{ position: 'relative', display: 'block', aspectRatio: '1', borderRadius: T.radius.md, overflow: 'hidden', outline: on ? '3px solid var(--il-ember)' : undefined, outlineOffset: -3, border: 0, padding: 0, background: 'transparent', cursor: 'pointer', width: '100%' }}
              >
                <Thumb label={m.label} images={m.images} size={tile} style={{ width: '100%', height: '100%', borderRadius: T.radius.md }} />
                {m.bucket !== 'Unknown' && (
                  <span style={{ position: 'absolute', left: 6, bottom: 6, fontSize: 10, fontWeight: 800, borderRadius: 999, padding: '2px 7px', background: 'rgba(20,20,22,.78)', color: 'var(--il-fg2)' }}>{m.bucket}</span>
                )}
                {on && <span style={{ position: 'absolute', right: 6, top: 6, fontSize: 10, fontWeight: 800, borderRadius: 999, padding: '2px 7px', background: 'var(--il-ember)', color: 'var(--il-bg)' }}>✓</span>}
              </button>
              <button
                type="button"
                onClick={() => onPick(f)}
                aria-pressed={on}
                title={`${title}\nTap to pick`}
                style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 30, padding: '4px 8px', border: 0, borderRadius: 999, background: on ? 'var(--il-ember-soft)' : 'var(--il-card-on)', color: on ? 'var(--il-ember-hi)' : 'var(--il-fg)', cursor: 'pointer', textAlign: 'left', minWidth: 0 }}
              >
                <span style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 700, lineHeight: 1.25, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflowWrap: 'anywhere' }}>{m.name ?? m.label}</span>
                <span aria-hidden style={{ flex: 'none', fontSize: 12, fontWeight: 800, color: on ? 'var(--il-ember-hi)' : 'var(--il-ok)' }}>{on ? '✓' : '+'}</span>
              </button>
            </div>
          );
        })}
        {!shown.length && (
          <div style={{ gridColumn: '1 / -1', padding: '24px 0', textAlign: 'center', fontSize: 12, color: 'var(--il-muted)' }}>
            {files.length ? 'Nothing matches' : 'The server offers none of this kind'}
          </div>
        )}
      </div>
    </div>
  );
}
