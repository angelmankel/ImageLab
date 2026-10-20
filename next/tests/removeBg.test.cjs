// Item 43: the Remove BG graph (src/app/removeBgGraph.ts, pure). Node classes and wiring match
// ComfyUI core's nodes_bg_removal as listed by winold's /object_info.
const test = require('node:test');
const assert = require('node:assert');
const R = require('../src/app/removeBgGraph.ts');

test('graph: LoadImage → model → RemoveBackground → InvertMask → JoinImageWithAlpha → SaveImage', () => {
  const g = R.removeBgGraph('imagelab/a.png');
  assert.equal(g['1'].class_type, 'LoadImage');
  assert.equal(g['1'].inputs.image, 'imagelab/a.png');
  assert.deepEqual(g['2'], { class_type: 'LoadBackgroundRemovalModel', inputs: { bg_removal_name: 'birefnet.safetensors' } });
  assert.deepEqual(g['3'].inputs, { bg_removal_model: ['2', 0], image: ['1', 0] });
  assert.deepEqual(g['4'], { class_type: 'InvertMask', inputs: { mask: ['3', 0] } });
  assert.deepEqual(g['5'].inputs, { image: ['1', 0], alpha: ['4', 0] });
  assert.equal(g[R.REMOVE_BG_OUT].class_type, 'SaveImage');
  assert.deepEqual(g[R.REMOVE_BG_OUT].inputs.images, ['5', 0]);
});

test('graph: model and prefix are passed through', () => {
  const g = R.removeBgGraph('x.png', 'rmbg.safetensors', 'p/q');
  assert.equal(g['2'].inputs.bg_removal_name, 'rmbg.safetensors');
  assert.equal(g[R.REMOVE_BG_OUT].inputs.filename_prefix, 'p/q');
});

test('model pick: default first, else the first listed, else null', () => {
  assert.equal(R.pickRemoveBgModel(['a.safetensors', 'birefnet.safetensors']), 'birefnet.safetensors');
  assert.equal(R.pickRemoveBgModel(['a.safetensors']), 'a.safetensors');
  assert.equal(R.pickRemoveBgModel([]), null);
});

test('noBgName: PNG, folder dropped', () => {
  assert.equal(R.noBgName('sub/photo.final.jpg'), 'photo.final_nobg.png');
  assert.equal(R.noBgName(''), 'image_nobg.png');
});
