/**
 * The phone's Step page body (mobile pass, m-create; Donny's 2D map, depth 2, siblings = the
 * steps): the step's stage first (`PhoneStage`: the picture at its aspect — swipe = results, tap =
 * viewer —, progress, the desktop toolbar's actions, results, prompt line, Send to the next step),
 * then the step's sections as rows, each with one line of what it is set to (Prompt, Composition,
 * Model, Parameters, Style — the desktop tabs, same names, same order). Tap a row = one layer
 * deeper into that section (`onOpenTab`). Generate lives in the frame's band (right side).
 */
import { IconChevronRight } from '@tabler/icons-react';
import type { Step } from '~/app/stepsStore';
import type { StepTab } from '~/screens/image/layoutStore';
import { STEP_TAB_DEFS, stepTabKeys } from '~/screens/image/StepPanel';
import { haptic } from '~/phone';
import { T } from '~/theme/tokens';
import { PhoneStage, usePhoneStage } from '../PhoneStage';
import { useSectionSummary } from './sectionSummary';

function SectionRow({ step, tab, onOpen }: { step: Step; tab: StepTab; onOpen: (t: StepTab) => void }) {
  const def = STEP_TAB_DEFS.find((d) => d.key === tab)!;
  const summary = useSectionSummary(step, tab);
  return (
    <button type="button" onClick={() => { haptic(); onOpen(tab); }}
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 60, padding: '0 12px 0 14px', border: 0, borderRadius: T.radius.lg, background: 'var(--il-card)', color: 'var(--il-fg)', textAlign: 'left', cursor: 'pointer' }}>
      <def.Icon size={19} stroke={2.2} style={{ color: 'var(--il-muted)', flex: 'none' }} />
      <span style={{ fontSize: 14, fontWeight: 800, width: 104, flex: 'none' }}>{def.title}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: 'var(--il-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{summary}</span>
      <IconChevronRight size={16} color="var(--il-muted)" style={{ flex: 'none' }} />
    </button>
  );
}

export function StepSections({ step, onOpenTab }: { step: Step; onOpenTab: (t: StepTab) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: T.gap.sm, padding: `0 ${T.pad.panel}px` }}>
      {stepTabKeys(step).map((k) => <SectionRow key={k} step={step} tab={k} onOpen={onOpenTab} />)}
    </div>
  );
}

export function StepPageBody({ step, onOpenTab }: { step: Step; onOpenTab: (t: StepTab) => void }) {
  const stage = usePhoneStage(step);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: T.gap.lg, paddingBottom: 12 }}>
      <div><PhoneStage step={step} stage={stage} /></div>
      <StepSections step={step} onOpenTab={onOpenTab} />
    </div>
  );
}
