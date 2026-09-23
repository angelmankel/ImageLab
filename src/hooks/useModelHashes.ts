import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { fetchModelHashes, type ModelHashes } from '@/lib/comfy';
import { resolveCivitai, type CivitaiCacheEntry } from '@/lib/civitai';

/** Keep hashes and previews current while models download and CivitAI recovers. */
export function useModelHashes() {
  const servers = useStore(s => s.servers);
  const setModelHashes = useStore(s => s.setModelHashes);
  const mergeCivitai = useStore(s => s.mergeCivitai);

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const snapshots = new Map<string, ModelHashes>();
    let timer: ReturnType<typeof setTimeout>;
    let resolving = false;
    let nextResolve = 0;
    let lastVersion = '';

    const buffer: CivitaiCacheEntry[] = [];
    let flushScheduled = false;
    const flush = () => {
      flushScheduled = false;
      if (!cancelled && buffer.length) mergeCivitai(buffer.splice(0));
    };

    const poll = async () => {
      const results = await Promise.allSettled(
        servers.map(s => fetchModelHashes(s.host, snapshots.get(s.host)?.version, ac.signal)),
      );
      if (cancelled) return;
      results.forEach((r, i) => {
        const sv = servers[i];
        if (r.status === 'fulfilled' && r.value) {
          snapshots.set(sv.host, r.value);
        } else if (r.status === 'rejected') {
          console.warn(`[imagelab-node] ${sv.name} (${sv.host}) failed:`, r.reason);
        }
        // A 304 or a temporarily unreachable server keeps its last snapshot.
      });
      const version = JSON.stringify([...snapshots].map(([host, value]) => [host, value.version]));
      const changed = version !== lastVersion;
      const merged = [...snapshots.values()].flatMap(s => s.models);
      if (changed) {
        // Keep filename aliases: identical content can have different names.
        setModelHashes(merged);
        lastVersion = version;
      }

      if (!resolving && (changed || Date.now() >= nextResolve)) {
        resolving = true;
        void resolveCivitai(merged.map(m => m.hash), {
          signal: ac.signal,
          onResolved: entry => {
            if (cancelled) return;
            buffer.push(entry);
            if (!flushScheduled) {
              flushScheduled = true;
              queueMicrotask(flush);
            }
          },
        }).catch(error => {
          if (!cancelled) console.warn('[civitai] Could not refresh metadata:', error);
        }).finally(() => {
          resolving = false;
          nextResolve = Date.now() + 30_000;
        });
      }
      timer = setTimeout(() => { void poll(); }, 10_000);
    };
    void poll();

    return () => { cancelled = true; clearTimeout(timer); ac.abort(); };
  }, [servers, setModelHashes, mergeCivitai]);
}
