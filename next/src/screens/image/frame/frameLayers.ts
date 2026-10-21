/**
 * Item 41, the pure part of the flash-free frame swap (tests/frameLayers.test.cjs).
 *
 * A picture that changes (a live preview frame, the next result) is a short stack of layers,
 * bottom first. The shown one stays until the new one has DECODED; only then does the new one go
 * on top (cut, or a ~150 ms cross-fade over the old), and once it is fully on screen everything
 * under it is dropped. A frame that is overtaken before it decoded never shows. Nothing ever
 * clears to empty between two pictures.
 */
export interface FrameLayer { id: number; url: string; ready: boolean }

export type FrameAction =
  | { type: 'push'; id: number; url: string | null }
  | { type: 'ready'; id: number }
  | { type: 'fail'; id: number }
  | { type: 'settle'; id: number };

export function frameReducer(layers: FrameLayer[], a: FrameAction): FrameLayer[] {
  switch (a.type) {
    case 'push': {
      if (!a.url) return layers.length ? [] : layers;
      const top = layers[layers.length - 1];
      if (top && top.url === a.url) return layers;
      const shown = topReady(layers);
      // Back to the shown picture: whatever was still decoding is moot.
      if (shown && shown.url === a.url) return layers.filter((l) => l.ready);
      // Keep every decoded layer (one may still be fading in over the others) and the newest
      // frame still decoding (so frames that come faster than they decode never starve the
      // screen: whichever decodes first shows), then the new one.
      const pending = layers.filter((l) => !l.ready).slice(-1);
      return [...layers.filter((l) => l.ready || pending.includes(l)), { id: a.id, url: a.url, ready: false }];
    }
    case 'ready': {
      const i = layers.findIndex((l) => l.id === a.id);
      if (i < 0 || layers[i].ready) return layers;
      // Pending layers older than this one never show.
      return layers.filter((l, j) => j >= i || l.ready).map((l) => (l.id === a.id ? { ...l, ready: true } : l));
    }
    case 'fail': {
      const i = layers.findIndex((l) => l.id === a.id);
      if (i < 0) return layers;
      // The only picture: show it anyway (a broken image beats a silent blank). Else keep the old one.
      if (layers.length === 1) return layers[0].ready ? layers : [{ ...layers[0], ready: true }];
      return layers.filter((l) => l.id !== a.id);
    }
    case 'settle': {
      const i = layers.findIndex((l) => l.id === a.id);
      if (i <= 0) return layers;
      return layers.slice(i);
    }
  }
}

export function topReady(layers: readonly FrameLayer[]): FrameLayer | null {
  for (let i = layers.length - 1; i >= 0; i--) if (layers[i].ready) return layers[i];
  return null;
}

/** The fade length in ms for a theme motion factor (`--il-motion`: 0 = off / reduced → a cut). */
export function fadeMs(motion: number, base = 150): number {
  return Number.isFinite(motion) && motion > 0 ? Math.round(base * Math.min(motion, 2)) : 0;
}
