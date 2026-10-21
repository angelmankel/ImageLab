/**
 * "Snippets from a picture" window (fix list 2, ADDED after close). Left: the picture (the shared
 * drop zone: drop · paste · upload · library), a focus hint, the target category ("Pick for me" =
 * the model chooses per snippet), how many, one overall Style snippet, the picture as preview,
 * Write. Right: the candidates — tick, edit name / text / category — then "Save N" (one undo step).
 * State + the call live in `fromImageRuns` (per session), so closing never loses a write; the
 * `FromImageButton` shows a spinner / count meanwhile. Right-click "Make snippets from this" on
 * history, canvas and viewer pictures opens it with that picture (`fromImageMenus`).
 */
import { Modal } from '@mantine/core';
import { IconCheck, IconPhotoScan, IconSparkles, IconX } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { aiNotReadyHint, aiReady } from '@/lib/ai';
import { activeEntry } from '@/lib/aiProviders';
import { useProviderModels } from '@/features/ai/aiModelsStore';
import { useIsPhone } from '~/app/useIsPhone';
import { useSessions } from '~/app/sessionsStore';
import { ImageDropZone } from '~/compose';
import { Button, SearchSelect, Skeleton, Spinner, Switch, Tabs } from '~/ui';
import { T } from '~/theme/tokens';
import { dvh } from '~/theme/uiScale';
import {
  AUTO, cleanCatName, closeSnippetsFromImage, openSnippetsFromImage, patchJob, pickableCategories, runFromImage, saveFromImage, setJobImage,
  useFromImageBadge, useFromImageJob, useFromImageOpen, type FromImageRow,
} from './fromImageRuns';
import './fromImageMenus';

const eyebrow: React.CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--il-muted)' };
const field: React.CSSProperties = { width: '100%', border: '1px solid var(--il-line-soft)', borderRadius: 10, background: 'var(--il-bg-deep)', color: 'var(--il-fg)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };
const COUNTS = ['4', '6', '8'] as const;

/** Why the active provider cannot look at pictures, or null when it (probably) can. */
export function useVisionNote(): string | null {
  const ai = useStore((s) => s.ai);
  const entry = activeEntry(ai);
  const { models } = useProviderModels(entry);
  if (!aiReady(ai)) return `${aiNotReadyHint(ai)} to read pictures.`;
  if (entry.visionModel) return null;
  const m = models.find((x) => x.id === entry.model);
  return m && !m.vision ? `${m.name || entry.model} can't see pictures — pick a vision model in Settings → AI helper.` : null;
}

const sid = () => useSessions.getState().currentId || 'app';

/** "✦ From image" with its status (spinner while it reads, count of new candidates). */
export function FromImageButton({ categoryId, size = 'sm', label = '✦ From image' }: { categoryId?: string; size?: 'sm' | 'md' | 'lg'; label?: string }) {
  const sessionId = useSessions((s) => s.currentId) || 'app';
  const { running, fresh } = useFromImageBadge(sessionId);
  return (
    <Button tone="card" size={size} style={{ color: 'var(--il-ember-hi)' }} tooltip="Make snippets from a picture" onClick={() => openSnippetsFromImage({ categoryId })}>
      {label}
      {running ? <Spinner size={12} style={{ marginLeft: 2 }} /> : fresh ? (
        <span style={{ marginLeft: 2, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: 'var(--il-ember)', color: 'var(--il-on-accent, var(--il-bg))', fontSize: 10, fontWeight: 800, display: 'inline-grid', placeItems: 'center', boxSizing: 'border-box' }}>{fresh}</span>
      ) : null}
    </Button>
  );
}

function RowCard({ r, cats, onPatch }: { r: FromImageRow; cats: Array<{ value: string; label: string }>; onPatch: (p: Partial<FromImageRow>) => void }) {
  const phone = useIsPhone();
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 10, borderRadius: 14, background: 'var(--il-card)', opacity: r.keep ? 1 : 0.55 }}>
      <button type="button" aria-pressed={r.keep} aria-label={r.keep ? `Skip ${r.name}` : `Keep ${r.name}`} onClick={() => onPatch({ keep: !r.keep })}
        style={{ width: phone ? 40 : 30, height: phone ? 40 : 30, flex: 'none', borderRadius: 9, border: r.keep ? 0 : '1px solid var(--il-line-strong)', background: r.keep ? 'var(--il-ember)' : 'transparent', color: 'var(--il-bg)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
        {r.keep && <IconCheck size={16} stroke={3} />}
      </button>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: phone ? 'wrap' : 'nowrap' }}>
          <input value={r.name} onChange={(e) => onPatch({ name: e.target.value })} aria-label="Name"
            style={{ ...field, flex: 1, minWidth: 120, border: 0, background: 'transparent', padding: '2px 0', fontSize: 13, fontWeight: 800 }} />
          {r.style && <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--il-ember-hi)', flex: 'none' }}>OVERALL STYLE</span>}
          <div style={{ width: phone ? '100%' : 170, flex: 'none' }}>
            <SearchSelect value={r.categoryId} onChange={(v) => onPatch({ categoryId: v })} options={cats} label="Category" size={phone ? 'lg' : 'sm'} />
          </div>
        </div>
        <textarea value={r.text} onChange={(e) => onPatch({ text: e.target.value })} aria-label="What it puts in the prompt" rows={2}
          style={{ ...field, padding: '6px 10px', fontSize: 12, lineHeight: 1.45, color: 'var(--il-fg2)', resize: 'none' }} />
      </div>
    </div>
  );
}

