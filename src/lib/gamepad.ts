/**
 * Game controllers, the pure part: which pad is which, how its buttons read, what is printed on
 * them, and the arithmetic the focus layer moves by. Imports nothing, so the tests load it from
 * source; `hooks/useGamepad` polls, `features/gamepad` acts.
 *
 * The Gamepad API's standard mapping is positional: index 0 is the *bottom* face button. On a
 * Nintendo pad that one is printed B and the right one A, so a Switch pad is read by position and
 * then named by its labels, and the button printed A confirms, as on a Switch. What Chrome reports
 * (read from Chromium's and Android's sources, see CLAUDE.md "Controllers"):
 *
 * - Desktop Chrome drives Switch pads itself over HID (`nintendo_controller.cc`): standard mapping,
 *   0 = B, 1 = A, 2 = Y, 3 = X, 16 Home, 17 Capture. A lone Joy-Con is already turned sideways
 *   there, and an L and an R connected together become one "Joy-Con L+R" pad.
 * - Chrome on Android has no mapping for them: `mapping` is '' but the indices still follow the
 *   standard layout (`GamepadMappings.java`, unknown pads). The Pro Controller has Android key
 *   layout `Vendor_057e_Product_2009.kl`, which is positional too. Joy-Cons fall back to
 *   `Generic.kl`, which swaps the top and left buttons, and each one stays its own upright pad, so
 *   here a lone one is turned sideways by hand, the way Chrome does it on desktop.
 */

/** A face button by where it sits, as the standard mapping indexes them. */
type Position =
  | 'south' | 'east' | 'west' | 'north'
  | 'l' | 'r' | 'zl' | 'zr' | 'select' | 'start' | 'lstick' | 'rstick'
  | 'up' | 'down' | 'left' | 'right' | 'home' | 'capture';

/**
 * A button by what it does here, named after the Switch label: `a` confirms on every pad (the one
 * printed A, or ✕), `b` goes back, `minus` / `plus` are Select / Start.
 */
export type PadKey =
  | 'a' | 'b' | 'x' | 'y'
  | 'l' | 'r' | 'zl' | 'zr' | 'minus' | 'plus' | 'lstick' | 'rstick'
  | 'up' | 'down' | 'left' | 'right' | 'home' | 'capture';

export const DIRECTIONS = ['up', 'down', 'left', 'right'] as const;
export type Dir = (typeof DIRECTIONS)[number];
export const isDir = (k: PadKey): k is Dir => k === 'up' || k === 'down' || k === 'left' || k === 'right';

export type PadFamily = 'nintendo' | 'joycon-l' | 'joycon-r' | 'xbox' | 'playstation';

/** Which kind of pad an id names. Chrome's ids carry `Vendor: 057e`; Android's are just the name. */
export function padFamily(id: string): PadFamily {
  const s = id.toLowerCase();
  // "Joy-Con L+R" is Chrome's composite of a pair; the charging grip is one pad too.
  if (/joy-?con\s*l\s*\+\s*r|product: 200e/.test(s)) return 'nintendo';
  if (/joy-?con\s*\(l\)|product: 2006/.test(s)) return 'joycon-l';
  if (/joy-?con\s*\(r\)|product: 2007/.test(s)) return 'joycon-r';
  if (/057e|nintendo|pro controller|joy-?con/.test(s)) return 'nintendo';
  if (/054c|dualsense|dualshock|playstation|^wireless controller/.test(s)) return 'playstation';
  return 'xbox';
}

export const isNintendo = (f: PadFamily) => f === 'nintendo' || f === 'joycon-l' || f === 'joycon-r';
export const isLoneJoyCon = (f: PadFamily) => f === 'joycon-l' || f === 'joycon-r';

/** What a pad's buttons are read as: a lone Joy-Con is sideways; one with its partner is half a pad. */
export function effectiveFamily(f: PadFamily, partnerConnected: boolean): PadFamily {
  return isLoneJoyCon(f) && partnerConnected ? 'nintendo' : f;
}

