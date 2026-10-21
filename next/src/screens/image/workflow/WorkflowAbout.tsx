/**
 * "About this workflow": the open workflow's own note (`workflowAbout`), folded to its first line.
 * The ready-made presets (workflows/presets) say there what the input must be and what each
 * setting does; any workflow with a Note node shows it the same way.
 */
import { useStudio } from '@/features/studio/studioStore';
import { Collapse } from '~/ui';
import { workflowAbout } from './workflowStepLogic';

export function WorkflowAbout() {
  const text = useStudio((s) => workflowAbout(s.workflow));
  if (!text) return null;
  return (
    <Collapse id="workflow.about" defaultOpen={false} label="About this workflow" preview={text.split('\n')[0]}>
      <div style={{ background: 'var(--il-card)', borderRadius: 14, padding: '10px 12px', fontSize: 12, lineHeight: 1.5, fontWeight: 500, color: 'var(--il-muted)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{text}</div>
    </Collapse>
  );
}
