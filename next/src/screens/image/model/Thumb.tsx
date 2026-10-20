/**
 * A model's picture (rule 4: "a row of circles (thumbnail or initials)"): the first of `images`
 * that loads (in the order `ModelThumb` / `useModelPreview` chose), else two initials on a colour
 * made from the file name. `round` for the circles, square (radius 14) for the entry card and the
 * picker tiles.
 */
import { useEffect, useState } from 'react';
import { T } from '~/theme/tokens';
import { smallThumb } from './useModelMeta';

const HUES = [
  ['#3E5050', '#1F2A2A'], ['#4C405A', '#241F2C'], ['#3F4F5E', '#1E262D'], ['#5A4A3E', '#2A2420'], ['#4A4E5C', '#23262E'],
];

function hue(name: string): [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length] as [string, string];
}

export function initials(label: string): string {
  const words = label.replace(/[_\-.]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function Thumb({ label, images, size, round, style, onPointerEnter, rootRef }: {
  label: string; images: string[]; size: number; round?: boolean; style?: React.CSSProperties;
  /** A callback ref on the picture (`useModelPreview().observe`: loads "Most popular" once on screen). */
  rootRef?: (el: HTMLElement | null) => void;
  /** A hover on the picture (`useModelPreview` loads "Most popular" / reshuffles "Random" on it). */
  onPointerEnter?: (e: React.PointerEvent) => void;
}) {
  const [i, setI] = useState(0);
  const key = images.join('\n');
  useEffect(() => { setI(0); }, [key]);
  const url = smallThumb(images[i], size);
  const [a, b] = hue(label);
  return (
    <span
      ref={rootRef}
      aria-hidden
      onPointerEnter={onPointerEnter}
      style={{
        width: size, height: size, flex: 'none', display: 'grid', placeItems: 'center', overflow: 'hidden',
        borderRadius: round ? '50%' : T.radius.lg, background: `linear-gradient(135deg, ${a}, ${b})`,
        color: 'var(--il-fg)', fontWeight: 800, fontSize: Math.max(10, Math.round(size * 0.28)), letterSpacing: '.5px', ...style,
      }}
    >
      {url ? <img src={url} alt="" draggable={false} onError={() => setI((n) => n + 1)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : initials(label)}
    </span>
  );
}
