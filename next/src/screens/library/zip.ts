/**
 * "Zip all" (stopgap, 10-22): fetch every library item and save them as .zip files. Stored, not
 * deflated — PNG / MP4 are compressed already. Plain zip (no zip64), so a zip is cut at ~3.5 GB or
 * 60 000 files and the rest goes in the next part.
 */
import type { LibItem } from './libraryLogic';
import { notifyError, say, unsay } from '~/app/notify';

const PART_BYTES = 3.5 * 1024 ** 3;
const PART_FILES = 60_000;

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosTime(d: Date): [number, number] {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = (Math.max(0, d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return [time, date];
}

interface Entry { name: Uint8Array<ArrayBuffer>; crc: number; size: number; offset: number; time: number; date: number }

class ZipWriter {
  parts: BlobPart[] = [];
  entries: Entry[] = [];
  offset = 0;
  add(name: string, data: Uint8Array<ArrayBuffer>, when: Date) {
    const n = new TextEncoder().encode(name);
    const [time, date] = dosTime(when);
    const e: Entry = { name: n, crc: crc32(data), size: data.length, offset: this.offset, time, date };
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, e.crc, true);
    h.setUint32(18, e.size, true); h.setUint32(22, e.size, true); h.setUint16(26, n.length, true); h.setUint16(28, 0, true);
    this.parts.push(h.buffer, n, data);
    this.offset += 30 + n.length + data.length;
    this.entries.push(e);
  }
  finish(): Blob {
    const start = this.offset;
    let len = 0;
    for (const e of this.entries) {
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint16(10, 0, true); c.setUint16(12, e.time, true); c.setUint16(14, e.date, true); c.setUint32(16, e.crc, true);
      c.setUint32(20, e.size, true); c.setUint32(24, e.size, true); c.setUint16(28, e.name.length, true);
      c.setUint32(42, e.offset, true);
      this.parts.push(c.buffer, e.name);
      len += 46 + e.name.length;
    }
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, this.entries.length, true); end.setUint16(10, this.entries.length, true);
    end.setUint32(12, len, true); end.setUint32(16, start, true);
    this.parts.push(end.buffer);
    return new Blob(this.parts, { type: 'application/zip' });
  }
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

let running = false;

export async function zipItems(items: readonly LibItem[], label = 'imagelab') {
  if (running) { say('A zip is already being made'); return; }
  if (!items.length) { say('Nothing to zip'); return; }
  running = true;
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const used = new Set<string>();
  let zip = new ZipWriter();
  let part = 1, done = 0, failed = 0;
  const flush = () => {
    if (!zip.entries.length) return;
    save(zip.finish(), `${label}-${stamp}${part > 1 || done < items.length ? `-part${part}` : ''}.zip`);
    part++;
    zip = new ZipWriter();
  };
  try {
    // Four downloads at a time; files go into the zip in library order.
    const queue = items.map((it, i) => ({ it, i }));
    const results = new Map<number, Uint8Array<ArrayBuffer> | null>();
    let next = 0;
    const fetchOne = async () => {
      while (next < queue.length) {
        const { it, i } = queue[next++];
        try {
          const res = await fetch(it.url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          results.set(i, new Uint8Array(await res.arrayBuffer()));
        } catch { results.set(i, null); }
      }
    };
    const workers = Promise.all([fetchOne(), fetchOne(), fetchOne(), fetchOne()]);
    for (let i = 0; i < items.length; i++) {
      while (!results.has(i)) await new Promise((r) => setTimeout(r, 30));
      const data = results.get(i)!;
      results.delete(i);
      done++;
      say(`Zipping ${done} / ${items.length}…`, { tone: 'busy', ms: 60_000 });
      if (!data) { failed++; continue; }
      const it = items[i];
      const base = (it.filename || `imagelab-${it.key.slice(-8)}.${it.kind === 'video' ? 'mp4' : 'png'}`).split('/').pop()!;
      let name = base;
      for (let n = 2; used.has(name); n++) name = base.replace(/(\.[^.]*)?$/, `-${n}$1`);
      used.add(name);
      if (zip.entries.length && (zip.offset + data.length > PART_BYTES || zip.entries.length >= PART_FILES)) flush();
      zip.add(name, data, new Date(it.createdAt || Date.now()));
    }
    await workers;
    flush();
    unsay();
    say(failed ? `Zip saved · ${failed} file${failed === 1 ? '' : 's'} could not be fetched` : `Zip saved · ${items.length - failed} files`, { tone: failed ? 'warn' : 'ok' });
  } catch (err) {
    unsay();
    notifyError('Zip failed', err);
  } finally {
    running = false;
  }
}
