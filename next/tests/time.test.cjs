const { test } = require('node:test');
const assert = require('node:assert/strict');
const T = require('./_load.cjs')('src/lib/time.ts');

const at = (y, mo, d, h, mi, s = 0) => new Date(y, mo, d, h, mi, s).getTime();

test('formatTime: 12-hour with AM / PM, midnight and noon are 12', () => {
  assert.equal(T.formatTime(at(2026, 9, 20, 14, 54)), '2:54 PM');
  assert.equal(T.formatTime(at(2026, 9, 20, 0, 5)), '12:05 AM');
  assert.equal(T.formatTime(at(2026, 9, 20, 12, 0)), '12:00 PM');
  assert.equal(T.formatTime(at(2026, 9, 20, 9, 7, 3), { seconds: true }), '9:07:03 AM');
  assert.equal(T.formatTime(NaN), '');
});

test('formatDate / formatDateTime: year only when not this year', () => {
  const now = at(2026, 9, 20, 12, 0);
  assert.equal(T.formatDate(at(2026, 2, 12, 8, 0), now), '12 Mar');
  assert.equal(T.formatDate(at(2025, 9, 12, 8, 0), now), '12 Oct 2025');
  assert.equal(T.formatDateTime(at(2026, 9, 12, 18, 40), now), '12 Oct · 6:40 PM');
});

test('formatWhen: Today / Yesterday / date', () => {
  const now = at(2026, 9, 20, 10, 0);
  assert.equal(T.formatWhen(at(2026, 9, 20, 9, 5), now), 'Today · 9:05 AM');
  assert.equal(T.formatWhen(at(2026, 9, 19, 23, 59), now), 'Yesterday · 11:59 PM');
  assert.equal(T.formatWhen(at(2026, 9, 1, 13, 0), now), '1 Oct · 1:00 PM');
});

test('formatClock: the footer clock', () => {
  assert.equal(T.formatClock(at(2026, 9, 20, 14, 7)), '02:07PM');
  assert.equal(T.formatClock(at(2026, 9, 20, 0, 30)), '12:30AM');
});
