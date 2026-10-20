// Loads one TS module's pure exports for node --test (same recipe as library.test.cjs): transpiled to
// CommonJS, every import stubbed, so only modules whose top level touches nothing but their own code load.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
module.exports = function load(rel, stubs = {}) {
  const exports = {};
  const src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  const code = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('exports', 'require', code)(exports, (name) => stubs[name] ?? new Proxy({}, { get: () => () => undefined }));
  return exports;
};
