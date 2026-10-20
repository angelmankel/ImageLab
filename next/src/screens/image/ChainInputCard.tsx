/**
 * The step-to-step input picker (rule 2), one card shared by the Input tabs of every step 2+:
 * Off (a picture of its own, the tab's own controls below) · Auto · last (the previous step's
 * newest result, follows it) · Pick (one chosen result, kept on the step as `chainPick`). Under
 * the switch: the picture it resolves to (thumbnail, name, "from 1 · Image"); in Pick a sideways
 * strip of the previous step's results, newest first, the chosen one outlined, and "Browse…"
 * for a grid of all of them. A picked result that is gone falls back to Auto with a one-line
 * hint. The rule itself is `stepInputLogic.ts`; this file is the look.
 */
import { useState, type ReactNode } from 'react';
import { Modal } from '@mantine/core';
import { IconLink, IconLayoutGrid } from '@tabler/icons-react';
import { useSteps, prevStepId, stepTitle, type ChainMode, type Step } from '~/app/stepsStore';
import { Tabs, useWheelSideways } from '~/ui';
import { T } from '~/theme/tokens';
import { toChainPick, type StepResult } from './stepInputLogic';
import { useStepInput, useStepResults } from './useStepOutput';

const STRIP_MAX = 24;
const BROWSE_FROM = 9;

