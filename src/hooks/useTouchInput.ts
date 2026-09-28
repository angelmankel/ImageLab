import { useMediaQuery } from '@mantine/hooks';

/**
 * True on a touch screen (finger, not mouse). A searchable select there puts a text field under
 * the finger: the tap opens the keyboard, the screen shrinks, the dropdown flips and moves, and it
 * can keep moving while the keyboard settles. Selects use this to stay plain lists on phones.
 */
export function useTouchInput(): boolean {
  return useMediaQuery('(pointer: coarse)') ?? false;
}
