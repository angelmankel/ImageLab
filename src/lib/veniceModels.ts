// Venice's chat models, for a picker instead of a free-text id. `GET /models?type=text` is public
// (no key, CORS open). The parse is pure and tested; the fetch is the one line that is not.

export type VeniceModel = {
  id: string;
  name: string;
  vision: boolean;
  /** Venice marks its least filtered models `most_uncensored`, or says so in the name. */
  uncensored: boolean;
  /** USD per million input tokens, when listed. */
  price?: number;
  context?: number;
};

type Raw = { id?: unknown; type?: unknown; model_spec?: Record<string, unknown> };

/** The usable text models from Venice's /models answer: uncensored first, then by name. */
export function parseVeniceModels(json: unknown): VeniceModel[] {
  const data = (json as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];
  const out: VeniceModel[] = [];
  for (const r of data as Raw[]) {
    if (typeof r?.id !== 'string' || !r.id || (r.type && r.type !== 'text')) continue;
    const spec = r.model_spec ?? {};
    if (spec.offline === true) continue;
    const name = typeof spec.name === 'string' && spec.name ? spec.name : r.id;
    const traits = Array.isArray(spec.traits) ? spec.traits : [];
    const caps = (spec.capabilities ?? {}) as Record<string, unknown>;
    const price = ((spec.pricing as Record<string, unknown> | undefined)?.input as Record<string, unknown> | undefined)?.usd;
    out.push({
      id: r.id,
      name,
      vision: caps.supportsVision === true,
      uncensored: traits.includes('most_uncensored') || /uncensored|abliterated|heretic/i.test(`${r.id} ${name}`),
      ...(typeof price === 'number' ? { price } : {}),
      ...(typeof spec.availableContextTokens === 'number' ? { context: spec.availableContextTokens } : {}),
    });
  }
  return out.sort((a, b) => Number(b.uncensored) - Number(a.uncensored) || a.name.localeCompare(b.name, undefined, { numeric: true }));
}

/** One line for a picker: "Venice Uncensored 1.2 · uncensored · vision · $0.20/M". */
export function veniceModelLabel(m: VeniceModel): string {
  return [m.name, m.uncensored && 'uncensored', m.vision && 'vision', m.price != null && `$${m.price}/M`].filter(Boolean).join(' · ');
}

export async function fetchVeniceModels(baseUrl: string, signal?: AbortSignal): Promise<VeniceModel[]> {
  const r = await fetch(`${baseUrl.replace(/\/+$/, '')}/models?type=text`, { signal });
  if (!r.ok) throw new Error(`Venice answered ${r.status}`);
  return parseVeniceModels(await r.json());
}
