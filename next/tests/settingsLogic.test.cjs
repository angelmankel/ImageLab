// Settings search + sub-route + phone summaries (src/screens/settings/settingsLogic.ts): every word
// must match, label hits outrank keyword and hint hits, diacritics and case are ignored, the
// highlight cuts the original string, `#/settings/<category>` round-trips.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');
const L = load('src/screens/settings/settingsLogic.ts');

const ROWS = [
  { id: 'servers', category: 'servers', label: 'ComfyUI servers', hint: 'Where images and video render.', keywords: ['host', 'port', 'add', 'remove'] },
  { id: 'ai.model', category: 'ai', label: 'Model', hint: 'The chat model every helper uses.', keywords: ['ollama', 'venice', 'llm'] },
  { id: 'ai.key', category: 'ai', label: 'Venice API key', hint: 'Stays in this browser.', keywords: ['token', 'secret'] },
  { id: 'models.key', category: 'models', label: 'CivitAI API key', hint: 'Unlocks the full catalog in Models.', keywords: ['token', 'civitai.com'] },
  { id: 'models.preview', category: 'models', label: 'Model preview starts on', hint: 'Which image a model tile shows first.' },
  { id: 'appearance.tiles', category: 'appearance', label: 'Library tile size', hint: 'Modèle préférée' },
  { id: 'sounds.volume', category: 'sounds', label: 'Volume', hint: 'Off at zero.', keywords: ['chime', 'blip', 'mute'] },
];

test('normalize: case, diacritics, whitespace', () => {
  assert.equal(L.normalize('  Modèle   PRÉFÉRÉE '), 'modele preferee');
  assert.equal(L.normalize(''), '');
  assert.deepEqual(L.queryTokens(' Api  KEY '), ['api', 'key']);
  assert.deepEqual(L.queryTokens(''), []);
});

test('scoreRow: label prefix > label > keyword > hint; no match = 0', () => {
  const [servers, model, key] = ROWS;
  assert.equal(L.scoreRow(model, 'model'), 100);
  assert.equal(L.scoreRow(servers, 'server'), 100);   // word start inside the label
  assert.equal(L.scoreRow(servers, 'fyui'), 60);      // inside a word
  assert.equal(L.scoreRow(model, 'ollama'), 40);
  assert.equal(L.scoreRow(model, 'helper'), 20);
  assert.equal(L.scoreRow(key, 'ollama'), 0);
  assert.equal(L.scoreRow(key, ''), 0);
});

test('every typed word must hit somewhere', () => {
  assert.ok(L.scoreRow(ROWS[2], 'venice key') > 0);
  assert.equal(L.scoreRow(ROWS[2], 'venice ollama'), 0);
  assert.equal(L.scoreRow(ROWS[1], 'venice ollama'), 80); // both keywords of one row
});

test('searchRows: best first, registry order on ties, empty for an empty query', () => {
  assert.deepEqual(L.searchRows(ROWS, '').map((r) => r.id), []);
  assert.deepEqual(L.searchRows(ROWS, 'key').map((r) => r.id), ['ai.key', 'models.key']);
  assert.deepEqual(L.searchRows(ROWS, 'token').map((r) => r.id), ['ai.key', 'models.key']);
  // "model": the label-prefix rows first, then the two hint hits ("in Models", "Modèle") in registry order.
  assert.deepEqual(L.searchRows(ROWS, 'model').map((r) => r.id), ['ai.model', 'models.preview', 'models.key', 'appearance.tiles']);
  assert.deepEqual(L.searchRows(ROWS, 'MODÈLE').map((r) => r.id), ['appearance.tiles']);
});

test('countByCategory / groupByCategory', () => {
  const counts = L.countByCategory(ROWS, 'key');
  assert.deepEqual(counts, { servers: 0, ai: 1, models: 1, appearance: 0, themes: 0, sounds: 0, hints: 0, about: 0 });
  const groups = L.groupByCategory(L.searchRows(ROWS, 'key'));
  assert.deepEqual(groups.map((g) => [g.category, g.rows.map((r) => r.id)]), [['ai', ['ai.key']], ['models', ['models.key']]]);
  assert.deepEqual(L.groupByCategory([]), []);
});

