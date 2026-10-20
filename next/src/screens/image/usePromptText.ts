/**
 * The prompt box's binding to the main store's prompt layers, as the old PromptBox did it: the
 * box edits the first layer of its kind (made on first keystroke when there is none); typing goes
 * into a local draft and is committed on a short timer and on blur, so typing never waits on the
 * store. The compiled prompt the job gets is every layer of that kind (`compileLayers`).
 */
import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import type { LayerKind } from '@/lib/types';

const COMMIT_MS = 250;

export function usePromptText(kind: LayerKind): { text: string; set: (t: string) => void; flush: () => void; clear: () => void } {
  const main = useStore((s) => s.layers.find((l) => l.kind === kind));
  const [draft, setDraft] = useState(main?.text ?? '');
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mainId = useRef(main?.id);
  mainId.current = main?.id;

  const flush = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const text = pending.current;
    if (text === null) return;
    pending.current = null;
    const st = useStore.getState();
    if (mainId.current) st.updateLayer(mainId.current, { text, on: true });
    else if (text.trim()) mainId.current = st.addLayer(kind, { text });
  };
  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (pending.current === null) setDraft(main?.text ?? ''); }, [main?.text, main?.id]);

  return {
    text: draft,
    set: (text) => { setDraft(text); pending.current = text; if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(flush, COMMIT_MS); },
    flush,
    clear: () => { if (timer.current) clearTimeout(timer.current); pending.current = null; setDraft(''); if (mainId.current) useStore.getState().updateLayer(mainId.current, { text: '' }); },
  };
}
