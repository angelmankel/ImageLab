#!/usr/bin/env node
/**
 * Converts Donny's UI sound pack (CelerisLab "Complete UI Sound Effects Library", 48 kHz / 24-bit
 * stereo WAV in category folders) into the small files the next UI plays (FIXLIST-2, "New UI
 * sounds"), and writes the manifest the Settings → Sounds picker reads.
 *
 *   node next/scripts/convert-sounds.cjs <packDir> [--out <dir>] [--manifest <file>] [--jobs N] [--no-mp3] [--manifest-only]
 *
 * Defaults: --out next/public/sounds/ui, --manifest next/src/app/sounds/soundPack.json.
 * The pack dir is only read, never written.
 *
 * Per WAV (every non-.wav file is ignored):
 *  1. stereo → mono (½ L + ½ R), leading silence cut (below -60 dBFS, so a click starts at once),
 *     trailing silence cut (below -60 dBFS, keeping 20 ms of tail);
 *  2. loudness matched: the loudest 50 ms RMS window (`astats` "RMS peak") is brought to
 *     TARGET_RMS_DB, but never so far that the sample peak passes PEAK_CEIL_DB. EBU R128 / loudnorm
 *     needs 3 s+ of audio and most of these are 0.1–1 s, so a short-window RMS is the fairer match;
 *  3. encoded twice: Opus in Ogg (libopus, 32 kbps VBR, 48 kHz, the file every browser but old
 *     Safari plays) and MP3 (libmp3lame, 64 kbps, 48 kHz, the fallback for Safari / iOS that cannot
 *     decode Ogg Opus; the app picks one with canPlayType and falls back on a decode error).
 *
 * Names: folders shortened to one stable word ("basic", "positive", "buttons_glass_crystal" …),
 * files lower-case with `-` → `_` (the pack has both "soft-bubbly" and "soft_bubbly"). A sound's
 * id is `<folder>/<name>` and its file is `<out>/<folder>/<name>.ogg` (+ `.mp3`).
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const os = require('node:os');

const TARGET_RMS_DB = -16;
const PEAK_CEIL_DB = -1.5;
const SILENCE_DB = -60;
const RATE = 48000;

/** Pack folder (relative, posix) → our folder id + label. Unknown folders get a slug. */
const FOLDERS = {
  basic_interactions_and_navigation: ['basic', 'Clicks & navigation'],
  positive_feedback_and_success: ['positive', 'Success'],
  negative_feedback_and_warnings: ['negative', 'Errors & warnings'],
  inventory_and_item_management: ['inventory', 'Items & drag'],
  crafting_and_upgrading: ['crafting', 'Crafting & upgrades'],
  shop_and_economy: ['shop', 'Shop'],
  social_and_communication: ['social', 'Notifications'],
  miscellaneous_and_unique_ui: ['misc', 'Misc'],
};

const slug = (s) => s.toLowerCase().replace(/-/g, '_').replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
const cap = (s) => { const t = s.replace(/\bsci fi\b/gi, (m) => (m[0] === 'S' ? 'Sci-fi' : 'sci-fi')); return t.charAt(0).toUpperCase() + t.slice(1); };

function folderOf(relDir) {
  const parts = relDir.split('/').filter(Boolean);
  if (!parts.length) return ['misc', 'Misc'];
  // basic_interactions_and_navigation/buttons/glass_crystal_button → buttons_glass_crystal
  if (parts.length >= 3 && parts[1] === 'buttons') {
    const kind = slug(parts[2]).replace(/_button$/, '');
    return [`buttons_${kind}`, `${cap(kind.replace(/_/g, ' '))} buttons`];
  }
  if (FOLDERS[parts[0]] && parts.length === 1) return FOLDERS[parts[0]];
  const id = parts.map(slug).join('_');
  return [id, cap(parts[parts.length - 1].replace(/[_-]+/g, ' '))];
}

/** "button_click_rejection_07" → "Button click rejection 7"; "currency_gained" → "Currency gained". */
function labelOf(name) {
  return cap(name.replace(/_/g, ' ').replace(/\b0+(\d)/g, '$1'));
}

function walk(dir, rel = '') {
  const out = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(dir, r));
    else if (e.isFile() && /\.wav$/i.test(e.name)) out.push(r);
  }
  return out;
}

function run(args) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-nostdin', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve(err) : reject(new Error(`ffmpeg ${args.join(' ')}\n${err.slice(-2000)}`))));
  });
}

const TRIM = [
  'pan=mono|c0=0.5*c0+0.5*c1',
  `silenceremove=start_periods=1:start_threshold=${SILENCE_DB}dB:start_silence=0:detection=peak`,
  'areverse',
  `silenceremove=start_periods=1:start_threshold=${SILENCE_DB}dB:start_silence=0.02:detection=peak`,
  'areverse',
].join(',');

