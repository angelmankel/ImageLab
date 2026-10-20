// "Write it" parameters (item 11, src/lib/aiParams.ts): the data-driven list per provider, ranges,
// and how set values land in the request body.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');
const A = load('../src/lib/aiParams.ts');

test('every provider lists known parameters, temperature first', () => {
  for (const [id, list] of Object.entries(A.PROVIDER_PARAMS)) {
    assert.ok(list.length > 0, id);
    assert.equal(list[0], 'temperature', id);
    for (const p of list) assert.ok(A.AI_PARAMS[p], `${id}: ${p}`);
  }
});

test('providerParams applies a provider\'s own range', () => {
  assert.equal(A.providerParams('anthropic').find((p) => p.id === 'temperature').max, 1);
  assert.equal(A.providerParams('openai').find((p) => p.id === 'temperature').max, 2);
  assert.equal(A.providerParams('anthropic').some((p) => p.id === 'seed'), false);
});

test('paramBody: only set values the provider takes, clamped, provider key names', () => {
  const b = A.paramBody('mistral', { temperature: 1.9, top_p: 0.9, seed: 42, top_k: 40, max_tokens: 500 });
  assert.equal(b.temperature, 1.5);
  assert.equal(b.maxTokens, 500);
  assert.deepEqual(b.extra, { top_p: 0.9, random_seed: 42 });
  assert.deepEqual(A.paramBody('local', {}), { extra: {} });
  assert.equal(A.clampParam(A.AI_PARAMS.top_p, 0.30000000000000004), 0.3);
});
