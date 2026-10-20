/**
 * The AI helper's providers, the pure part (tested in tests/ai-providers.test.cjs; imports nothing).
 *
 * A user adds providers from the SUPPORTED catalogue below; Local (Ollama) is always there and
 * cannot be removed. Exactly one is active and it is the only one called — no fallback chain.
 * Each entry keeps its own key, model, vision model and base URL, and whether a Test passed with
 * that key (`tested`; reset when the key or the URL changes).
 *
 * Two wire shapes: nearly everyone speaks OpenAI's chat-completions (`openai` adapter, with a
 * few per-provider quirks), Anthropic has its Messages API (`anthropic`), and Ollama is OpenAI's
 * shape at `/v1` plus its own `/api/tags` for the model list (`ollama`). `chatRequest` /
 * `modelsRequest` build the fetch; `parseModels` / `parseChatReply` read the answers.
 */

export type AiProviderId =
  | 'local' | 'venice' | 'openrouter' | 'openai' | 'anthropic' | 'deepseek' | 'gemini' | 'groq' | 'mistral' | 'xai' | 'together';

export type AiAdapter = 'openai' | 'anthropic' | 'ollama';

/** Which prompt-style ruleset the AI helpers target: generic comma-separated SDXL prose, or
 *  Arctenox's Illustrious / Danbooru conventions. */
export type PromptStyle = 'sdxl' | 'illustrious';

export type AiProviderSpec = {
  id: AiProviderId;
  name: string;
  adapter: AiAdapter;
  /** The API root; the entry's `baseUrl` starts as this and may be edited. */
  baseUrl: string;
  /** Appended to the base URL for the model list / the chat call. */
  modelsPath: string;
  chatPath: string;
  /** Where a key is made. */
  keyUrl?: string;
  keyPlaceholder?: string;
  /** Whether the provider has image-reading models at all (DeepSeek has none). */
  vision: boolean;
  /** Shown on the provider's page: CORS findings, what the list is filtered to. */
  note: string;
};

