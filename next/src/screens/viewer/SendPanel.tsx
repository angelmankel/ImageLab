/**
 * Item 30, the Send tab: quick "send to" actions as big tap targets (44px). Input of a step (every
 * step of this session, numbered like the rail) · New step ▾ (the shared step-kind picker) ·
 * Composition (the Image step's input picture) · Collection ▾ · New session (the whole steps
 * stack that made it, `newSessionFromImage`) · Remove BG · Recall / Use prompt / Use settings ·
 * Copy · Download, then any other drop target an owner registered (`~/dnd` targets). Sending to a
 * step closes the viewer (you land on that step); the rest keep it open.
 */
import type { ReactNode } from 'react';
import { Menu } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconPlus, IconLayersSubtract, IconFolderPlus, IconFolder, IconCopyPlus, IconBackground, IconHistory, IconTextCaption,
  IconSettings, IconDownload, IconClipboard, IconArrowRight,
} from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { recallFrom, reuseSettingsFrom, sendToStep, usePromptFrom } from '~/app/actions';
import { useSteps, stepTitle, STEP_LABEL, STEP_IO } from '~/app/stepsStore';
import { addStepWithPicker, KIND_ICON } from '~/app/stepKindPicker';
import { newSessionFromImage } from '~/app/sessionsStore';
import { removeBgFrom, useRemovingBg } from '~/app/removeBgAction';
import { addImageToCollection, newCollectionWith } from '~/screens/image/collections/collectionActions';
import { useLayout } from '~/screens/image/layoutStore';
import { downloadUrl } from '~/screens/image/canvasMenu';
import { useDropTargets } from '~/dnd';
import { T } from '~/theme/tokens';
import type { ViewerItem } from './types';

function Tile({ icon, title, sub, onClick, disabled, busy }: { icon: ReactNode; title: string; sub?: string; onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void; disabled?: boolean; busy?: boolean }) {
  return (
    <button type="button" className="il-btn il-btn-flash" onClick={onClick} disabled={disabled || busy}
      style={{ height: 48, borderRadius: 12, border: 0, background: 'var(--il-card-on)', display: 'flex', alignItems: 'center', gap: 9, padding: '0 10px', textAlign: 'left', color: 'var(--il-fg)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1, minWidth: 0 }}>
      <span style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--il-ember-soft)', color: 'var(--il-ember-hi)', display: 'grid', placeItems: 'center', flex: 'none' }}>{icon}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 12, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{busy ? 'Working…' : title}</span>
        {sub && <span style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--il-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span>}
      </span>
    </button>
  );
}

const Group = ({ title, children }: { title: string; children: ReactNode }) => (
  <div>
    <div className="il-eyebrow" style={{ margin: '2px 2px 8px' }}>{title}</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6 }}>{children}</div>
  </div>
);

const SUB: Record<string, string> = { image: 'img2img input', video: 'start frame', workflow: 'its image input' };

async function copyImage(url: string) {
  try {
    const blob = await (await fetch(url)).blob();
    const png = blob.type === 'image/png' ? blob : await toPng(blob);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    notifications.show({ message: 'Picture copied', color: 'teal', autoClose: 1500 });
  } catch (e) { notifications.show({ title: 'Could not copy', message: e instanceof Error ? e.message : String(e), color: 'red', autoClose: 3000 }); }
}
async function toPng(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  c.getContext('2d')!.drawImage(bmp, 0, 0);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('PNG encode failed'))), 'image/png'));
}

