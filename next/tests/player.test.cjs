// The stage player's pure layer (src/screens/image/player/playerLogic.ts): the frame-rate guess
// and estimate, frame stepping, time formatting, scrub position ↔ time, the speed cycle, the saved
// preferences. Loaded alone (the module imports nothing).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('./_load.cjs')('src/screens/image/player/playerLogic.ts');

test('frame rate by file name: H3 24, Wan 16, anything else 24', () => {
  assert.equal(P.guessFps('ImageLab_H3_T2V_00012.mp4'), 24);
  assert.equal(P.guessFps('/view?filename=ImageLab_H3_I2V_00001.mp4&subfolder=video'), 24);
  assert.equal(P.guessFps('ImageLab_T2V_00003.mp4'), 16);
  assert.equal(P.guessFps('/view?filename=ImageLab_I2V_00004.mp4'), 16);
  assert.equal(P.guessFps('https://pod/view?filename=ImageLab%5FH3%5FREF.mp4'), 24);
  assert.equal(P.guessFps('somebody_else.mp4'), 24);
  assert.equal(P.guessFps(''), 24);
  assert.equal(P.guessFps(null), 24);
  assert.equal(P.guessFps('%E0%A4%A'), 24); // a broken escape never throws
});

test('rVFC estimate: frames per media second, snapped to a common rate, null until enough frames', () => {
  const a = { mediaTime: 0.5, presentedFrames: 10 };
  assert.equal(P.estimateFps(a, { mediaTime: 0.9, presentedFrames: 15 }), null); // too few frames
  assert.equal(P.estimateFps(a, { mediaTime: 1.5, presentedFrames: 26 }), 16);   // 16 / 1 s
  assert.equal(P.estimateFps(a, { mediaTime: 1.5, presentedFrames: 34 }), 24);   // 24 / 1 s
  assert.equal(P.estimateFps(a, { mediaTime: 1.5, presentedFrames: 33.5 }), 24); // 23.5 → 24 within 6%
  assert.equal(P.estimateFps(a, { mediaTime: 1.5, presentedFrames: 42 }), 32);   // interpolated Wan
  assert.equal(P.estimateFps(a, { mediaTime: 1.5, presentedFrames: 51 }), 41);   // nothing common: rounded
  assert.equal(P.estimateFps(a, { mediaTime: 0.5, presentedFrames: 30 }), null); // no time passed
  assert.equal(P.estimateFps(a, { mediaTime: 0.1, presentedFrames: 30 }), null); // time went back (a loop)
});

test('frame stepping lands on frame centres and never leaves the clip', () => {
  const fps = 16;
  assert.equal(P.frameAt(0, fps), 0);
  assert.equal(P.frameAt(0.5, fps), 8);
  assert.equal(P.frameAt(P.frameCentre(8, fps), fps), 8);
  // forward from frame 8's centre → frame 9's centre
  assert.equal(P.stepFrame(P.frameCentre(8, fps), fps, 1, 5), P.frameCentre(9, fps));
  // back → frame 7's centre
  assert.equal(P.stepFrame(P.frameCentre(8, fps), fps, -1, 5), P.frameCentre(7, fps));
  // at the start, back stays at 0; past the end clamps to the duration
  assert.equal(P.stepFrame(0, fps, -1, 5), 0);
  assert.equal(P.stepFrame(5, fps, 1, 5), 5);
  // the last frame is reachable from the end
  assert.equal(P.stepFrame(5, fps, -1, 5), P.frameCentre(79, fps));
  // a bad fps falls back to the default rather than dividing by zero
  assert.equal(P.stepFrame(1, 0, 1, 5), P.frameCentre(P.frameAt(1, 24) + 1, 24));
  // frame 16 at 16 fps is exactly 1.0 s: floor(1.0 * 16 + eps) must give 16, not 15 from float noise
  assert.equal(P.frameAt(0.1 * 3, 10), 3);
});

test('seeking by seconds clamps to the clip', () => {
  assert.equal(P.seekBy(2, 1, 5), 3);
  assert.equal(P.seekBy(4.5, 1, 5), 5);
  assert.equal(P.seekBy(0.5, -1, 5), 0);
  assert.equal(P.seekBy(NaN, 1, 5), 0);
  assert.equal(P.clampTime(3, 0), 3); // unknown duration: no upper clamp
  assert.equal(P.SEEK_STEP, 1);
});

