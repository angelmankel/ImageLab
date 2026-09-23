// Run with node --test tests/model-metadata.test.cjs. Uses the build's TypeScript compiler.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, require: name => {
      assert.ok(name in dependencies, `Unexpected import: ${name}`);
      return dependencies[name];
    },
    console: { info() {}, warn() {} }, Date, performance, AbortController,
    setTimeout, clearTimeout, URL, URLSearchParams, queueMicrotask,
    ...globals,
  }, { filename: file });
  return exports;
}
const drain = () => new Promise(resolve => setImmediate(resolve));

test('polls late hashes, preserves 304 snapshots and aliases, retries metadata, cleans up', async () => {
  let cleanup, now = 0, resolves = 0, published = [];
  const timers = new Map();
  const knownVersions = [];
  const rows = [{ key: 'loras/one', hash: 'abc' }, { key: 'loras/alias', hash: 'abc' }];
  const responses = [{ version: 'empty', models: [] }, { version: 'ready', models: rows }, null, null];
  const entries = [];
  const state = {
    servers: [{ host: 'pod', name: 'Pod' }],
    setModelHashes: models => { published = models; },
    mergeCivitai: batch => entries.push(...batch),
  };
  const module = load('hooks/useModelHashes.ts', {
    react: { useEffect: effect => { cleanup = effect(); } },
    '@/lib/store': { useStore: selector => selector(state) },
    '@/lib/comfy': { fetchModelHashes: async (_, known) => { knownVersions.push(known); return responses.shift() ?? null; } },
    '@/lib/civitai': { resolveCivitai: async (hashes, opts) => {
      resolves++;
      for (const hash of hashes) opts.onResolved({ hash, status: resolves < 3 ? 'error' : 'found' });
      return new Map();
    } },
  }, {
    Date: class extends Date { static now() { return now; } },
    setTimeout: fn => { const id = Symbol(); timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id),
  });
  const tick = async ms => {
    now += ms;
    const [id, fn] = timers.entries().next().value;
    timers.delete(id); fn(); await drain();
  };
  module.useModelHashes(); await drain();
  assert.equal(published.length, 0);
  await tick(10_000);
  assert.equal(published.length, 2, 'keep both names for identical content');
  assert.equal(entries.at(-1).status, 'error');
  await tick(10_000);
  assert.equal(published.length, 2, '304 must retain hashes');
  assert.equal(resolves, 2, 'do not retry every hash poll');
  await tick(30_000);
  assert.equal(entries.at(-1).status, 'found', 'recover without reloading');
  assert.deepEqual(knownVersions, [undefined, 'empty', 'ready', 'ready']);
  cleanup();
  assert.equal(timers.size, 0);
});

function civitaiHarness(cached = new Map(), overrides = {}, globals = {}) {
  let calls = 0;
  const data = { modelId: 123, images: [{ url: 'https://example.com/new.jpg' }] };
  const module = load('lib/civitai.ts', {
    './storage': { loadCivitaiSettings: () => ({ apiKey: '' }) },
    './civitaiCache': {
      getCivitaiMany: async () => cached,
      putCivitaiMany: async entries => entries.forEach(entry => cached.set(entry.hash, entry)),
      getCivitaiModel: async () => undefined,
      putCivitaiModel: async () => {},
      ...overrides,
    },
  }, {
    localStorage: { getItem: () => null },
    fetch: async () => { calls++; return new Response(JSON.stringify(data)); },
    ...globals,
  });
  return { module, calls: () => calls };
}

test('expires old previews and empty galleries, retains fresh previews', async () => {
  const cached = new Map([
    ['fresh', { hash: 'fresh', status: 'found', fetchedAt: Date.now(), data: { images: [{ url: 'good' }] } }],
    ['old', { hash: 'old', status: 'found', fetchedAt: Date.now() - 2 * 86400000, data: { images: [{ url: 'stale' }] } }],
    ['empty', { hash: 'empty', status: 'found', fetchedAt: Date.now() - 600000, data: { images: [] } }],
    ['missing', { hash: 'missing', status: 'not-found', fetchedAt: Date.now() - 7200000, data: null }],
  ]);
  const h = civitaiHarness(cached);
  const result = await h.module.resolveCivitai([...cached.keys()]);
  assert.equal(h.calls(), 3);
  assert.equal(result.get('fresh').data.images[0].url, 'good');
  for (const key of ['old', 'empty', 'missing']) assert.equal(result.get(key).data.modelId, 123);
});

test('storage failures do not discard successful metadata', async () => {
  const fail = async () => { throw new Error('storage unavailable'); };
  const h = civitaiHarness(new Map(), { getCivitaiMany: fail, putCivitaiMany: fail, getCivitaiModel: fail, putCivitaiModel: fail });
  assert.equal((await h.module.resolveCivitai(['abc'])).get('abc').status, 'found');
  assert.equal((await h.module.fetchCivitaiModel(123)).modelId, 123);
});

test('timeout covers a stalled response body after headers arrive', async () => {
  let timeout;
  const h = civitaiHarness(new Map(), {}, {
    setTimeout: fn => { timeout = fn; return 1; },
    clearTimeout() {},
    fetch: async (_, { signal }) => ({
      ok: true, status: 200,
      text: () => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('timeout', 'AbortError')))),
    }),
  });
  const pending = h.module.fetchCivitaiByHash('abc');
  await drain(); timeout();
  assert.equal((await pending).status, 'error');
});

test('a failed refresh retains previews without making the cache fresh', async () => {
  const previous = { hash: 'abc', status: 'found', fetchedAt: Date.now() - 2 * 86400000, data: { images: [{ url: 'existing' }] } };
  const cached = new Map([['abc', previous]]);
  let calls = 0;
  const h = civitaiHarness(cached, {}, { fetch: async () => { calls++; return new Response('', { status: 503 }); } });
  for (let i = 0; i < 2; i++) assert.equal((await h.module.resolveCivitai(['abc'])).get('abc'), previous);
  assert.equal(cached.get('abc').fetchedAt, previous.fetchedAt);
  assert.equal(calls, 2, 'failed refresh must remain eligible for retry');
});
