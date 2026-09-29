const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
// Only the two URL helpers: civitai.ts itself imports the app, so pull the functions out by name.
const source = fs.readFileSync(path.join(__dirname, '../src/lib/civitai.ts'), 'utf8');
const pick = (name) => source.slice(source.indexOf(`export function ${name}`)).match(/^[\s\S]*?\n}\n/)[0];
const code = ts.transpileModule(pick('isCivitaiVideo') + pick('civitaiThumbUrl'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const { isCivitaiVideo, civitaiThumbUrl } = new Function(code.replace(/export /g, '') + 'return { isCivitaiVideo, civitaiThumbUrl };')();
const B = 'https://image.civitai.com/xG1nk/cbce1b3e';

test('a video gets a still first-frame JPEG, not the .mp4', () => {
  assert.equal(civitaiThumbUrl(`${B}/original=true/94317504.mp4`, 450), `${B}/anim=false,transcode=true,width=450/94317504.jpeg`);
  assert.equal(civitaiThumbUrl(`${B}/original=true/1.jpeg`, 450, { video: true }), `${B}/anim=false,transcode=true,width=450/1.jpeg`);
  assert.ok(isCivitaiVideo({ url: 'x.jpeg', type: 'video' }));
  assert.ok(!isCivitaiVideo({ url: 'x.jpeg', type: 'image' }));
});

test('an original=true image is resized instead of pulled full-size', () => {
  assert.equal(civitaiThumbUrl(`${B}/original=true/1.jpeg`, 450), `${B}/width=450/1.jpeg`);
  assert.equal(civitaiThumbUrl(`${B}/width=1024/1.jpeg`, 450), `${B}/width=450/1.jpeg`);
  assert.equal(civitaiThumbUrl(`${B}/1.jpeg`, 450), `${B}/width=450/1.jpeg`);
  assert.equal(civitaiThumbUrl('https://other.host/a.png', 450), 'https://other.host/a.png');
});
