/**
 * Starters → "Your models" (fix list 2 item 5): ONE model search instead of the long row of
 * model chips. The closed box shows the picked model with a clear thumbnail (48px); open, type to
 * filter the installed models (ranked like every select, item 38: prefix · word start · contains
 * · letters in order), each option with a 56px thumbnail, the name and "version · type".
 * Thumbnails are small CivitAI renditions (`civitaiThumbUrl` at 2× their size), lazy, and never an
 * NSFW picture unless the user opted in (item 27): the first of the version's pictures that needs
 * no cover, else the initials.
 */
import { useMemo, useRef, useState } from 'react';
import { Combobox, useCombobox } from '@mantine/core';
import { IconCheck, IconChevronDown, IconSearch } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { civitaiThumbUrl, isCivitaiVideo, type CivitaiVersionByHash } from '@/lib/civitai';
import { findModelHash } from '@/lib/modelHash';
import type { InstalledCivitai } from '@/features/layers/civitaiPrompts';
import { useIsPhone } from '~/app/useIsPhone';
import { T } from '~/theme/tokens';
import { filterOptions, splitMatch } from '~/ui/selectLogic';
import { useNsfwCover } from '~/screens/models/nsfwCover';
import { initials } from '../model/Thumb';

function Highlight({ text, q }: { text: string; q: string }) {
  return <>{splitMatch(text, q).map((p, i) => (p.hit ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}</>;
}

/** The first picture of each installed version that needs no NSFW cover, keyed by version id. */
function useSafePreviews(models: InstalledCivitai[]): Map<number, string> {
  const hashes = useStore((s) => s.modelHashes);
  const byHash = useStore((s) => s.civitaiByHash);
  const covered = useNsfwCover();
  return useMemo(() => {
    const out = new Map<number, string>();
    for (const m of models) {
      const h = findModelHash(hashes, m.file);
      const e = h ? byHash[h.hash] : undefined;
      const imgs = e?.status === 'found' ? (e.data as CivitaiVersionByHash)?.images ?? [] : [];
      const pic = imgs.find((i) => i?.url && !covered(i.nsfwLevel));
      if (pic) out.set(m.versionId, civitaiThumbUrl(pic.url, 128, { video: isCivitaiVideo(pic) }));
    }
    return out;
  }, [models, hashes, byHash, covered]);
}

function Pic({ url, label, size }: { url?: string; label: string; size: number }) {
  const [broken, setBroken] = useState(false);
  return (
    <span aria-hidden style={{ width: size, height: size, borderRadius: Math.min(10, Math.round(size / 3)), flex: 'none', overflow: 'hidden', display: 'grid', placeItems: 'center', background: 'linear-gradient(140deg,#3f4f5e,#1e262d)', color: 'var(--il-fg)', fontWeight: 800, fontSize: Math.round(size * 0.3) }}>
      {url && !broken
        ? <img src={url} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : initials(label)}
    </span>
  );
}

export function ModelAutocomplete({ models, value, onChange, compact }: {
  models: InstalledCivitai[]; value: number | null; onChange: (versionId: number) => void;
  /** One toolbar row high (Starters' packed toolbar): a 26px thumbnail, the name only. */
  compact?: boolean;
}) {
  const phone = useIsPhone();
  const [search, setSearch] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const combobox = useCombobox({ onDropdownClose: () => { combobox.resetSelectedOption(); setSearch(''); }, onDropdownOpen: () => combobox.updateSelectedOptionIndex('active') });
  const previews = useSafePreviews(models);
  const current = models.find((m) => m.versionId === value) ?? null;
  const options = useMemo(() => models.map((m) => ({ value: String(m.versionId), label: m.model, description: `${m.version} · ${m.type || 'Model'}` })), [models]);
  const shown = filterOptions(options, search);
  const byId = useMemo(() => new Map(models.map((m) => [String(m.versionId), m])), [models]);
  const open = combobox.dropdownOpened;
  const boxH = compact ? (phone ? 40 : 34) : phone ? 60 : 56;
  const pic = compact ? (phone ? 30 : 26) : 48;

  return (
    <Combobox store={combobox} withinPortal zIndex={T.z.popover} position="bottom-start" width="target" offset={4} transitionProps={{ transition: 'pop', duration: 120 }}
      classNames={{ dropdown: 'il-dd', options: 'il-scroll', empty: 'il-empty' }}
      onOptionSubmit={(v) => { combobox.closeDropdown(); input.current?.blur(); if (Number(v) !== value) onChange(Number(v)); }}>
      <Combobox.DropdownTarget>
        <div className="il-field" data-open={open}
          onMouseDown={(e) => { if (e.target === input.current) return; e.preventDefault(); if (open) combobox.closeDropdown(); else { input.current?.focus(); combobox.openDropdown(); } }}
          style={{ height: boxH, padding: compact ? '0 8px 0 4px' : '0 10px 0 4px', gap: compact ? 8 : 10, cursor: 'pointer', maxWidth: compact ? 280 : phone ? undefined : 460, width: '100%', minWidth: compact ? 180 : undefined, flex: compact ? '1 1 200px' : undefined }}>
          {open ? <span style={{ width: pic, display: 'grid', placeItems: 'center', flex: 'none', color: 'var(--il-dim)' }}><IconSearch size={compact ? 15 : 18} stroke={2.4} /></span>
            : <Pic url={current ? previews.get(current.versionId) : undefined} label={current?.model ?? '?'} size={pic} />}
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Combobox.EventsTarget>
              <input ref={input} aria-label="Model" role="combobox" aria-expanded={open} spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="off" data-1p-ignore data-lpignore="true"
                value={open ? search : current?.model ?? ''} placeholder={open ? 'Search your models…' : 'Pick a model'}
                onChange={(e) => { setSearch(e.currentTarget.value); combobox.openDropdown(); combobox.updateSelectedOptionIndex(); }}
                onClick={() => combobox.openDropdown()} onFocus={() => combobox.openDropdown()} onBlur={() => combobox.closeDropdown()}
                style={{ fontSize: 13, fontWeight: 800, textOverflow: 'ellipsis', cursor: 'text' }} />
            </Combobox.EventsTarget>
            {!open && current && !compact && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{current.version} · {current.type || 'Model'}</span>}
          </span>
          <IconChevronDown size={15} stroke={2.6} className="il-chev" style={{ flex: 'none' }} aria-hidden />
        </div>
      </Combobox.DropdownTarget>
      <Combobox.Dropdown>
        <Combobox.Options style={{ maxHeight: 420, overflowY: 'auto', touchAction: 'pan-y' }}>
          {shown.map((o) => {
            const m = byId.get(o.value)!;
            const on = m.versionId === value;
            return (
              <Combobox.Option key={o.value} value={o.value} active={on} aria-selected={on} className="il-opt" style={{ gap: 10, minHeight: 64 }}>
                <Pic url={previews.get(m.versionId)} label={m.model} size={56} />
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                  <span className="il-opt-label"><Highlight text={o.label} q={search} /></span>
                  <span className="il-opt-desc">{o.description}</span>
                </span>
                {on && <IconCheck size={14} stroke={2.6} style={{ flex: 'none', color: 'var(--il-ember)' }} />}
              </Combobox.Option>
            );
          })}
          {shown.length === 0 && <Combobox.Empty>No model matches</Combobox.Empty>}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
