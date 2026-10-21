// Late item (live previews on winold): the real preview method per server.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./_load.cjs');
const P = load('src/screens/comfy/previewLogic.ts');

test('reads --preview-method from argv', () => {
  assert.equal(P.previewArg(['main.py', '--listen', '--preview-method', 'taesd']), 'taesd');
  assert.equal(P.previewArg(['main.py', '--preview-method=Auto']), 'auto');
  assert.equal(P.previewArg(['main.py']), 'none');
  assert.equal(P.previewArg(undefined), 'none');
  assert.equal(P.previewArg(['--preview-method', 'weird']), 'none');
});

test('taesd without decoders is the latent2rgb fallback, with the fix hint', () => {
  const i = P.previewInfo('taesd', []);
  assert.equal(i.label, 'latent2rgb (fallback)');
  assert.equal(i.poor, true);
  assert.equal(i.hint, P.PREVIEW_FIX_HINT);
  assert.equal(P.previewInfo('auto', []).method, 'latent2rgb');
});

test('decoders present = TAESD; a missing one is named', () => {
  assert.deepEqual(P.previewInfo('taesd', ['taesd_decoder.pth', 'taesdxl_decoder.safetensors']), { method: 'taesd', label: 'TAESD', poor: false, hint: null });
  assert.equal(P.previewInfo('auto', ['taesd_decoder.pth']).label, 'TAESD (no SDXL)');
  assert.equal(P.previewInfo('none', []).label, 'Off');
  assert.equal(P.previewInfo('latent2rgb', ['taesd_decoder.pth']).poor, true);
});
