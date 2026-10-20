/**
 * Right-click / long-press on a step in the rail (FIXLIST 45): open it. The steps owner adds the
 * rest (~/screens/image/stepMenuEntries.ts: add after, rename, duplicate, move, remove with Undo).
 */
import { IconArrowRight } from '@tabler/icons-react';
import { useRoute } from '~/app/routeStore';
import { useSteps, type Step } from '~/app/stepsStore';
import { registerMenu } from '../registry';

registerMenu<Step>('step', [
  {
    id: 'open', label: 'Open', icon: IconArrowRight, group: 'open',
    visible: (s) => useSteps.getState().activeId !== s.id || useRoute.getState().screen !== 'step',
    action: (s) => { useSteps.getState().setActive(s.id); useRoute.getState().go('step'); },
  },
  // Add after · Rename · Duplicate · Move · Remove (with Undo): the steps owner's ~/screens/image/stepMenuEntries.ts.
]);
