/**
 * The saved workflows of one ComfyUI host for the step's picker (rule 14's list, read where the
 * step runs): `listSavedWorkflows` (`@/lib/comfy`, `/api/userdata?dir=workflows&recurse=true`),
 * read when the host changes and on Refresh. No polling, no auto-open: the ComfyUI screen's
 * `useComfyWorkflows` does that for its own page; a step only needs the list when it picks.
 */
import { useCallback, useEffect, useState } from 'react';
import { listSavedWorkflows, type SavedWorkflow } from '@/lib/comfy';

const EMPTY: SavedWorkflow[] = [];

export function useSavedWorkflows(host: string | null) {
  const [rows, setRows] = useState<SavedWorkflow[]>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!host) { setRows(EMPTY); setError(null); return; }
    let stopped = false;
    setLoading(true);
    listSavedWorkflows(host)
      .then((list) => { if (!stopped) { setRows(list); setError(null); } })
      .catch((err: unknown) => { if (!stopped) setError(err instanceof Error ? err.message : String(err)); })
      .finally(() => { if (!stopped) setLoading(false); });
    return () => { stopped = true; };
  }, [host, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);
  return { rows, loading, error, refresh };
}
