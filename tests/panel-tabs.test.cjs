const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
function load(name) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/lib', name + '.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports });
  return exports;
}
const {
  SECTION_IDS, defaultTabs, normalizeTabs, tabOfSection, moveTab, moveTabBy, renameTab, setTabHidden,
  moveSection, moveSectionBy, addTab, removeTab, barTabs, resolveActive, activeFromOldSections, MAX_LABEL,
} = load('panelTabs');
const plain = value => JSON.parse(JSON.stringify(value));
const ids = tabs => plain(tabs.map(t => t.id));
const allSections = tabs => plain(tabs.flatMap(t => t.sections).sort());

test('the default layout holds every section exactly once', () => {
  const tabs = defaultTabs();
  assert.deepEqual(ids(tabs), ['prompt', 'models', 'settings', 'enhance', 'input', 'passes']);
  assert.deepEqual(allSections(tabs), [...SECTION_IDS].sort());
  assert.deepEqual(plain(tabOfSection(tabs, 'composition')).id, 'settings');
  // A fresh copy each time: editing one must not leak into the defaults.
  tabs[0].sections.push('models');
  assert.deepEqual(plain(defaultTabs()[0].sections), ['prompts']);
});

test('normalize repairs stored layouts', () => {
  assert.deepEqual(plain(normalizeTabs(null)), plain(defaultTabs()));
  assert.deepEqual(plain(normalizeTabs('junk')), plain(defaultTabs()));
  const tabs = normalizeTabs([
    { id: 'passes', label: '  My   passes  ', icon: 'bolt', sections: ['passes', 'prompts', 'bogus'] },
    { id: 'prompt', label: '', sections: ['prompts'] },          // prompts already claimed above
    { id: 'passes', label: 'dupe', sections: [] },                // duplicate tab id
    { id: 'stranger', label: 'x', sections: ['models'] },         // unknown, not custom: dropped
    { id: 'custom-1', label: 'Fav', icon: 'star', custom: true, sections: ['parameters'] },
    { id: 'models', label: 'M'.repeat(80), sections: 'nope', hidden: true },
  ]);
  assert.deepEqual(ids(tabs), ['passes', 'prompt', 'custom-1', 'models', 'settings', 'enhance', 'input']);
  assert.equal(tabs[0].label, 'My passes');
  assert.deepEqual(plain(tabs[0].sections), ['passes', 'prompts']);
  assert.equal(tabs[1].label, 'Prompt');
  assert.deepEqual(plain(tabs[1].sections), []);
  assert.equal(tabs[2].custom, true);
  assert.equal(tabs[3].label.length, MAX_LABEL);
  assert.equal(tabs[3].hidden, true);
  // Every section still lives somewhere exactly once; lost ones went back to their built-in tab.
  assert.deepEqual(allSections(tabs), [...SECTION_IDS].sort());
  assert.deepEqual(plain(tabOfSection(tabs, 'models')).id, 'models');
  assert.deepEqual(plain(tabOfSection(tabs, 'composition')).id, 'settings');
});

test('normalize never leaves every tab hidden', () => {
  const tabs = normalizeTabs(defaultTabs().map(t => ({ ...t, hidden: true })));
  assert.equal(tabs.filter(t => !t.hidden).length, 1);
  assert.equal(tabs.find(t => !t.hidden).id, 'prompt');
});

test('tabs reorder by drag and by step', () => {
  const tabs = defaultTabs();
  assert.deepEqual(ids(moveTab(tabs, 'passes', 'models')), ['prompt', 'passes', 'models', 'settings', 'enhance', 'input']);
  assert.deepEqual(ids(moveTab(tabs, 'prompt', 'settings')), ['models', 'settings', 'prompt', 'enhance', 'input', 'passes']);
  assert.deepEqual(ids(moveTabBy(tabs, 'models', -1)), ['models', 'prompt', 'settings', 'enhance', 'input', 'passes']);
  assert.deepEqual(ids(moveTabBy(tabs, 'prompt', -1)), ids(tabs));
  assert.deepEqual(ids(moveTab(tabs, 'nope', 'models')), ids(tabs));
  assert.deepEqual(ids(tabs), ['prompt', 'models', 'settings', 'enhance', 'input', 'passes']);
});

test('rename trims and falls back to the built-in name', () => {
  const tabs = defaultTabs();
  assert.equal(renameTab(tabs, 'models', '  Checkpoints ').find(t => t.id === 'models').label, 'Checkpoints');
  assert.equal(renameTab(tabs, 'models', '   ').find(t => t.id === 'models').label, 'Models');
});

