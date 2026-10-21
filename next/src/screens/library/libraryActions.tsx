/**
 * Library (rule 12) — what the buttons do. Plain functions (no hooks) so the desktop panel, the
 * phone sheet and the bulk bar share them: Use prompt · Reuse settings · Send to step (through
 * `~/app/actions`, then back to the step), Add to collection, ★, Download, Delete.
 */
import { useState } from 'react';
import { Button, TextInput } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useStore } from '@/lib/store';
import { usePromptFrom, reuseSettingsFrom, recallFrom, sendToStep } from '~/app/actions';
import { useRoute } from '~/app/routeStore';
import { T } from '~/theme/tokens';
import { useLibrary } from './libraryStore';
import { forgetImage, runStoreOf } from '~/app/deleteResult';
import type { LibItem } from './libraryLogic';

const toStep = () => useRoute.getState().go('step');

export function applyPrompt(it: LibItem) {
  if (!it.entry) return;
  usePromptFrom(it.entry);
  toStep();
}

export function applySettings(it: LibItem) {
  if (!it.entry) return;
  reuseSettingsFrom(it.entry);
  toStep();
}

/** Everything back into the step: workflow, input image and prompt. */
export function recallItem(it: LibItem) {
  if (!it.entry) return;
  recallFrom(it.entry);
  toStep();
}

export function sendItemToStep(it: LibItem, stepId?: string) {
  sendToStep({ url: it.url, entry: it.entry }, stepId);
  toStep();
}

export function toggleFav(it: LibItem) {
  if (it.entry) useStore.getState().toggleHistoryLiked(it.entry.id);
  else useLibrary.getState().toggleVideoLiked(it.key);
}

/** Bulk ★: star them all, or, when every one is starred already, unstar them all. */
export function favMany(items: readonly LibItem[]) {
  const on = !items.every((i) => i.liked);
  for (const it of items) if (it.liked !== on) toggleFav(it);
}

export function addToCollection(collectionId: string, items: readonly LibItem[]) {
  const { addToCollection: add, collections } = useStore.getState();
  for (const it of items) add(collectionId, it.key);
  const name = collections.find((c) => c.id === collectionId)?.name ?? 'collection';
  notifications.show({ message: `${items.length === 1 ? 'Added' : `${items.length} added`} to ${name}` });
}

export function removeFromCollection(collectionId: string, items: readonly LibItem[]) {
  const { removeFromCollection: remove } = useStore.getState();
  for (const it of items) remove(collectionId, it.key);
}

/** Fetch + object URL: `<a download>` is ignored on the cross-origin ComfyUI host. */
export async function downloadItem(it: LibItem) {
  try {
    const res = await fetch(it.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const obj = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = obj;
    a.download = it.filename || `imagelab-${it.key.slice(-8)}.${it.kind === 'video' ? 'mp4' : 'png'}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(obj), 1000);
  } catch (err) {
    notifications.show({ color: 'red', message: `Download failed: ${err instanceof Error ? err.message : String(err)}` });
  }
}

export async function downloadMany(items: readonly LibItem[]) {
  for (const it of items) {
    await downloadItem(it);
    await new Promise((r) => setTimeout(r, 250)); // browsers drop rapid-fire downloads
  }
}

/** Ask, then remove: images leave the history, videos leave the library and their run store, so the step's history drops them too (the file stays on the server). */
export function confirmDelete(items: readonly LibItem[], onDone?: () => void) {
  if (!items.length) return;
  const n = items.length;
  modals.openConfirmModal({
    title: n === 1 ? 'Delete this item?' : `Delete ${n} items?`,
    children: <span style={{ fontSize: 13, color: 'var(--il-fg2)' }}>It leaves your history and every collection. Starred copies saved on the server stay.</span>,
    labels: { confirm: 'Delete', cancel: 'Cancel' },
    confirmProps: { color: 'red' },
    zIndex: T.z.confirm,
    centered: true,
    onConfirm: () => {
      const s = useStore.getState();
      const videos: string[] = [];
      for (const it of items) {
        if (it.entry) forgetImage(it.entry); // its file stays hidden from the run stores too (fix list 2, item 2)
        else videos.push(it.key);
        s.removeItemFromAllCollections(it.key);
      }
      if (videos.length) {
        useLibrary.getState().hideVideos(videos);
        for (const url of videos) runStoreOf(url)?.getState().removeResult(url);
      }
      onDone?.();
    },
  });
}

/** "+ New collection": ask for a name, create it, optionally add `items`, and show it. */
export function newCollection(items?: readonly LibItem[]) {
  const id = modals.open({
    title: 'New collection',
    centered: true,
    zIndex: T.z.confirm,
    children: <NewCollectionForm onCreate={(name) => {
      const cid = useStore.getState().createCollection(name);
      if (items?.length) addToCollection(cid, items);
      else useLibrary.getState().setBucket(cid);
      modals.close(id);
    }} />,
  });
}

function NewCollectionForm({ onCreate }: { onCreate: (name: string) => void }) {
  const [name, setName] = useState('');
  const ok = name.trim().length > 0;
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (ok) onCreate(name.trim()); }} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <TextInput data-autofocus placeholder="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
      <Button type="submit" disabled={!ok} color="ember" radius="xl">Create</Button>
    </form>
  );
}
