/**
 * Who owns a ComfyUI prompt id, so a run store does not file another part's results as its own.
 * The run stores (`comfyRunner`) pick up finished prompts they did not queue — runs from the
 * ComfyUI editor, other tabs — but the generate store's image jobs are already in the image
 * history, and taking them too drew every picture twice. Imports nothing: the store registers its
 * check here (`setImageJobCheck`) and `comfyRunner` asks (`isImageJob`), with no import cycle.
 */
let check: (promptId: string) => boolean = () => false;

export function setImageJobCheck(fn: (promptId: string) => boolean): void { check = fn; }

/** True when the generate store queued this prompt (a job in flight or an entry in its history). */
export function isImageJob(promptId: string | null | undefined): boolean {
  return !!promptId && check(promptId);
}

/**
 * The app's own picture tools save into output/imagelab/ as `edit_*` (next/ Edit mode: its ComfyUI
 * tools and Save) and `removebg_*` (Remove BG). Those results go into the image history by the code
 * that ran them; a run store that also adopted them showed every saved edit twice (one copy could
 * not be favourited — next fix list 2, "Edit mode save creates duplicates"). Checked by file, not
 * prompt id: the `executed` event can arrive before the queue call returns the id.
 */
export function isAppToolFile(img: { filename?: string; subfolder?: string } | null | undefined): boolean {
  if (!img?.filename) return false;
  const sub = (img.subfolder ?? '').replace(/\\/g, '/').replace(/\/+$/, '');
  return sub === 'imagelab' && /^(edit|removebg)_\d/.test(img.filename);
}
