/**
 * Item 9: Starters (was "Prompt library") — start from a picture someone made. Opens like the
 * model picker (the same ≈ 94vw × 92vh window; full screen with Back on a phone). The body is
 * only pictures, in a masonry; a click uses the picture's prompt (+ negative, steps / CFG / seed)
 * with Undo and closes; right-click / long-press: Use · As input image · Copy prompt · Open on
 * CivitAI. The top section filters: source (Your models / Mine / Built-in), the installed models
 * as a strip, sort, content, shape, search, and tags (the parts that recur in the loaded prompts).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Loader, Modal } from '@mantine/core';
import { IconSparkles, IconChevronLeft, IconCopy, IconExternalLink, IconPhotoUp, IconRefresh, IconSearch, IconTextCaption, IconTrash, IconX } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { civitaiThumbUrl, isCivitaiVideo, type CivitaiImageSort, type NsfwFilter } from '@/lib/civitai';
import { loadNsfw, saveNsfw, useInstalledCivitai, type InstalledCivitai } from '@/features/layers/civitaiPrompts';
import { PROMPT_PRESETS, familyForCheckpoint, presetPrompt } from '@/lib/promptLibrary';
import { profileById } from '@/lib/modelProfiles';
import { useMine } from '@/features/next/mineStore';
import { menuProps, registerMenu } from '~/app/contextMenu';
import { useIsPhone } from '~/app/useIsPhone';
import { T } from '~/theme/tokens';
import { Button, useWheelSideways } from '~/ui';
import { tileBackground } from '../prompt/promptSearch';
import { applyStarter, setAsInput, type StarterUse } from './applyStarter';
import { passes, topTags, type Shape } from './starterLogic';
import { useStarterGallery } from './useStarterGallery';

type Source = 'models' | 'mine' | 'builtin';

/** One tile of the masonry: a CivitAI picture, or a saved / built-in prompt as a colour card. */
export interface StarterItem {
  key: string;
  name: string;
  prompt: string;
  use: StarterUse;
  img?: { url: string; width: number; height: number; link: string };
  mineId?: string;
}

registerMenu<StarterItem>('starter', [
  { id: 'use', label: 'Use this prompt', icon: IconTextCaption, action: (it) => applyStarter(it.use, it.name) },
  { id: 'input', label: 'Use as input image', icon: IconPhotoUp, visible: (it) => !!it.img, action: (it) => void setAsInput(civitaiThumbUrl(it.img!.url, 1280), `civitai-${it.key}.png`) },
  { id: 'copy', label: 'Copy prompt', icon: IconCopy, group: 'copy', action: (it) => { void navigator.clipboard?.writeText(it.prompt); } },
  { id: 'open', label: 'Open on CivitAI', icon: IconExternalLink, group: 'copy', visible: (it) => !!it.img, action: (it) => window.open(it.img!.link, '_blank', 'noopener') },
  { id: 'del', label: 'Remove from Mine', icon: IconTrash, danger: true, group: 'danger', visible: (it) => !!it.mineId, action: (it) => useMine.getState().remove(it.mineId!) },
]);

const SORTS: Array<{ key: CivitaiImageSort; label: string }> = [{ key: 'Most Reactions', label: 'Most reactions' }, { key: 'Newest', label: 'Newest' }, { key: 'Most Collected', label: 'Most collected' }];
const NSFW: Array<{ key: NsfwFilter; label: string }> = [{ key: 'all', label: 'All' }, { key: 'sfw', label: 'SFW' }, { key: 'nsfw', label: 'NSFW' }];
const SHAPES: Array<{ key: Shape; label: string }> = [{ key: 'any', label: 'Any' }, { key: 'portrait', label: 'Portrait' }, { key: 'landscape', label: 'Landscape' }, { key: 'square', label: 'Square' }];

function Seg<K extends string>({ items, value, onChange, h }: { items: Array<{ key: K; label: string }>; value: K; onChange: (k: K) => void; h: number }) {
  return (
    <div role="tablist" style={{ display: 'inline-flex', padding: 3, borderRadius: 12, background: 'var(--il-bg-deep)', height: h, flex: 'none' }}>
      {items.map((it) => (
        <button key={it.key} type="button" role="tab" aria-selected={it.key === value} onClick={() => onChange(it.key)}
          style={{ padding: '0 12px', border: 0, borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', background: it.key === value ? 'var(--il-card-on)' : 'transparent', color: it.key === value ? 'var(--il-fg)' : 'var(--il-muted)' }}>{it.label}</button>
      ))}
    </div>
  );
}

function Pills<K extends string>({ label, items, value, onChange, h }: { label: string; items: Array<{ key: K; label: string }>; value: K; onChange: (k: K) => void; h: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flex: 'none' }}>
      <span className="il-eyebrow" style={{ marginRight: 2 }}>{label}</span>
      {items.map((it) => {
        const on = it.key === value;
        return <button key={it.key} type="button" aria-pressed={on} onClick={() => onChange(it.key)}
          style={{ height: h, padding: '0 11px', borderRadius: 999, fontSize: 11, fontWeight: 800, cursor: 'pointer', border: `1px solid ${on ? 'var(--il-fg)' : 'var(--il-line-soft)'}`, background: on ? 'var(--il-fg)' : 'transparent', color: on ? 'var(--il-bg)' : 'var(--il-muted)' }}>{it.label}</button>;
      })}
    </span>
  );
}