export const AI_PROVIDERS: readonly AiProviderSpec[] = [
  {
    id: 'local', name: 'Local', adapter: 'ollama', baseUrl: 'https://llm.blueoceanswim.com', modelsPath: '/api/tags', chatPath: '/v1/chat/completions',
    vision: true, note: 'An Ollama server: the home PC behind llm.blueoceanswim.com, the Ollama this pod runs itself, or any address. No key.',
  },
  {
    id: 'openrouter', name: 'OpenRouter', adapter: 'openai', baseUrl: 'https://openrouter.ai/api/v1', modelsPath: '/models', chatPath: '/chat/completions',
    keyUrl: 'https://openrouter.ai/settings/keys', keyPlaceholder: 'sk-or-…', vision: true,
    note: 'Hundreds of models from every lab behind one key; the list says which read images. Browser calls allowed (CORS *).',
  },
  {
    id: 'openai', name: 'OpenAI', adapter: 'openai', baseUrl: 'https://api.openai.com/v1', modelsPath: '/models', chatPath: '/chat/completions',
    keyUrl: 'https://platform.openai.com/api-keys', keyPlaceholder: 'sk-…', vision: true,
    note: 'GPT and o-series chat models (audio, image, embedding and realtime models are left out). Browser calls allowed (CORS *).',
  },
  {
    id: 'anthropic', name: 'Anthropic', adapter: 'anthropic', baseUrl: 'https://api.anthropic.com', modelsPath: '/v1/models', chatPath: '/v1/messages',
    keyUrl: 'https://console.anthropic.com/settings/keys', keyPlaceholder: 'sk-ant-…', vision: true,
    note: 'Claude, through the Messages API. Every Claude model reads images. Browser calls allowed with the direct-browser-access header (CORS *).',
  },
  {
    id: 'deepseek', name: 'DeepSeek', adapter: 'openai', baseUrl: 'https://api.deepseek.com', modelsPath: '/models', chatPath: '/chat/completions',
    keyUrl: 'https://platform.deepseek.com/api_keys', keyPlaceholder: 'sk-…', vision: false,
    note: 'deepseek-chat and deepseek-reasoner; no image models. Browser calls allowed (CORS echoes the origin).',
  },
  {
    id: 'gemini', name: 'Google Gemini', adapter: 'openai', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', modelsPath: '/models', chatPath: '/chat/completions',
    keyUrl: 'https://aistudio.google.com/apikey', keyPlaceholder: 'AIza…', vision: true,
    note: "Gemini's OpenAI-compatible endpoint. Gemini models read images. Browser calls allowed (CORS echoes the origin).",
  },
  {
    id: 'groq', name: 'Groq', adapter: 'openai', baseUrl: 'https://api.groq.com/openai/v1', modelsPath: '/models', chatPath: '/chat/completions',
    keyUrl: 'https://console.groq.com/keys', keyPlaceholder: 'gsk_…', vision: true,
    note: 'Fast open models (Llama, Qwen, Kimi…); speech and guard models are left out. Browser calls allowed (CORS *).',
  },
  {
    id: 'mistral', name: 'Mistral', adapter: 'openai', baseUrl: 'https://api.mistral.ai/v1', modelsPath: '/models', chatPath: '/chat/completions',
    keyUrl: 'https://console.mistral.ai/api-keys', vision: true,
    note: 'Chat models only, from what the API marks completion_chat; Pixtral and the Small 3+ models read images. Browser calls allowed (CORS *).',
  },
  {
    id: 'xai', name: 'xAI', adapter: 'openai', baseUrl: 'https://api.x.ai/v1', modelsPath: '/models', chatPath: '/chat/completions',
    keyUrl: 'https://console.x.ai', keyPlaceholder: 'xai-…', vision: true,
    note: 'Grok. Image-generation models are left out; Grok 4 and the vision models read images. Browser calls allowed (CORS *).',
  },
  {
    id: 'together', name: 'Together', adapter: 'openai', baseUrl: 'https://api.together.xyz/v1', modelsPath: '/models', chatPath: '/chat/completions',
    keyUrl: 'https://api.together.ai/settings/api-keys', vision: true,
    note: "Open models; the list is what Together types as chat. Browser calls allowed (CORS *).",
  },
  {
    id: 'venice', name: 'Venice', adapter: 'openai', baseUrl: 'https://api.venice.ai/api/v1', modelsPath: '/models?type=text', chatPath: '/chat/completions',
    keyUrl: 'https://venice.ai/settings/api', keyPlaceholder: 'vn-…', vision: true,
    note: 'Uncensored models first. Venice gets no system prompt of its own and no web search from here. Browser calls allowed (CORS *).',
  },
];

export const AI_PROVIDER_IDS: readonly AiProviderId[] = AI_PROVIDERS.map((p) => p.id);

export function providerSpec(id: AiProviderId): AiProviderSpec {
  return AI_PROVIDERS.find((p) => p.id === id) ?? AI_PROVIDERS[0];
}

export function isProviderId(id: unknown): id is AiProviderId {
  return typeof id === 'string' && (AI_PROVIDER_IDS as readonly string[]).includes(id);
}

// --- the saved shape -------------------------------------------------------------------------

export type AiProviderEntry = {
  id: AiProviderId;
  /** Empty for Local. */
  apiKey: string;
  /** The chat model id. */
  model: string;
  /** The model for the image helpers; '' = same as `model`. */
  visionModel: string;
  /** The API root; '' = the catalogue default. Local: the Ollama root, no /v1. */
  baseUrl: string;
  /** A Test passed with this key and URL (Local: the server answered). */
  tested: boolean;
};

export type AiSettings = {
  active: AiProviderId;
  /** Local first, then the added providers in the order they were added. */
  providers: AiProviderEntry[];
  /** Applied to every helper. */
  promptStyle: PromptStyle;
  /** GPU memory of the Ollama box, for the model browser's "fits" hint. */
  localVramGb: number;
};

export const VENICE_DEFAULT_MODEL = 'venice-uncensored';

export function newProviderEntry(id: AiProviderId): AiProviderEntry {
  return { id, apiKey: '', model: '', visionModel: '', baseUrl: providerSpec(id).baseUrl, tested: false };
}

