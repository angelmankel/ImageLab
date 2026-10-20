/**
 * `~/dnd` — the app-wide drag-and-drop layer (fix list 42) and the one input-image drop zone
 * (fix list 41). Owner: compose agent.
 *
 *   payload.ts        MIME + ImagePayload + readDrop(): the ONE in-app drag format (tested)
 *   useImageDrag      spread on any picture to make it a drag source
 *   useImageDrop      spread on any element to make it a drop target (over / active for the look)
 *   importImage.ts    DropItem → Blob / dataUrl, with CORS fallbacks (img canvas, server proxy)
 *   DragLayer         mount once: outside-the-window drags light the targets, no stray file opens
 *   targets.ts        the phone fallback: register targets, openSendTo(payload) → SendToSheet
 *   useLongPress      long-press on a picture = "drag" on a phone (opens the Send-to sheet)
 */
export { MIME, makePayload, encodePayload, decodePayload, readDrop, nameFromUrl, firstUrl, imgSrcFromHtml, mayCarryImage, isVideoName } from './payload';
export type { ImagePayload, DropItem, DragSource, TransferLike } from './payload';
export { useImageDrag, setDragPayload } from './useImageDrag';
export type { ImageDragProps } from './useImageDrag';
export { useImageDrop } from './useImageDrop';
export type { ImageDropOptions, ImageDropProps } from './useImageDrop';
export { fetchImageBlob, dropToBlob, dropToImageState, proxyUrl, withExt } from './importImage';
export type { ImportedBlob, ImageState } from './importImage';
export { useDrag, useDragActive } from './dragStore';
export { DragLayer } from './DragLayer';
export { useTargets, useDropTargets, useRegisterDropTarget, openSendTo } from './targets';
export type { DropTarget } from './targets';
export { SendToSheet } from './SendToSheet';
export { useLongPress } from './useLongPress';