test('time formatting: m:ss, tenths on request, "0:03 / 0:05"', () => {
  assert.equal(P.fmtTime(0), '0:00');
  assert.equal(P.fmtTime(3.9), '0:03');
  assert.equal(P.fmtTime(65), '1:05');
  assert.equal(P.fmtTime(3.46, true), '0:03.4');
  assert.equal(P.fmtTime(59.99, true), '0:59.9');
  assert.equal(P.fmtTime(60, true), '1:00.0');
  assert.equal(P.fmtTime(NaN), '0:00');
  assert.equal(P.fmtTime(-2), '0:00');
  assert.equal(P.fmtClock(3.2, 5.06), '0:03 / 0:05');
});

test('scrub bar: position ↔ time', () => {
  assert.equal(P.posOf(2.5, 5), 0.5);
  assert.equal(P.posOf(7, 5), 1);
  assert.equal(P.posOf(-1, 5), 0);
  assert.equal(P.posOf(2, 0), 0);
  // a bar from x=100, 200 wide, over a 10 s clip
  assert.equal(P.timeAt(100, 100, 200, 10), 0);
  assert.equal(P.timeAt(150, 100, 200, 10), 2.5);
  assert.equal(P.timeAt(300, 100, 200, 10), 10);
  assert.equal(P.timeAt(400, 100, 200, 10), 10);
  assert.equal(P.timeAt(0, 100, 200, 10), 0);
  assert.equal(P.timeAt(150, 100, 0, 10), 0);
  assert.equal(P.timeAt(150, 100, 200, 0), 0);
});

test('speed cycles 0.25 · 0.5 · 1 · 1.5 · 2 and anything odd goes back to 1×', () => {
  assert.deepEqual(P.SPEEDS, [0.25, 0.5, 1, 1.5, 2]);
  assert.equal(P.nextSpeed(1), 1.5);
  assert.equal(P.nextSpeed(1.5), 2);
  assert.equal(P.nextSpeed(2), 0.25);
  assert.equal(P.nextSpeed(0.25), 0.5);
  assert.equal(P.nextSpeed(0.5), 1);
  assert.equal(P.nextSpeed(3), 1);
  assert.equal(P.fmtSpeed(1), '1×');
  assert.equal(P.fmtSpeed(0.25), '0.25×');
});

test('a press on the clip: tap under the slop, a sideways swipe on the phone only', () => {
  assert.equal(P.classifyPress(3, 2, false), 'tap');
  assert.equal(P.classifyPress(3, 2, true), 'tap');
  assert.equal(P.classifyPress(-80, 10, true), 'next');
  assert.equal(P.classifyPress(80, 10, true), 'prev');
  assert.equal(P.classifyPress(-80, 10, false), null);   // desktop: a drag is nothing
  assert.equal(P.classifyPress(-30, 5, true), null);     // too short
  assert.equal(P.classifyPress(-60, 50, true), null);    // mostly vertical: the page scrolls
  assert.equal(P.classifyPress(-10, 0, true), null);     // past the slop, under the swipe: nothing
});

test('saved preferences: defaults, a full save, junk and partial saves', () => {
  assert.deepEqual(P.DEFAULT_PREFS, { loop: true, muted: false, volume: 1, speed: 1 });
  assert.deepEqual(P.parsePrefs(null), P.DEFAULT_PREFS);
  assert.deepEqual(P.parsePrefs(''), P.DEFAULT_PREFS);
  assert.deepEqual(P.parsePrefs('{nope'), P.DEFAULT_PREFS);
  assert.deepEqual(P.parsePrefs('42'), P.DEFAULT_PREFS);
  assert.deepEqual(P.parsePrefs(JSON.stringify({ loop: false, muted: true, volume: 0.4, speed: 0.5 })), { loop: false, muted: true, volume: 0.4, speed: 0.5 });
  assert.deepEqual(P.parsePrefs(JSON.stringify({ loop: 'yes', volume: 7, speed: 3 })), { loop: true, muted: false, volume: 1, speed: 1 });
  assert.deepEqual(P.parsePrefs(JSON.stringify({ volume: -1 })), { ...P.DEFAULT_PREFS, volume: 0 });
  assert.notEqual(P.parsePrefs(null), P.DEFAULT_PREFS, 'a fresh object every time, never the shared default');
  assert.equal(P.PREFS_KEY, 'imagelab.next.player.v1');
});

test('starting mute: silent clips always, clips with sound as last chosen', () => {
  assert.equal(P.initialMuted(false, { muted: false }), true);
  assert.equal(P.initialMuted(true, { muted: false }), false);
  assert.equal(P.initialMuted(true, { muted: true }), true);
});