export function defaultAiSettings(): AiSettings {
  return { active: 'local', providers: [newProviderEntry('local')], promptStyle: 'sdxl', localVramGb: 20 };
}

/** What `imagelab.venice.v1` held before providers existed. */
export type LegacyVeniceSettings = {
  apiKey?: string; model?: string; baseUrl?: string; promptStyle?: string; provider?: string;
  localBaseUrl?: string; localModel?: string; localVisionModel?: string; localVramGb?: number;
};

/**
 * The old single-provider save as a provider list: the Local entry always (its URL, text and
 * vision models), a Venice entry when a key was saved, and active = whatever `provider` was.
 * A Venice key that was in use counts as tested — it worked yesterday, and `aiReady` used to be
 * just "has a key"; the first Test with a changed key starts from scratch as for any provider.
 */
export function migrateVeniceSettings(old: LegacyVeniceSettings | null | undefined): AiSettings {
  const o = old ?? {};
  const local: AiProviderEntry = {
    ...newProviderEntry('local'),
    baseUrl: (o.localBaseUrl ?? '').trim() || providerSpec('local').baseUrl,
    model: o.localModel ?? '',
    visionModel: o.localVisionModel ?? '',
    tested: !!(o.localModel ?? ''),
  };
  const providers = [local];
  const key = (o.apiKey ?? '').trim();
  if (key) {
    providers.push({
      ...newProviderEntry('venice'),
      apiKey: key,
      model: o.model || VENICE_DEFAULT_MODEL,
      baseUrl: (o.baseUrl ?? '').trim() || providerSpec('venice').baseUrl,
      tested: true,
    });
  }
  return {
    active: o.provider === 'local' || !key ? 'local' : 'venice',
    providers,
    promptStyle: o.promptStyle === 'illustrious' ? 'illustrious' : 'sdxl',
    localVramGb: typeof o.localVramGb === 'number' && o.localVramGb > 0 ? o.localVramGb : 20,
  };
}

/** A saved `AiSettings` made whole: Local present and first, unknown providers dropped, every
 *  field typed, the active id one of the entries. */
export function normalizeAiSettings(raw: unknown): AiSettings {
  const d = defaultAiSettings();
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<AiSettings>;
  const seen = new Set<string>();
  const providers: AiProviderEntry[] = [];
  for (const e of Array.isArray(r.providers) ? r.providers : []) {
    if (!e || typeof e !== 'object' || !isProviderId((e as AiProviderEntry).id) || seen.has((e as AiProviderEntry).id)) continue;
    const p = e as Partial<AiProviderEntry> & { id: AiProviderId };
    seen.add(p.id);
    providers.push({
      id: p.id,
      apiKey: typeof p.apiKey === 'string' ? p.apiKey : '',
      model: typeof p.model === 'string' ? p.model : '',
      visionModel: typeof p.visionModel === 'string' ? p.visionModel : '',
      baseUrl: typeof p.baseUrl === 'string' ? p.baseUrl : providerSpec(p.id).baseUrl,
      tested: p.tested === true,
    });
  }
  if (!seen.has('local')) providers.unshift(newProviderEntry('local'));
  else providers.sort((a, b) => Number(b.id === 'local') - Number(a.id === 'local'));
  const active = isProviderId(r.active) && seen.has(r.active) ? r.active : 'local';
  return {
    active,
    providers,
    promptStyle: r.promptStyle === 'illustrious' ? 'illustrious' : d.promptStyle,
    localVramGb: typeof r.localVramGb === 'number' && r.localVramGb > 0 ? r.localVramGb : d.localVramGb,
  };
}

// --- reading and changing the settings -------------------------------------------------------

export function providerEntry(s: AiSettings, id: AiProviderId): AiProviderEntry | undefined {
  return s.providers.find((p) => p.id === id);
}

/** The Local entry (always there). */
export function localEntry(s: AiSettings): AiProviderEntry {
  return providerEntry(s, 'local') ?? newProviderEntry('local');
}

export function activeEntry(s: AiSettings): AiProviderEntry {
  return providerEntry(s, s.active) ?? s.providers[0] ?? newProviderEntry('local');
}

