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
