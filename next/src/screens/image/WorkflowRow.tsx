/**
 * Rule 3, the top of the sticky block (fix list 36): the orange "STEP N · <step name>" eyebrow, the
 * SESSION's name as the big title (the same on every step; one click renames it in place,
 * `SessionTitle`), "edited" when a parameter differs from the saved workflow, and ONLY the ▾ opens
 * the menu: Save · Save as… · Revert · Rename step… (· Remove step for steps 2+). The Image step saves to a local snapshot
 * (`workflowSnapshots.ts`); other steps get their own stores later.
 */
import { useState } from 'react';
import { Menu, Modal, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconChevronDown, IconDeviceFloppy, IconCopy, IconArrowBackUp, IconPencil, IconTrash } from '@tabler/icons-react';
import { useSteps, STEP_LABEL, type Step } from '~/app/stepsStore';
import { SessionTitle } from './SessionTitle';
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
  const index = Math.max(0, steps.findIndex((s) => s.id === step.id));
  const first = index === 0;

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', height: 58, padding: '0 8px 0 12px', color: 'var(--il-fg)' }}>
        <div aria-hidden style={{ width: 40, height: 40, borderRadius: 12, background: THUMB[step.kind], flex: 'none' }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 800, letterSpacing: '.4px', color: 'var(--il-ember)', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Step {index + 1} · {step.name || STEP_LABEL[step.kind]}</span>
          <SessionTitle />
        </span>
        {step.edited && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-ember-hi)', background: 'var(--il-card-on)', borderRadius: 999, padding: '4px 9px', flex: 'none' }}>edited</span>}
      <Menu position="bottom-end" shadow="lg" width={220} withinPortal>
        <Menu.Target>
          <button type="button" aria-label="Workflow menu" title="Workflow: Save · Save as… · Revert · Rename step…" className="il-chev"
            style={{ width: 32, height: 32, borderRadius: 10, border: 0, display: 'grid', placeItems: 'center', background: 'transparent', color: 'var(--il-muted)', cursor: 'pointer', flex: 'none' }}>
            <IconChevronDown size={18} stroke={2.4} />
          </button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<IconDeviceFloppy size={14} />} onClick={save}>Save</Menu.Item>
          <Menu.Item leftSection={<IconCopy size={14} />} onClick={() => { setDraft(`${step.name} copy`); setRenaming('saveAs'); }}>Save as…</Menu.Item>
          <Menu.Item leftSection={<IconArrowBackUp size={14} />} onClick={revert} disabled={!step.edited}>Revert</Menu.Item>
          <Menu.Item leftSection={<IconPencil size={14} />} onClick={() => { setDraft(step.name); setRenaming('rename'); }}>Rename step…</Menu.Item>
          {!first && <><Menu.Divider /><Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => removeStepWithUndo(step.id)}>Remove step</Menu.Item></>}
        </Menu.Dropdown>
      </Menu>
      </div>
      <Modal opened={renaming !== null} onClose={() => setRenaming(null)} title={renaming === 'saveAs' ? 'Save the workflow as' : 'Rename the step'} size="xs" centered>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} style={{ display: 'flex', gap: 6 }}>
          <TextInput value={draft} onChange={(e) => setDraft(e.currentTarget.value)} data-autofocus style={{ flex: 1 }} aria-label="Workflow name" />
          <button type="submit" style={{ height: 36, padding: '0 14px', border: 0, borderRadius: 999, background: 'var(--il-ember)', color: 'var(--il-bg)', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>{renaming === 'saveAs' ? 'Save' : 'Rename'}</button>
        </form>
      </Modal>
    </>
  );
}