const STANDARD: readonly Position[] = [
  'south', 'east', 'west', 'north', 'l', 'r', 'zl', 'zr', 'select', 'start', 'lstick', 'rstick',
  'up', 'down', 'left', 'right', 'home', 'capture',
];
/** Android's Generic.kl puts the top button on BUTTON_X (index 2) and the left on BUTTON_Y. */
const ANDROID_JOYCON: readonly Position[] = STANDARD.map((p, i) => (i === 2 ? 'north' : i === 3 ? 'west' : p));
/** A lone Joy-Con on Android, turned sideways as Chrome's desktop driver turns it. */
const ANDROID_SIDEWAYS_R: Readonly<Record<number, Position>> = {
  1: 'south', 2: 'east', 0: 'west', 3: 'north', 4: 'l', 6: 'r', 5: 'select', 7: 'zr', 9: 'start', 10: 'lstick', 11: 'lstick', 16: 'home',
};
const ANDROID_SIDEWAYS_L: Readonly<Record<number, Position>> = {
  14: 'south', 13: 'east', 12: 'west', 15: 'north', 5: 'l', 7: 'r', 4: 'select', 8: 'start', 6: 'zl', 10: 'lstick', 16: 'home',
};

export interface PadContext {
  /** The page runs in Chrome on Android, where Switch pads arrive unmapped. */
  android: boolean;
  /** The other Joy-Con of a pair is connected as its own pad. */
  partner: boolean;
}

/** Index → position for one pad. */
export function buttonLayout(family: PadFamily, mapping: string, ctx: PadContext): (i: number) => Position | undefined {
  const raw = mapping !== 'standard' && ctx.android && isLoneJoyCon(family);
  if (raw && !ctx.partner) {
    const table = family === 'joycon-r' ? ANDROID_SIDEWAYS_R : ANDROID_SIDEWAYS_L;
    return i => table[i];
  }
  const list = raw ? ANDROID_JOYCON : STANDARD;
  return i => list[i];
}

/** What each position does: Nintendo pads confirm on the right button, everyone else on the bottom. */
export function keyOf(family: PadFamily, pos: Position): PadKey {
  switch (pos) {
    case 'south': return isNintendo(family) ? 'b' : 'a';
    case 'east': return isNintendo(family) ? 'a' : 'b';
    // By label: the button printed X rerolls on every pad, wherever it sits.
    case 'west': return isNintendo(family) ? 'y' : 'x';
    case 'north': return isNintendo(family) ? 'x' : 'y';
    case 'select': return 'minus';
    case 'start': return 'plus';
    default: return pos;
  }
}

export interface Stick { x: number; y: number }
export interface PadSnapshot {
  id: string;
  mapping: string;
  buttons: readonly { pressed: boolean; value: number }[];
  axes: readonly number[];
}
export interface PadReading {
  family: PadFamily;
  keys: Set<PadKey>;
  /** The stick that moves the highlight, and the one that scrolls. */
  move: Stick;
  scroll: Stick;
}

const num = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** One pad's state in app terms. Triggers are analog: a soft pull can leave `pressed` false. */
export function readPad(pad: PadSnapshot, ctx: PadContext): PadReading {
  const base = padFamily(pad.id);
  const family = effectiveFamily(base, ctx.partner);
  const layout = buttonLayout(base, pad.mapping, ctx);
  const keys = new Set<PadKey>();
  pad.buttons.forEach((b, i) => {
    const pos = layout(i);
    if (pos && b && (b.pressed || num(b.value) > 0.5)) keys.add(keyOf(family, pos));
  });
  const a = pad.axes;
  let move: Stick = { x: num(a[0]), y: num(a[1]) };
  let scroll: Stick = { x: num(a[2]), y: num(a[3]) };
  if (pad.mapping !== 'standard' && ctx.android && !ctx.partner && isLoneJoyCon(base)) {
    // Sideways: the stick's up is the Joy-Con's right (L) or left (R), and an R reports its stick
    // as the right stick.
    move = base === 'joycon-l' ? { x: num(a[1]), y: -num(a[0]) } : { x: -num(a[3]), y: num(a[2]) };
    scroll = { x: 0, y: 0 };
  }
  return { family, keys, move, scroll };
}

