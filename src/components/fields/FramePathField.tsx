/**
 * Loopback's frame path: a small canvas in the image's shape where a Start frame and an End frame
 * are set. Each round crops to the frame between them (drawn dashed — as it will really run,
 * fitted inside the round before) and renders that crop at the round's size, so the rounds travel
 * and zoom through the picture, and can change its shape.
 *
 * On the canvas, for the chosen frame (Start or End — the other is only shown):
 *   - drag outside it to draw it anew — any aspect ratio; hold Shift to keep its current one
 *     (a frame covering the whole image is redrawn by any drag)
 *   - drag inside it to move it; drag a corner to resize it
 *   - a tap on empty space moves it there; the wheel or the zoom slider scales it
 * Aspect buttons reshape it around its centre, keeping its area.
 */
import { useEffect, useRef, useState } from 'react';
import { Button, Group, SegmentedControl, Slider, Stack, Switch, Text } from '@mantine/core';
import { IconArrowsExchange, IconRefresh } from '@tabler/icons-react';
import { DEFAULT_FRAME, frameRect, frameZoom, type FrameRect } from '@/lib/pipeline';
import type { LoopbackFrame, LoopbackSettings } from '@/lib/types';
import { useStore } from '@/lib/store';
import { viewUrl } from '@/lib/comfy';

type FramePath = NonNullable<LoopbackSettings['frame']>;
type Which = 'start' | 'end';
type Pt = { x: number; y: number };

const MAX_ZOOM = 8;
const MIN_SIDE = 0.05;
const CANVAS_MAX_H = 280;
/** Corner grab radius, in screen pixels. */
const HANDLE_PX = 12;
const COLORS: Record<Which, string> = { start: 'var(--mantine-color-teal-5)', end: 'var(--mantine-color-orange-5)' };
export const DEFAULT_FRAME_PATH: FramePath = { enabled: false, start: DEFAULT_FRAME, end: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 } };

/** Pixel aspect ratios offered as buttons ('image' = the image's own). */
const ASPECTS: { label: string; value: number | 'image' }[] = [
  { label: 'Image', value: 'image' }, { label: '1:1', value: 1 }, { label: '2:3', value: 2 / 3 }, { label: '3:2', value: 3 / 2 },
  { label: '9:16', value: 9 / 16 }, { label: '16:9', value: 16 / 9 },
];
const NAMED = [[1, 1], [2, 3], [3, 2], [3, 4], [4, 3], [4, 5], [5, 4], [9, 16], [16, 9], [21, 9], [9, 21]];

/** "2:3" when the pixel aspect is close to a common one, else "1.27:1". */
function aspectLabel(pixelAspect: number): string {
  for (const [a, b] of NAMED) if (Math.abs(pixelAspect / (a / b) - 1) < 0.03) return `${a}:${b}`;
  return `${pixelAspect.toFixed(2)}:1`;
}

const rectFromCorners = (a: Pt, b: Pt): FrameRect => {
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const x0 = clamp(Math.min(a.x, b.x)), x1 = clamp(Math.max(a.x, b.x));
  const y0 = clamp(Math.min(a.y, b.y)), y1 = clamp(Math.max(a.y, b.y));
  const w = Math.max(MIN_SIDE, x1 - x0), h = Math.max(MIN_SIDE, y1 - y0);
  return { x: x0 + w / 2, y: y0 + h / 2, w, h };
};

const inside = (r: FrameRect, p: Pt) => Math.abs(p.x - r.x) <= r.w / 2 && Math.abs(p.y - r.y) <= r.h / 2;

/** Same centre and fraction-aspect, scaled so its zoom is `z` (area 1/z²), kept within the image. */
function withZoom(r: FrameRect, z: number): FrameRect {
  const a = r.w / r.h;
  let h = Math.sqrt(1 / (z * z * a)), w = a * h;
  const over = Math.max(w, h);
  if (over > 1) { w /= over; h /= over; }
  return { ...r, w, h };
}

/** Same centre and area, reshaped to a fraction-aspect `fa` (w/h in image fractions). */
function withAspect(r: FrameRect, fa: number): FrameRect {
  const area = r.w * r.h;
  let h = Math.sqrt(area / fa), w = fa * h;
  const over = Math.max(w, h);
  if (over > 1) { w /= over; h /= over; }
  return { ...r, w, h };
}