/** The providers not added yet, in catalogue order. */
export function addableProviders(s: AiSettings): AiProviderSpec[] {
  return AI_PROVIDERS.filter((p) => !s.providers.some((e) => e.id === p.id));
}

/** A change to one entry. A new key or URL has not been tested: `tested` drops unless the patch
 *  itself sets it (the Test button). */
export function patchProvider(entry: AiProviderEntry, patch: Partial<AiProviderEntry>): AiProviderEntry {
  const next = { ...entry, ...patch };
  const retest = ('apiKey' in patch && patch.apiKey !== entry.apiKey) || ('baseUrl' in patch && patch.baseUrl !== entry.baseUrl);
  if (retest && !('tested' in patch)) next.tested = false;
  return next;
}

export function addProvider(s: AiSettings, id: AiProviderId): AiSettings {
  if (providerEntry(s, id)) return s;
  return { ...s, providers: [...s.providers, newProviderEntry(id)] };
}

/** Local stays. Removing the active provider makes Local active. */
export function removeProvider(s: AiSettings, id: AiProviderId): AiSettings {
  if (id === 'local' || !providerEntry(s, id)) return s;
  return { ...s, providers: s.providers.filter((p) => p.id !== id), active: s.active === id ? 'local' : s.active };
}

export function updateProvider(s: AiSettings, id: AiProviderId, patch: Partial<AiProviderEntry>): AiSettings {
  return { ...s, providers: s.providers.map((p) => (p.id === id ? patchProvider(p, patch) : p)) };
}

export function setActiveProvider(s: AiSettings, id: AiProviderId): AiSettings {
  return providerEntry(s, id) ? { ...s, active: id } : s;
}

/** A key provider needs a key, a passed Test and a model; Local needs its server to have
 *  answered and a model. */
export function providerReady(e: AiProviderEntry): boolean {
  if (!e.tested || !e.model) return false;
  return e.id === 'local' ? true : !!e.apiKey.trim();
}

/** Can the active provider take a call? */
export function aiReady(s: AiSettings): boolean {
  return providerReady(activeEntry(s));
}

/** Why `aiReady` is false, for disabled buttons' titles ("… to write prompts"). */
export function aiNotReadyHint(s: AiSettings): string {
  const e = activeEntry(s);
  const name = providerSpec(e.id).name;
  if (e.id === 'local') return e.tested ? 'Pick a local model in Settings → AI helper' : 'Check the local server in Settings → AI helper';
  if (!e.apiKey.trim()) return `Enter the ${name} key in Settings → AI helper`;
  if (!e.tested) return `Test the ${name} key in Settings → AI helper`;
  return `Pick a model for ${name} in Settings → AI helper`;
}

/** The chat model the helpers use (the active entry's). */
export function chatModelOf(s: AiSettings): string {
  return activeEntry(s).model;
}

/** The model the image helpers use: the active entry's vision model, else its chat model. */
export function visionModelOf(s: AiSettings): string {
  const e = activeEntry(s);
  return e.visionModel || e.model;
}

/** The settings with `model` as the active entry's chat model (a one-off override). */
export function withChatModel(s: AiSettings, model: string): AiSettings {
  if (!model) return s;
  return { ...s, providers: s.providers.map((p) => (p.id === s.active ? { ...p, model } : p)) };
}

/** The settings with the active entry's vision model replaced (the Collections panel's pick). */
export function withVisionModel(s: AiSettings, model: string): AiSettings {
  if (!model) return s;
  return { ...s, providers: s.providers.map((p) => (p.id === s.active ? { ...p, visionModel: model } : p)) };
}

/** A readable model id: `hf.co/bartowski/x-GGUF:Q6_K` → `x · Q6_K`, `models/gemini-2.5-pro` →
 *  `gemini-2.5-pro`, `anthropic/claude-sonnet-4` → `claude-sonnet-4`. */
export function shortModelName(id: string): string {
  const [path, tag] = id.split(':');
  let base = path.split('/').pop() ?? path;
  base = base.replace(/[-_.]?GGUF$/i, '');
  return tag && tag !== 'latest' ? `${base} · ${tag}` : base;
}

