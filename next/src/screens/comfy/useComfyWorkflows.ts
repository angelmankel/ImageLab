/**
 * Saved workflows on the chosen server (rule 14). The list, its polling and opening one are the
 * main app's (`@/features/studio/useWorkflowLibrary`, which needs the raw `/object_info` from
 * `useObjectInfo`); opening loads the workflow into the shared Studio store, which is what a
 * workflow step runs. This adds what the new screen shows and does: node counts (read once per
 * saved version), "last used", "Use as step", and importing a JSON file (an API-format graph is
 * turned into an editor workflow with `@/lib/workflowGraph`'s `apiToEditor`).
 */
import { useCallback, useEffect, useMemo } from 'react';
import { notifications } from '@mantine/notifications';
import { loadSavedWorkflow, type SavedWorkflow } from '@/lib/comfy';
import { useWorkflowLibrary } from '@/features/studio/useWorkflowLibrary';
import { useObjectInfo } from '@/features/studio/useStudioRun';
import { apiToEditor, type ApiGraph } from '@/lib/workflowGraph';
import type { Server } from '@/lib/storage';
import { useSteps } from '~/app/stepsStore';
import { useRoute } from '~/app/routeStore';
import { deleteWorkflowFile, restoreWorkflowFile, saveWorkflowFile } from './comfyApi';
import { deleteInFrame, openInFrame, syncFrame } from './comfyFrame';
import { undoNote } from '~/app/undoNote';
import { errorNote } from './errorNote';
import { editorNodeCount, epochMs, workflowFileName, workflowKind } from './comfyHelpers';
import { useWorkflowStore, workflowKey, type ComfyKind } from './workflowStore';
import { ensureStepWorkflowOpen } from './ensureStepWorkflow';

export interface ComfyWorkflowRow extends SavedWorkflow {
  key: string;
  nodes: number | null;
  usedAt: number;
  savedAt: number;
}

export function useComfyWorkflows(server: Server | null, kind: ComfyKind) {
  const host = server?.host ?? null;
  const { info, error: infoError } = useObjectInfo(host);
  const library = useWorkflowLibrary(host, info);
  const meta = useWorkflowStore((s) => s.meta);
  const lastUsed = useWorkflowStore((s) => s.lastUsed);

  // Read node counts one file at a time, only for versions not read yet.
  useEffect(() => {
    if (!host || !library.workflows.length) return;
    let stopped = false;
    void (async () => {
      for (const w of library.workflows.slice(0, 60)) {
        if (stopped) return;
        const key = workflowKey(host, w.path);
        const known = useWorkflowStore.getState().meta[key];
        if (known && known.modified === w.modified) continue;
        try {
          const wf = await loadSavedWorkflow(host, w.path);
          if (!stopped) useWorkflowStore.getState().setMeta(key, { nodes: editorNodeCount(wf), modified: w.modified });
        } catch { /* a file that will not load just shows no count */ }
      }
    })();
    return () => { stopped = true; };
  }, [host, library.workflows]);

  const rows = useMemo<ComfyWorkflowRow[]>(() => (host ? library.workflows.map((w) => {
    const key = workflowKey(host, w.path);
    const m = meta[key];
    return { ...w, key, nodes: m ? m.nodes : null, usedAt: lastUsed[key] ?? 0, savedAt: epochMs(w.modified) };
  }) : []), [host, library.workflows, meta, lastUsed]);

  const open = library.open;

  /** Load it, add a workflow step that runs it, remember which, and go to the step. */
  const addAsStep = useCallback(async (w: ComfyWorkflowRow) => {
    if (!host) return;
    const stepId = useSteps.getState().addStep('workflow', w.name);
    const store = useWorkflowStore.getState();
    store.setStepWorkflow(stepId, { host, serverId: server?.id ?? null, path: w.path, name: w.name, kind });
    store.markUsed(w.key);
    // Load it into the Studio store from the step's host, so the step's Generate runs it.
    try { await ensureStepWorkflowOpen(stepId); } catch (err) {
      errorNote('Could not open this workflow', err);
    }
    useRoute.getState().go('step');
  }, [host, server?.id, kind]);

  /** Open it in the embedded ComfyUI (FIXLIST 34) and in the shared Studio store (what a workflow step runs). */
  const select = useCallback(async (w: ComfyWorkflowRow) => {
    void openInFrame(w.path).catch((err) => errorNote('Could not open this workflow', err, `ComfyUI could not load ${w.name}.`));
    await open(w.path);
    useWorkflowStore.getState().markUsed(w.key);
  }, [open]);

  /** Delete the file from ComfyUI's workflow store (through the frame when it can, so its tab closes too). Undo writes it back. */
  const remove = useCallback(async (w: ComfyWorkflowRow) => {
    if (!host) return;
    let saved: unknown;
    try { saved = await loadSavedWorkflow(host, w.path); } catch { saved = undefined; }
    try {
      const viaFrame = await deleteInFrame(w.path);
      if (!viaFrame) await deleteWorkflowFile(host, w.path);
    } catch (err) {
      notifications.show({ color: 'red', title: 'Could not delete it', message: err instanceof Error ? err.message : String(err) });
      return;
    }
    library.refresh();
    if (saved !== undefined) {
      undoNote(`${w.name} deleted`, () => {
        void restoreWorkflowFile(host, w.path, saved)
          .then(() => { library.refresh(); return syncFrame(); })
          .catch((err) => notifications.show({ color: 'red', title: 'Could not bring it back', message: err instanceof Error ? err.message : String(err) }));
      });
    }
  }, [host, library]);

  /** Import a workflow file into this server's ComfyUI `workflows/` folder. */
  const importFile = useCallback(async (file: File) => {
    if (!host) return;
    let json: unknown;
    try { json = JSON.parse(await file.text()); } catch {
      notifications.show({ color: 'red', title: 'Not a workflow', message: `${file.name} is not JSON.` });
      return;
    }
    const kindOf = workflowKind(json);
    if (!kindOf) {
      notifications.show({ color: 'red', title: 'Not a workflow', message: `${file.name} has no ComfyUI nodes in it.` });
      return;
    }
    if (kindOf === 'api' && !info) {
      notifications.show({ color: 'red', title: 'Server not ready', message: 'This server has not sent its node list yet. Try again in a moment.' });
      return;
    }
    const wf = kindOf === 'api' ? apiToEditor(json as ApiGraph, info!) : json;
    const base = workflowFileName(file.name).replace(/\.json$/, '');
    for (let n = 1; n <= 20; n++) {
      const name = n === 1 ? `${base}.json` : `${base} (${n}).json`;
      try {
        await saveWorkflowFile(host, name, wf);
        notifications.show({ color: 'green', title: 'Workflow imported', message: name.replace(/\.json$/, '') });
        library.refresh();
        void syncFrame();
        return;
      } catch (err) {
        if (err instanceof Error && err.message === 'exists') continue;
        notifications.show({ color: 'red', title: 'Import failed', message: err instanceof Error ? err.message : String(err) });
        return;
      }
    }
  }, [host, info, library]);

  return {
    rows,
    loading: library.loading,
    error: library.error ?? (infoError ? `Could not read the server's nodes (${infoError})` : null),
    ready: !!info,
    addAsStep,
    select,
    remove,
    importFile,
    refresh: library.refresh,
  };
}
