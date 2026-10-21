/**
 * The ImageLab logo, option D "Monolith" (approved by Donny 10-20; spec:
 * agent-handoffs/logo-d-monolith.md). Pure geometry + SVG strings, no DOM (tests/monolith.test.cjs);
 * the React parts are in `logo.tsx`, the PNG icons come from `scripts/make-icons.cjs`.
 *
 * The mark: an inverted equilateral triangle with a Y cut (corner → centre → out through the tip).
 * The cut is SUBTRACTED (three filled pieces), so the mark works on any background. The cut gets
 * thicker as the mark gets smaller (48 px → 7, 24 px → 9, 16 px → 11 viewBox units) and the viewBox
 * is shifted so the VISIBLE shape is centred (the cut eats the thin bottom tip).
 * Blue #2f7cf6 accent, no orange. Wordmark "IMAGELAB": IBM Plex Sans Condensed SemiBold, tracked
 * 0.16em, outlined to one path (no font to load).
 */

export const LOGO_BLUE = '#2f7cf6';
export const MARK_ON_DARK = '#eceef1';
export const MARK_DARK = '#0c0e11';

type Pt = readonly [number, number];
const A: Pt = [6, 14];
const B: Pt = [94, 14];
const C: Pt = [50, 90.2];
const O: Pt = [50, 39.4];

/** Cut width (viewBox units) for a mark drawn `px` tall: 16 → 11, 24 → 9, 48 → 7, ≥ 100 → 5.5, linear between. */
export function cutFor(px: number): number {
  const pts: ReadonlyArray<Pt> = [[16, 11], [24, 9], [48, 7], [100, 5.5]];
  if (px <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    if (px <= x1) return Math.round((y0 + ((px - x0) / (x1 - x0)) * (y1 - y0)) * 100) / 100;
  }
  return pts[pts.length - 1][1];
}

/** viewBox y-offset that centres what is visible: the shape runs from y 14 to 90.2 − cut / 1.1547. */
export function yOffsetFor(cut: number): number {
  return Math.round(((14 + 90.2 - cut / 1.1547) / 2 - 50) * 100) / 100;
}

export const viewBoxFor = (cut: number): string => `0 ${yOffsetFor(cut)} 100 100`;

/** Keep the part of a convex polygon where a·x + b·y + c ≥ 0 (Sutherland–Hodgman, one edge). */
function clip(poly: Pt[], a: number, b: number, c: number): Pt[] {
  const f = (p: Pt) => a * p[0] + b * p[1] + c;
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const fp = f(p), fq = f(q);
    if (fp >= 0) out.push(p);
    if ((fp >= 0) !== (fq >= 0)) {
      const t = fp / (fp - fq);
      out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  }
  return out;
}

/** Half-plane "at least `d` from the line P→Q, on the side of `side`". */
function awayFrom(poly: Pt[], P: Pt, Q: Pt, side: Pt, d: number): Pt[] {
  let a = -(Q[1] - P[1]), b = Q[0] - P[0];
  const n = Math.hypot(a, b);
  a /= n; b /= n;
  let c = -(a * P[0] + b * P[1]);
  if (a * side[0] + b * side[1] + c < 0) { a = -a; b = -b; c = -c; }
  return clip(poly, a, b, c - d);
}

const fmt = (v: number) => String(Math.round(v * 100) / 100);

/** The mark's path data (three pieces, cut subtracted) for a cut width. */
export function markPath(cut: number): string {
  const h = cut / 2;
  const top = awayFrom(awayFrom([A, B, O], A, O, B, h), B, O, A, h);
  const left = awayFrom(awayFrom([A, O, C], A, O, C, h), O, C, A, h);
  const right = awayFrom(awayFrom([B, O, C], B, O, C, h), O, C, B, h);
  return [top, left, right]
    .filter((p) => p.length >= 3)
    .map((p) => `M${p.map((q) => `${fmt(q[0])} ${fmt(q[1])}`).join('L')}Z`)
    .join('');
}

