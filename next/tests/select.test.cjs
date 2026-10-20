// The searchable select's pure part (src/ui/selectLogic.ts): ranking, highlight pieces, groups, sampler families.
const test = require('node:test');
const assert = require('node:assert');
const S = require('../src/ui/selectLogic.ts');

const SAMPLERS = ['euler', 'euler_cfg_pp', 'euler_ancestral', 'euler_ancestral_cfg_pp', 'heun', 'heunpp2', 'dpmpp_2m', 'dpmpp_2m_sde', 'lcm', 'ddim', 'uni_pc'];
const opts = SAMPLERS.map((value) => ({ value }));

test('matchRank: exact < prefix < word start < contains < letters in order', () => {
  assert.equal(S.matchRank('euler', 'euler'), 0);
  assert.equal(S.matchRank('euler_ancestral', 'euler'), 1);
  assert.equal(S.matchRank('euler_ancestral', 'anc'), 2);
  assert.equal(S.matchRank('heunpp2', 'pp'), 3);
  assert.equal(S.matchRank('euler_ancestral', 'euanc'), 4);
  assert.equal(S.matchRank('ddim', 'xyz'), -1);
  assert.equal(S.matchRank('Euler', 'EU'), 1);
});

test('filterOptions: best first, stable, empty query keeps all', () => {
  assert.deepEqual(S.filterOptions(opts, '').map((o) => o.value), SAMPLERS);
  assert.deepEqual(S.filterOptions(opts, 'anc').map((o) => o.value), ['euler_ancestral', 'euler_ancestral_cfg_pp']);
  const sde = S.filterOptions(opts, 'sde').map((o) => o.value);
  assert.deepEqual(sde, ['dpmpp_2m_sde']);
  assert.equal(S.filterOptions(opts, 'pp')[0].value, 'euler_cfg_pp'); // word start "_pp" beats mid-word "dpmpp"
});

test('splitMatch: contiguous hit, word start preferred, in-order letters', () => {
  assert.deepEqual(S.splitMatch('euler_ancestral', 'anc'), [{ text: 'euler_', hit: false }, { text: 'anc', hit: true }, { text: 'estral', hit: false }]);
  assert.deepEqual(S.splitMatch('Euler', 'eu'), [{ text: 'Eu', hit: true }, { text: 'ler', hit: false }]);
  assert.deepEqual(S.splitMatch('ddim', ''), [{ text: 'ddim', hit: false }]);
  const p = S.splitMatch('dpmpp_2m', 'd2');
  assert.equal(p.filter((x) => x.hit).map((x) => x.text).join(''), 'd2');
  assert.deepEqual(S.splitMatch('ddim', 'zz'), [{ text: 'ddim', hit: false }]);
});

test('groupOptions + samplerFamily', () => {
  const g = S.groupOptions(opts.map((o) => ({ ...o, group: S.samplerFamily(o.value) })));
  assert.deepEqual(g.map((x) => x.group), ['Euler', 'Heun', 'DPM', 'Few-step', 'Classic', 'Multistep']);
  assert.equal(S.groupOptions([{ value: 'a', group: 'X' }, { value: 'b' }])[0].group, '');
});
