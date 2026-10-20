/**
 * `~/compose` — the ONE input-image drop zone (fix list 41) and the Composition tab (item 2).
 * Owner: compose agent.
 *
 *   ImageDropZone     every picture slot: drop · paste · Upload · Library; preview, badge, Replace / Edit / Clear
 *   StepImageInput    a step's input card: My image · Last from N · Pick from N (+ the slot's ImageDropZone)
 *   StepSource        the same without the card / title
 *   LibraryPicker     Recent · Liked · Collections · On the server
 *   inputLogic        pure: choice words, origins, display names, slot labels (tested)
 *   originStore       where each slot's picture came from (the badge)
 */
export { ImageDropZone } from './ImageDropZone';
export type { ImageDropZoneProps } from './ImageDropZone';
export { StepImageInput, StepSource } from './StepImageInput';
export { SourceChoice } from './SourceChoice';
export { LibraryPicker } from './LibraryPicker';
export type { LibraryPick, ServerFiles } from './LibraryPicker';
export { sourceChoices, ORIGIN_LABEL, originOfDrop, displayName, slotLabel, fmtDims, valueRef } from './inputLogic';
export type { Origin, SourceMode, SourceChoice as SourceChoiceItem } from './inputLogic';
export { useOrigin, useOrigins, rememberOrigin } from './originStore';
export { CompositionTab } from './CompositionTab';
export { useComposition, useCompositionSync, CompositionSync, useNativeArea } from './sizeStore';
export type { SizeMode, InputSizeMode } from './sizeStore';
export { Seg } from './Seg';
