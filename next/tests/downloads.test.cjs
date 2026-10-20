const { test } = require('node:test');
const assert = require('node:assert/strict');
const D = require('./_load.cjs')('src/screens/image/queue/downloadLogic.ts');

const row = (status, extra = {}) => ({ status, downloaded_bytes: 0, total_bytes: 0, started_at: 0, updated_at: 0, version_id: 1, ...extra });

test('order: downloading (oldest first), failed, cancelled, done (newest first)', () => {
  const rows = [row('completed', { updated_at: 5 }), row('downloading', { started_at: 9 }), row('failed'), row('downloading', { started_at: 3 }), row('completed', { updated_at: 8 }), row('cancelled')];
  assert.deepEqual(D.orderDownloads(rows).map((r) => `${r.status}${r.started_at || r.updated_at || ''}`),
    ['downloading3', 'downloading9', 'failed', 'cancelled', 'completed8', 'completed5']);
});

test('sizes, speed and time left', () => {
  assert.equal(D.fmtBytes(6.5e9), '6.5 GB');
  assert.equal(D.fmtBytes(340e6), '340 MB');
  assert.equal(D.etaText(120e6, 2e6), '~1 min');
  assert.equal(D.etaText(10e6, 1e6), '~10 s');
  assert.equal(D.etaText(10e6, 0), null);
  assert.equal(D.progressLine(row('downloading', { downloaded_bytes: 1.2e9, total_bytes: 6.5e9 }), 34e6), '1.2 GB / 6.5 GB · 34 MB/s · ~3 min');
});

test('counts and retry', () => {
  assert.deepEqual(D.downloadCounts([row('downloading'), row('failed'), row('completed')]), { active: 1, failed: 1, finished: 2 });
  assert.equal(D.canRetry(row('failed')), true);
  assert.equal(D.canRetry(row('completed')), false);
});
