/**
 * Human error text (fix list 2, item 12): a raw error → one plain sentence + the raw text kept for
 * the toast's "Details". Pure, tested in `tests/notify.test.cjs`.
 */

export interface HumanError { text: string; detail: string }

const RULES: Array<[RegExp, string]> = [
  [/failed to fetch|networkerror|network request failed|load failed|ERR_CONNECTION|ECONNREFUSED/i, 'Could not reach the server. Is it running?'],
  [/timed? ?out|timeout/i, 'The server took too long to answer.'],
  [/\b401\b|unauthori[sz]ed/i, 'The server refused the login. Check the key or password in Settings.'],
  [/\b403\b|forbidden/i, 'The server said no (not allowed).'],
  [/\b404\b|not found/i, 'The server could not find it.'],
  [/\b413\b|too large/i, 'The file is too big for the server.'],
  [/\b5\d\d\b|internal server error|bad gateway|service unavailable/i, 'The server had a problem. Try again in a moment.'],
  [/value_not_in_list|not in list|missing.*(model|file)|no such file/i, 'A model or file is missing on the server.'],
  [/node.*(does not exist|not found|missing)|missing_node|unknown node|class_type/i, 'A ComfyUI node is missing on the server.'],
  [/out of memory|OOM|CUDA error/i, 'The GPU ran out of memory. Try a smaller size or batch.'],
  [/clipboard|NotAllowedError|permission/i, 'The browser did not allow it.'],
  [/quota|QuotaExceeded/i, 'The browser storage is full.'],
  [/unexpected token|JSON/i, 'The answer was not readable.'],
  [/abort/i, 'It was cancelled.'],
];

/** The raw text of anything thrown. */
export function rawError(err: unknown): string {
  if (err == null) return '';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || err.name;
  try { return JSON.stringify(err); } catch { return String(err); }
}

/** One plain sentence for the user + the raw text (empty when the sentence already is it). */
export function humanError(err: unknown): HumanError {
  const detail = rawError(err).trim();
  if (!detail) return { text: '', detail: '' };
  for (const [re, text] of RULES) if (re.test(detail)) return { text, detail };
  // Already short and plain (no stack, no code-ish characters): show it as is.
  if (detail.length <= 90 && !/[{}<>[\]]|\n|Error:/.test(detail)) return { text: detail, detail: '' };
  return { text: 'Something went wrong.', detail };
}