const muted: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--il-muted)', lineHeight: 1.4 };
const pillBtn: React.CSSProperties = { height: 30, padding: '0 11px', border: 0, borderRadius: 999, background: 'var(--il-card-on)', color: 'var(--il-fg2)', fontWeight: 700, fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', whiteSpace: 'nowrap' };

const MODES: Array<{ key: ChainMode; label: string; title: string }> = [
  { key: 'off', label: 'Off', title: 'A picture of your own' },
  { key: 'auto', label: 'Auto · last', title: "The previous step's newest result, always" },
  { key: 'pick', label: 'Pick', title: 'One result of the previous step' },
];

/** A thumbnail of a result (a clip shows its first frame). */
function Thumb({ r, size, radius = 10 }: { r: Pick<StepResult, 'url' | 'kind'>; size: number | string; radius?: number }) {
  const box: React.CSSProperties = { width: size, height: size, borderRadius: radius, objectFit: 'cover', background: 'var(--il-bg-deep)', display: 'block', flex: 'none', pointerEvents: 'none' };
  return r.kind === 'video' ? <video src={r.url} muted playsInline preload="metadata" style={box} /> : <img src={r.url} alt="" loading="lazy" style={box} />;
}

/** A tappable result: `size` in px for the strip, 'fill' for a grid cell (square by aspect ratio). */
function ResultTile({ r, selected, size, onPick }: { r: StepResult; selected: boolean; size: number | 'fill'; onPick: () => void }) {
  return (
    <button type="button" onClick={onPick} aria-label={r.name} aria-pressed={selected} title={r.name}
      style={{ flex: 'none', width: size === 'fill' ? '100%' : size, height: size === 'fill' ? undefined : size, aspectRatio: size === 'fill' ? '1' : undefined, padding: 0, border: 0, borderRadius: 10, background: 'transparent', cursor: 'pointer', outline: selected ? '3px solid var(--il-ember)' : undefined, outlineOffset: -3, overflow: 'hidden', position: 'relative' }}>
      <Thumb r={r} size="100%" />
      {r.kind === 'video' && <span style={{ position: 'absolute', left: 5, bottom: 4, fontSize: 9, fontWeight: 800, color: 'rgba(242,242,244,.9)', background: 'rgba(15,15,17,.6)', borderRadius: 999, padding: '1px 5px' }}>VIDEO</span>}
    </button>
  );
}

export function ChainInputCard({ step, thumb = 44, note, bare = false, children }: {
  step: Step;
  /** The chosen picture's thumbnail size. */
  thumb?: number;
  /** Appended to the chosen picture's line ("— sent to the workflow on Generate"). */
  note?: string;
  /** No card of its own: it sits inside another card (the Workflow step's LoadImage card). */
  bare?: boolean;
  /** Extra lines under the chosen picture while chained. */
  children?: ReactNode;
}) {
  const steps = useSteps((s) => s.steps);
  const setChainMode = useSteps((s) => s.setChainMode);
  const prev = steps.find((s) => s.id === prevStepId(steps, step.id)) ?? null;
  const res = useStepInput(step);
  const results = useStepResults(prev);
  const stripRef = useWheelSideways<HTMLDivElement>();
  const [browsing, setBrowsing] = useState(false);
  if (!prev) return null;
  const from = stepTitle(steps, prev.id);
  const mode = res.mode;
  const picked = step.chainPick?.key ?? null;
  const pick = (r: StepResult) => { setChainMode(step.id, 'pick', toChainPick(r)); setBrowsing(false); };
  const strip = results.slice(0, STRIP_MAX);

  return (
    <div style={bare ? { display: 'flex', flexDirection: 'column', gap: 8 } : { background: 'var(--il-card)', borderRadius: 14, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)', whiteSpace: 'nowrap' }}>From {from}</span>
        <div style={{ flex: 1, minWidth: 0 }}><Tabs<ChainMode> items={MODES} value={mode} onChange={(m) => setChainMode(step.id, m)} compact /></div>
      </div>
      {mode !== 'off' && (
        res.kind === 'chained'
          ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Thumb r={{ url: res.src.url, kind: results.find((r) => r.url === res.src.url)?.kind ?? 'image' }} size={thumb} />
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-fg2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={res.src.name}><IconLink size={11} /> {res.src.name}</span>
                <span style={muted}>{res.mode === 'pick' && !res.pickLost ? 'Picked' : 'Last result'} from {from}{note ? ` ${note}` : ''}</span>
              </div>
            </div>
          )
          : <div style={muted}>{from} has no output yet — Generate there first; this step takes its {mode === 'pick' ? 'picked' : 'newest'} picture when you press Generate here.</div>
      )}
      {'pickLost' in res && res.pickLost && <div style={{ ...muted, color: 'var(--il-warn)' }}>The picked result is gone — using the last one until you pick another.</div>}
      {mode === 'pick' && !picked && results.length > 0 && <div style={muted}>Tap a result to pin it; until then the last one is used.</div>}
      {mode === 'pick' && results.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div ref={stripRef} className="il-scroll-x" data-no-swipe role="listbox" aria-label={`Results of ${from}`} style={{ display: 'flex', gap: 6, padding: 3, margin: -3, flex: 1, minWidth: 0, touchAction: 'pan-x pan-y' }}>
            {strip.map((r) => <ResultTile key={r.key} r={r} selected={r.key === picked} size={56} onPick={() => pick(r)} />)}
          </div>
          {results.length >= BROWSE_FROM && <button type="button" style={pillBtn} onClick={() => setBrowsing(true)} title={`All ${results.length} results of ${from}`}><IconLayoutGrid size={13} />Browse…</button>}
        </div>
      )}
      {mode !== 'off' && children}
      <Modal opened={browsing} onClose={() => setBrowsing(false)} title={`Pick a result of ${from}`} size="lg" centered zIndex={T.z.modal}
        styles={{ body: { maxHeight: 'calc(100dvh - 120px)', overflow: 'hidden', display: 'flex' } }}>
        <div className="il-scroll" style={{ flex: 1, minHeight: 0, maxHeight: 'calc(100dvh - 180px)', touchAction: 'pan-y', paddingRight: 2 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 6 }}>
            {results.map((r) => <ResultTile key={r.key} r={r} selected={r.key === picked} size="fill" onPick={() => pick(r)} />)}
          </div>
        </div>
      </Modal>
    </div>
  );
}
