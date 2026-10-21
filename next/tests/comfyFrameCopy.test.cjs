// FIXLIST-2 #50: opening a workflow in the embedded ComfyUI copies its state without structuredClone.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');
const { plainCopy } = load('src/screens/comfy/frameCopy.ts');

const graph = {
  last_node_id: 3, nodes: [{ id: 1, type: 'KSampler', widgets_values: [1, 'randomize', 20] }],
  links: [[1, 1, 0, 2, 0, 'LATENT']], groups: [{ title: 'G', bounding: [0, 0, 10, 10] }],
  definitions: { subgraphs: [{ id: 'sg', nodes: [{ id: 5 }], links: [] }] }, extra: { ds: { scale: 1 } },
};

test('a Proxy (Vue reactive) is copied, where structuredClone throws', () => {
  const p = new Proxy(graph, {});
  assert.throws(() => structuredClone(p));
  const c = plainCopy(p);
  assert.deepEqual(c, graph);
  assert.notEqual(c, graph);
});

test('Vue raw target is unwrapped; subgraphs and groups survive', () => {
  const p = new Proxy({}, { get: (_t, k) => (k === '__v_raw' ? graph : undefined) });
  const c = plainCopy(p);
  assert.deepEqual(c.definitions.subgraphs[0].nodes, [{ id: 5 }]);
  assert.equal(c.groups[0].title, 'G');
});

test('uses the given JSON (the frame realm) and handles empty / cyclic', () => {
  let used = false;
  plainCopy(graph, { parse: (s) => { used = true; return JSON.parse(s); } });
  assert.ok(used);
  assert.equal(plainCopy(null), null);
  const cyc = { a: 1 }; cyc.self = cyc;
  assert.equal(plainCopy(cyc), cyc);
});
