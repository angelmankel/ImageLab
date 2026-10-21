/**
 * Item 13: the Edit mode's exact pixel moves (rotate 90°, flip, crop) on a 2D canvas: no
 * resampling, lossless PNG out. Colour work happens on the GPU (`gpu/engine.bake`), the rest on
 * ComfyUI (`editTools.ts`).
 */
export interface Pic { blob: Blob; url: string; w: number; h: number }

export async function picFromBlob(blob: Blob): Promise<Pic> {
  const bmp = await createImageBitmap(blob);
  const pic = { blob, url: URL.createObjectURL(blob), w: bmp.width, h: bmp.height };
  bmp.close();
  return pic;
}

async function draw(blob: Blob, w: number, h: number, paint: (g: CanvasRenderingContext2D, bmp: ImageBitmap) => void): Promise<Pic> {
  const bmp = await createImageBitmap(blob);
  try {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    paint(g, bmp);
    const out = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not encode the picture'))), 'image/png'));
    return { blob: out, url: URL.createObjectURL(out), w, h };
  } finally { bmp.close(); }
}

/** Rotate a quarter turn: 1 = clockwise, -1 = counter-clockwise. */
export function rotate90(p: Pic, dir: 1 | -1 = 1): Promise<Pic> {
  return draw(p.blob, p.h, p.w, (g, bmp) => {
    g.translate(p.h / 2, p.w / 2);
    g.rotate((dir * Math.PI) / 2);
    g.drawImage(bmp, -p.w / 2, -p.h / 2);
  });
}

export function flip(p: Pic, axis: 'h' | 'v'): Promise<Pic> {
  return draw(p.blob, p.w, p.h, (g, bmp) => {
    if (axis === 'h') { g.translate(p.w, 0); g.scale(-1, 1); } else { g.translate(0, p.h); g.scale(1, -1); }
    g.drawImage(bmp, 0, 0);
  });
}

export function cropPic(p: Pic, r: { x: number; y: number; w: number; h: number }): Promise<Pic> {
  const w = Math.max(1, Math.round(r.w)), h = Math.max(1, Math.round(r.h));
  return draw(p.blob, w, h, (g, bmp) => g.drawImage(bmp, Math.round(r.x), Math.round(r.y), w, h, 0, 0, w, h));
}
