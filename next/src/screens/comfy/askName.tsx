/**
 * FIXLIST-2 #53: a small box that asks for a workflow name (Rename, Save as). Resolves with the
 * typed name, or null when closed.
 */
import { useState } from 'react';
import { TextInput } from '@mantine/core';
import { modals } from '@mantine/modals';
import { Button } from '~/ui/Button';

function NameForm({ initial, action, done }: { initial: string; action: string; done: (name: string | null) => void }) {
  const [draft, setDraft] = useState(initial);
  return (
    <form onSubmit={(e) => { e.preventDefault(); done(draft.trim() || null); }} style={{ display: 'flex', gap: 6 }}>
      <TextInput value={draft} onChange={(e) => setDraft(e.currentTarget.value)} data-autofocus style={{ flex: 1 }} aria-label="Workflow name"
        onFocus={(e) => e.currentTarget.select()} />
      <Button type="submit" tone="primary" disabled={!draft.trim()}>{action}</Button>
    </form>
  );
}

export function askName(title: string, initial: string, action: string): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v: string | null) => { if (!settled) { settled = true; resolve(v); } };
    const id = modals.open({
      title, size: 'xs', centered: true,
      onClose: () => finish(null),
      children: <NameForm initial={initial} action={action} done={(v) => { finish(v); modals.close(id); }} />,
    });
  });
}
