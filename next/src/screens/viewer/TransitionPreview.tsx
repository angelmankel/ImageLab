/**
 * Item 30: a live, looping thumbnail of one slideshow transition (the picker shows what each one
 * does). Two placeholder gradients play the very keyframes the slideshow uses.
 */
import { useEffect, useRef } from 'react';
import { kenBurnsFrames, transitionFrames, type ShowTransition } from './slideshowLogic';

const A = 'linear-gradient(160deg, #4a3d58 0%, #262a36 55%, #3d3026 100%)';
const B = 'linear-gradient(200deg, #2f4a46 0%, #22252e 60%, #4a3628 100%)';

export function TransitionPreview({ kind }: { kind: ShowTransition }) {
  const inRef = useRef<HTMLDivElement>(null);
  const outRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const f = transitionFrames(kind);
    const ms = Math.max(f.ms, 300);
    const opts: KeyframeAnimationOptions = { duration: ms, easing: f.easing, iterations: Infinity, delay: 0, endDelay: 900, fill: 'both' };
    const anims: Animation[] = [];
    if (kind === 'cut') {
      anims.push(inRef.current!.animate([{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1, offset: 0.5 }, { opacity: 1 }], { duration: 1600, iterations: Infinity }));
    } else {
      anims.push(inRef.current!.animate(f.incoming, opts), outRef.current!.animate(f.outgoing, opts));
      if (kind === 'kenburns') anims.push(inRef.current!.firstElementChild!.animate(kenBurnsFrames(0), { duration: ms + 900, iterations: Infinity }));
    }
    return () => anims.forEach((a) => a.cancel());
  }, [kind]);
  const layer: React.CSSProperties = { position: 'absolute', inset: 0 };
  return (
    <div aria-hidden style={{ position: 'relative', height: 40, borderRadius: 7, overflow: 'hidden', marginBottom: 5, background: '#111' }}>
      <div ref={outRef} style={{ ...layer, background: A }} />
      <div ref={inRef} style={layer}><div style={{ ...layer, background: B }} /></div>
    </div>
  );
}