export function SnippetsFromImageHost() {
  const phone = useIsPhone();
  const openFor = useFromImageOpen();
  const sessionId = openFor ?? sid();
  const job = useFromImageJob(sessionId);
  const allCats = useStore((s) => s.snippetCategories);
  const note = useVisionNote();
  const cats = pickableCategories(allCats);
  const catOptions = [...cats.map((c) => ({ value: c.id, label: `${c.icon ? `${c.icon} ` : ''}${cleanCatName(c.name)}` })), ...(cats.some((c) => c.id === 'uncategorized') ? [] : [{ value: 'uncategorized', label: 'Uncategorized' }])];
  const targetOptions = [{ value: AUTO, label: 'Pick for me' }, ...catOptions];
  const kept = job.rows.filter((r) => r.keep && r.text.trim()).length;
  const canRun = !note && !!job.image && !job.running;
  const h = phone ? 44 : 34;
  const set = (p: Parameters<typeof patchJob>[1]) => patchJob(sessionId, p);
  const patchRow = (key: string, p: Partial<FromImageRow>) => set((j) => ({ rows: j.rows.map((r) => (r.key === key ? { ...r, ...p } : r)) }));

  const left = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ImageDropZone url={job.image?.url ?? null} name={job.image?.name} emptyTitle="Drop a picture" label="Picture" pasteAnywhere
        onBlob={(img) => setJobImage(sessionId, img.blob, img.name)} onClear={() => set({ image: null })} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={eyebrow}>Focus · optional</span>
        <input value={job.hint} onChange={(e) => set({ hint: e.target.value })} placeholder="only the lighting, the outfit, the colours…" aria-label="Focus hint"
          onKeyDown={(e) => { if (e.key === 'Enter' && canRun) { e.preventDefault(); void runFromImage(sessionId); } }}
          style={{ ...field, height: h, padding: '0 12px', fontSize: 13 }} />
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={eyebrow}>Category</span>
          <SearchSelect value={job.categoryId} onChange={(v) => set({ categoryId: v })} options={targetOptions} label="Target category" size={phone ? 'lg' : 'md'} />
        </div>
        <div style={{ width: 140, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={eyebrow}>How many</span>
          <Tabs items={COUNTS.map((c) => ({ key: c, label: c }))} value={(COUNTS.includes(String(job.count) as (typeof COUNTS)[number]) ? String(job.count) : '6') as (typeof COUNTS)[number]} onChange={(c) => set({ count: Number(c) })} />
        </div>
      </div>
      <Switch label="Also one overall style snippet" checked={job.withStyle} onChange={(v) => set({ withStyle: v })} big={phone} />
      <Switch label="Use the picture as their preview" checked={job.usePicture} onChange={(v) => set({ usePicture: v })} big={phone} />
      {note && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-warn)' }}>{note}</div>}
      {job.error && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-err)' }}>{job.error}</div>}
    </div>
  );

  const right = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {job.running && Array.from({ length: Math.min(4, job.count) }, (_, i) => <Skeleton key={i} h={74} radius={14} />)}
      {!job.running && job.rows.map((r) => <RowCard key={r.key} r={r} cats={catOptions} onPatch={(p) => patchRow(r.key, p)} />)}
      {!job.running && !job.rows.length && (
        <div style={{ border: '1px dashed var(--il-line-strong)', borderRadius: 16, padding: phone ? '22px 16px' : '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
          <span aria-hidden style={{ width: 44, height: 44, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'var(--il-ember-soft)', color: 'var(--il-ember-hi)' }}><IconPhotoScan size={22} /></span>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--il-fg2)' }}>Snippets show up here</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-dim)', maxWidth: 320 }}>Add a picture and press Read it. You can close this window — it keeps going.</span>
        </div>
      )}
    </div>
  );

  const size = phone ? 'lg' : 'md';
  const actions = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Button tone={job.rows.length ? 'card' : 'primary'} size={size} disabled={!canRun} onClick={() => void runFromImage(sessionId)}
        icon={job.running ? <Spinner size={13} color={job.rows.length ? undefined : 'var(--il-bg)'} /> : <IconSparkles size={15} stroke={2.2} />}>
        {job.running ? 'Reading…' : job.rows.length ? 'Read again' : 'Read it'}
      </Button>
      <div style={{ flex: 1 }} />
      <Button tone="card" size={size} onClick={closeSnippetsFromImage}>Close</Button>
      <Button tone="primary" size={size} disabled={!kept || job.running} onClick={() => { void saveFromImage(sessionId).then((n) => { if (n) closeSnippetsFromImage(); }); }}>{kept ? `Save ${kept}` : 'Save'}</Button>
    </div>
  );

  return (
    <Modal opened={openFor !== null} onClose={closeSnippetsFromImage} withCloseButton={false} centered size={980} fullScreen={phone} zIndex={T.z.modal} radius={phone ? 0 : T.radius.xl} padding={0}
      overlayProps={{ backgroundOpacity: 0.55, blur: 6 }} transitionProps={{ transition: 'pop', duration: 140 }}
      styles={{
        content: { background: 'var(--il-panel)', border: phone ? 0 : '1px solid var(--il-line-soft)', height: phone ? dvh(100) : `min(760px, ${dvh(90)})`, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
        body: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 0 },
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: phone ? '10px 14px' : '14px 18px', borderBottom: '1px solid var(--il-line-soft)', flex: 'none' }}>
        <span aria-hidden style={{ width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--il-ember-soft)', color: 'var(--il-ember-hi)', flex: 'none' }}><IconPhotoScan size={17} stroke={2.2} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Snippets from a picture</div>
          {!phone && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)' }}>The AI's vision model turns what it sees into tiles. Keep the ones you like.</div>}
        </div>
        <Button tone="ghost" size={phone ? 'lg' : 'sm'} icon={<IconX size={16} stroke={2.4} />} tooltip="Close" onClick={closeSnippetsFromImage} />
      </div>
      {phone ? (
        <>
          <div className="il-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', touchAction: 'pan-y', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>{left}{right}</div>
          <div style={{ flex: 'none', padding: '10px 14px calc(12px + var(--il-safe-bottom, 0px))', borderTop: '1px solid var(--il-line-soft)' }}>{actions}</div>
        </>
      ) : (
        <>
          <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(300px, 380px) minmax(0, 1fr)' }}>
            <div className="il-scroll" style={{ minHeight: 0, overflowY: 'auto', padding: '16px 18px', borderRight: '1px solid var(--il-line-soft)' }}>{left}</div>
            <div className="il-scroll" style={{ minHeight: 0, overflowY: 'auto', padding: '16px 18px' }}>{right}</div>
          </div>
          <div style={{ flex: 'none', padding: '12px 18px 16px', borderTop: '1px solid var(--il-line-soft)' }}>{actions}</div>
        </>
      )}
    </Modal>
  );
}
