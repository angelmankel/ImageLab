/**
 * Layers portalled to the body on top of an open Mantine Modal / Drawer (the fullscreen model
 * viewer). The modal's scroll lock (react-remove-scroll) cancels every touch scroll and wheel
 * outside its own DOM, so the viewer could neither scroll nor swipe on a phone. Every Modal and
 * Drawer gets this ref as a scroll "shard" (theme defaults); the lock reads its shards at event
 * time, so the viewer only has to point the ref at its root while it is mounted.
 */
export const viewerLayerRef: { current: HTMLElement | null } = { current: null };