/** Short name of the active provider + model, for status lines ("Tagged 20 tags from …"). */
export function aiSourceLabel(s: AiSettings): string {
  const e = activeEntry(s);
  return e.id === 'local' ? shortModelName(e.model) : providerSpec(e.id).name;
}

/** The settings page's one line: "Using OpenRouter · claude-sonnet-4", or what is missing. */
export function aiStatusLine(s: AiSettings): string {
  const e = activeEntry(s);
  const name = providerSpec(e.id).name;
  return providerReady(e) ? `Using ${name} · ${shortModelName(e.model)}` : `${name} · not set up`;
}

/** The list's key-state dot: ok = tested, pending = has a key (or is Local) but untested, none = no key. */
export type KeyState = 'ok' | 'pending' | 'none';
export function keyState(e: AiProviderEntry): KeyState {
  if (e.tested) return 'ok';
  return e.id === 'local' || e.apiKey.trim() ? 'pending' : 'none';
}

/** The API root without a trailing slash; Local's loses a `/v1` someone typed (Ollama's root). */
export function resolveBaseUrl(e: AiProviderEntry): string {
  const url = (e.baseUrl.trim() || providerSpec(e.id).baseUrl).replace(/\/+$/, '');
  return e.id === 'local' ? url.replace(/\/v1$/, '') : url;
}

// --- model lists -----------------------------------------------------------------------------

export type AiModel = {
  id: string;
  name: string;
  vision: boolean;
  /** Extra for the picker: "uncensored · $0.2/M", a context size. */
  note?: string;
};

/** One line for a picker: "Venice Uncensored 1.2 · vision · uncensored · $0.2/M". */
export function aiModelLabel(m: AiModel): string {
  return [m.name, m.vision && 'vision', m.note].filter(Boolean).join(' · ');
}

export function visionModels(models: readonly AiModel[]): AiModel[] {
  return models.filter((m) => m.vision);
}

export function modelsRequest(e: AiProviderEntry): { url: string; headers: Record<string, string> } {
  const spec = providerSpec(e.id);
  const url = `${resolveBaseUrl(e)}${spec.modelsPath}`;
  if (spec.adapter === 'ollama') return { url, headers: {} };
  if (spec.adapter === 'anthropic') return { url, headers: anthropicHeaders(e.apiKey) };
  return { url, headers: { Authorization: `Bearer ${e.apiKey}` } };
}

type Row = Record<string, unknown>;

