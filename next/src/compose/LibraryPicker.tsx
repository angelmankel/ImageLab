/**
 * The drop zone's "Library" (fix list 41: "From history, from Collections"): one window to pick a
 * picture the app already has — Recent (every image result), Liked, Collections (pick one, then
 * its pictures; generations and imports alike, `useCollectionTiles`) and, for a workflow slot, the
 * files already On the server. Search by prompt or file name. A tap picks; the zone fetches it.
 */
import { useMemo, useState } from 'react';
import { Modal } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { useImageResults } from '@/features/workspace/results';
import { useCollectionTiles } from '@/features/collections/useCollectionTiles';
import { useIsPhone } from '~/app/useIsPhone';
import { Tabs } from '~/ui';
import { T } from '~/theme/tokens';
import { displayName, type Origin } from './inputLogic';
import { dvh } from '~/theme/uiScale';

export interface LibraryPick { url: string; name: string; origin: Origin; /** A server file name (On the server): the slot takes it as is, nothing is fetched. */ serverFile?: string }

export interface ServerFiles {
  files: readonly string[];
  /** A preview URL for a server file, or null when it cannot be shown. */
  viewUrl: (file: string) => string | null;
}

type Tab = 'recent' | 'liked' | 'collections' | 'server';
const MAX = 240;

interface Cell { key: string; url: string; name: string; search: string }

function Grid({ cells, onPick, empty }: { cells: Cell[]; onPick: (c: Cell) => void; empty: string }) {
  if (!cells.length) return <div style={{ padding: '36px 8px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--il-muted)' }}>{empty}</div>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 6 }}>
      {cells.slice(0, MAX).map((c) => (
        <button key={c.key} type="button" onClick={() => onPick(c)} title={c.name} aria-label={c.name}
          style={{ aspectRatio: '1', padding: 0, border: 0, borderRadius: T.radius.sm, overflow: 'hidden', background: 'var(--il-bg-deep)', cursor: 'pointer' }}>
          <img src={c.url} alt="" loading="lazy" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </button>
      ))}
    </div>
  );
}

function Collections({ q, onPick }: { q: string; onPick: (c: Cell) => void }) {
  const collections = useStore((s) => s.collections);
  const [open, setOpen] = useState<string | null>(null);
  const id = open && collections.some((c) => c.id === open) ? open : collections[0]?.id ?? null;
  const { tiles } = useCollectionTiles({ bucket: id ?? '__none__', search: q, sort: 'newest', source: 'all' });
  if (!collections.length) return <Grid cells={[]} onPick={onPick} empty="No collections yet." />;
  const cells: Cell[] = id ? tiles.filter((t) => t.thumbnailUrl).map((t) => ({ key: t.id, url: t.thumbnailUrl, name: t.history?.filename ?? t.title, search: '' })) : [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {collections.map((c) => {
          const on = c.id === id;
          return (
            <button key={c.id} type="button" onClick={() => setOpen(c.id)} aria-pressed={on}
              style={{ minHeight: 32, padding: '0 12px', border: 0, borderRadius: 999, background: on ? 'var(--il-ember-soft)' : 'var(--il-card)', color: on ? 'var(--il-ember-hi)' : 'var(--il-fg2)', boxShadow: on ? 'inset 0 0 0 1px var(--il-ember-line)' : undefined, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
              {c.icon ? `${c.icon} ` : ''}{c.name} <span style={{ opacity: .7 }}>· {c.itemIds.length}</span>
            </button>
          );
        })}
      </div>
      <Grid cells={cells} onPick={onPick} empty="Nothing in this collection matches." />
    </div>
  );
}

export function LibraryPicker({ opened, onClose, onPick, server }: {
  opened: boolean; onClose: () => void; onPick: (p: LibraryPick) => void; server?: ServerFiles | null;
}) {
  const phone = useIsPhone();
  const results = useImageResults();
  const [tab, setTab] = useState<Tab>('recent');
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const recent = useMemo<Cell[]>(() => results.map((r) => ({ key: r.key, url: r.url, name: r.filename, search: `${r.filename} ${r.entry.positive ?? ''}`.toLowerCase(), liked: !!r.entry.liked }))
    .filter((c) => !needle || c.search.includes(needle)), [results, needle]);
  const liked = useMemo(() => recent.filter((c) => (c as Cell & { liked: boolean }).liked), [recent]);
  const files = useMemo<Cell[]>(() => (server?.files ?? []).flatMap((f) => {
    const url = server?.viewUrl(f);
    return url && (!needle || f.toLowerCase().includes(needle)) ? [{ key: f, url, name: f, search: f }] : [];
  }), [server, needle]);

  const tabs: Array<{ key: Tab; label: string }> = [{ key: 'recent', label: 'Recent' }, { key: 'liked', label: 'Liked' }, { key: 'collections', label: 'Collections' }];
  if (server) tabs.push({ key: 'server', label: 'On the server' });
  const cur = tabs.some((t) => t.key === tab) ? tab : 'recent';
  const pick = (c: Cell, origin: Origin, serverFile?: string) => { onPick({ url: c.url, name: displayName(c.name), origin, serverFile }); onClose(); };

  return (
    <Modal opened={opened} onClose={onClose} title="Pick a picture" size="lg" centered={!phone} fullScreen={phone} zIndex={T.z.modal}
      styles={{ body: { display: 'flex', flexDirection: 'column', gap: 10, maxHeight: phone ? undefined : `calc(${dvh(100)} - 140px)` } }}>
      <Tabs<Tab> items={tabs} value={cur} onChange={setTab} />
      <label style={{ height: 36, borderRadius: T.radius.sm, background: 'var(--il-elev)', boxShadow: 'inset 0 0 0 1px var(--il-line-strong)', display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', flex: 'none' }}>
        <IconSearch size={14} color="var(--il-muted)" />
        <input value={q} onChange={(e) => setQ(e.currentTarget.value)} placeholder={cur === 'server' ? 'File name…' : 'Prompt or file name…'} aria-label="Search pictures"
          style={{ flex: 1, minWidth: 0, height: '100%', border: 0, outline: 'none', background: 'transparent', color: 'var(--il-fg)', fontSize: 12, fontWeight: 600 }} />
      </label>
      <div className="il-scroll" style={{ flex: 1, minHeight: 200, maxHeight: phone ? undefined : `calc(${dvh(100)} - 280px)`, touchAction: 'pan-y', paddingRight: 2 }}>
        {cur === 'recent' && <Grid cells={recent} onPick={(c) => pick(c, 'history')} empty={needle ? 'Nothing matches.' : 'No pictures yet: generate one first.'} />}
        {cur === 'liked' && <Grid cells={liked} onPick={(c) => pick(c, 'history')} empty="No liked pictures." />}
        {cur === 'collections' && <Collections q={q} onPick={(c) => pick(c, 'collection')} />}
        {cur === 'server' && <Grid cells={files} onPick={(c) => pick(c, 'server', c.key)} empty="No pictures on the server." />}
      </div>
    </Modal>
  );
}
