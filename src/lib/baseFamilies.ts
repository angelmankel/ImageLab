// Base-model families: CivitAI splits one family over many `baseModel` labels (Wan alone has
// nine), so a phone filter of raw labels is a wall of chips. A family is one chip that stands for
// all of its labels. Pure, imports nothing (tests load it straight from source).

export type BaseFamily = {
  id: string;
  label: string;
  /** CivitAI's `baseModels` labels, sent as-is (the API ignores ones it does not know). */
  bases: string[];
  /** Catches labels missing from `bases` — new versions, or a library entry saved long ago. */
  match: RegExp;
};

export const BASE_FAMILIES: BaseFamily[] = [
  { id: 'illustrious', label: 'Illustrious', bases: ['Illustrious', 'Illustrious 1.0'], match: /^illustrious/i },
  { id: 'pony', label: 'Pony', bases: ['Pony', 'Pony V7'], match: /^pony/i },
  { id: 'noobai', label: 'NoobAI', bases: ['NoobAI'], match: /^noob/i },
  { id: 'sdxl', label: 'SDXL', bases: ['SDXL 1.0', 'SDXL Lightning', 'SDXL Turbo', 'SDXL Hyper'], match: /^sdxl/i },
  { id: 'sd15', label: 'SD 1.5', bases: ['SD 1.5', 'SD 1.5 LCM', 'SD 1.5 Hyper'], match: /^sd 1\./i },
  {
    id: 'wan', label: 'Wan',
    bases: [
      'Wan Video 2.2 T2V-A14B', 'Wan Video 2.2 I2V-A14B', 'Wan Video 2.2 TI2V-5B', 'Wan Video 14B t2v',
      'Wan Video 14B i2v 480p', 'Wan Video 14B i2v 720p', 'Wan Video 1.3B t2v', 'Wan Video 2.5 T2V',
      'Wan Video 2.5 I2V', 'Wan Video 2.7', 'Wan Image 2.7',
    ],
    match: /^wan /i,
  },
  { id: 'flux', label: 'Flux.1', bases: ['Flux.1 D', 'Flux.1 S', 'Flux.1 Krea', 'Flux.1 Kontext'], match: /^flux\.1/i },
  { id: 'flux2', label: 'Flux.2', bases: ['Flux.2 D', 'Flux.2 Klein 9B', 'Flux.2 Klein 4B'], match: /^flux\.2/i },
  { id: 'zimage', label: 'Z-Image', bases: ['ZImageTurbo', 'ZImageBase'], match: /^z-?image/i },
  { id: 'qwen', label: 'Qwen', bases: ['Qwen', 'Qwen 2'], match: /^qwen/i },
  { id: 'anima', label: 'Anima', bases: ['Anima'], match: /^anima/i },
  { id: 'chroma', label: 'Chroma', bases: ['Chroma'], match: /^chroma/i },
  { id: 'hidream', label: 'HiDream', bases: ['HiDream'], match: /^hidream/i },
  { id: 'hunyuan', label: 'Hunyuan', bases: ['Hunyuan Video', 'Hunyuan 1'], match: /^hunyuan/i },
  { id: 'ltxv', label: 'LTX Video', bases: ['LTXV', 'LTXV2', 'LTXV 2.3'], match: /^ltxv/i },
  { id: 'sd3', label: 'SD 3', bases: ['SD 3', 'SD 3.5'], match: /^sd 3/i },
];

/** The family a label belongs to, or undefined (then the label is its own group). */
export function familyOf(base: string): BaseFamily | undefined {
  const b = base.trim();
  if (!b) return undefined;
  return BASE_FAMILIES.find((f) => f.bases.includes(b)) ?? BASE_FAMILIES.find((f) => f.match.test(b));
}

/** The group name a library filter shows for a label: the family's label, else the label itself. */
export function baseGroupOf(base: string): string {
  return familyOf(base)?.label ?? base.trim();
}

/** A family chip is on when every one of its labels is picked. */
export function familyPicked(picked: string[], f: BaseFamily): boolean {
  return f.bases.every((b) => picked.includes(b));
}

/** Turns a whole family on or off in a picked-labels list, keeping the order of the rest. */
export function toggleFamily(picked: string[], f: BaseFamily): string[] {
  if (familyPicked(picked, f)) return picked.filter((b) => !f.bases.includes(b));
  return [...picked, ...f.bases.filter((b) => !picked.includes(b))];
}