async function measure(file) {
  const log = await run(['-i', file, '-af', `${TRIM},astats=measure_perchannel=none:length=0.05`, '-f', 'null', '-']);
  // astats prints an "Overall" block last; take the last match of each.
  const last = (re) => { const all = [...log.matchAll(new RegExp(re, 'g'))]; return all.length ? Number(all[all.length - 1][1]) : NaN; };
  const peak = last('Peak level dB: (-?[\\d.]+|-inf)');
  const rms = last('RMS peak dB: (-?[\\d.]+|-inf)');
  const samples = last('Number of samples: (\\d+)');
  return { peak, rms, duration: Number.isFinite(samples) ? samples / RATE : NaN };
}

async function convertOne(src, base, mp3) {
  const m = await measure(src);
  let gain = 0;
  if (Number.isFinite(m.rms) && Number.isFinite(m.peak)) gain = Math.min(TARGET_RMS_DB - m.rms, PEAK_CEIL_DB - m.peak);
  gain = Math.max(-30, Math.min(30, gain));
  const af = `${TRIM},volume=${gain.toFixed(2)}dB`;
  fs.mkdirSync(path.dirname(base), { recursive: true });
  await run(['-y', '-i', src, '-af', af, '-ar', String(RATE), '-ac', '1', '-map_metadata', '-1',
    '-c:a', 'libopus', '-b:a', '32k', '-vbr', 'on', '-application', 'audio', `${base}.ogg`]);
  if (mp3) {
    await run(['-y', '-i', src, '-af', af, '-ar', String(RATE), '-ac', '1', '-map_metadata', '-1', '-write_xing', '1',
      '-c:a', 'libmp3lame', '-b:a', '64k', `${base}.mp3`]);
  }
  return { duration: m.duration, gain };
}

async function pool(items, n, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; await fn(items[k], k); }
  });
  await Promise.all(workers);
}

async function main() {
  const argv = process.argv.slice(2);
  const opt = (name, dflt) => { const k = argv.indexOf(name); return k >= 0 ? argv[k + 1] : dflt; };
  const flag = (name) => argv.includes(name);
  const input = argv.find((a, k) => !a.startsWith('--') && !(k > 0 && argv[k - 1].startsWith('--') && !['--no-mp3', '--manifest-only'].includes(argv[k - 1])));
  if (!input || !fs.existsSync(input)) {
    console.error('usage: node next/scripts/convert-sounds.cjs <packDir> [--out dir] [--manifest file] [--jobs N] [--no-mp3] [--manifest-only]');
    process.exit(2);
  }
  const nextDir = path.resolve(__dirname, '..');
  const out = path.resolve(opt('--out', path.join(nextDir, 'public/sounds/ui')));
  const manifestFile = path.resolve(opt('--manifest', path.join(nextDir, 'src/app/sounds/soundPack.json')));
  const jobs = Number(opt('--jobs', Math.max(2, Math.min(16, os.cpus().length))));
  const mp3 = !flag('--no-mp3');
  const manifestOnly = flag('--manifest-only');

  const files = walk(path.resolve(input)).sort();
  const seen = new Set();
  const items = files.map((rel) => {
    const dir = path.posix.dirname(rel) === '.' ? '' : path.posix.dirname(rel);
    const [folder, folderLabel] = folderOf(dir);
    const name = slug(path.posix.basename(rel).replace(/\.wav$/i, ''));
    const id = `${folder}/${name}`;
    if (seen.has(id)) throw new Error(`duplicate sound id ${id} (${rel})`);
    seen.add(id);
    return { rel, id, folder, folderLabel, name };
  });

  const results = new Array(items.length);
  let done = 0;
  await pool(items, jobs, async (it, k) => {
    const src = path.join(path.resolve(input), it.rel);
    const base = path.join(out, it.folder, it.name);
    results[k] = manifestOnly ? { duration: (await measure(src)).duration } : await convertOne(src, base, mp3);
    done++;
    if (done % 50 === 0 || done === items.length) process.stderr.write(`  ${done}/${items.length}\n`);
  });

  const folders = [];
  for (const it of items) if (!folders.some((f) => f.id === it.folder)) folders.push({ id: it.folder, label: it.folderLabel });
  const manifest = {
    pack: 'Complete UI Sound Effects Library (CelerisLab)',
    formats: mp3 ? ['ogg', 'mp3'] : ['ogg'],
    folders,
    sounds: items.map((it, k) => ({
      id: it.id,
      folder: it.folder,
      label: labelOf(it.name),
      duration: Math.round((results[k].duration || 0) * 1000) / 1000,
      path: `ui/${it.folder}/${it.name}.ogg`,
    })),
  };
  fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
  // One sound per line: small, and a re-run diffs line by line.
  const { sounds, ...head } = manifest;
  const body = JSON.stringify(head, null, 1).replace(/\n}$/, `,\n "sounds": [\n${sounds.map((x) => `  ${JSON.stringify(x)}`).join(',\n')}\n ]\n}`);
  fs.writeFileSync(manifestFile, `${body}\n`);

  if (!manifestOnly) {
    let bytes = 0, count = 0;
    const sum = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) sum(p); else { bytes += fs.statSync(p).size; count++; } } };
    sum(out);
    console.log(`${items.length} sounds → ${out} (${count} files, ${(bytes / 1e6).toFixed(2)} MB); manifest → ${manifestFile}`);
  } else {
    console.log(`${items.length} sounds; manifest → ${manifestFile}`);
  }
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
