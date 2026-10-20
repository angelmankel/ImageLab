/**
 * A step's input picture (fix list 41 on the item-24 I/O standard): for step 2+ the source choice
 * (`SourceChoice`: My image · Last from N · Pick from N, default = the previous step's output),
 * then either the chained picture — shown big, with "Step 1 · newest / picked", its name and size,
 * and in Pick a strip of step N's results (+ "All N results…") — or `own`, the slot's
 * `ImageDropZone`. Step 1 (nothing before it) shows `own` alone. The rule itself is
 * `screens/image/stepInputLogic.ts` (`useStepInput`); this is the look.
 */
import { useState, type ReactNode } from 'react';
import { Modal } from '@mantine/core';
import { IconLayoutGrid } from '@tabler/icons-react';
import { useSteps, prevStepId, type Step } from '~/app/stepsStore';
import { useStepInput, useStepResults } from '~/screens/image/useStepOutput';
import { toChainPick, type StepResult } from '~/screens/image/stepInputLogic';
import { makePayload, useImageDrag } from '~/dnd';
import { useIsPhone } from '~/app/useIsPhone';
import { Button, useWheelSideways } from '~/ui';
import { T } from '~/theme/tokens';
import { SourceChoice } from './SourceChoice';
import { displayName, fmtDims } from './inputLogic';

const STRIP_MAX = 24;
const muted: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--il-muted)', lineHeight: 1.4 };
const checker: React.CSSProperties = { background: 'repeating-conic-gradient(#18181b 0 25%, #121214 0 50%) 0 0 / 16px 16px' };

function ResultTile({ r, selected, size, onPick }: { r: StepResult; selected: boolean; size: number | 'fill'; onPick: () => void }) {
  const box: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' };
  return (
    <button type="button" onClick={onPick} aria-label={r.name} aria-pressed={selected} title={r.name}
      style={{ flex: 'none', width: size === 'fill' ? '100%' : size, height: size === 'fill' ? undefined : size, aspectRatio: size === 'fill' ? '1' : undefined, padding: 0, border: 0, borderRadius: T.radius.sm, background: 'var(--il-bg-deep)', cursor: 'pointer', outline: selected ? '3px solid var(--il-ember)' : undefined, outlineOffset: -3, overflow: 'hidden', position: 'relative' }}>
      {r.kind === 'video' ? <video src={r.url} muted playsInline preload="metadata" style={box} /> : <img src={r.url} alt="" loading="lazy" style={box} />}
      {r.kind === 'video' && <span style={{ position: 'absolute', left: 5, bottom: 4, fontSize: 9, fontWeight: 800, color: 'rgba(242,242,244,.9)', background: 'rgba(15,15,17,.6)', borderRadius: 999, padding: '1px 5px' }}>VIDEO</span>}
    </button>
  );
}

