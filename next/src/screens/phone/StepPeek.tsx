/**
 * What a neighbouring step looks like while the page is dragged towards it (rule 11: swipe the
 * page sideways to change step). A light stand-in for the real page — the step's name and the
 * shape of its Create or Output page — so the drag stays smooth; the real page takes its place
 * the moment the swipe lands.
 */
import { STEP_LABEL, type Step } from '~/app/stepsStore';
import { T } from '~/theme/tokens';
import type { PhonePage } from './phoneStore';

const block = (h: number | string, extra?: React.CSSProperties): React.CSSProperties => ({ height: h, borderRadius: 20, background: 'var(--il-card)', ...extra });

export function StepPeek({ step, index, page }: { step: Step; index: number; page: PhonePage }) {
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: 'var(--il-bg)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div style={{ height: 48, display: 'flex', alignItems: 'center', padding: `0 ${T.pad.panel}px`, gap: T.gap.sm }}>
        <span style={{ fontWeight: 800, fontSize: 18 }}>{page === 'output' ? 'Output' : step.name}</span>
      </div>
      {page === 'output' ? (
        <div style={{ width: '100%', aspectRatio: '1', background: 'var(--il-card)' }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: T.gap.lg, padding: `0 ${T.pad.panel}px` }}>
          <div style={{ ...block(64), display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 14px', gap: 2 }}>
            <span className="il-eyebrow">Step {index + 1} · {STEP_LABEL[step.kind]}</span>
            <span style={{ fontSize: 14, fontWeight: 800 }}>{step.name}</span>
          </div>
          <div style={block(180)} />
          <div style={block(58)} />
          <div style={block(58)} />
        </div>
      )}
    </div>
  );
}
