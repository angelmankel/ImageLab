/**
 * Rule 3, the top of the sticky block: "STEP 1 · WORKFLOW" eyebrow, the workflow's name, "edited"
 * when a parameter differs from the saved workflow, and ▾ = a menu: Save · Save as… · Revert ·
 * Rename… (· Remove step for steps 2+). The Image step saves to a local snapshot
 * (`workflowSnapshots.ts`); other steps get their own stores later.
 */
import { useState } from 'react';
import { Menu, Modal, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconChevronDown, IconDeviceFloppy, IconCopy, IconArrowBackUp, IconPencil, IconTrash } from '@tabler/icons-react';
import { useSteps, stepTitle, type Step } from '~/app/stepsStore';
import { saveSnapshot, revertSnapshot } from './workflowSnapshots';
import { removeStepWithUndo } from './stepActions';

const THUMB: Record<Step['kind'], string> = {
  image: 'linear-gradient(135deg,#5A4A3E,#2A2420)',
  upscale: 'linear-gradient(135deg,#3E5050,#1F2A2A)',
  refine: 'linear-gradient(135deg,#5A503E,#2A2620)',
  'remove-bg': 'linear-gradient(135deg,#4A5A3E,#232A1F)',
  video: 'linear-gradient(135deg,#4C405A,#241F2C)',
  workflow: 'linear-gradient(135deg,#3F4F5E,#1E262D)',
};

export function WorkflowRow({ step }: { step: Step }) {
  const steps = useSteps((s) => s.steps);
  const updateStep = useSteps((s) => s.updateStep);
  const [renaming, setRenaming] = useState<null | 'rename' | 'saveAs'>(null);
  const [draft, setDraft] = useState(step.name);
  const first = steps[0]?.id === step.id;

  const save = () => { saveSnapshot(step.id); updateStep(step.id, { edited: false }); notifications.show({ title: 'Workflow saved', message: step.name, color: 'teal', autoClose: 2000 }); };
  const revert = () => {
    if (revertSnapshot(step.id)) { updateStep(step.id, { edited: false }); notifications.show({ title: 'Reverted', message: `Back to the saved “${step.name}”`, color: 'teal', autoClose: 2000 }); }
    else notifications.show({ title: 'Nothing saved yet', message: 'Save the workflow first, then Revert goes back to it.', color: 'yellow', autoClose: 3000 });
  };
  const submit = () => {
    const name = draft.trim();
    if (name) {
      updateStep(step.id, { name, edited: renaming === 'saveAs' ? false : step.edited });
      if (renaming === 'saveAs') saveSnapshot(step.id);
    }
    setRenaming(null);
  };

  return (
    <>
      <Menu position="bottom-end" shadow="lg" width={220} withinPortal>
        <Menu.Target>
          <button type="button" aria-label="Workflow menu" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', height: 54, padding: '0 12px', border: 0, background: 'transparent', color: 'var(--il-fg)', textAlign: 'left', cursor: 'pointer' }}>
            <div aria-hidden style={{ width: 40, height: 40, borderRadius: 12, background: THUMB[step.kind], flex: 'none' }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 800, letterSpacing: '.4px', color: 'var(--il-ember)', textTransform: 'uppercase' }}>Step {stepTitle(steps, step.id).replace(' · ', ' · ').split(' · ')[0]} · Workflow</span>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{step.name}</span>
            </span>
            {step.edited && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-ember-hi)', background: 'var(--il-card-on)', borderRadius: 999, padding: '4px 9px', flex: 'none' }}>edited</span>}
            <IconChevronDown size={18} stroke={2.4} color="var(--il-muted)" />
          </button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<IconDeviceFloppy size={14} />} onClick={save}>Save</Menu.Item>
          <Menu.Item leftSection={<IconCopy size={14} />} onClick={() => { setDraft(`${step.name} copy`); setRenaming('saveAs'); }}>Save as…</Menu.Item>
          <Menu.Item leftSection={<IconArrowBackUp size={14} />} onClick={revert} disabled={!step.edited}>Revert</Menu.Item>
          <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => { setDraft(step.name); setRenaming('rename'); }}>Rename…</Menu.Item>
          {!first && <><Menu.Divider /><Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => removeStepWithUndo(step.id)}>Remove step</Menu.Item></>}
        </Menu.Dropdown>
      </Menu>
      <Modal opened={renaming !== null} onClose={() => setRenaming(null)} title={renaming === 'saveAs' ? 'Save the workflow as' : 'Rename the workflow'} size="xs" centered>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} style={{ display: 'flex', gap: 6 }}>
          <TextInput value={draft} onChange={(e) => setDraft(e.currentTarget.value)} data-autofocus style={{ flex: 1 }} aria-label="Workflow name" />
          <button type="submit" style={{ height: 36, padding: '0 14px', border: 0, borderRadius: 999, background: 'var(--il-ember)', color: 'var(--il-bg)', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>{renaming === 'saveAs' ? 'Save' : 'Rename'}</button>
        </form>
      </Modal>
    </>
  );
}
