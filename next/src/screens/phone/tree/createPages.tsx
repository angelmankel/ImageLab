/**
 * The create flow's places in the phone's 2D map (mobile pass, m-create; Donny 10-21). Y = depth
 * (stacked cards), X = siblings:
 *   'session' {id}         depth 1 · siblings = the open sessions (the desktop's tabs) · the step cards
 *   'step'    {id}         depth 2 · siblings = the session's steps · the stage + the section rows
 *   'section' {stepId,tab} depth 3 · siblings = the step's tabs (Prompt · Composition · Model · Parameters · Style)
 * A page whose id is not the current session / active step makes it current when it shows (a
 * sideways swipe, the HUD, a link), so the stores and the map agree. The band's right side on the
 * step and section pages is Generate (`BandGenerate`). Registered on import (PhoneShell imports it).
 */
import { useEffect, type ReactNode } from 'react';
import { registerPhonePage, setScreenPath, phoneNav, usePhoneBand, type PhonePageProps } from '~/phone';
import { useSessions, displayName } from '~/app/sessionsStore';
import { useSteps, STEP_LABEL } from '~/app/stepsStore';
import type { StepTab } from '~/screens/image/layoutStore';
import { STEP_TAB_DEFS, stepTabKeys } from '~/screens/image/StepPanel';
import { SessionPageBody } from './SessionPage';
import { StepPageBody } from './StepPage';
import { TabPageBody } from './TabPage';
import { BandGenerate } from './BandGenerate';
import { StepSheet } from '../StepSheet';

type SessionP = { id?: string };
type StepP = { id?: string };
type SectionP = { stepId?: string; tab?: StepTab };

function useMakeCurrentSession(id: string | undefined) {
  useEffect(() => { const st = useSessions.getState(); if (id && id !== st.currentId && st.sessions[id]) st.switchTo(id); }, [id]);
}
function useMakeActiveStep(id: string | undefined) {
  useEffect(() => { if (id && useSteps.getState().activeId !== id && useSteps.getState().steps.some((s) => s.id === id)) useSteps.getState().setActive(id); }, [id]);
}

function SessionPage({ params, page }: PhonePageProps<SessionP>) {
  useMakeCurrentSession(params.id);
  usePhoneBand({ right: { label: 'Generate all', node: <BandGenerate all /> } });
  return (
    <Scroll>
      <div style={{ paddingTop: 4 }}><SessionPageBody onOpenStep={(id) => { useSteps.getState().setActive(id); phoneNav.push('step', { id }, { from: page.key }); }} /></div>
      <StepSheet />
    </Scroll>
  );
}

function StepPage({ params, page }: PhonePageProps<StepP>) {
  useMakeActiveStep(params.id);
  const steps = useSteps((s) => s.steps);
  const activeId = useSteps((s) => s.activeId);
  const step = steps.find((s) => s.id === (params.id ?? activeId)) ?? steps[0];
  usePhoneBand({ right: { label: 'Generate', node: <BandGenerate /> } });
  return <Scroll><StepPageBody step={step} onOpenTab={(tab) => phoneNav.push('section', { stepId: step.id, tab }, { from: page.key })} /></Scroll>;
}

function SectionPage({ params }: PhonePageProps<SectionP>) {
  useMakeActiveStep(params.stepId);
  const steps = useSteps((s) => s.steps);
  const activeId = useSteps((s) => s.activeId);
  const step = steps.find((s) => s.id === (params.stepId ?? activeId)) ?? steps[0];
  const keys = stepTabKeys(step);
  const tab = params.tab && keys.includes(params.tab) ? params.tab : 'prompt';
  usePhoneBand({ right: { label: 'Generate', node: <BandGenerate /> } });
  return <Scroll><TabPageBody step={step} tab={tab} /></Scroll>;
}

/** The card body scrolls by itself (the frame pulls the card down only once this is at its top). */
function Scroll({ children }: { children: ReactNode }) {
  return (
    <div className="il-scroll" data-pad-start style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain', touchAction: 'pan-y', paddingBottom: 'var(--il-safe-bottom)' }}>
      {children}
    </div>
  );
}

const stepIndex = (id?: string) => { const st = useSteps.getState(); return Math.max(0, st.steps.findIndex((s) => s.id === (id ?? st.activeId))); };

registerPhonePage<SessionP>('session', {
  Component: SessionPage,
  title: (p) => { const st = useSessions.getState(); const s = st.sessions[p.id ?? st.currentId]; return s ? displayName(s.name) : 'Session'; },
  screen: 'step',
  siblings: (p) => {
    const st = useSessions.getState();
    const ids = st.openIds;
    return { count: ids.length, index: ids.indexOf(p.id ?? st.currentId), at: (i) => ({ kind: 'session', params: { id: ids[i] } }) };
  },
});

registerPhonePage<StepP>('step', {
  Component: StepPage,
  title: (p) => { const st = useSteps.getState(); const i = stepIndex(p.id); const s = st.steps[i]; return s ? `${i + 1} · ${STEP_LABEL[s.kind]}` : 'Step'; },
  screen: 'step',
  siblings: (p) => {
    const steps = useSteps.getState().steps;
    return { count: steps.length, index: stepIndex(p.id), at: (i) => ({ kind: 'step', params: { id: steps[i].id } }) };
  },
});

registerPhonePage<SectionP>('section', {
  Component: SectionPage,
  title: (p) => STEP_TAB_DEFS.find((d) => d.key === (p.tab ?? 'prompt'))?.title ?? 'Section',
  screen: 'step',
  siblings: (p) => {
    const st = useSteps.getState();
    const step = st.steps.find((s) => s.id === (p.stepId ?? st.activeId)) ?? st.steps[0];
    if (!step) return null;
    const keys = stepTabKeys(step);
    return { count: keys.length, index: keys.indexOf(p.tab ?? 'prompt'), at: (i) => ({ kind: 'section', params: { stepId: step.id, tab: keys[i] } }) };
  },
});

setScreenPath('step', () => {
  const sid = useSessions.getState().currentId;
  const id = useSteps.getState().activeId;
  return [{ kind: 'home' }, { kind: 'session', params: { id: sid } }, { kind: 'step', params: { id } }];
});
