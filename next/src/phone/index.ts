/**
 * Shared phone primitives (mobile pass, m-shell). Import from here:
 *   import { BottomSheet, PhoneTwoPane, useLongPress, usePullToClose, haptic, useKeyboardOpen } from '~/phone';
 *   import { useFormFactor, usePhoneLandscape } from '~/app/useFormFactor';
 * CSS: html[data-phone][data-orient="landscape"], html[data-kb] (keyboard open), var(--il-kb),
 * var(--il-safe-top / -bottom / -left / -right).
 */
export { BottomSheet } from './BottomSheet';
export type { BottomSheetProps } from './BottomSheet';
export { PhoneTwoPane, SIDE_WIDTH } from './TwoPane';
export type { PhoneTwoPaneProps } from './TwoPane';
export { useLongPress } from './useLongPress';
export type { LongPressOpts } from './useLongPress';
export { usePullToClose } from './usePullToClose';
export type { PullOpts } from './usePullToClose';
export { haptic } from './haptic';
export type { HapticKind } from './haptic';
export { useKeyboardInset, useKeyboardOpen, revealFocused } from './keyboard';
export { PhoneEffects } from './PhoneEffects';
export { useKeepScroll } from '~/screens/models/useKeepScroll';
// The phone map (Donny 10-21): stacked cards for depth, sideways swipes between siblings, the band + circle HUD.
export { phoneNav, usePhoneNav } from './nav/navStore';
export { registerPhonePage, setScreenPath, phonePageDef, siblingsOf, pageTitle } from './nav/pages';
export type { PhonePageDef, PhonePageProps, PageRef, SiblingSet } from './nav/pages';
export { usePhoneBand, usePhonePage } from './nav/band';
export type { BandAction, BandSpec } from './nav/band';
export type { NavPage } from './nav/navLogic';
export { flashMap } from './nav/MapDots';
