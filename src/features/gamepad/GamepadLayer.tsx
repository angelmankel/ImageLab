/**
 * The app's controller layer, mounted once in App. Idle with no pad: `useGamepad` starts polling
 * only once one connects, and nothing here renders until then.
 *
 * One map for every mode and both shells (the table is in CLAUDE.md "Controllers" and in the help
 * card, `PadHelp`): A presses the highlighted control (Generate when nothing is highlighted), B goes
 * back (then stops the run), Plus generates or stops, the d-pad or stick moves a highlight over the
 * controls on screen and ◀ ▶ change the one highlighted, L / R switch mode, X a new seed, Y
 * favourite, the left stick's press opens the result full screen, the right one's flips Simple /
 * Advanced, Minus shows the card.
 *
 * The highlight is a ring drawn over the control (`padDom.ts` finds controls by role, so no control
 * knows about it). It appears on a controller press only and hides on a touch, click, wheel or key.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { notifications } from '@mantine/notifications';
import { useGamepad, type PadPress } from '@/hooks/useGamepad';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { emitApp } from '@/lib/appEvents';
import { familyName, isDir, padLabels, type Box, type Dir, type PadKey, type Stick } from '@/lib/gamepad';
import { useCanvasStore } from '@/lib/canvasStore';
import { modeOfView } from '@/lib/workspace';
import * as dom from './padDom';
import * as act from './padActions';
import { PadHelp } from './PadHelp';

/** A stale highlight (its page slid away) waits this long for the layout to settle, then moves. */
const SETTLE_MS = 300;
/**
 * Android turns pad buttons into keys too (d-pad → arrows, A → Enter) unless the page is reading
 * the pad; Chrome should swallow them while it is, but such a key arriving while a pad button is
 * down (or just after a press) is dropped, so it neither hides the ring nor acts a second time.
 */
const ECHO_MS = 80;
const ECHO_KEYS = /^(Arrow|Enter$|Escape$| $|Gamepad|Unidentified$)/;
const padHeld = () => [...(navigator.getGamepads?.() ?? [])].some(p => !!p && (p.buttons.some(b => b.pressed) || p.axes.slice(0, 4).some(a => Math.abs(a) > 0.5)));