export function FramePathField({ value, onChange, between, aspect, disabled }: {
  value: FramePath;
  onChange: (v: FramePath) => void;
  /** Every round's frame as it will really run, drawn dashed. */
  between: FrameRect[];
  /** Image width / height. */
  aspect: number;
  disabled?: boolean;
}) {
  const [which, setWhich] = useState<Which>('end');
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<
    | { kind: 'move'; which: Which; dx: number; dy: number }
    | { kind: 'draw' | 'resize'; which: Which; anchor: Pt; from: Pt; moved: boolean; keep?: number }
    | null
  >(null);
  const latest = useRef(value);
  latest.current = value;
  const imgA = aspect || 1;

  // The picture being worked on, when there is one, so frames can be placed on real content.
  const entry = useStore((s) => s.selectedEntry);
  const servers = useStore((s) => s.servers);
  const preview = entry ? viewUrl(entry, servers.find((sv) => sv.id === entry.serverId)?.host ?? '') : '';

  const rectOf = (w: Which) => frameRect(latest.current[w]);
  const set = (w: Which, r: FrameRect | LoopbackFrame) => onChange({ ...latest.current, [w]: frameRect(r) });

  const point = (e: { clientX: number; clientY: number }): Pt => {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const nearCorner = (r: FrameRect, p: Pt): Pt | null => {
    const box = boxRef.current!.getBoundingClientRect();
    const tx = HANDLE_PX / box.width, ty = HANDLE_PX / box.height;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const cx = r.x + (sx * r.w) / 2, cy = r.y + (sy * r.h) / 2;
      if (Math.abs(p.x - cx) <= tx && Math.abs(p.y - cy) <= ty) return { x: r.x - (sx * r.w) / 2, y: r.y - (sy * r.h) / 2 };
    }
    return null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    const p = point(e);
    // Only the chosen frame (Start / End switch) is edited, so the other can never be grabbed by
    // accident. A frame covering the whole image cannot move, so dragging on it draws instead.
    const mine = rectOf(which);
    const keep = e.shiftKey ? mine.w / mine.h : undefined;
    const corner = nearCorner(mine, p);
    const whole = mine.w > 0.98 && mine.h > 0.98;
    if (corner && !whole) {
      drag.current = { kind: 'resize', which, anchor: corner, from: p, moved: true, keep };
    } else if (inside(mine, p) && !whole) {
      drag.current = { kind: 'move', which, dx: mine.x - p.x, dy: mine.y - p.y };
    } else {
      drag.current = { kind: 'draw', which, anchor: p, from: p, moved: false, keep };
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = point(e);
    if (d.kind === 'move') {
      set(d.which, { ...rectOf(d.which), x: p.x + d.dx, y: p.y + d.dy });
      return;
    }
    if (!d.moved && Math.hypot(p.x - d.from.x, p.y - d.from.y) < 0.015) return;
    d.moved = true;
    let r = rectFromCorners(d.anchor, p);
    const keep = e.shiftKey ? (d.keep ?? r.w / r.h) : undefined;
    if (keep) {
      // Keep the shape: the longer drag direction wins, grown from the anchor corner.
      const w = Math.max(r.w, r.h * keep), h = w / keep;
      const sx = p.x >= d.anchor.x ? 1 : -1, sy = p.y >= d.anchor.y ? 1 : -1;
      r = rectFromCorners(d.anchor, { x: d.anchor.x + sx * w, y: d.anchor.y + sy * h });
    }
    set(d.which, r);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    // A tap on empty space brings the chosen frame there.
    if (d && d.kind === 'draw' && !d.moved) {
      const p = point(e);
      set(d.which, { ...rectOf(d.which), x: p.x, y: p.y });
    }
  };

  // Wheel scales the chosen frame. Native listener: React's wheel handler is passive and could not
  // keep the panel from scrolling.
  const whichRef = useRef(which);
  whichRef.current = which;
  useEffect(() => {
    const el = boxRef.current;
    if (!el || !value.enabled || disabled) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const w = whichRef.current;
      const r = frameRect(latest.current[w]);
      const z = Math.min(MAX_ZOOM, Math.max(1, frameZoom(r) * Math.exp(-e.deltaY * 0.0015)));
      set(w, withZoom(r, z));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [value.enabled, disabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const box = (r: FrameRect) => ({ x: (r.x - r.w / 2) * 100, y: (r.y - r.h / 2) * 100, w: r.w * 100, h: r.h * 100 });
  const rects = { start: frameRect(value.start), end: frameRect(value.end) };
  const chosen = rects[which];
  const cb = box(chosen);
  const label = (w: Which) => `${w === 'start' ? 'Start' : 'End'} ${aspectLabel((rects[w].w * imgA) / rects[w].h)} ×${frameZoom(rects[w]).toFixed(2)}`;

  return (
    <Stack gap="xs">
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Text size="xs" c="dimmed">Frame path</Text>
          <Text size="xs" c="dimmed" style={{ opacity: 0.7 }}>Crop each round, moving from Start to End. Drag on the canvas to draw a frame.</Text>
        </div>
        <Switch size="sm" checked={value.enabled} disabled={disabled} aria-label="Frame path"
          onChange={(e) => onChange({ ...value, enabled: e.currentTarget.checked })} />
      </Group>
      {value.enabled && (
        <>
          <SegmentedControl size="xs" fullWidth value={which} onChange={(v) => setWhich(v as Which)} disabled={disabled}
            data={[
              { value: 'start', label: <span style={{ color: COLORS.start }}>● Start</span> },
              { value: 'end', label: <span style={{ color: COLORS.end }}>● End</span> },
            ]} />
          <div
            ref={boxRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => { drag.current = null; }}
            role="application"
            aria-label="Frame path canvas: drag to draw a frame, drag a frame to move it, a corner to resize, wheel to zoom"
            style={{
              // Width follows the height cap, so the box always has the image's shape (a max-height
              // alone would squash a tall image into a square and skew every frame).
              position: 'relative', width: `min(100%, ${Math.round(CANVAS_MAX_H * imgA)}px)`, aspectRatio: String(imgA),
              margin: '0 auto', borderRadius: 6, overflow: 'hidden', cursor: disabled ? 'default' : 'crosshair',
              touchAction: 'none', userSelect: 'none', border: '1px solid var(--mantine-color-dark-4)',
              background: preview
                ? `center / cover no-repeat url("${preview}")`
                : 'repeating-conic-gradient(var(--mantine-color-dark-6) 0 25%, var(--mantine-color-dark-7) 0 50%) 0 0 / 24px 24px',
            }}
          >
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              {/* Dim everything outside the chosen frame so it reads as a viewfinder. */}
              <path fillRule="evenodd" fill="rgba(0,0,0,0.35)" d={`M0 0H100V100H0Z M${cb.x} ${cb.y}h${cb.w}v${cb.h}h${-cb.w}Z`} />
              {between.map((f, i) => {
                const r = box(f);
                return <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke="rgba(255,255,255,0.6)"
                  strokeWidth={1} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />;
              })}
              {(['start', 'end'] as Which[]).map((w) => {
                const r = box(rects[w]);
                return <rect key={w} x={r.x} y={r.y} width={r.w} height={r.h} fill={w === which ? 'rgba(255,255,255,0.06)' : 'none'}
                  stroke={COLORS[w]} strokeWidth={w === which ? 2.5 : 1.5} vectorEffect="non-scaling-stroke" />;
              })}
            </svg>
            {/* Corner handles on the chosen frame. */}
            {!disabled && [[0, 0], [1, 0], [0, 1], [1, 1]].map(([cx, cy]) => (
              <span key={`${cx}${cy}`} style={{
                position: 'absolute', left: `${cb.x + cx * cb.w}%`, top: `${cb.y + cy * cb.h}%`, width: 10, height: 10,
                transform: 'translate(-50%, -50%)', background: COLORS[which], borderRadius: 2, pointerEvents: 'none',
              }} />
            ))}
            {(['start', 'end'] as Which[]).map((w) => {
              const r = box(rects[w]);
              return (
                <span key={w} style={{
                  position: 'absolute', left: `${Math.max(0, r.x)}%`, top: `${Math.max(0, r.y)}%`, transform: 'translate(3px, 3px)',
                  fontSize: 10, fontWeight: 700, padding: '0 4px', borderRadius: 3, background: COLORS[w], color: '#111', pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                }}>
                  {label(w)}
                </span>
              );
            })}
          </div>
          <Group gap={4} justify="center">
            {ASPECTS.map((a) => (
              <Button key={a.label} size="compact-xs" variant="default" disabled={disabled}
                onClick={() => set(which, withAspect(chosen, a.value === 'image' ? 1 : a.value / imgA))}>
                {a.label}
              </Button>
            ))}
          </Group>
          <Group justify="space-between" mb={2}>
            <Text size="xs" c="dimmed">{which === 'start' ? 'Start' : 'End'} zoom</Text>
            <Text size="xs" fw={500}>×{frameZoom(chosen).toFixed(2)}</Text>
          </Group>
          <Slider value={frameZoom(chosen)} min={1} max={MAX_ZOOM} step={0.05} label={null} disabled={disabled} color={which === 'start' ? 'teal' : 'orange'}
            onChange={(z) => set(which, withZoom(chosen, z))} thumbProps={{ 'aria-label': `${which} zoom` }} className="touch-pan-y" />
          <Group gap="xs" justify="flex-end">
            <Button size="compact-xs" variant="subtle" leftSection={<IconArrowsExchange size={14} />} disabled={disabled}
              onClick={() => onChange({ ...value, start: value.end, end: value.start })}>Swap</Button>
            <Button size="compact-xs" variant="subtle" color="gray" leftSection={<IconRefresh size={14} />} disabled={disabled}
              onClick={() => onChange({ ...DEFAULT_FRAME_PATH, enabled: true })}>Reset</Button>
          </Group>
        </>
      )}
    </Stack>
  );
}
