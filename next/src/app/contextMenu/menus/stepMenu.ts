/**
 * Right-click / long-press on a step in the rail (FIXLIST 45): open it, add a step, remove it
 * (not step 1) with Undo. The steps owner extends type 'step' (rename, duplicate, move, run …).
 */
import { IconArrowRight, IconArrowsMaximize, IconGitBranch, IconMovie, IconPlus, IconTrash } from '@tabler/icons-react';
import { useRoute } from '~/app/routeStore';
import { useSteps, type Step, type StepKind } from '~/app/stepsStore';
import { registerMenu } from '../registry';
import { undoNote } from './undoNote';

const ADD: Array<{ kind: StepKind; label: string; icon: typeof IconPlus }> = [
  { kind: 'upscale', label: 'Upscale', icon: IconArrowsMaximize },
  { kind: 'video', label: 'Video', icon: IconMovie },
  { kind: 'workflow', label: 'Workflow', icon: IconGitBranch },
];

const isFirst = (s: Step) => useSteps.getState().steps[0]?.id === s.id;

registerMenu<Step>('step', [
  {
    id: 'open', label: 'Open', icon: IconArrowRight, group: 'open',
    visible: (s) => useSteps.getState().activeId !== s.id || useRoute.getState().screen !== 'step',
    action: (s) => { useSteps.getState().setActive(s.id); useRoute.getState().go('step'); },
  },
  {
    id: 'add', label: 'Add a step', icon: IconPlus, group: 'add',
    submenu: ADD.map((a) => ({
      id: `add-${a.kind}`, label: a.label, icon: a.icon,
      action: () => { useSteps.getState().addStep(a.kind); useRoute.getState().go('step'); },
    })),
  },
  {
    id: 'remove', label: 'Remove step', icon: IconTrash, danger: true, group: 'danger', order: 100,
    enabled: (s) => !isFirst(s) || 'Step 1 always stays',
    action: (s) => {
      const { steps, activeId } = useSteps.getState();
      useSteps.getState().removeStep(s.id);
      undoNote(`${s.name || 'Step'} removed`, () => useSteps.setState({ steps, activeId }));
    },
  },
]);
