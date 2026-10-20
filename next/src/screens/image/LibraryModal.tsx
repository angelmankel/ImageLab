/**
 * Rule 6: one prompt place. "Library" = CivitAI prompts for the installed models + Mine (the
 * user's saved prompts and the starters), the main app's `features/next` pieces, which put a
 * prompt straight into the box with Undo. Shown in a Mantine modal on the desktop.
 */
import { useState } from 'react';
import { Modal } from '@mantine/core';
import { CivitaiLibrary } from '@/features/next/CivitaiLibrary';
import { MinePrompts } from '@/features/next/MinePrompts';
import { Tabs } from '~/ui';
import { T } from '~/theme/tokens';

type Tab = 'civitai' | 'mine';

export function LibraryModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('civitai');
  return (
    <Modal opened={opened} onClose={onClose} title="Prompt library" size="lg" centered zIndex={T.z.modal} scrollAreaComponent={undefined}
      styles={{ body: { display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 'calc(100dvh - 120px)' } }}>
      <Tabs<Tab> items={[{ key: 'civitai', label: 'CivitAI prompts' }, { key: 'mine', label: 'Mine' }]} value={tab} onChange={setTab} />
      <div className="il-scroll" style={{ minHeight: 0, flex: 1, maxHeight: 'calc(100dvh - 220px)', paddingRight: 2 }}>
        {tab === 'civitai' ? <CivitaiLibrary kind="image" large={false} /> : <MinePrompts kind="image" large={false} />}
      </div>
    </Modal>
  );
}