/** The chained picture, big: what this step will take. */
function ChainedPicture({ url, name, kind, badge, small }: { url: string; name: string; kind: 'image' | 'video'; badge: string; small?: boolean }) {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const drag = useImageDrag(() => makePayload({ url, name: displayName(name), source: 'input' }));
  const media: React.CSSProperties = { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' };
  return (
    <>
      <div style={{ ...checker, width: '100%', aspectRatio: small ? '16 / 7' : '4 / 3', maxHeight: small ? 140 : 260, borderRadius: T.radius.lg, overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
        {kind === 'video'
          ? <video key={url} src={url} muted playsInline preload="metadata" onLoadedMetadata={(e) => setDims({ w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight })} style={media} />
          : <img key={url} src={url} alt="" {...drag} onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} style={{ ...media, cursor: 'grab' }} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ flex: 'none', height: 22, padding: '0 8px', borderRadius: 999, background: 'var(--il-ember-soft)', color: 'var(--il-ember-hi)', fontSize: 10, fontWeight: 800, letterSpacing: .3, textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center' }}>{badge}</span>
        <span title={displayName(name)} style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 700, color: 'var(--il-fg2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName(name)}</span>
        {dims && <span style={{ flex: 'none', fontSize: 11, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtDims(dims.w, dims.h)}</span>}
      </div>
    </>
  );
}

/**
 * The chained part alone (no own picture): the source choice and, while chained, the picture it
 * resolves to. `ChainInputCard` (older callers) and `StepImageInput` both render it.
 */
export function StepSource({ step, own, small, children }: {
  step: Step;
  /** Shown in "My image" mode (the slot's drop zone). */
  own?: ReactNode;
  small?: boolean;
  /** Extra lines under the chained picture. */
  children?: ReactNode;
}) {
  const phone = useIsPhone();
  const steps = useSteps((s) => s.steps);
  const setChainMode = useSteps((s) => s.setChainMode);
  const prevIndex = steps.findIndex((s) => s.id === prevStepId(steps, step.id));
  const prev = prevIndex >= 0 ? steps[prevIndex] : null;
  const res = useStepInput(step);
  const results = useStepResults(prev);
  const stripRef = useWheelSideways<HTMLDivElement>();
  const [browsing, setBrowsing] = useState(false);
  if (!prev) return <>{own}</>;
  const n = prevIndex + 1;
  const mode = res.mode;
  const picked = step.chainPick?.key ?? null;
  const pick = (r: StepResult) => { setChainMode(step.id, 'pick', toChainPick(r)); setBrowsing(false); };

  return (
    <>
      <SourceChoice from={n} value={mode} onChange={(m) => setChainMode(step.id, m)} />
      {mode === 'off' && own}
      {mode !== 'off' && (res.kind === 'chained'
        ? <ChainedPicture url={res.src.url} name={res.src.name} kind={results.find((r) => r.url === res.src.url)?.kind ?? 'image'} small={small}
            badge={`Step ${n} · ${res.mode === 'pick' && !res.pickLost ? 'picked' : 'newest'}`} />
        : (
          <div style={{ width: '100%', aspectRatio: '16 / 7', maxHeight: 150, borderRadius: T.radius.lg, background: 'var(--il-bg-deep)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 12, textAlign: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--il-fg2)' }}>Step {n} has no picture yet</span>
            <span style={muted}>Generate there; its {mode === 'pick' ? 'results show here to pick from' : 'newest result lands here'}.</span>
          </div>
        ))}
      {'pickLost' in res && res.pickLost && <div style={{ ...muted, color: 'var(--il-warn)' }}>The picked result is gone: using the newest until you pick another.</div>}
      {mode === 'pick' && results.length > 0 && (
        <>
          <div ref={stripRef} className="il-scroll-x" data-no-swipe role="listbox" aria-label={`Results of step ${n}`} style={{ display: 'flex', gap: 6, padding: 3, margin: -3, touchAction: 'pan-x pan-y' }}>
            {results.slice(0, STRIP_MAX).map((r) => <ResultTile key={r.key} r={r} selected={r.key === picked} size={phone ? 60 : 52} onPick={() => pick(r)} />)}
          </div>
          {results.length > 6 && <div><Button size={phone ? 'lg' : 'sm'} icon={<IconLayoutGrid size={14} />} onClick={() => setBrowsing(true)}>All {results.length} results…</Button></div>}
        </>
      )}
      {mode !== 'off' && children}
      <Modal opened={browsing} onClose={() => setBrowsing(false)} title={`Pick a result of step ${n}`} size="lg" centered={!phone} fullScreen={phone} zIndex={T.z.modal}>
        <div className="il-scroll" style={{ maxHeight: phone ? undefined : 'calc(100dvh - 180px)', touchAction: 'pan-y', paddingRight: 2 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 6 }}>
            {results.map((r) => <ResultTile key={r.key} r={r} selected={r.key === picked} size="fill" onPick={() => pick(r)} />)}
          </div>
        </div>
      </Modal>
    </>
  );
}

/** The whole input card: a title, then `StepSource` with the slot's own drop zone. */
export function StepImageInput({ step, title = 'Input image', own, small, children, bare = false }: {
  step: Step; title?: ReactNode; own: ReactNode; small?: boolean; children?: ReactNode; bare?: boolean;
}) {
  const body = (
    <>
      {title && <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--il-fg)' }}>{title}</div>}
      <StepSource step={step} own={own} small={small}>{children}</StepSource>
    </>
  );
  if (bare) return body;
  return <div style={{ background: 'var(--il-card)', borderRadius: T.radius.lg, padding: 10, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>{body}</div>;
}
