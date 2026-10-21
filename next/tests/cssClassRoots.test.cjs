// A class defined in two stylesheets is two components fighting over one name (the phone map's
// frame was `.il-nav`, already NavArrows' round button: the frame came out 0 px wide). Every
// `.il-*` class that starts a rule may be defined in ONE .css file under next/src.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

function cssFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? cssFiles(p) : e.name.endsWith('.css') ? [p] : [];
  });
}

/** Deliberate: the theme sheet restyles shared controls; next.css tunes the smart prompt's pick. */
const SHARED = new Set(['il-btn-primary', 'il-slider', 'il-switch', 'il-sp-pick']);

test('no .il-* class is defined in two stylesheets', () => {
  const src = path.join(__dirname, '..', 'src');
  const owner = new Map();
  const clashes = [];
  for (const file of cssFiles(src)) {
    const text = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const names = new Set();
    // Selectors: the text before each `{`, split on commas; the class a compound selector starts with.
    for (const m of text.matchAll(/([^{}]+)\{/g)) {
      for (const sel of m[1].split(',')) {
        const first = sel.trim().split(/\s+/).find((part) => /^\.il-[\w-]+/.test(part) || /^[a-z*]+\.il-[\w-]+/.test(part));
        const cls = first && first.match(/\.(il-[\w-]+)/);
        if (cls && sel.trim().startsWith(first)) names.add(cls[1]);
      }
    }
    const rel = path.relative(src, file);
    for (const n of names) {
      if (SHARED.has(n)) continue;
      if (owner.has(n) && owner.get(n) !== rel) clashes.push(`${n}: ${owner.get(n)} + ${rel}`);
      else owner.set(n, rel);
    }
  }
  assert.deepStrictEqual(clashes, []);
});
