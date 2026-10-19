import type { PopoverProps } from '@mantine/core';

/**
 * How every dropdown is placed (theme default for Popover, which Select, Autocomplete, Menu and
 * the popover base all sit on).
 *
 * The loop it stops: opening a Select scrolls the picked option into view. When the dropdown hung
 * off the screen, that scroll moved the input, flip sent the dropdown to the other side, the option
 * was off screen again, and so on, forever. `size` keeps the dropdown inside the screen, so the
 * option scrolls within the dropdown and nothing outside moves. Flip still picks the side that fits
 * on open, but when neither side fits it stays put rather than bouncing between them.
 */
export const DROPDOWN_MIDDLEWARES: NonNullable<PopoverProps['middlewares']> = {
  flip: { fallbackStrategy: 'initialPlacement', padding: 8 },
  shift: { padding: 8 },
  size: {
    padding: 8,
    apply({ availableHeight, elements }: { availableHeight: number; elements: { floating: HTMLElement } }) {
      elements.floating.style.maxHeight = `${Math.max(120, Math.floor(availableHeight))}px`;
    },
  },
};
