/**
 * Tag browsing (models-picker brief, item 4). Tags are plain strings on a model. Import-free so
 * `tests/models-tags.test.cjs` can require it.
 *
 *   - TAG_GROUPS: a static grouping of CivitAI's common tags (the API has no categories);
 *     `groupTags` fills each group from the loaded models and adds "Most used" for the rest.
 *   - `rankByTags`: pick tags → models that carry them first (by how many), then models whose
 *     tag sets overlap the picked tags' neighbourhood (tags that co-occur with them), by overlap.
 *   - `matchesText`: the search box also matches tags (and the creator).
 */

export interface TaggedModel { id: number; name?: string; tags?: string[]; creator?: { username?: string } | null }

export const TAG_GROUPS: Record<string, readonly string[]> = {
  Style: ['style', 'anime', 'realistic', 'photorealistic', 'illustration', 'cartoon', '3d', 'digital art', 'painting', 'watercolor', 'oil painting', 'pixel art', 'sketch', 'line art', 'comic', 'manga', 'retro', 'vintage', 'cinematic', 'film', 'aesthetic', 'semi-realistic', '2.5d', 'flat color', 'cel shading', 'chibi', 'furry', 'noir', 'cyberpunk', 'fantasy', 'sci-fi', 'horror', 'gothic', 'surreal', 'minimalist', 'graphic design', 'photography', 'art style', 'artist', 'artstyle'],
  Character: ['character', 'celebrity', 'person', 'woman', 'man', 'girl', 'boy', 'girls', 'portrait', 'portraits', 'face', 'actress', 'model', 'idol', 'vtuber', 'oc', 'original character', 'game character', 'anime character', 'mascot', 'creature', 'monster', 'robot', 'mecha', 'animal', 'cat', 'dog', 'dragon', 'elf', 'demon', 'angel', 'vampire', 'cosplay', 'real person'],
  Concept: ['concept', 'concepts', 'scene', 'landscape', 'background', 'architecture', 'building', 'city', 'nature', 'space', 'vehicle', 'car', 'weapon', 'food', 'detail', 'detail enhancer', 'lighting', 'composition', 'camera', 'perspective', 'expression', 'emotion', 'action', 'slider', 'enhancer', 'quality', 'hands', 'eyes', 'hair', 'skin', 'texture', 'effect', 'magic', 'fire', 'water', 'rain', 'snow', 'night', 'abstract', 'pattern', 'interior', 'exterior'],
  Clothing: ['clothing', 'clothes', 'outfit', 'dress', 'uniform', 'school uniform', 'swimsuit', 'bikini', 'lingerie', 'armor', 'armour', 'costume', 'fashion', 'jacket', 'shirt', 'skirt', 'kimono', 'maid', 'suit', 'hoodie', 'jeans', 'shoes', 'boots', 'hat', 'glasses', 'accessories', 'jewelry', 'mask', 'underwear', 'sportswear', 'military', 'streetwear', 'latex', 'leather', 'wedding dress'],
  Pose: ['pose', 'poses', 'posing', 'sitting', 'standing', 'lying', 'kneeling', 'walking', 'running', 'dancing', 'jumping', 'fighting', 'selfie', 'from behind', 'from above', 'from below', 'close-up', 'full body', 'upper body', 'dynamic pose', 'looking at viewer', 'hand gesture', 'openpose', 'controlnet'],
  Tool: ['tool', 'tools', 'utility', 'helper', 'upscaler', 'upscale', 'vae', 'negative embedding', 'negative', 'embedding', 'textual inversion', 'lora', 'lycoris', 'hypernetwork', 'workflow', 'comfyui', 'wildcards', 'detailer', 'adetailer', 'inpainting', 'inpaint', 'img2img', 'merge', 'base model', 'trained', 'motion', 'animatediff', 'video', 'lcm', 'turbo', 'lightning', 'hyper', 'dmd', 'speed', 'fix', 'enhancement'],
  Base: ['sd1.5', 'sd 1.5', 'sdxl', 'sdxl 1.0', 'pony', 'pony diffusion', 'illustrious', 'noobai', 'flux', 'flux.1', 'sd3', 'sd 3.5', 'wan', 'wan video', 'hunyuan', 'hunyuan video', 'minimax', 'z-image', 'zimage', 'qwen', 'anima', 'cascade', 'pixart', 'auraflow', 'kolors', 'hidream', 'chroma', 'ltx'],
};
export const MOST_USED = 'Most used';
export const GROUP_ORDER: readonly string[] = [...Object.keys(TAG_GROUPS), MOST_USED];

const norm = (t: string) => t.trim().toLowerCase();

