import { IconMessageCircle } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { ControlSection } from '@/features/controls/ControlSection';
import { PromptFields } from './PromptFields';

/** The Prompts section: v1's prompt box, snippets, and negative prompt (see PromptFields). */
export function PromptWorkspace() {
  const first = useStore(s => s.layers.find(l => l.kind === 'positive' && l.on && l.text.trim())?.text.trim() ?? '');
  const parts = useStore(s => s.layers.filter(l => l.on && l.text.trim()).length);
  const summary = first ? `${first.slice(0, 40)}${first.length > 40 ? '…' : ''}${parts > 1 ? ` · ${parts} parts` : ''}` : 'Empty';
  return (
    <ControlSection id="workspace-prompts" title="Prompts" icon={IconMessageCircle} summary={summary}>
      <PromptFields />
    </ControlSection>
  );
}