export function GamepadLayer() {
  const isDesktop = useIsDesktop();
  const [help, setHelp] = useState(false);
  const helpOpen = useRef(false);
  helpOpen.current = help;

  const ring = useRef<HTMLDivElement>(null);
  const target = useRef<dom.Stop | null>(null);
  const lit = useRef(false);
  const lastBox = useRef<Box | null>(null);
  const staleSince = useRef(0);
  const layerSeen = useRef<HTMLElement | null>(null);
  /** Overlays opened over the highlight, and what it sat on, to hand it back when they close. */
  const openers = useRef<{ layer: HTMLElement; opener: dom.Stop | null }[]>([]);
  /** ZL / ZR held: a modifier while a direction is pressed, a tap otherwise. */
  const zHeld = useRef<{ key: PadKey; used: boolean } | null>(null);

  const draw = useCallback(() => {
    const el = ring.current;
    if (!el) return;
    const s = target.current;
    if (!lit.current || !s || !dom.stillThere(s)) { el.style.opacity = '0'; return; }
    const r = s.visual.getBoundingClientRect();
    el.style.opacity = '1';
    el.style.left = `${r.left - 3}px`;
    el.style.top = `${r.top - 3}px`;
    el.style.width = `${r.width + 6}px`;
    el.style.height = `${r.height + 6}px`;
  }, []);

  const hide = useCallback(() => {
    if (!lit.current) return;
    lit.current = false;
    draw();
  }, [draw]);

  const setTarget = useCallback((s: dom.Stop) => {
    target.current = s;
    lit.current = true;
    staleSince.current = 0;
    dom.reveal(s.visual);
    lastBox.current = dom.boxOf(s);
    draw();
  }, [draw]);

  /** The stops on top and where the highlight is among them; `fresh` when it had to be found again. */
  const acquire = useCallback(() => {
    const layer = dom.topLayer();
    const root = layer ?? document.body;
    // Overlays that closed since the last look hand the highlight back to what opened them.
    let restored: dom.Stop | null = null;
    const stack = openers.current;
    while (stack.length && stack[stack.length - 1].layer !== layer && !dom.isOpen(stack[stack.length - 1].layer)) {
      restored = stack.pop()!.opener;
    }
    const opened = !!layer && layer !== layerSeen.current && !stack.some(o => o.layer === layer);
    if (opened) stack.push({ layer, opener: target.current });
    layerSeen.current = layer;

    const stops = dom.collectStops(root);
    let at = target.current ? stops.findIndex(s => s.el === target.current!.el) : -1;
    const fresh = at < 0;
    if (fresh) {
      const back = restored ? stops.findIndex(s => s.el === restored!.el) : -1;
      if (opened || !lastBox.current) at = dom.initialStop(stops, root);
      else if (back >= 0) at = back;
      else at = dom.nearestStop(stops, lastBox.current);
    }
    return { stops, at, fresh };
  }, []);

  const navigate = useCallback((dir: Dir, big: boolean) => {
    const { stops, at, fresh } = acquire();
    if (at < 0) return;
    // The first press only shows where the highlight is.
    if (!lit.current || fresh) { setTarget(stops[at]); return; }
    const s = stops[at];
    if ((dir === 'left' || dir === 'right') && dom.nudge(s, dir === 'right' ? 1 : -1, big)) { setTarget(s); return; }
    const next = dom.moveFrom(stops, at, dir);
    setTarget(stops[next >= 0 ? next : at]);
  }, [acquire, setTarget]);

  const back = useCallback((layer: HTMLElement | null) => {
    if (layer) { dom.closeLayer(layer); return; }
    const page = dom.backButton();
    if (page) { page.click(); return; }
    if (lit.current) { hide(); return; }
    const mode = act.modeNow();
    if (mode) act.stop(mode);
  }, [hide]);

  const lastPress = useRef(0);

  const onPress = useCallback(({ key, held }: PadPress) => {
    lastPress.current = performance.now();
    if (helpOpen.current) {
      if (key === 'minus' || key === 'b' || key === 'a' || key === 'plus') setHelp(false);
      return;
    }
    const mode = act.modeNow();
    // A text box keeps the controller out, except Plus (generate) and B (leave the box).
    const typing = dom.typingElement();
    if (typing) {
      if (key === 'plus' && mode) act.runOrStop(mode);
      else if (key === 'b') typing.blur();
      return;
    }
    const layer = dom.topLayer();
    const viewer = dom.isViewer(layer);
    const workspace = !!modeOfView(useCanvasStore.getState().mainView);

    if (isDir(key)) {
      if (zHeld.current) zHeld.current.used = true;
      // Full screen, ◀ ▶ step the pictures until the highlight is called up with ▲ ▼.
      if (viewer && !lit.current && (key === 'left' || key === 'right')) { dom.pressKey(key === 'left' ? 'ArrowLeft' : 'ArrowRight'); return; }
      navigate(key, held.has('zl') || held.has('zr'));
      return;
    }
    switch (key) {
      case 'minus': hide(); setHelp(true); return;
      case 'plus': if (mode) act.runOrStop(mode); return;
      case 'b': back(layer); return;
      case 'a':
        if (lit.current && target.current && dom.stillThere(target.current)) dom.activate(target.current);
        else if (!layer && mode) act.generate(mode);
        return;
      case 'x': if (!layer && mode) act.newSeed(mode); return;
      case 'y': if (mode === 'image' && (!layer || viewer)) act.favouriteShown(); return;
      case 'l': case 'r':
        if (viewer) dom.pressKey(key === 'l' ? 'ArrowLeft' : 'ArrowRight');
        else if (!layer && workspace) act.stepMode(key === 'l' ? -1 : 1);
        return;
      case 'zl': case 'zr':
        if (viewer) dom.pressKey(key === 'zl' ? 'ArrowLeft' : 'ArrowRight');
        else zHeld.current = { key, used: false };
        return;
      case 'lstick':
        if (viewer && layer) dom.closeLayer(layer);
        else if (!layer && mode) act.openResult(mode);
        return;
      case 'rstick': if (!layer && workspace) act.toggleDetail(); return;
      default: return;
    }
  }, [navigate, back, hide]);

  const onRelease = useCallback((key: PadKey) => {
    if ((key !== 'zl' && key !== 'zr') || zHeld.current?.key !== key) return;
    const tap = !zHeld.current.used;
    zHeld.current = null;
    if (!tap || helpOpen.current || dom.topLayer() || dom.typingElement()) return;
    const mode = act.modeNow();
    if (!mode || !modeOfView(useCanvasStore.getState().mainView)) return;
    // ZL is "left": the older result, as ← on the keyboard; on a phone, the tab to the left.
    if (isDesktop) act.stepResults(mode, key === 'zl' ? 1 : -1);
    else emitApp('pad-tab', key === 'zl' ? -1 : 1);
  }, [isDesktop]);

  const onFrame = useCallback((scroll: Stick, dt: number) => {
    const s = target.current;
    if (lit.current && s && !dom.stillThere(s)) {
      // Its page slid away or its list redrew: pick up nearby once things settle.
      const now = performance.now();
      if (!staleSince.current) staleSince.current = now;
      else if (now - staleSince.current > SETTLE_MS) {
        const { stops, at } = acquire();
        if (at >= 0) setTarget(stops[at]); else staleSince.current = now;
      }
    }
    draw();
    if (Math.abs(scroll.y) > 0.2 && !dom.typingElement()) {
      dom.scrollFrom(lit.current && s ? s.visual : null, dom.topLayer(), scroll.y * dt * 1.2);
    }
  }, [acquire, setTarget, draw]);

  const pad = useGamepad({ onPress, onRelease, onFrame });

  // Touch, mouse, wheel or a real key: the user has moved on, so the ring goes.
  useEffect(() => {
    if (!pad.connected) return;
    const off = (e: Event) => { if (e.isTrusted) hide(); };
    const onKey = (e: KeyboardEvent) => {
      if (!e.isTrusted) return;
      if (ECHO_KEYS.test(e.key) && (performance.now() - lastPress.current < ECHO_MS || padHeld())) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
      hide();
    };
    const opts = { capture: true, passive: true } as const;
    window.addEventListener('pointerdown', off, opts);
    window.addEventListener('wheel', off, opts);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', off, opts);
      window.removeEventListener('wheel', off, opts);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [pad.connected, hide]);

  // Say so once per connection, with the button that opens the card.
  useEffect(() => {
    if (!pad.connected) { hide(); setHelp(false); target.current = null; openers.current = []; return; }
    const family = pad.family ?? 'xbox';
    notifications.show({
      title: 'Controller connected',
      message: `${familyName(family)}. Press ${padLabels(family).minus} for the buttons.`,
      autoClose: 4000,
    });
  }, [pad.connected]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pad.connected) return null;
  return (
    <>
      {createPortal(
        <div ref={ring} aria-hidden data-pad-skip
          className="pointer-events-none fixed z-[10000] rounded-lg"
          style={{
            opacity: 0, left: 0, top: 0, width: 0, height: 0,
            boxShadow: '0 0 0 2px var(--mantine-primary-color-filled), 0 0 0 6px color-mix(in srgb, var(--mantine-primary-color-filled) 30%, transparent)',
            transition: 'left 90ms ease-out, top 90ms ease-out, width 90ms ease-out, height 90ms ease-out, opacity 120ms',
          }}
        />,
        document.body,
      )}
      {help && <PadHelp family={pad.family ?? 'xbox'} desktop={isDesktop} mode={act.modeNow()} onClose={() => setHelp(false)} />}
    </>
  );
}
