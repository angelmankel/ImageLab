const { test } = require('node:test');
const assert = require('node:assert/strict');
const G = require('./_load.cjs')('src/screens/image/kinds/kindGraphs.ts');

test('serverRef: a /view URL of the same server is used in place', () => {
  const base = 'https://pod/comfy';
  assert.equal(G.serverRef(`${base}/view?filename=a.png&subfolder=imagelab&type=output`, base), 'imagelab/a.png [output]');
  assert.equal(G.serverRef(`${base}/view?filename=a.png&subfolder=&type=temp`, base), 'a.png [temp]');
  assert.equal(G.serverRef(`${base}/view?filename=a.png&subfolder=imagelab&type=input`, base), 'imagelab/a.png');
  assert.equal(G.serverRef('https://other/view?filename=a.png', base), null);
  assert.equal(G.serverRef('data:image/png;base64,xx', base), null);
});

test('skipBaseSampler rewires the rounds onto the input', () => {
  const g = {
    i0: { class_type: 'LoadImage', inputs: { image: 'x' } },
    i1: { class_type: 'VAEEncode', inputs: { pixels: ['i0', 0], vae: ['4', 2] } },
    3: { class_type: 'KSampler', inputs: { latent_image: ['i1', 0] } },
    8: { class_type: 'VAEDecode', inputs: { samples: ['3', 0] } },
    p0latent: { class_type: 'LatentUpscaleBy', inputs: { samples: ['3', 0] } },
    9: { class_type: 'PreviewImage', inputs: { images: ['p0decode', 0] } },
  };
  const out = G.skipBaseSampler(g);
  assert.equal(out['3'], undefined);
  assert.equal(out['8'], undefined);
  assert.deepEqual(out.p0latent.inputs.samples, ['i1', 0]);
  assert.equal(G.outputIsInput(out), false);
  assert.equal(G.skipBaseSampler({ 3: g['3'] }), null);
  const bare = G.skipBaseSampler({ ...g, 9: { class_type: 'PreviewImage', inputs: { images: ['8', 0] } } });
  assert.equal(G.outputIsInput(bare), true);
});

test('upscaleGraph: model to an exact size, or a plain resize without a model', () => {
  const m = G.upscaleGraph({ ref: 'r', model: '4x.pth', factor: 2, width: 1000, height: 600 });
  assert.equal(m.u1.inputs.model_name, '4x.pth');
  assert.deepEqual([m.u3.inputs.width, m.u3.inputs.height], [2000, 1200]);
  assert.deepEqual(m['9'].inputs.images, ['u3', 0]);
  const plain = G.upscaleGraph({ ref: 'r', model: null, factor: 1.5, width: 1000, height: 600 });
  assert.equal(plain.u1, undefined);
  assert.equal(plain.u3.inputs.upscale_method, 'lanczos');
  const native = G.upscaleGraph({ ref: 'r', model: '4x.pth', factor: 2, nativeScale: 4 });
  assert.equal(native.u3.inputs.scale_by, 0.5);
  const exact = G.upscaleGraph({ ref: 'r', model: '2x.pth', factor: 2, nativeScale: 2 });
  assert.deepEqual(exact['9'].inputs.images, ['u2', 0]);
});