function ModelChip({ m, on, onClick }: { m: InstalledCivitai; on: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} title={`${m.model} · ${m.version}`}
      style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 12px 0 4px', borderRadius: 12, flex: 'none', cursor: 'pointer', textAlign: 'left', maxWidth: 240,
        background: on ? 'var(--il-ember-soft)' : 'var(--il-elev)', border: `1px solid ${on ? 'var(--il-ember-line)' : 'var(--il-line-soft)'}`, color: 'var(--il-fg)' }}>
      <span aria-hidden style={{ width: 36, height: 36, borderRadius: 9, flex: 'none', overflow: 'hidden', background: 'linear-gradient(140deg,#3f4f5e,#1e262d)' }}>
        {m.preview && <img src={civitaiThumbUrl(m.preview, 96, { video: isCivitaiVideo({ url: m.preview }) })} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
      </span>
      <span style={{ minWidth: 0 }}>
        <b style={{ display: 'block', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.model}</b>
        <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--il-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.version} · {m.type || 'Model'}</span>
      </span>
    </button>
  );
}

function hue(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h % 360; }

function Tile({ it, onUse }: { it: StarterItem; onUse: () => void }) {
  const [hover, setHover] = useState(false);
  const box: CSSProperties = { breakInside: 'avoid', marginBottom: 10, borderRadius: 12, overflow: 'hidden', position: 'relative', cursor: 'pointer', display: 'block', width: '100%', border: 0, padding: 0, textAlign: 'left', color: '#fff', font: 'inherit' };
  const overlay = (
    <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '28px 10px 8px', background: 'linear-gradient(transparent, rgba(0,0,0,.78))', fontSize: 11, fontWeight: 700, lineHeight: 1.4, opacity: hover ? 1 : 0, transition: 'opacity .12s ease' }}>
      <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{it.prompt}</span>
      <span style={{ display: 'inline-block', marginTop: 6, padding: '3px 9px', borderRadius: 999, background: 'var(--il-ember)', color: 'var(--il-bg)', fontWeight: 800 }}>Use</span>
    </span>
  );
  if (it.img) {
    return (
      <button type="button" onClick={onUse} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} aria-label={`Use: ${it.prompt.slice(0, 80)}`} style={{ ...box, background: '#000' }} {...menuProps('starter', it)}>
        <img src={civitaiThumbUrl(it.img.url, 450)} alt="" loading="lazy" style={{ display: 'block', width: '100%', aspectRatio: `${it.img.width || 1} / ${it.img.height || 1}`, objectFit: 'cover' }} />
        {overlay}
      </button>
    );
  }
  const len = Math.min(it.prompt.length, 300);
  return (
    <button type="button" onClick={onUse} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ ...box, background: tileBackground(hue(it.name)), aspectRatio: `1 / ${0.8 + len / 500}`, padding: 12 }} {...menuProps('starter', it)}>
      <span style={{ display: 'block', fontSize: 14, fontWeight: 800, textShadow: '0 1px 3px rgba(0,0,0,.5)' }}>{it.name}</span>
      <span style={{ display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginTop: 6, fontSize: 11, fontWeight: 600, opacity: 0.8, lineHeight: 1.45 }}>{it.prompt}</span>
      {overlay}
    </button>
  );
}

