#!/usr/bin/env node
/**
 * Writes the logo files in next/public from `src/app/monolith.ts` (logo D "Monolith"): favicon.svg,
 * icons/monolith.svg and the PNG sizes the manifest + iOS need (via `rsvg-convert`, librsvg).
 *   node scripts/make-icons.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src/app/monolith.ts'), 'utf8');
const code = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const M = {};
new Function('exports', 'require', code)(M, require);

const pub = path.join(root, 'public');
const icons = path.join(pub, 'icons');
fs.mkdirSync(icons, { recursive: true });
fs.writeFileSync(path.join(pub, 'favicon.svg'), M.tileSvg(32));
fs.writeFileSync(path.join(icons, 'monolith.svg'), M.tileSvg(512));

const png = (name, svg, px) => {
  const tmp = path.join(icons, `.${name}.svg`);
  fs.writeFileSync(tmp, svg);
  execFileSync('rsvg-convert', ['-w', String(px), '-h', String(px), tmp, '-o', path.join(icons, name)]);
  fs.unlinkSync(tmp);
};
png('monolith-192.png', M.tileSvg(192), 192);
png('monolith-512.png', M.tileSvg(512), 512);
png('monolith-maskable-512.png', M.tileSvg(512, { maskable: true }), 512);
// iOS draws its own rounded corners: a full-bleed square, the mark at the tile's 63%.
png('monolith-apple-180.png', M.tileSvg(180, { square: true }), 180);
console.log('icons written');
