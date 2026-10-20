/**
 * Fix list 24 (+ 45's registry): the steps owner's right-click entries on a step (rail circle,
 * phone strip pill): Run this step · Generate all · Add a step after it · Rename · Duplicate · Move up / down · Remove (Undo).
 * "Open" is the menu module's own (`~/app/contextMenu/menus/stepMenu.ts`).
 */
import { IconArrowDown, IconArrowUp, IconCopy, IconPencil, IconPlayerPlay, IconPlayerTrackNext, IconPlus, IconTrash } from '@tabler/icons-react';
import { registerMenu } from '~/app/contextMenu';
import { addStepAfter, useSteps, ADDABLE_KINDS, STEP_LABEL, type Step } from '~/app/stepsStore';
import { KIND_ICON } from '~/app/stepKindPicker';
import { generateAll, runStepNow } from './GenerateAll';
import { duplicateStep, moveStepBy, removeStepWithUndo, renameStepPrompt } from './stepActions';

const indexOf = (s: Step) => useSteps.getState().steps.findIndex((x) => x.id === s.id);
const count = () => useSteps.getState().steps.length;

registerMenu<Step>('step', [
  {
    id: 'add', label: 'Add a step after it', icon: IconPlus, group: 'add',
    submenu: (s) => ADDABLE_KINDS.map((kind) => ({ id: `add-${kind}`, label: STEP_LABEL[kind], icon: KIND_ICON[kind], action: () => { addStepAfter(kind, { after: s.id }); } })),
  },
  { id: 'run', label: 'Run this step', icon: IconPlayerPlay, group: 'run', order: 5, action: (s) => { void runStepNow(s); } },
  { id: 'run-all', label: 'Generate all steps', icon: IconPlayerTrackNext, group: 'run', order: 6, action: () => { void generateAll(); } },
  { id: 'rename', label: 'Rename…', icon: IconPencil, group: 'edit', order: 10, action: (s) => renameStepPrompt(s) },
  { id: 'duplicate', label: 'Duplicate', icon: IconCopy, group: 'edit', order: 11, enabled: (s) => indexOf(s) > 0 || 'Step 1 is the session’s picture', action: (s) => duplicateStep(s.id) },
  { id: 'up', label: 'Move up', icon: IconArrowUp, group: 'move', order: 20, enabled: (s) => indexOf(s) > 1 || (indexOf(s) === 0 ? 'Step 1 stays first' : 'Already right under step 1'), action: (s) => moveStepBy(s.id, -1) },
  { id: 'down', label: 'Move down', icon: IconArrowDown, group: 'move', order: 21, enabled: (s) => (indexOf(s) > 0 && indexOf(s) < count() - 1) || (indexOf(s) === 0 ? 'Step 1 stays first' : 'Already the last step'), action: (s) => moveStepBy(s.id, 1) },
  {
    id: 'remove', label: 'Remove step', icon: IconTrash, danger: true, group: 'danger', order: 100,
    enabled: (s) => indexOf(s) > 0 || 'Step 1 always stays',
    action: (s) => removeStepWithUndo(s.id),
  },
]);