/** The bare mark as a standalone SVG (`px` square), one colour. */
export function markSvg(px: number, color = MARK_ON_DARK, cut = cutFor(px)): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="${viewBoxFor(cut)}"><path d="${markPath(cut)}" fill="${color}"/></svg>`;
}

/**
 * The app icon / favicon tile: a blue rounded square (radius 23%), the dark mark at 63% of it,
 * cut 6.5 (thicker when tiny), visibly centred. `maskable` = full-bleed square, mark at 50% (safe zone);
 * `square` = full-bleed square, mark at 63% (iOS rounds the corners itself).
 */
export function tileSvg(px: number, opts: { maskable?: boolean; square?: boolean } = {}): string {
  const inner = opts.maskable ? 0.5 : 0.63;
  const cut = Math.max(6.5, cutFor(px * inner));
  const s = 100 * inner;
  const o = (100 - s) / 2;
  const bg = opts.maskable || opts.square
    ? `<rect width="100" height="100" fill="${LOGO_BLUE}"/>`
    : `<rect width="100" height="100" rx="23" fill="${LOGO_BLUE}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 100 100">${bg}`
    + `<svg x="${fmt(o)}" y="${fmt(o)}" width="${fmt(s)}" height="${fmt(s)}" viewBox="${viewBoxFor(cut)}"><path d="${markPath(cut)}" fill="${MARK_DARK}"/></svg></svg>`;
}

export const svgDataUrl = (svg: string): string => `data:image/svg+xml,${encodeURIComponent(svg)}`;

/** "IMAGELAB" outlined: caps from y 0 to 698, ink from x 48 to 5673 (units of 1000 per em). */
export const WORDMARK = {
  viewBox: '48 0 5625 698',
  /** width ÷ height of the viewBox. */
  aspect: 5625 / 698,
  /** cap height ÷ font size: a wordmark "at font size N" is N × this tall. */
  capRatio: 0.698,
  d: 'M48 698V599H131V99H48V0H339V99H256V599H339V698Z M1093 300 1101 182H1087L1041 296L915 565L790 296L744 183H730L738 300V698H620V0H757L861 227L912 370H921L972 227L1074 0H1211V698H1093Z M1907 698 1858 516H1633L1584 698H1464L1668 0H1826L2030 698ZM1774 224 1752 113H1738L1716 224L1663 415H1828Z M2684 592H2670Q2662 643 2621 676.5Q2580 710 2508 710Q2387 710 2322 617Q2257 524 2257 351Q2257 255 2276.5 186.5Q2296 118 2332 73.5Q2368 29 2418.5 8.5Q2469 -12 2531 -12Q2625 -12 2685 28.5Q2745 69 2779 145L2677 204Q2660 154 2625.5 125Q2591 96 2531 96Q2465 96 2427.5 139Q2390 182 2390 262V436Q2390 516 2427.5 559Q2465 602 2531 602Q2591 602 2631 570Q2671 538 2671 478V427H2549V321H2790V698H2684Z M3084 698V0H3503V109H3209V291H3466V397H3209V589H3503V698Z M3788 698V0H3913V589H4158V698Z M4811 698 4762 516H4537L4488 698H4368L4572 0H4730L4934 698ZM4678 224 4656 113H4642L4620 224L4567 415H4732Z M5187 0H5484Q5566 0 5607.5 47Q5649 94 5649 179Q5649 248 5620 286Q5591 324 5534 328V343Q5565 343 5590.5 354.5Q5616 366 5634.5 386.5Q5653 407 5663 435.5Q5673 464 5673 498Q5673 541 5661.5 577.5Q5650 614 5629 641Q5608 668 5578.5 683Q5549 698 5512 698H5187ZM5312 589H5476Q5507 589 5524.5 572.5Q5542 556 5542 517V468Q5542 429 5524.5 412.5Q5507 396 5476 396H5312ZM5312 290H5456Q5486 290 5503 275Q5520 260 5520 223V176Q5520 139 5503 124Q5486 109 5456 109H5312Z',
} as const;