export function SendPanel({ item, onClose }: { item: ViewerItem; onClose: () => void }) {
  const steps = useSteps((s) => s.steps);
  const collections = useStore((s) => s.collections);
  const targets = useDropTargets();
  const removing = useRemovingBg(item.url);
  const entry = item.entry ?? null;
  const isImage = item.kind === 'image';
  const image = { url: item.url, entry: entry ?? undefined };
  const collectable = { url: item.url, name: item.filename, entryId: entry?.id, key: item.key };

  const toStep = (id: string) => { onClose(); sendToStep(image, id); };
  const composition = () => {
    onClose();
    sendToStep(image, steps[0].id);
    useLayout.getState().setTab('input');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {isImage && (
        <Group title="Input of a step">
          {steps.map((s, i) => {
            const Icon = KIND_ICON[s.kind] ?? IconArrowRight;
            const takes = STEP_IO[s.kind]?.needs !== 'none' || s.kind === 'image';
            return (
              <Tile key={s.id} icon={<Icon size={15} stroke={2.2} />} title={s.name && s.name !== STEP_LABEL[s.kind] ? `${i + 1} · ${s.name}` : stepTitle(steps, s.id)}
                sub={SUB[s.kind] ?? 'step input'} disabled={!takes} onClick={() => toStep(s.id)} />
            );
          })}
          <Tile icon={<IconPlus size={15} stroke={2.4} />} title="New step ▾" sub="Refine, Upscale, Remove BG…"
            onClick={(e) => addStepWithPicker(e.currentTarget, { input: { url: item.url, name: item.filename } }, () => onClose())} />
        </Group>
      )}
      <Group title="Elsewhere">
        {isImage && <Tile icon={<IconLayersSubtract size={15} stroke={2.2} />} title="Composition" sub="the Image step's input" onClick={composition} />}
        <Menu position="bottom-start" withinPortal zIndex={T.z.popover} classNames={{ dropdown: 'il-dd' }}>
          <Menu.Target>
            <div style={{ display: 'grid' }}><Tile icon={<IconFolder size={15} stroke={2.2} />} title="Collection ▾" sub={collections.length ? `${collections.length} collections` : 'start one'} /></div>
          </Menu.Target>
          <Menu.Dropdown>
            {collections.map((c) => (
              <Menu.Item key={c.id} leftSection={<IconFolder size={14} />} onClick={() => void addImageToCollection(c.id, collectable)}>{c.icon ? `${c.icon} ` : ''}{c.name}</Menu.Item>
            ))}
            {collections.length > 0 && <Menu.Divider />}
            <Menu.Item leftSection={<IconFolderPlus size={14} />} onClick={() => void newCollectionWith(collectable)}>New collection with it</Menu.Item>
          </Menu.Dropdown>
        </Menu>
        <Tile icon={<IconCopyPlus size={15} stroke={2.2} />} title="New session" sub="the steps that made it" onClick={() => { onClose(); newSessionFromImage({ url: item.url, key: item.key, entryId: entry?.id, entry, name: item.filename }); }} />
        {isImage && <Tile icon={<IconBackground size={15} stroke={2.2} />} title="Remove BG" sub="cut-out, transparent PNG" busy={removing} onClick={() => void removeBgFrom({ url: item.url, filename: item.filename, entry })} />}
        {targets.map((t) => (
          <Tile key={t.id} icon={<IconArrowRight size={15} stroke={2.2} />} title={t.label} sub={t.group}
            onClick={() => t.onDrop({ kind: 'url', url: item.url, name: item.filename, payload: { v: 1, url: item.url, name: item.filename, kind: item.kind, key: item.key, entryId: entry?.id, source: 'viewer' } })} />
        ))}
      </Group>
      {entry && (
        <Group title="Reuse">
          <Tile icon={<IconHistory size={15} stroke={2.2} />} title="Recall everything" sub="back into the step" onClick={() => recallFrom(entry)} />
          <Tile icon={<IconTextCaption size={15} stroke={2.2} />} title="Use its prompt" onClick={() => usePromptFrom(entry)} />
          <Tile icon={<IconSettings size={15} stroke={2.2} />} title="Use its settings" sub="model, size, sampler, seed" onClick={() => reuseSettingsFrom(entry)} />
        </Group>
      )}
      <Group title="File">
        {isImage && typeof ClipboardItem !== 'undefined' && <Tile icon={<IconClipboard size={15} stroke={2.2} />} title="Copy picture" onClick={() => void copyImage(item.url)} />}
        <Tile icon={<IconDownload size={15} stroke={2.2} />} title="Download" sub={item.filename} onClick={() => downloadUrl(item.url, item.filename)} />
      </Group>
    </div>
  );
}
