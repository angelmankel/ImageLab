/**
 * Fix list 2 "Video previews": how video thumbnails play, app-wide (Settings → Appearance).
 *   hover    → a clip plays while the pointer is on it (the default)
 *   autoplay → the on-screen clips play by themselves (nearest the centre, a few at a time;
 *              reduced motion / Save-Data fall back to hover)
 *   off      → stills only
 * Remembered in this browser (`imagelab.next.videoPreview.v1`). Every video thumbnail reads it
 * through `~/ui/VideoThumb` (or the Library grid's controller).
 */
import { create } from 'zustand';

export type VideoPreviewMode = 'hover' | 'autoplay' | 'off';
export const VIDEO_PREVIEW_MODES: readonly VideoPreviewMode[] = ['hover', 'autoplay', 'off'];
const KEY = 'imagelab.next.videoPreview.v1';

export function parseVideoPreview(raw: unknown): VideoPreviewMode {
  return (VIDEO_PREVIEW_MODES as readonly unknown[]).includes(raw) ? (raw as VideoPreviewMode) : 'hover';
}

function load(): VideoPreviewMode {
  try { return parseVideoPreview(JSON.parse(localStorage.getItem(KEY) || 'null')?.mode); } catch { return 'hover'; }
}

export const useVideoPreview = create<{ mode: VideoPreviewMode; setMode: (m: VideoPreviewMode) => void }>((set) => ({
  mode: typeof localStorage === 'undefined' ? 'hover' : load(),
  setMode: (mode) => {
    try { localStorage.setItem(KEY, JSON.stringify({ mode })); } catch { /* private mode */ }
    set({ mode });
  },
}));