test('highlight: cuts the original text, diacritics-insensitive, every token, every occurrence', () => {
  assert.deepEqual(L.highlight('Venice API key', 'api'), [{ text: 'Venice ', hit: false }, { text: 'API', hit: true }, { text: ' key', hit: false }]);
  assert.deepEqual(L.highlight('Modèle préférée', 'modele pref'), [{ text: 'Modèle', hit: true }, { text: ' ', hit: false }, { text: 'préf', hit: true }, { text: 'érée', hit: false }]);
  assert.deepEqual(L.highlight('a key, a key', 'key'), [{ text: 'a ', hit: false }, { text: 'key', hit: true }, { text: ', a ', hit: false }, { text: 'key', hit: true }]);
  assert.deepEqual(L.highlight('Volume', ''), [{ text: 'Volume', hit: false }]);
  assert.deepEqual(L.highlight('Volume', 'zzz'), [{ text: 'Volume', hit: false }]);
  assert.deepEqual(L.highlight('', 'x'), [{ text: '', hit: false }]);
});

test('categoryOfHash / hashOfCategory', () => {
  assert.equal(L.categoryOfHash('#/settings/ai'), 'ai');
  assert.equal(L.categoryOfHash('#/settings/sounds?x=1'), 'sounds');
  assert.equal(L.categoryOfHash('#/settings'), null);
  assert.equal(L.categoryOfHash('#/settings/'), null);
  assert.equal(L.categoryOfHash('#/settings/nope'), null);
  assert.equal(L.categoryOfHash('#/library/ai'), null);
  assert.equal(L.categoryOfHash(''), null);
  assert.equal(L.hashOfCategory('models'), '#/settings/models');
  assert.equal(L.hashOfCategory(null), '#/settings');
  for (const c of L.CATEGORY_IDS) assert.equal(L.categoryOfHash(L.hashOfCategory(c)), c);
});

test('providerOfHash / hashOfProvider: only under #/settings/ai', () => {
  assert.equal(L.providerOfHash('#/settings/ai/openrouter'), 'openrouter');
  assert.equal(L.providerOfHash('#/settings/ai/local?x=1'), 'local');
  assert.equal(L.categoryOfHash('#/settings/ai/openrouter'), 'ai');
  assert.equal(L.providerOfHash('#/settings/ai'), null);
  assert.equal(L.providerOfHash('#/settings/ai/'), null);
  assert.equal(L.providerOfHash('#/settings/models/x'), null);
  assert.equal(L.providerOfHash('#/library/ai/x'), null);
  assert.equal(L.hashOfProvider('xai'), '#/settings/ai/xai');
  assert.equal(L.providerOfHash(L.hashOfProvider('gemini')), 'gemini');
});

test('phone summaries', () => {
  assert.equal(L.serversSummary(0, 0), 'No servers yet');
  assert.equal(L.serversSummary(1, 1), '1 server · 1 online');
  assert.equal(L.serversSummary(3, 1), '3 servers · 1 online');
  const label = (n) => n.toUpperCase();
  assert.equal(L.aiSummary('Using Venice · venice-uncensored', 'sdxl'), 'Using Venice · venice-uncensored · Generic SDXL');
  assert.equal(L.aiSummary('Local · not set up', 'illustrious'), 'Local · not set up · Illustrious tags');
  assert.equal(L.modelsSummary(true, 'First'), 'CivitAI key set · previews: First');
  assert.equal(L.modelsSummary(false, 'Random'), 'No CivitAI key · previews: Random');
  assert.equal(L.appearanceSummary(200), 'Library tiles 200px');
  assert.equal(L.soundsSummary(0), 'Off');
  assert.equal(L.soundsSummary(0.5), 'Volume 50%');
});

test('themesSummary: palette, OLED, scale when not 100%', () => {
  assert.equal(L.themesSummary('Ember', false, 1), 'Ember');
  assert.equal(L.themesSummary('Ocean', true, 1.1), 'Ocean · OLED · 110%');
});