/**
 * Every connected pad at once. Their presses are merged, so whichever pad is pressed works and a
 * button held on two pads still fires once.
 */
export function readPads(pads: readonly PadSnapshot[], android: boolean): { keys: Set<PadKey>; move: Stick; scroll: Stick; readings: PadReading[] } {
  const families = pads.map(p => padFamily(p.id));
  const hasL = families.includes('joycon-l');
  const hasR = families.includes('joycon-r');
  const readings = pads.map((p, i) => readPad(p, { android, partner: (families[i] === 'joycon-l' && hasR) || (families[i] === 'joycon-r' && hasL) }));
  const keys = new Set<PadKey>();
  let move: Stick = { x: 0, y: 0 };
  let scroll: Stick = { x: 0, y: 0 };
  const bigger = (s: Stick, t: Stick) => (Math.hypot(t.x, t.y) > Math.hypot(s.x, s.y) ? t : s);
  for (const r of readings) {
    r.keys.forEach(k => keys.add(k));
    move = bigger(move, r.move);
    scroll = bigger(scroll, r.scroll);
  }
  return { keys, move, scroll, readings };
}

/** A stick past its dead zone, as d-pad directions. */
export function stickDirs(s: Stick, deadzone = 0.5): Dir[] {
  const out: Dir[] = [];
  if (s.x < -deadzone) out.push('left'); else if (s.x > deadzone) out.push('right');
  if (s.y < -deadzone) out.push('up'); else if (s.y > deadzone) out.push('down');
  return out;
}

// ── Labels ──────────────────────────────────────────────────────────────────

/** What is printed on each button, for the help. An empty label: this pad has no such button. */
export function padLabels(f: PadFamily): Record<PadKey, string> {
  const dirs = { up: '▲', down: '▼', left: '◀', right: '▶' };
  switch (f) {
    case 'nintendo':
      return { a: 'A', b: 'B', x: 'X', y: 'Y', l: 'L', r: 'R', zl: 'ZL', zr: 'ZR', minus: '−', plus: '+', lstick: 'LS', rstick: 'RS', home: 'Home', capture: 'Capture', ...dirs };
    case 'joycon-r':
      // Sideways the right button is the one printed X: it confirms, as on a Switch.
      return { a: 'X', b: 'A', x: 'Y', y: 'B', l: 'SL', r: 'SR', zl: '', zr: 'ZR', minus: 'R', plus: '+', lstick: 'Stick', rstick: '', home: 'Home', capture: '', ...dirs };
    case 'joycon-l':
      // Its four buttons are arrows; sideways each points where it sits.
      return { a: '▶', b: '▼', x: '▲', y: '◀', l: 'SL', r: 'SR', zl: 'ZL', zr: '', minus: 'L', plus: '−', lstick: 'Stick', rstick: '', home: 'Capture', capture: '', ...dirs };
    case 'playstation':
      return { a: '✕', b: '○', x: '□', y: '△', l: 'L1', r: 'R1', zl: 'L2', zr: 'R2', minus: 'Create', plus: 'Options', lstick: 'L3', rstick: 'R3', home: 'PS', capture: '', ...dirs };
    default:
      return { a: 'A', b: 'B', x: 'X', y: 'Y', l: 'LB', r: 'RB', zl: 'LT', zr: 'RT', minus: 'View', plus: 'Menu', lstick: 'LS', rstick: 'RS', home: 'Guide', capture: 'Share', ...dirs };
  }
}

export function familyName(f: PadFamily): string {
  switch (f) {
    case 'nintendo': return 'Switch controller';
    case 'joycon-l': return 'Joy-Con (L), sideways';
    case 'joycon-r': return 'Joy-Con (R), sideways';
    case 'playstation': return 'PlayStation controller';
    default: return 'Controller';
  }
}

