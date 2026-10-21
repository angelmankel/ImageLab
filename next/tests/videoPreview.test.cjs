// Fix list 2 "Video previews": the setting's parse (src/app/videoPreview.ts).
const test = require('node:test');
const assert = require('node:assert');
const load = require('./_load.cjs');

const V = load('src/app/videoPreview.ts', { zustand: { create: () => () => ({}) } });

test('parseVideoPreview: hover by default, the three modes kept', () => {
  assert.equal(V.parseVideoPreview(undefined), 'hover');
  assert.equal(V.parseVideoPreview('nonsense'), 'hover');
  assert.equal(V.parseVideoPreview('autoplay'), 'autoplay');
  assert.equal(V.parseVideoPreview('off'), 'off');
  assert.deepEqual([...V.VIDEO_PREVIEW_MODES], ['hover', 'autoplay', 'off']);
});