function rows(json: unknown): Row[] {
  if (Array.isArray(json)) return json.filter((r) => r && typeof r === 'object') as Row[];
  const data = (json as { data?: unknown; models?: unknown })?.data ?? (json as { models?: unknown })?.models;
  return Array.isArray(data) ? (data.filter((r) => r && typeof r === 'object') as Row[]) : [];
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

function byName(a: AiModel, b: AiModel): number {
  return a.name.localeCompare(b.name, undefined, { numeric: true });
}

/** The chat models in a provider's model-list answer, filtered to what can chat where the API
 *  says so (type, capabilities, modalities) or by well-known names where it does not, with
 *  whether each reads images. Sorted by name; Venice's uncensored models first. */
export function parseModels(id: AiProviderId, json: unknown): AiModel[] {
  const out: AiModel[] = [];
  for (const r of rows(json)) {
    const m = parseOne(id, r);
    if (m && !out.some((x) => x.id === m.id)) out.push(m);
  }
  if (id === 'venice') return out.sort((a, b) => Number(/uncensored/.test(b.note ?? '')) - Number(/uncensored/.test(a.note ?? '')) || byName(a, b));
  return out.sort(byName);
}

function parseOne(id: AiProviderId, r: Row): AiModel | null {
  const rawId = str(r.id) || str(r.name);
  if (!rawId) return null;
  switch (id) {
    case 'local':
      return { id: rawId, name: shortModelName(rawId), vision: false };
    case 'venice': {
      if (r.type && r.type !== 'text') return null;
      const spec = (r.model_spec ?? {}) as Row;
      if (spec.offline === true) return null;
      const name = str(spec.name) || rawId;
      const traits = Array.isArray(spec.traits) ? spec.traits : [];
      const caps = (spec.capabilities ?? {}) as Row;
      const price = ((spec.pricing as Row | undefined)?.input as Row | undefined)?.usd;
      const uncensored = traits.includes('most_uncensored') || /uncensored|abliterated|heretic/i.test(`${rawId} ${name}`);
      const note = [uncensored && 'uncensored', typeof price === 'number' && `$${price}/M`].filter(Boolean).join(' · ');
      return { id: rawId, name, vision: caps.supportsVision === true, ...(note ? { note } : {}) };
    }
    case 'openrouter': {
      const arch = (r.architecture ?? {}) as Row;
      const outs = Array.isArray(arch.output_modalities) ? arch.output_modalities : null;
      if (outs ? !outs.includes('text') : !/->text$/.test(str(arch.modality))) return null;
      const ins = Array.isArray(arch.input_modalities) ? arch.input_modalities : str(arch.modality).split('->')[0].split('+');
      const prompt = Number((r.pricing as Row | undefined)?.prompt);
      const note = Number.isFinite(prompt) ? (prompt === 0 ? 'free' : `$${+(prompt * 1e6).toFixed(2)}/M`) : '';
      return { id: rawId, name: str(r.name) || rawId, vision: ins.includes('image'), ...(note ? { note } : {}) };
    }
    case 'openai': {
      if (!/^(gpt-|o[1-9]|chatgpt-)/.test(rawId)) return null;
      if (/realtime|audio|tts|transcribe|search|image|embedding|moderation|instruct|codex/.test(rawId)) return null;
      const vision = /gpt-4o|gpt-4\.1|gpt-5|o1|o3|o4|chatgpt/.test(rawId) && !/o1-mini|o3-mini|o1-preview/.test(rawId);
      return { id: rawId, name: rawId, vision };
    }
    case 'anthropic':
      if (r.type && r.type !== 'model') return null;
      return { id: rawId, name: str(r.display_name) || rawId, vision: true };
    case 'deepseek':
      return { id: rawId, name: rawId, vision: false };
    case 'gemini': {
      const bare = rawId.replace(/^models\//, '');
      if (!/gemini|gemma/.test(bare)) return null;
      if (/embedding|imagen|veo|tts|audio|image|live|aqa|learnlm|computer|robotics/.test(bare)) return null;
      return { id: bare, name: bare, vision: /gemini/.test(bare) };
    }
    case 'groq': {
      if (r.active === false) return null;
      if (/whisper|tts|guard|playai|orpheus|embedding/.test(rawId)) return null;
      return { id: rawId, name: rawId, vision: /vision|llama-4|maverick|scout/.test(rawId) };
    }
    case 'mistral': {
      const caps = (r.capabilities ?? {}) as Row;
      if ('completion_chat' in caps ? caps.completion_chat !== true : /embed|moderation|ocr/.test(rawId)) return null;
      return { id: rawId, name: str(r.name) || rawId, vision: caps.vision === true };
    }
    case 'xai':
      if (/image|embedding/.test(rawId)) return null;
      return { id: rawId, name: rawId, vision: /vision|grok-4/.test(rawId) };
    case 'together':
      if (r.type && r.type !== 'chat') return null;
      return { id: rawId, name: str(r.display_name) || rawId, vision: /vision|VL|llama-4|maverick|scout/i.test(rawId) };
  }
}

// --- chat ------------------------------------------------------------------------------------

/** One slice of a vision-capable user message: text, or an inline image (`https://…` or a
 *  `data:image/png;base64,…` URL — ours are always data URLs, the pictures live in the browser). */
export type AiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type AiMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | AiContentPart[];
};

export type ChatRequestInput = {
  model: string;
  messages: AiMessage[];
  temperature: number;
  maxTokens: number;
  /** Ask a reasoning model to answer straight away (Ollama's think-off, Venice's strip). */
  noThinking?: boolean;
  /** More body fields the user set (top_p, seed…; `aiParams.paramBody`), added as they are. */
  extra?: Record<string, unknown>;
};

export type BuiltRequest = { url: string; headers: Record<string, string>; body: Record<string, unknown> };

export const ANTHROPIC_VERSION = '2023-06-01';

function anthropicHeaders(apiKey: string): Record<string, string> {
  return {
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    // The Messages API refuses browser calls without this opt-in; the key stays in this browser.
    'anthropic-dangerous-direct-browser-access': 'true',
  };
}

/** OpenAI's reasoning models take `max_completion_tokens` and only the default temperature. */
const OPENAI_REASONING = /^(o[1-9]|gpt-5)/;

/** The fetch for one chat call on this provider: URL, headers and JSON body per adapter. */
export function chatRequest(e: AiProviderEntry, req: ChatRequestInput): BuiltRequest {
  const spec = providerSpec(e.id);
  const url = `${resolveBaseUrl(e)}${spec.chatPath}`;
  if (spec.adapter === 'anthropic') {
    return { url, headers: { 'Content-Type': 'application/json', ...anthropicHeaders(e.apiKey) }, body: { ...anthropicBody(req), ...(req.extra ?? {}) } };
  }
  const body: Record<string, unknown> = { model: req.model, messages: req.messages, temperature: req.temperature, max_tokens: req.maxTokens, ...(req.extra ?? {}) };
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (spec.adapter === 'openai') headers.Authorization = `Bearer ${e.apiKey}`;
  switch (e.id) {
    case 'local':
      // Ollama maps this to `think: false`: reasoning models (Qwen3…) answer straight away.
      body.reasoning_effort = 'none';
      break;
    case 'venice':
      // No web search (the model's own words, no scraped links) and no Venice system prompt
      // (it nudges uncensored models toward refusing explicit content).
      body.venice_parameters = {
        enable_web_search: 'off',
        include_venice_system_prompt: false,
        ...(req.noThinking ? { disable_thinking: true, strip_thinking_response: true } : {}),
      };
      break;
    case 'openai':
      if (OPENAI_REASONING.test(req.model)) {
        delete body.temperature;
        delete body.max_tokens;
        body.max_completion_tokens = req.maxTokens;
      }
      break;
    case 'openrouter':
      headers['X-Title'] = 'ImageLab';
      if (req.noThinking) body.reasoning = { enabled: false };
      break;
  }
  return { url, headers, body };
}

/** A data URL's media type and base64 payload; null for anything else. */
export function splitDataUrl(url: string): { mediaType: string; data: string } | null {
  const m = /^data:([^;,]+);base64,(.+)$/s.exec(url);
  return m ? { mediaType: m[1], data: m[2] } : null;
}

function anthropicBody(req: ChatRequestInput): Record<string, unknown> {
  const system = req.messages.filter((m) => m.role === 'system').map((m) => (typeof m.content === 'string' ? m.content : m.content.map((p) => (p.type === 'text' ? p.text : '')).join('\n'))).join('\n\n');
  const messages = req.messages.filter((m) => m.role !== 'system').map((m) => ({
    role: m.role,
    content: typeof m.content === 'string' ? m.content : m.content.map((p) => {
      if (p.type === 'text') return { type: 'text', text: p.text };
      const d = splitDataUrl(p.image_url.url);
      return { type: 'image', source: d ? { type: 'base64', media_type: d.mediaType, data: d.data } : { type: 'url', url: p.image_url.url } };
    }),
  }));
  return { model: req.model, max_tokens: req.maxTokens, temperature: req.temperature, ...(system ? { system } : {}), messages };
}

/** The assistant's text from a chat answer, or the API's error message. */
export function parseChatReply(adapter: AiAdapter, json: unknown): { text: string; error: string } {
  const j = (json && typeof json === 'object' ? json : {}) as Row;
  const err = j.error;
  const error = typeof err === 'string' ? err : str((err as Row | undefined)?.message) || str(j.message);
  if (adapter === 'anthropic') {
    const content = Array.isArray(j.content) ? (j.content as Row[]) : [];
    return { text: content.filter((c) => c.type === 'text').map((c) => str(c.text)).join('').trim(), error };
  }
  const choices = Array.isArray(j.choices) ? (j.choices as Row[]) : [];
  const content = (choices[0]?.message as Row | undefined)?.content;
  const text = typeof content === 'string' ? content : Array.isArray(content) ? (content as Row[]).map((c) => str(c.text)).join('') : '';
  return { text: text.trim(), error };
}
