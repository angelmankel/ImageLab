// readParams: a Primitive node's control_after_generate makes it a seed only when its title says Seed (fix list 2, preset workflows).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');
const G = load('../src/lib/workflowGraph.ts');
const S = load('../src/features/studio/params.ts', { '@/lib/workflowGraph': G });

const info = {
  PrimitiveInt: { input: { required: { value: ['INT', { min: 0, max: 99999, control_after_generate: 'fixed' }] } }, input_order: { required: ['value'] }, output: ['INT'], output_name: ['INT'] },
};
const node = (id, title) => ({ id, type: 'PrimitiveInt', title, pos: [0, 0], size: [1, 1], flags: {}, order: id, mode: 0, inputs: [{ name: 'value', type: 'INT', widget: { name: 'value' }, link: null }], outputs: [{ name: 'INT', type: 'INT', links: [] }], properties: {}, widgets_values: [id === 1 ? 1024 : 7, 'fixed'] });

test('Primitive "Tile size" is a number, Primitive "Seed" is a seed', () => {
  const wf = { nodes: [node(1, 'Tile size'), node(2, 'Seed')], links: [], groups: [], config: {}, extra: {}, version: 0.4, last_node_id: 2, last_link_id: 0 };
  const params = S.readParams(wf, info);
  assert.equal(params[0].seedLike, false);
  assert.equal(params[0].value, 1024);
  assert.equal(params[1].seedLike, true);
});