function Body({ onClose }: { onClose: () => void }) {
  const phone = useIsPhone();
  const h = phone ? 40 : 34;
  const [source, setSource] = useState<Source>('models');
  const [query, setQuery] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [shape, setShape] = useState<Shape>('any');
  const [sort, setSort] = useState<CivitaiImageSort>('Most Reactions');
  const [nsfw, setNsfw] = useState<NsfwFilter>(loadNsfw);
  useEffect(() => { saveNsfw(nsfw); }, [nsfw]);
  const installed = useInstalledCivitai('image');
  const [picked, setPicked] = useState<number | null>(null);
  const model = installed.find((m) => m.versionId === picked) ?? installed[0] ?? null;
  const gallery = useStarterGallery(source === 'models' ? model?.versionId ?? null : null, nsfw, sort);
  const mine = useMine((s) => s.items);
  const checkpoint = useStore((s) => s.workflow.checkpoints[0]?.name);
  const typeHasTags = useStore((s) => !!profileById(s.workflow.modelProfile)?.tags.length);
  const wheel = useWheelSideways<HTMLDivElement>();
  useEffect(() => { setTags([]); }, [source, model?.versionId]);

  const items = useMemo<StarterItem[]>(() => {
    if (source === 'models') {
      return gallery.items.map((img, i) => ({
        key: `${img.url.split('/').pop() ?? i}-${i}`,
        name: model ? `${model.model} picture` : 'CivitAI picture',
        prompt: img.meta!.prompt!,
        use: { positive: img.meta!.prompt!, negative: img.meta!.negativePrompt || undefined, steps: img.meta!.steps, cfg: img.meta!.cfgScale, seed: img.meta!.seed },
        img: { url: img.url, width: img.width, height: img.height, link: model ? `https://civitai.com/models/${model.modelId}?modelVersionId=${model.versionId}` : 'https://civitai.com' },
      }));
    }
    if (source === 'mine') {
      return mine.filter((p) => p.kind === 'image').map((p) => ({ key: p.id, name: p.name, prompt: p.positive, use: { positive: p.positive, negative: p.negative }, mineId: p.id }));
    }
    const fam = familyForCheckpoint(checkpoint, typeHasTags);
    return PROMPT_PRESETS.map((p) => { const t = presetPrompt(p, fam); return { key: p.id, name: p.name, prompt: p.positive, use: { positive: t.positive, negative: t.negative } }; });
  }, [source, gallery.items, model, mine, checkpoint, typeHasTags]);

  const tagList = useMemo(() => topTags(items.map((i) => i.prompt)), [items]);
  const shown = useMemo(() => items.filter((it) => passes({ prompt: it.prompt, width: it.img?.width, height: it.img?.height }, { tags, query, shape: it.img ? shape : 'any' })), [items, tags, query, shape]);

  // Load more when the end of the masonry scrolls into view.
  const sentinel = useRef<HTMLDivElement>(null);
  const { more, hasMore, loading } = gallery;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || source !== 'models') return;
    const io = new IntersectionObserver((e) => { if (e[0]?.isIntersecting && hasMore && !loading) more(); }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [source, hasMore, loading, more]);

  const use = useCallback((it: StarterItem) => { applyStarter(it.use, it.name); onClose(); }, [onClose]);
  const toggleTag = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const empty: ReactNode = source === 'models'
    ? (!installed.length ? 'None of the installed models is known to CivitAI yet (their hashes may still be loading).'
      : gallery.failed ? 'CivitAI did not answer. Try again in a moment.'
      : gallery.loading ? null : items.length ? 'Nothing passes these filters.' : 'No pictures with a prompt for this model under this filter.')
    : source === 'mine' ? (items.length ? 'Nothing passes these filters.' : 'Nothing saved yet.') : 'Nothing passes these filters.';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ flex: 'none', padding: phone ? '8px 10px' : '10px 16px', borderBottom: '1px solid var(--il-line)', display: 'flex', flexDirection: 'column', gap: 8, background: 'linear-gradient(var(--il-panel), var(--il-bg))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: phone ? 'wrap' : 'nowrap' }}>
          <Seg<Source> h={h} value={source} onChange={setSource} items={[{ key: 'models', label: phone ? 'Models' : 'Your models' }, { key: 'mine', label: 'Mine' }, { key: 'builtin', label: 'Built-in' }]} />
          <label style={{ flex: 1, minWidth: phone ? 140 : 200, height: h, borderRadius: 12, background: 'var(--il-bg-deep)', border: '1px solid var(--il-line-soft)', display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px 0 12px' }}>
            <IconSearch size={14} stroke={2.4} style={{ color: 'var(--il-dim)', flex: 'none' }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the prompts…" aria-label="Search the prompts"
              style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', color: 'var(--il-fg)', fontSize: 13, fontWeight: 600, outline: 'none', fontFamily: 'inherit' }} />
            {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')} style={{ width: 24, height: 24, border: 0, background: 'transparent', color: 'var(--il-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><IconX size={12} stroke={2.6} /></button>}
          </label>
          {source === 'models' && !phone && <Seg<CivitaiImageSort> h={h} value={sort} onChange={setSort} items={SORTS} />}
          {source === 'models' && <Button tone="card" h={h} icon={<IconRefresh size={15} stroke={2.2} />} tooltip="Reload" onClick={gallery.reload} disabled={gallery.loading} />}
        </div>
        {source === 'models' && installed.length > 0 && (
          <div ref={wheel} className="il-scroll-x" data-no-swipe style={{ display: 'flex', gap: 8, touchAction: 'pan-x pan-y' }}>
            {installed.map((m) => <ModelChip key={m.versionId} m={m} on={m.versionId === model?.versionId} onClick={() => setPicked(m.versionId)} />)}
          </div>
        )}
        <div className="il-scroll-x" data-no-swipe style={{ display: 'flex', alignItems: 'center', gap: 10, touchAction: 'pan-x pan-y' }}>
          {source === 'models' && phone && <Pills<CivitaiImageSort> label="Sort" h={30} value={sort} onChange={setSort} items={SORTS} />}
          {source === 'models' && <Pills<NsfwFilter> label="Content" h={phone ? 34 : 28} value={nsfw} onChange={setNsfw} items={NSFW} />}
          {source === 'models' && <Pills<Shape> label="Shape" h={phone ? 34 : 28} value={shape} onChange={setShape} items={SHAPES} />}
        </div>
        {tagList.length > 0 && (
          <div className="il-scroll-x" data-no-swipe style={{ display: 'flex', alignItems: 'center', gap: 6, touchAction: 'pan-x pan-y', flexWrap: phone ? 'nowrap' : 'wrap' }}>
            <span className="il-eyebrow" style={{ flex: 'none' }}>Tags</span>
            {tagList.map(({ tag, count }) => {
              const on = tags.includes(tag);
              return (
                <button key={tag} type="button" aria-pressed={on} onClick={() => toggleTag(tag)}
                  style={{ height: phone ? 34 : 28, padding: '0 10px', borderRadius: 999, border: 0, flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                    background: on ? 'var(--il-ember-soft)' : 'var(--il-elev)', color: on ? 'var(--il-ember-hi)' : 'var(--il-fg2)', boxShadow: on ? 'inset 0 0 0 1px var(--il-ember-line)' : undefined }}>
                  {tag}<span style={{ fontSize: 10, color: on ? 'var(--il-ember-hi)' : 'var(--il-dim)' }}>{count}</span>
                </button>
              );
            })}
            {tags.length > 0 && <button type="button" onClick={() => setTags([])} style={{ height: 28, padding: '0 8px', border: 0, background: 'transparent', color: 'var(--il-muted)', fontSize: 11, fontWeight: 800, cursor: 'pointer', flex: 'none' }}>Clear tags</button>}
          </div>
        )}
      </div>
      <div className="il-scroll" style={{ flex: 1, minHeight: 0, padding: phone ? 8 : '12px 16px', touchAction: 'pan-y' }}>
        <div style={{ columns: phone ? 2 : '5 220px', columnGap: phone ? 8 : 10 }}>
          {shown.map((it) => <Tile key={it.key} it={it} onUse={() => use(it)} />)}
        </div>
        {shown.length === 0 && empty && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--il-muted)', textAlign: 'center', padding: '40px 12px' }}>{empty}</div>}
        <div ref={sentinel} style={{ height: 1 }} />
        {source === 'models' && gallery.loading && <div style={{ display: 'grid', placeItems: 'center', padding: 16 }}><Loader size="sm" color="orange" /></div>}
      </div>
    </div>
  );
}

export function StartersModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const phone = useIsPhone();
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      fullScreen={phone}
      centered
      size={phone ? undefined : '94vw'}
      zIndex={T.z.modal}
      radius={phone ? 0 : T.radius.xl}
      padding={0}
      overlayProps={{ backgroundOpacity: 0.55, blur: 6 }}
      transitionProps={{ transition: 'pop', duration: 160 }}
      styles={{
        content: { background: 'var(--il-bg)', border: phone ? 0 : '1px solid var(--il-line-soft)', height: phone ? '100dvh' : '92vh', maxHeight: phone ? '100dvh' : '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
        body: { padding: 0, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', height: '100%' },
      }}
    >
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {phone ? (
          <div style={{ height: 48, flex: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', borderBottom: '1px solid var(--il-line)' }}>
            <button type="button" onClick={onClose} aria-label="Back" style={{ height: 40, padding: '0 12px 0 6px', border: 0, borderRadius: 999, background: 'transparent', color: 'var(--il-fg)', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
              <IconChevronLeft size={18} stroke={2.6} />Back
            </button>
            <span style={{ flex: 1, textAlign: 'center', fontWeight: 800, fontSize: 15 }}>Starters</span>
            <span style={{ width: 76 }} />
          </div>
        ) : (
          <div style={{ height: 48, flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px 0 16px', borderBottom: '1px solid var(--il-line)' }}>
            <IconSparkles size={16} stroke={2.2} style={{ color: 'var(--il-ember)' }} />
            <span style={{ fontWeight: 800, fontSize: 15 }}>Starters</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)' }}>Start from a picture someone made — its prompt and settings</span>
            <div style={{ flex: 1 }} />
            <Button tone="ghost" size="sm" icon={<IconX size={16} stroke={2.4} />} tooltip="Close" onClick={onClose} />
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0 }}>{opened && <Body onClose={onClose} />}</div>
      </div>
    </Modal>
  );
}