test('hiding refuses to hide the last visible tab', () => {
  let tabs = defaultTabs();
  for (const id of ['prompt', 'models', 'settings', 'enhance', 'input']) tabs = setTabHidden(tabs, id, true);
  assert.deepEqual(ids(tabs.filter(t => !t.hidden)), ['passes']);
  tabs = setTabHidden(tabs, 'passes', true);
  assert.deepEqual(ids(tabs.filter(t => !t.hidden)), ['passes']);
  tabs = setTabHidden(tabs, 'models', false);
  assert.equal('hidden' in tabs.find(t => t.id === 'models'), false);
});

test('sections move between and within tabs', () => {
  let tabs = addTab(defaultTabs(), 'fav', 'Favorites');
  tabs = moveSection(tabs, 'parameters', 'fav');
  tabs = moveSection(tabs, 'prompts', 'fav', 0);
  assert.deepEqual(plain(tabs.find(t => t.id === 'fav').sections), ['prompts', 'parameters']);
  assert.deepEqual(plain(tabs.find(t => t.id === 'settings').sections), ['composition']);
  assert.deepEqual(plain(tabs.find(t => t.id === 'prompt').sections), []);
  tabs = moveSectionBy(tabs, 'parameters', -1);
  assert.deepEqual(plain(tabs.find(t => t.id === 'fav').sections), ['parameters', 'prompts']);
  assert.deepEqual(allSections(tabs), [...SECTION_IDS].sort());
  // Unknown target: nothing moves.
  assert.deepEqual(plain(moveSection(tabs, 'models', 'nope')), plain(tabs));
});

test('removing a custom tab sends its sections home and shows that tab again', () => {
  let tabs = addTab(defaultTabs(), 'fav', 'Favorites');
  tabs = moveSection(tabs, 'models', 'fav');
  tabs = setTabHidden(tabs, 'models', true);
  tabs = removeTab(tabs, 'fav');
  assert.ok(!tabs.some(t => t.id === 'fav'));
  const models = tabs.find(t => t.id === 'models');
  assert.deepEqual(plain(models.sections), ['models']);
  assert.equal('hidden' in models, false);
  // Built-in tabs cannot be removed.
  assert.deepEqual(ids(removeTab(tabs, 'models')), ids(tabs));
});

test('the bar skips hidden and empty tabs, and tabs with nothing available', () => {
  let tabs = setTabHidden(defaultTabs(), 'enhance', true);
  tabs = moveSection(tabs, 'prompts', 'models');
  const all = [...SECTION_IDS];
  assert.deepEqual(ids(barTabs(tabs, all, null)), ['models', 'settings', 'input', 'passes']);
  // A canvas layer has no Composition / Input; Settings still has Parameters.
  const layer = all.filter(s => s !== 'composition' && s !== 'input');
  assert.deepEqual(ids(barTabs(tabs, layer, null)), ['models', 'settings', 'passes']);
  // A hidden tab stays while it is the active one.
  assert.deepEqual(ids(barTabs(tabs, all, 'enhance')), ['models', 'settings', 'enhance', 'input', 'passes']);
});

test('the active tab falls back to the first on the bar', () => {
  const bar = barTabs(defaultTabs(), [...SECTION_IDS], null);
  assert.equal(resolveActive(bar, 'passes'), 'passes');
  assert.equal(resolveActive(bar, 'gone'), 'prompt');
  assert.equal(resolveActive(bar, null), 'prompt');
  assert.equal(resolveActive([], 'prompt'), null);
});

test('the first tab after the accordion is the topmost section that was open', () => {
  const tabs = defaultTabs();
  // Nothing stored: Prompts started open.
  assert.equal(activeFromOldSections(undefined, tabs), 'prompt');
  assert.equal(activeFromOldSections({ 'workspace-prompts': true }, tabs), 'settings');
  assert.equal(activeFromOldSections({ 'workspace-prompts': true, models: false }, tabs), 'models');
  // Everything folded: the first tab.
  const folded = { 'workspace-prompts': true, models: true, 'workspace-base': true, 'workspace-composition': true, inputimage: true, 'workspace-enhancement': true, 'workspace-passes': true };
  assert.equal(activeFromOldSections(folded, tabs), 'prompt');
  assert.equal(activeFromOldSections({ ...folded, 'workspace-passes': false }, tabs), 'passes');
  assert.equal(activeFromOldSections('garbage', tabs), 'prompt');
});
