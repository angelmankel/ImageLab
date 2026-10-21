// UI sounds (FIXLIST-2 "New UI sounds", src/app/sounds/soundActions.ts + soundPack.json): the
// manifest's shape, every default resolving to a real sound, the volume maths, saved picks being
// repaired, the press → action rules and the picker's search.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const load = require('./_load.cjs');
const S = load('src/app/sounds/soundActions.ts');
const pack = require('../src/app/sounds/soundPack.json');

test('manifest: shape, unique ids, paths, folders', () => {
  assert.ok(Array.isArray(pack.sounds) && pack.sounds.length >= 500, 'the whole pack');
  assert.ok(pack.formats.includes('ogg'));
  const folderIds = new Set(pack.folders.map((f) => f.id));
  const ids = new Set();
  for (const s of pack.sounds) {
    assert.deepEqual(Object.keys(s).sort(), ['duration', 'folder', 'id', 'label', 'path']);
    assert.match(s.id, /^[a-z0-9_]+\/[a-z0-9_]+$/, s.id);
    assert.ok(!ids.has(s.id), `duplicate ${s.id}`);
    ids.add(s.id);
    assert.equal(s.id.split('/')[0], s.folder);
    assert.ok(folderIds.has(s.folder), `folder ${s.folder}`);
    assert.equal(s.path, S.soundPath(s.id, 'ogg'));
    assert.ok(s.duration > 0 && s.duration < 10, `${s.id} ${s.duration}`);
    assert.ok(s.label.length > 0);
  }
  for (const f of pack.folders) assert.ok(f.label && pack.sounds.some((s) => s.folder === f.id));
});

test('manifest: every file it names is on disk (both formats)', () => {
  const root = path.join(__dirname, '..', 'public', 'sounds');
  if (!fs.existsSync(root)) return; // the audio is optional in a checkout; the app degrades to silence
  for (const s of pack.sounds) for (const ext of pack.formats) {
    assert.ok(fs.existsSync(path.join(root, S.soundPath(s.id, ext))), `${s.id}.${ext}`);
  }
});

test('defaults: every action once, every default sound in the pack, volumes in range', () => {
  const ids = new Set(pack.sounds.map((s) => s.id));
  assert.equal(new Set(S.ACTION_IDS).size, S.SOUND_ACTIONS.length);
  for (const a of S.SOUND_ACTIONS) {
    if (a.sound !== null) assert.ok(ids.has(a.sound), `${a.id} → ${a.sound}`);
    assert.ok(a.volume > 0 && a.volume <= 1, a.id);
    assert.ok(a.label && a.hint, a.id);
  }
  assert.equal(S.actionDef('hover').sound, null, 'hover is off by default');
  const d = S.defaultPicks();
  for (const a of S.SOUND_ACTIONS) assert.deepEqual(d[a.id], { sound: a.sound, volume: a.volume });
  assert.ok(S.isDefaultPick('click', d.click));
  assert.ok(!S.isDefaultPick('click', { ...d.click, volume: 0.1 }));
});

test('mergePicks: repairs old / partial / bad saves', () => {
  const known = new Set(pack.sounds.map((s) => s.id));
  const m = S.mergePicks({ click: { sound: 'basic/button_click_03', volume: 2 }, hover: { sound: 'gone/nope', volume: -1 }, error: { sound: null }, bogus: { sound: 'x' } }, known);
  assert.deepEqual(m.click, { sound: 'basic/button_click_03', volume: 1 });
  assert.deepEqual(m.hover, { sound: S.actionDef('hover').sound, volume: 0 });
  assert.equal(m.error.sound, null);
  assert.equal(m.bogus, undefined);
  assert.deepEqual(m.done, S.defaultPicks().done);
  assert.deepEqual(S.mergePicks(null), S.defaultPicks());
  assert.deepEqual(S.mergePicks('junk'), S.defaultPicks());
});

