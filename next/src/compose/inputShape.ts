/**
 * The Composition tab's From image picture (fix list 2 item 34), kept in memory only:
 *   - the picture set aside while "New image" is on (the switch back brings it back);
 *   - the shape it was cropped to: a shape chip centre-crops the picture (img2img keeps the input's
 *     shape, so the crop is how the output gets that shape); "Picture" gives the original back.
 * The crop is valid only while `workflow.inputImage` is still the picture it made (a new picture,
 * an Edit, a reload → "Picture", the picture as it is now).
 */
import { create } from 'zustand';
import { useStore } from '@/lib/store';
import { cropRect, ratioById } from './sizeLogic';

export interface Pic { dataUrl: string; name: string; width: number; height: number }

interface ShapeState {
  /** The picture set aside by "New image". */
  stash: Pic | null;
  /** The uncropped picture, the shape chosen, and the data URL of the crop it made. */
  original: Pic | null;
  shape: string | null;
  cropped: string | null;
}

export const useInputShape = create<ShapeState>(() => ({ stash: null, original: null, shape: null, cropped: null }));

/** The shape chip lit for this picture: a ratio id, or 'picture' (its own shape). */
export function shapeOf(s: ShapeState, input: Pic | null): string {
  return input && s.shape && s.cropped === input.dataUrl ? s.shape : 'picture';
}

/** The uncropped picture behind this one. */
export function originalOf(s: ShapeState, input: Pic): Pic {
  return s.original && s.cropped === input.dataUrl ? s.original : input;
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('Could not read the picture')); i.src = src; });
}

async function crop(pic: Pic, id: string): Promise<Pic> {
  const r = ratioById(id);
  const img = await load(pic.dataUrl);
  const c = cropRect(img.naturalWidth, img.naturalHeight, r.w, r.h);
  const canvas = document.createElement('canvas');
  canvas.width = c.width; canvas.height = c.height;
  canvas.getContext('2d')!.drawImage(img, c.x, c.y, c.width, c.height, 0, 0, c.width, c.height);
  const jpeg = /^data:image\/jpe?g/i.test(pic.dataUrl);
  return { dataUrl: canvas.toDataURL(jpeg ? 'image/jpeg' : 'image/png', 0.95), name: pic.name, width: c.width, height: c.height };
}

/** A shape chip in From image: crop the original to it ('picture' = the original back). */
export async function setInputShape(id: string): Promise<void> {
  const input = useStore.getState().workflow.inputImage;
  if (!input) return;
  const s = useInputShape.getState();
  const orig = originalOf(s, input);
  if (id === 'picture') {
    useInputShape.setState({ original: null, shape: null, cropped: null });
    if (orig !== input) useStore.getState().setWorkflow({ inputImage: orig });
    return;
  }
  const out = await crop(orig, id);
  useInputShape.setState({ original: orig, shape: id, cropped: out.dataUrl });
  useStore.getState().setWorkflow({ inputImage: out });
}

/** "New image": set the picture aside (txt2img needs no input). "From image": bring it back. */
export function setCompositionMode(mode: 'new' | 'from'): void {
  const st = useStore.getState();
  const input = st.workflow.inputImage;
  if (mode === 'new') {
    if (input) { useInputShape.setState({ stash: input }); st.setWorkflow({ inputImage: null }); }
    return;
  }
  const { stash } = useInputShape.getState();
  if (!input && stash) { useInputShape.setState({ stash: null }); st.setWorkflow({ inputImage: stash }); }
}
