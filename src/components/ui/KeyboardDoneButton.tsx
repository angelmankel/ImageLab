/**
 * A small "Done" button on the right, just above a phone's on-screen keyboard, that closes it. A
 * page cannot add keys to the keyboard, and Android's has no close key, so this sits above it.
 *
 * The keyboard shrinks the visual viewport, not always the layout one (Chrome resizes only the
 * visual viewport by default), so a plain `bottom: 0` would hide behind it. The button is placed from
 * `visualViewport` instead. "Keyboard up" means an editable field has focus and the visual viewport
 * is well short of the tallest it has been at this width — that works whichever of the two
 * viewports the browser shrinks.
 */
import { useEffect, useState } from 'react';
import { Button, Portal } from '@mantine/core';
import { IconKeyboardHide } from '@tabler/icons-react';

const BAR_H = 40;
const GAP = 8;
/** Less than this and it is browser chrome moving, not a keyboard. */
const KEYBOARD_MIN = 150;

function isEditable(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly;
  if (el instanceof HTMLInputElement) {
    return !el.readOnly && !['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'file', 'color', 'image'].includes(el.type);
  }
  return (el as HTMLElement).isContentEditable === true;
}

export function KeyboardDoneButton() {
  const [top, setTop] = useState<number | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || !window.matchMedia('(pointer: coarse)').matches) return;
    let tallest = vv.height;
    let width = vv.width;

    const update = () => {
      // A rotation changes what "full height" is.
      if (Math.abs(vv.width - width) > 1) { width = vv.width; tallest = vv.height; }
      // Pinch zoom also shrinks the visual viewport; scale it back so zooming is not a keyboard.
      const height = vv.height * (vv.scale || 1);
      tallest = Math.max(tallest, height, window.innerHeight);
      const keyboardUp = isEditable(document.activeElement) && tallest - height > KEYBOARD_MIN;
      setTop(keyboardUp ? vv.offsetTop + vv.height - BAR_H - GAP : null);
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    document.addEventListener('focusin', update);
    // focusout fires before the next field's focusin; wait a tick so moving between fields does not flicker.
    const onFocusOut = () => setTimeout(update, 50);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  if (top == null) return null;
  // Portalled to <body> so it sits over modals, which portal there too.
  return (
    <Portal>
    <Button
      size="md"
      h={BAR_H}
      radius="xl"
      leftSection={<IconKeyboardHide size={18} />}
      style={{ position: 'fixed', right: 12, top, zIndex: 500, boxShadow: '0 4px 14px rgba(0,0,0,0.45)' }}
      // Keep focus in the field until Done is released, so the tap itself cannot bounce the keyboard.
      onPointerDown={(e) => e.preventDefault()}
      onClick={() => (document.activeElement as HTMLElement | null)?.blur()}
      aria-label="Close keyboard"
    >
      Done
    </Button>
    </Portal>
  );
}
