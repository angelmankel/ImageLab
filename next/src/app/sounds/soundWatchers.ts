/**
 * The UI sounds nobody has to call (FIXLIST-2 "New UI sounds"), installed once by UiEffects:
 *  - All done: the image jobs run dry after a batch of two or more → the last "done" becomes it;
 *  - Download done: a model download turns from downloading to completed;
 *  - Open / close window: a modal dialog (`[role=dialog][aria-modal=true]`, Mantine Modal / Drawer)
 *    appears in or leaves the page;
 *  - Warning / status note: the footer's `say` line (tone warn / ok);
 *  - Drop accepted / refused: a drop a zone took (any `drop` event: DragLayer refuses the rest at
 *    dragover) / a drag of ours that ended on nothing (`dragend`, dropEffect none, not Escape).
 * Returns the uninstall.
 */
import { useStore } from '@/lib/store';
import { playSound } from '@/lib/sounds';
import { useDownloadsStore } from '@/features/downloads/store';
import { useSaid } from '~/app/notify';
import { armAllDone } from './soundEngine';

function watchJobs(): () => void {
  const batch = new Set<string>();
  let active = 0;
  return useStore.subscribe((s, prev) => {
    if (s.jobs === prev.jobs) return;
    let n = 0;
    for (const j of s.jobs) if (j.status !== 'error') { n++; batch.add(j.id); }
    if (active > 0 && n === 0 && batch.size >= 2) armAllDone();
    if (n === 0) batch.clear();
    active = n;
  });
}

function watchDownloads(): () => void {
  return useDownloadsStore.subscribe((s, prev) => {
    if (s.rows === prev.rows) return;
    for (const r of s.rows) {
      if (r.status !== 'completed') continue;
      const before = prev.rows.find((p) => p.rowId === r.rowId);
      if (before?.status === 'downloading') { playSound('download'); return; }
    }
  });
}

const MODAL = '[role="dialog"][aria-modal="true"]';

function watchModals(): () => void {
  let count = document.querySelectorAll(MODAL).length;
  let raf = 0;
  const recount = () => {
    raf = 0;
    const n = document.querySelectorAll(MODAL).length;
    if (n > count) playSound('open');
    else if (n < count) playSound('close');
    count = n;
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(recount); };
  // Mantine mounts each modal in a portal (a child of <body>): watch <body>'s own children and
  // everything inside the portals, never the app's tree, so its re-renders cost nothing. At most
  // one document query per frame.
  const portals = new MutationObserver(schedule);
  const watchPortals = () => { for (const p of document.querySelectorAll('body > [data-portal]')) portals.observe(p, { childList: true, subtree: true }); };
  const body = new MutationObserver(() => { watchPortals(); schedule(); });
  body.observe(document.body, { childList: true });
  watchPortals();
  return () => { body.disconnect(); portals.disconnect(); if (raf) cancelAnimationFrame(raf); };
}

function watchDrops(): () => void {
  let escaped = false;
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape') escaped = true; };
  const dragstart = () => { escaped = false; };
  // A drop event only fires where a zone accepted the dragover (DragLayer answers "none"
  // everywhere else), so any drop is a taken one. Text dropped into a text box is not ours.
  const drop = (e: DragEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    playSound('dropOk');
  };
  const dragend = (e: DragEvent) => {
    if (!escaped && e.dataTransfer && e.dataTransfer.dropEffect === 'none') playSound('dropRejected');
  };
  window.addEventListener('dragstart', dragstart, true);
  window.addEventListener('keydown', key, true);
  window.addEventListener('drop', drop, true);
  window.addEventListener('dragend', dragend);
  return () => {
    window.removeEventListener('dragstart', dragstart, true);
    window.removeEventListener('keydown', key, true);
    window.removeEventListener('drop', drop, true);
    window.removeEventListener('dragend', dragend);
  };
}

/** The footer's status line (`say`): a soft warning = warning, a routine note = status note. */
function watchSaid(): () => void {
  return useSaid.subscribe((s, prev) => {
    if (s.seq === prev.seq || !s.text) return;
    if (s.tone === 'warn') playSound('warning');
    else if (s.tone === 'ok') playSound('notify');
  });
}

export function installSoundWatchers(): () => void {
  const off = [watchJobs(), watchDownloads(), watchModals(), watchDrops(), watchSaid()];
  return () => { for (const f of off) f(); };
}
