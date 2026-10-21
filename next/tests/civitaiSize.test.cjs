// Perf pass: which CivitAI rendition each slot asks for (src/lib/civitaiSize.ts).
const test = require('node:test');
const assert = require('node:assert');
const load = require('./_load.cjs');

const calls = [];
const S = load('src/lib/civitaiSize.ts', {
  '@/lib/civitai': {
    isCivitaiVideo: (i) => /\.mp4$/.test(i.url ?? ''),
    previewStill: (i) => i.url,
    civitaiThumbUrl: (url, w, opts = {}) => { calls.push({ url, w, opts }); return `${url}@${w}${opts.optimized ? 'o' : ''}`; },
    civitaiVideoUrl: (url, w) => `${url}#${w}`,
  },
});

test('renditionFor: the CDN rounds a width up to its renditions', () => {
  assert.equal(S.renditionFor(64), 320);
  assert.equal(S.renditionFor(198), 320);
  assert.equal(S.renditionFor(440), 450);
  assert.equal(S.renditionFor(560), 800);
  assert.equal(S.renditionFor(1024), 1200);
  assert.equal(S.renditionFor(1600), 1600);
  assert.equal(S.renditionFor(2048), 2200);
  assert.equal(S.renditionFor(9000), 2200);
});

test('fullWidth: the smallest rendition that holds the original, never past the cap', () => {
  assert.equal(S.fullWidth(1024), 1200);         // was width=2048 → a 2200 px upscale
  assert.equal(S.fullWidth(832), 1200);
  assert.equal(S.fullWidth(768), 800);
  assert.equal(S.fullWidth(1376), 1600);
  assert.equal(S.fullWidth(3456), 2200);
  assert.equal(S.fullWidth(3456, 1600), 1600);   // the model viewer's picture cap
  assert.equal(S.fullWidth(1024, 1600), 1200);   // same URL as the full-screen viewer
  assert.equal(S.fullWidth(0), 2200);            // unknown: the cap
  assert.equal(S.fullWidth(undefined, 1600), 1600);
});

test('civitaiFullUrl / civitaiSmallUrl', () => {
  assert.equal(S.civitaiFullUrl({ url: 'u', width: 1024 }), 'u@1200');
  assert.equal(S.civitaiFullUrl({ url: 'u', width: 1024 }, 1600), 'u@1200');
  assert.equal(S.civitaiSmallUrl({ url: 'u' }, 560), 'u@560o');      // WebP
  assert.equal(S.civitaiSmallUrl('u', 32), 'u@32o');
  assert.equal(S.civitaiSmallUrl({ url: 'v.mp4' }, 198), 'v.mp4@198'); // a clip's still stays as it was
  assert.equal(S.civitaiFullVideoUrl({ url: 'v.mp4', width: 700 }), 'v.mp4#800');
});
