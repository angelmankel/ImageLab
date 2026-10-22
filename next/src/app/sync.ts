/**
 * Cross-device sync shim (stopgap until the rewrite): every `imagelab*` localStorage key is mirrored
 * to /imagelab/sync/k/<key> (nginx WebDAV on .10, behind the lab-auth login via Traefik), one file per
 * key, last writer wins per key. Pull before the app renders; push 1.5 s after a write; on returning
 * to the tab, pull again and reload if another device changed something. Where /imagelab/sync/ is
 * not served (bare pod ip:port, dev server) every call fails quietly and the app runs as before.
 */
const BASE = '/imagelab/sync/k/';
const META = 'imagelab~sync.meta'; // { key: remote mtime last seen } — itself never synced
// Panel sizes, phone page, folds: these belong to one screen, not to the person.
const LOCAL_ONLY = /layout|panel|phone|collapse|viewer|sliders|cursors/i;

const shouldSync = (k: string) => k.startsWith('imagelab') && k !== META && !LOCAL_ONLY.test(k);

const origSet = Storage.prototype.setItem;
const origRemove = Storage.prototype.removeItem;

function readMeta(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(META) || '{}'); } catch { return {}; }
}
function writeMeta(m: Record<string, string>) {
  try { origSet.call(localStorage, META, JSON.stringify(m)); } catch { /* full: next pull re-fetches */ }
}

interface Entry { name: string; type: string; mtime: string }

async function list(): Promise<Entry[] | null> {
  try {
    const res = await fetch(BASE, { cache: 'no-store', credentials: 'include', signal: AbortSignal.timeout(4000) });
    if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) return null;
    return ((await res.json()) as Entry[]).filter((e) => e.type === 'file');
  } catch { return null; }
}

/** Fetch every key another device changed since we last looked. Returns how many changed. */
async function pull(): Promise<number> {
  const entries = await list();
  if (!entries) return 0;
  const meta = readMeta();
  let changed = 0;
  await Promise.all(entries.map(async (e) => {
    const key = decodeURIComponent(e.name);
    if (!shouldSync(key) || meta[key] === e.mtime || dirty.has(key)) return;
    try {
      const res = await fetch(BASE + e.name, { cache: 'no-store', credentials: 'include' });
      if (!res.ok) return;
      const text = await res.text();
      if (localStorage.getItem(key) !== text) { origSet.call(localStorage, key, text); changed++; }
      meta[key] = e.mtime;
    } catch { /* try again next pull */ }
  }));
  writeMeta(meta);
  return changed;
}

const dirty = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;

async function push() {
  timer = undefined;
  const keys = [...dirty];
  dirty.clear();
  await Promise.all(keys.map(async (key) => {
    const v = localStorage.getItem(key);
    const url = BASE + encodeURIComponent(key);
    try {
      const res = await fetch(url, { method: v === null ? 'DELETE' : 'PUT', body: v ?? undefined, credentials: 'include', keepalive: (v?.length ?? 0) < 60_000 });
      if (!res.ok && res.status !== 404) dirty.add(key);
    } catch { dirty.add(key); }
  }));
  // Remember the server's time for what we just wrote, so the next pull does not fetch it back.
  const entries = await list();
  if (entries) {
    const meta = readMeta();
    for (const e of entries) { const k = decodeURIComponent(e.name); if (keys.includes(k)) meta[k] = e.mtime; }
    for (const k of keys) if (!entries.some((e) => decodeURIComponent(e.name) === k)) delete meta[k];
    writeMeta(meta);
  }
  if (dirty.size) schedule(10_000);
}

function schedule(ms = 1500) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(push, ms);
}

function mark(storage: Storage, key: string) {
  if (storage === localStorage && shouldSync(key)) { dirty.add(key); schedule(); }
}

/** Call once before the first render. */
export async function startSync(): Promise<void> {
  const first = await list();
  if (!first) return; // no sync server here: leave the app alone
  // First run on this device with an empty server: upload what this browser has.
  if (!first.length) {
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; if (shouldSync(k)) dirty.add(k); }
    schedule(0);
  } else {
    await pull();
  }

  Storage.prototype.setItem = function (key: string, value: string) {
    origSet.call(this, key, value);
    mark(this, key);
  };
  Storage.prototype.removeItem = function (key: string) {
    origRemove.call(this, key);
    mark(this, key);
  };

  const flush = () => { if (dirty.size) { if (timer) clearTimeout(timer); void push(); } };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'hidden') return flush();
    if (dirty.size) return; // our own writes go first; the next return pulls
    if (await pull()) location.reload();
  });
}