// ── Focus arithmetic ────────────────────────────────────────────────────────

export interface Box { left: number; top: number; right: number; bottom: number }

const cx = (b: Box) => (b.left + b.right) / 2;
const cy = (b: Box) => (b.top + b.bottom) / 2;
const gap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, b0 - a1, a0 - b1);

/**
 * The box to move to from `from` in a direction: the nearest one ahead that is in line with it
 * (overlaps it across the direction), else the nearest one out of line. So the highlight stays in
 * its column on a three-column desktop and in its row in a toolbar. -1 when there is none.
 */
export function pickInDirection(boxes: readonly Box[], from: Box, dir: Dir, skip = -1): number {
  let best = -1;
  let bestScore = Infinity;
  const vertical = dir === 'up' || dir === 'down';
  boxes.forEach((b, i) => {
    if (i === skip) return;
    let ahead: boolean;
    switch (dir) {
      // Ahead means it starts past our middle: a box beside us that only reaches lower is not below.
      case 'down': ahead = b.top > cy(from) && b.bottom > from.bottom; break;
      case 'up': ahead = b.bottom < cy(from) && b.top < from.top; break;
      case 'right': ahead = b.left > cx(from) && b.right > from.right; break;
      default: ahead = b.right < cx(from) && b.left < from.left;
    }
    if (!ahead) return;
    const along = vertical
      ? (dir === 'down' ? Math.max(0, b.top - from.bottom) : Math.max(0, from.top - b.bottom))
      : (dir === 'right' ? Math.max(0, b.left - from.right) : Math.max(0, from.left - b.right));
    const across = vertical ? gap(from.left, from.right, b.left, b.right) : gap(from.top, from.bottom, b.top, b.bottom);
    const drift = vertical ? Math.abs(cx(b) - cx(from)) : Math.abs(cy(b) - cy(from));
    // Anything in line beats anything out of it; out of line is the fallback when nothing is.
    const score = along + across * 3 + (across > 0 ? 10_000 : 0) + drift * 0.1;
    if (score < bestScore) { bestScore = score; best = i; }
  });
  return best;
}

/** The box nearest a point (0 when it is inside), for picking up again after the page changed. */
export function nearestBox(boxes: readonly Box[], x: number, y: number): number {
  let best = -1;
  let bestD = Infinity;
  boxes.forEach((b, i) => {
    const d = Math.hypot(gap(x, x, b.left, b.right), gap(y, y, b.top, b.bottom)) + Math.hypot(cx(b) - x, cy(b) - y) * 0.01;
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

/** The first box in reading order: the top row (within a few px), then the leftmost. */
export function firstBox(boxes: readonly Box[], rowSlack = 8): number {
  let best = -1;
  boxes.forEach((b, i) => {
    if (best < 0) { best = i; return; }
    const o = boxes[best];
    if (b.top < o.top - rowSlack || (Math.abs(b.top - o.top) <= rowSlack && b.left < o.left)) best = i;
  });
  return best;
}

/**
 * How far a scroller must move to show an item with a margin: 0 when it is in view, otherwise
 * just enough (an item taller than the view lines up its start).
 */
export function scrollDelta(itemStart: number, itemEnd: number, viewStart: number, viewEnd: number, margin = 24): number {
  const room = viewEnd - viewStart;
  const m = Math.min(margin, Math.max(0, (room - (itemEnd - itemStart)) / 2));
  if (itemEnd - itemStart > room - 2 * m) return itemStart - viewStart - m;
  if (itemStart < viewStart + m) return itemStart - viewStart - m;
  if (itemEnd > viewEnd - m) return itemEnd - viewEnd + m;
  return 0;
}

/** One step through a list, stopping at its ends (a segmented choice does not wrap). */
export function stepIndex(i: number, n: number, dir: 1 | -1, wrap = false): number {
  if (n <= 0) return -1;
  if (i < 0) return dir > 0 ? 0 : n - 1;
  const next = i + dir;
  if (wrap) return (next + n) % n;
  return Math.min(n - 1, Math.max(0, next));
}