/** Which static group a tag belongs to (undefined when none). */
export function groupOf(tag: string): string | undefined {
  const t = norm(tag);
  for (const [g, list] of Object.entries(TAG_GROUPS)) if (list.includes(t)) return g;
  return undefined;
}

export interface TagCount { tag: string; count: number }
export interface TagGroup { group: string; tags: TagCount[] }

/** Count every tag across the models (normalised, case folded). */
export function countTags(models: readonly TaggedModel[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const m of models) for (const raw of new Set((m.tags ?? []).map(norm))) if (raw) counts.set(raw, (counts.get(raw) ?? 0) + 1);
  return counts;
}

/**
 * The tag groups for the loaded models: each static group lists its tags that appear (most used
 * first), "Most used" lists the rest. `selected` tags always show, even with count 0, so a chip
 * can be removed where it was picked. Empty groups are left out.
 */
export function groupTags(models: readonly TaggedModel[], opts: { limit?: number; selected?: readonly string[] } = {}): TagGroup[] {
  const limit = opts.limit ?? 24;
  const counts = countTags(models);
  for (const s of opts.selected ?? []) if (!counts.has(norm(s))) counts.set(norm(s), 0);
  const byGroup = new Map<string, TagCount[]>();
  for (const [tag, count] of counts) {
    const g = groupOf(tag) ?? MOST_USED;
    const list = byGroup.get(g) ?? [];
    list.push({ tag, count });
    byGroup.set(g, list);
  }
  const out: TagGroup[] = [];
  for (const g of GROUP_ORDER) {
    const list = byGroup.get(g);
    if (!list?.length) continue;
    list.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
    out.push({ group: g, tags: list.slice(0, limit) });
  }
  return out;
}

export interface Ranked<M> { model: M; score: number; direct: number }

/**
 * Rank models by the picked tags. A model carrying n of the picked tags scores n (direct); any
 * other model scores by how much its tag set overlaps the neighbourhood — the tags that co-occur
 * with the picked ones on the direct models — weighted by co-occurrence, always below 1 so a
 * direct match sorts first. Models with no overlap at all are dropped. Order is stable otherwise.
 */
export function rankByTags<M extends TaggedModel>(models: readonly M[], selected: readonly string[]): Ranked<M>[] {
  const picked = new Set(selected.map(norm).filter(Boolean));
  if (!picked.size) return models.map((model) => ({ model, score: 0, direct: 0 }));
  const sets = models.map((m) => new Set((m.tags ?? []).map(norm)));
  // 1. direct matches and the neighbourhood they define
  const direct = sets.map((s) => { let n = 0; for (const t of picked) if (s.has(t)) n++; return n; });
  const co = new Map<string, number>();
  sets.forEach((s, i) => { if (direct[i] > 0) for (const t of s) if (!picked.has(t)) co.set(t, (co.get(t) ?? 0) + 1); });
  const max = Math.max(1, ...co.values());
  // 2. score
  const out: Ranked<M>[] = [];
  models.forEach((model, i) => {
    let score = direct[i];
    if (score === 0) {
      let sum = 0;
      for (const t of sets[i]) { const w = co.get(t); if (w) sum += w / max; }
      if (sum === 0) return;
      score = Math.min(0.999, sum / (sum + 1)); // 0..1, below any direct match
    } else {
      // a direct match with more of the neighbourhood sorts above one with less
      let sum = 0;
      for (const t of sets[i]) { const w = co.get(t); if (w) sum += w / max; }
      score += Math.min(0.999, sum / (sum + 1)) * 0.5;
    }
    out.push({ model, score, direct: direct[i] });
  });
  out.sort((a, b) => b.score - a.score);
  return out;
}

/** Does the model match free text in its name, a tag or its creator? */
/**
 * The local search of a source that is not CivitAI (Downloaded, Favourites, Account ★; fix list 2,
 * added item: "the search runs INSIDE the chosen source"): name, creator, tags, version names,
 * file names, base models.
 */
export function matchesLocal(m: TaggedModel & { modelVersions?: ReadonlyArray<{ name?: string; baseModel?: string; files?: ReadonlyArray<{ name?: string }> }> }, q: string): boolean {
  const s = norm(q);
  if (!s) return true;
  if (matchesText(m, q)) return true;
  return (m.modelVersions ?? []).some((v) => (v.name ?? '').toLowerCase().includes(s) || (v.baseModel ?? '').toLowerCase().includes(s)
    || (v.files ?? []).some((f) => (f.name ?? '').toLowerCase().includes(s)));
}

export function matchesText(m: TaggedModel, q: string): boolean {
  const s = norm(q);
  if (!s) return true;
  if ((m.name ?? '').toLowerCase().includes(s)) return true;
  if ((m.creator?.username ?? '').toLowerCase().includes(s)) return true;
  return (m.tags ?? []).some((t) => norm(t).includes(s));
}
