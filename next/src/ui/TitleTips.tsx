/**
 * FIXLIST-2 item 20: one tooltip, never two. A native `title=""` drew the browser's own box next
 * to ours (e.g. a session tab's title over the × button's "The last tab stays open"). This bridge
 * runs once for the whole app (mounted by UiEffects): when the mouse enters an element with a
 * `title`, the attribute is lifted off while the pointer is inside (so the browser never shows
 * it) and put back on leave; after the usual tooltip delay the text shows in OUR `.il-tip` look
 * instead — unless one of our real tooltips (Tip / Mantine Tooltip) is open, which always wins.
 * So: every native title in the app looks like our tooltips, and a parent's title can never stack
 * with a child's Tip. `data-no-tip` (on the element or an ancestor) opts out; iframes are skipped.
 * New code: use <Tip label> rather than `title`, and keep `aria-label` for screen readers.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { T } from '~/theme/tokens';
import { dur } from '~/theme/motion';
import { toCssPx } from '~/theme/uiScale';
import { TIP_DELAY } from './Tip';
import { placeTip } from './titleTipLogic';

const REAL_TIP = '.mantine-Tooltip-tooltip';

export function TitleTips() {
  const [tip, setTip] = useState<{ text: string; el: HTMLElement } | null>(null);

  useEffect(() => {
    let holder: HTMLElement | null = null;
    let saved = '';
    let timer = 0;
    let watch: MutationObserver | null = null;

    const hide = () => { window.clearTimeout(timer); watch?.disconnect(); watch = null; setTip(null); };
    const release = () => {
      hide();
      // Put the title back unless React wrote a new one meanwhile.
      if (holder && saved && !holder.hasAttribute('title')) holder.setAttribute('title', saved);
      holder = null; saved = '';
    };
    const show = () => {
      if (!holder?.isConnected || document.querySelector(REAL_TIP)) return;
      setTip({ text: saved, el: holder });
      // A real tooltip opening later (a child's Tip) takes over.
      watch = new MutationObserver(() => { if (document.querySelector(REAL_TIP)) hide(); });
      watch.observe(document.body, { childList: true, subtree: true });
    };

    const over = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const t = e.target instanceof Element ? e.target : null;
      const near = t?.closest<HTMLElement>('[title]') ?? null;
      // Still inside the current holder and no nearer title: nothing changes.
      if (holder && t && holder.contains(t) && (!near || !holder.contains(near))) return;
      release();
      if (!near || near.tagName === 'IFRAME' || near.closest('[data-no-tip]')) return;
      const text = near.getAttribute('title') ?? '';
      holder = near; saved = text;
      near.removeAttribute('title');
      if (text.trim()) timer = window.setTimeout(show, TIP_DELAY + 60);
    };
    const out = (e: PointerEvent) => { if (!e.relatedTarget) release(); };
    document.addEventListener('pointerover', over, { passive: true });
    document.addEventListener('pointerout', out, { passive: true });
    document.addEventListener('pointerdown', hide, { passive: true, capture: true });
    document.addEventListener('wheel', hide, { passive: true, capture: true });
    document.addEventListener('keydown', hide, { capture: true });
    return () => {
      release();
      document.removeEventListener('pointerover', over);
      document.removeEventListener('pointerout', out);
      document.removeEventListener('pointerdown', hide, { capture: true });
      document.removeEventListener('wheel', hide, { capture: true });
      document.removeEventListener('keydown', hide, { capture: true });
    };
  }, []);

  return tip ? createPortal(<Bubble text={tip.text} anchor={tip.el} />, document.body) : null;
}

function Bubble({ text, anchor }: { text: string; anchor: HTMLElement }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const a = anchor.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    const p = placeTip(a, { width: b.width, height: b.height }, { width: window.innerWidth, height: window.innerHeight });
    setPos({ left: toCssPx(p.left), top: toCssPx(p.top) });
  }, [anchor, text]);
  return (
    <div ref={ref} role="tooltip" className="il-tip" style={{
      position: 'fixed', left: pos?.left ?? 0, top: pos?.top ?? 0, zIndex: T.z.confirm + 10, pointerEvents: 'none',
      whiteSpace: 'pre-line', opacity: pos ? 1 : 0, transition: `opacity ${dur(0.09)} ease`,
    }}>
      {text}
    </div>
  );
}
