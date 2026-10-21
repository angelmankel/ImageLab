// Prompt studio (item 37) + Generate snippets (item 47): screens/image/writeIt/studioLogic.ts.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');
const S = load('src/screens/image/writeIt/studioLogic.ts');

const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };

test('surprise + examples are deterministic given rand and distinct', () => {
  assert.equal(S.surpriseIdea(() => 0), 'a wandering knight in a flooded cathedral, at golden hour');
  const ex = S.exampleIdeas(5, seq([0.1, 0.7, 0.3, 0.9, 0.5]));
  assert.equal(ex.length, 5);
  assert.equal(new Set(ex).size, 5);
  for (const e of ex) assert.ok(S.IDEAS.includes(e));
});

test('user message: idea, ingredients, style, length, option angle, others', () => {
  const m = S.studioUserMessage({
    mode: 'idea', idea: ' sphinx at dusk ', style: 'photo', length: 'short', index: 1, count: 3,
    ingredients: [{ name: 'Golden hour', text: 'warm low sun', category: 'Lighting' }, { name: 'x', text: '  ' }],
    others: ['first option'],
  });
  assert.match(m, /^Idea: sphinx at dusk/);
  assert.match(m, /- Golden hour \(Lighting\): warm low sun/);
  assert.doesNotMatch(m, /- x:/);
  assert.match(m, /Style: a photograph/);
  assert.match(m, /Length: 6 to 10 phrases/);
  assert.match(m, /option 2 of 3/);
  assert.match(m, /- first option/);
});

test('user message: rework uses the current prompt, any style adds nothing, single option no angle', () => {
  const m = S.studioUserMessage({ mode: 'rework', idea: '', current: 'a cat, red hat', style: 'any', count: 1 });
  assert.match(m, /Rework this existing prompt[^]*a cat, red hat/);
  assert.doesNotMatch(m, /Direction/);
  assert.doesNotMatch(m, /Style:/);
  assert.doesNotMatch(m, /option 1 of/);
  assert.match(m, /Length: 12 to 18/);
});

test('cleanPrompt: labels, quotes, bullets, lines, commas, period', () => {
  assert.equal(S.cleanPrompt('Prompt: "a cat, red hat."'), 'a cat, red hat');
  assert.equal(S.cleanPrompt("Here's your prompt:\n- a cat\n- red hat,\n\n- night"), 'a cat, red hat, night');
  assert.equal(S.cleanPrompt('```\na cat ,, red  hat\n```'), 'a cat, red hat');
  assert.equal(S.cleanPrompt('Option 2: neon city'), 'neon city');
  assert.equal(S.cleanPrompt('Subject: a cat, red hat\nLighting: dusk glow'), 'a cat, red hat, dusk glow');
  assert.equal(S.cleanPrompt('masterpiece, best quality, 1girl'), 'masterpiece, best quality, 1girl');
});

test('stock system differs per flavor', () => {
  assert.match(S.stockStudioSystem('illustrious'), /masterpiece, best quality/);
  assert.doesNotMatch(S.stockStudioSystem('sdxl'), /Danbooru/);
});

test('creativity label + recent list', () => {
  assert.equal(S.creativityLabel(0, 2), 'Safe');
  assert.equal(S.creativityLabel(2, 2), 'Wild');
  const a = { id: 'a', at: 1, idea: 'i', prompt: 'p1' };
  const b = { id: 'b', at: 2, idea: 'i', prompt: 'p2' };
  let l = S.pushRecent([], a);
  l = S.pushRecent(l, b);
  l = S.pushRecent(l, { ...a, id: 'c', at: 3 });
  assert.deepEqual(l.map((r) => r.id), ['c', 'b']);
  assert.equal(S.pushRecent(l, { id: 'd', at: 4, idea: '', prompt: 'p3' }, 2).length, 2);
});

test('snippet ideas: parse lines, fill missing names, skip dupes and existing', () => {
  const raw = '1. **Neon Glow**: neon rim light, magenta glow.\n- Moonlit: cold moonlight, blue shadows\n\nsoft window light, dust motes\nMoonlit: again\nOld One: x';
  const r = S.parseSnippetIdeas(raw, ['old one']);
  assert.deepEqual(r, [
    { name: 'Neon Glow', text: 'neon rim light, magenta glow' },
    { name: 'Moonlit', text: 'cold moonlight, blue shadows' },
    { name: 'soft window light', text: 'soft window light, dust motes' },
  ]);
  const u = S.snippetGenUser({ category: 'Lighting', count: 6, hint: 'night', existing: ['A', 'B'] });
  assert.match(u, /Write 6 new snippets/);
  assert.match(u, /Direction: night/);
  assert.match(u, /do not repeat\): A; B/);
});

test('snippets from a picture: parse category lines, style flag, match categories', () => {
  const raw = '1. Lighting > Golden Rim: warm rim light, low sun\nColor: Teal Orange: teal shadows, orange highlights\nMoody Fog: thick fog, muted tones\nStyle > Overall Look: painterly, soft brush, warm palette, cinematic';
  const r = S.parseImageSnippets(raw, 'Atmosphere');
  assert.deepEqual(r.map((x) => [x.category, x.name, !!x.style]), [
    ['Lighting', 'Golden Rim', false], ['Color', 'Teal Orange', false], ['Atmosphere', 'Moody Fog', false], ['Style', 'Overall Look', true],
  ]);
  const cats = [{ id: 'lighting', name: '💡 Lighting' }, { id: 'color', name: 'Color' }, { id: 'style', name: 'Style & medium' }];
  assert.equal(S.matchCategory('lighting', cats), 'lighting');
  assert.equal(S.matchCategory('Style', cats), 'style');
  assert.equal(S.matchCategory('Weather', cats), null);
  assert.match(S.imageSnippetSystem('sdxl', ['Lighting', 'Color'], true), /LAST line[^]*"Style"/);
  assert.match(S.imageSnippetUser({ count: 5, hint: 'only the lighting', category: 'Lighting' }), /Write 5[^]*"Lighting"[^]*Focus: only the lighting/);
});
