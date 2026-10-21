/**
 * FIXLIST-2 (late item, live previews on winold): which live-preview method a ComfyUI server
 * really uses. `--preview-method` (from `/system_stats` → `system.argv`) says what was asked for;
 * TAESD (or `auto`) needs decoder files in `models/vae_approx` (`GET /models/vae_approx`), and
 * without them ComfyUI silently falls back to latent2rgb (a blurry 1/8-size colour guess).
 * Pure, tested in tests/comfyPreview.test.cjs. The app only reads; Donny installs the files.
 */
export type PreviewArg = 'auto' | 'latent2rgb' | 'taesd' | 'none';

/** `--preview-method X` / `--preview-method=X` in ComfyUI's argv; unset = ComfyUI's default, none. */
export function previewArg(argv: unknown): PreviewArg {
  if (!Array.isArray(argv)) return 'none';
  const args = argv.map(String);
  let v: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--preview-method') v = args[i + 1];
    else if (a.startsWith('--preview-method=')) v = a.slice('--preview-method='.length);
  }
  const m = (v ?? '').toLowerCase();
  return m === 'auto' || m === 'latent2rgb' || m === 'taesd' ? m : 'none';
}

/** The decoders ComfyUI looks for (any of .pth / .safetensors). */
const DECODERS = { sd: 'taesd_decoder', sdxl: 'taesdxl_decoder', sd3: 'taesd3_decoder', flux: 'taef1_decoder' } as const;
const has = (files: readonly string[], base: string) => files.some((f) => f.toLowerCase().replace(/^.*[\\/]/, '').startsWith(base));

export const PREVIEW_FIX_HINT = 'Add taesd_decoder.pth + taesdxl_decoder.pth to models/vae_approx and restart ComfyUI';

export interface PreviewInfo {
  /** What the server really does. */
  method: 'taesd' | 'latent2rgb' | 'none';
  /** "TAESD", "TAESD (no SDXL)", "latent2rgb (fallback)", "latent2rgb", "Off". */
  label: string;
  /** Previews are worse than they should be (fallback, or a decoder missing). */
  poor: boolean;
  /** Short fix, when there is one. */
  hint: string | null;
}

export function previewInfo(arg: PreviewArg, vaeApprox: readonly string[]): PreviewInfo {
  if (arg === 'none') return { method: 'none', label: 'Off', poor: false, hint: null };
  if (arg === 'latent2rgb') return { method: 'latent2rgb', label: 'latent2rgb', poor: true, hint: 'Start ComfyUI with --preview-method taesd for sharp previews' };
  const sd = has(vaeApprox, DECODERS.sd);
  const xl = has(vaeApprox, DECODERS.sdxl);
  if (!sd && !xl) return { method: 'latent2rgb', label: 'latent2rgb (fallback)', poor: true, hint: PREVIEW_FIX_HINT };
  if (!xl) return { method: 'taesd', label: 'TAESD (no SDXL)', poor: true, hint: 'Add taesdxl_decoder.pth to models/vae_approx and restart ComfyUI' };
  if (!sd) return { method: 'taesd', label: 'TAESD (no SD 1.5)', poor: true, hint: 'Add taesd_decoder.pth to models/vae_approx and restart ComfyUI' };
  return { method: 'taesd', label: 'TAESD', poor: false, hint: null };
}