test('playGain: volume maths, mute, no sound, motion', () => {
  const g = (o) => S.playGain({ master: 0.5, volume: 0.8, muted: false, sound: 'a/b', ...o });
  assert.ok(Math.abs(g({}) - Math.pow(0.4, 1.5) * 2.5) < 1e-9);
  assert.equal(g({ muted: true }), 0);
  assert.equal(g({ sound: null }), 0);
  assert.equal(g({ master: 0 }), 0);
  assert.equal(g({ volume: 0 }), 0);
  assert.equal(g({ master: 1, volume: 1 }), S.MAX_GAIN, 'capped');
  assert.ok(g({ master: 1, volume: 1 }) <= 2);
  assert.ok(g({ volume: 0.3 }) < g({ volume: 0.6 }), 'monotonic');
  assert.equal(g({ master: 7, volume: 7 }), S.MAX_GAIN, 'clamped inputs');
  assert.equal(g({ master: NaN }), 0);
  // motion: off quiets interface sounds only; subtle only hover; reduced = off; followMotion false ignores it
  assert.equal(g({ action: 'click', motion: 'off' }), 0);
  assert.ok(g({ action: 'done', motion: 'off' }) > 0);
  assert.ok(g({ action: 'error', motion: 'off' }) > 0);
  assert.equal(g({ action: 'hover', motion: 'subtle' }), 0);
  assert.ok(g({ action: 'click', motion: 'subtle' }) > 0);
  assert.equal(g({ action: 'click', motion: 'full', reducedMotion: true }), 0);
  assert.ok(g({ action: 'click', motion: 'off', followMotion: false }) > 0);
});

test('urls and labels', () => {
  assert.equal(S.soundUrl('./sounds/', 'basic/checkbox_tick_01'), './sounds/ui/basic/checkbox_tick_01.ogg');
  assert.equal(S.soundUrl('https://x/y', 'basic/checkbox_tick_01', 'mp3'), 'https://x/y/ui/basic/checkbox_tick_01.mp3');
  assert.equal(S.labelOfId('basic/checkbox_tick_01'), 'Checkbox tick 1');
  assert.equal(S.labelOfId('buttons_sci_fi/sci_fi_button_click_in_01'), 'Sci-fi button click in 1');
  assert.equal(S.labelOfId(null), 'None');
  for (const s of pack.sounds) assert.equal(S.labelOfId(s.id), s.label, s.id);
});

test('actionOfKind: old kinds map on', () => {
  assert.equal(S.actionOfKind('toggle', true), 'toggleOn');
  assert.equal(S.actionOfKind('toggle', false), 'toggleOff');
  assert.equal(S.actionOfKind('toggle'), 'toggleOn');
  assert.equal(S.actionOfKind('done'), 'done');
  assert.equal(S.actionOfKind('nope'), null);
});

test('pressAction: data-sound, names, toggles, tabs, click', () => {
  const p = S.pressAction;
  assert.equal(p({ dataSound: 'none', label: 'Delete' }), null);
  assert.equal(p({ dataSound: 'copy', label: 'x' }), 'copy');
  assert.equal(p({ label: 'Delete image' }), 'delete');
  assert.equal(p({ label: 'Remove step' }), 'delete');
  assert.equal(p({ label: 'Copy prompt' }), 'copy');
  assert.equal(p({ label: 'Undo' }), null);
  assert.equal(p({ label: 'Redo' }), null);
  assert.equal(p({ label: 'Favourite', toggleTo: true }), 'favorite');
  assert.equal(p({ label: 'Favourite', toggleTo: false }), 'toggleOff');
  assert.equal(p({ label: 'Remove from favourites' }), 'toggleOff');
  assert.equal(p({ label: 'Remove background', toggleTo: true }), 'toggleOn', 'a switch named Remove… is a toggle');
  assert.equal(p({ label: 'Hints', toggleTo: false }), 'toggleOff');
  assert.equal(p({ label: 'Image', role: 'tab' }), 'tab');
  assert.equal(p({ label: 'Name', tag: 'LABEL' }), null);
  assert.equal(p({ label: 'Generate' }), 'click');
});

test('groupSounds: folders in order, every word must match', () => {
  const all = S.groupSounds(pack.sounds, pack.folders, '');
  assert.equal(all.reduce((n, g) => n + g.sounds.length, 0), pack.sounds.length);
  assert.deepEqual(all.map((g) => g.folder.id), pack.folders.map((f) => f.id));
  const tick = S.groupSounds(pack.sounds, pack.folders, 'checkbox TICK');
  assert.ok(tick.length === 1 && tick[0].sounds.every((s) => /checkbox_tick/.test(s.id)));
  const sci = S.groupSounds(pack.sounds, pack.folders, 'sci-fi click');
  assert.ok(sci.length >= 1 && sci.every((g) => g.sounds.every((s) => s.id.includes('sci_fi') && s.id.includes('click'))));
  assert.deepEqual(S.groupSounds(pack.sounds, pack.folders, 'zzzz'), []);
});
