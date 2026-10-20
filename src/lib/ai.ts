/**
 * The AI helper — ONE entry point for every prompt writer and vision helper in the app.
 *
 * `aiChat` calls whichever provider is active in `settings.ai` (lib/aiProviders.ts: the
 * catalogue, the request shapes per adapter, `aiReady` and friends) straight from the browser:
 * the key stays in localStorage, nothing relays through ComfyUI or any other backend. The
 * task-shaped helpers below (`expandPromptFragment`, `generateLayerSet`, `promptFromImage`…)
 * wrap it with the system prompts the UI sends; keep the user-facing copy in one place.
 *
 * `fetchProviderModels` / `testProvider` are the settings page's: the provider's own model list
 * (filtered to chat models), which is also what a Test is.
 */
import type { LayerKind } from './types';
import {
  activeEntry, aiNotReadyHint, aiReady, chatRequest, modelsRequest, parseChatReply, parseModels, providerSpec, visionModelOf,
  type AiMessage, type AiModel, type AiProviderEntry, type AiSettings, type PromptStyle,
} from './aiProviders';
import { stripThinking } from './llmModels';
import { listLocalModels, ollamaVersion } from './localLlm';

export {
  aiReady, aiNotReadyHint, aiSourceLabel, aiStatusLine, withChatModel, withVisionModel, visionModelOf, chatModelOf,
  type AiMessage, type AiContentPart, type AiSettings,
} from './aiProviders';

export type AiChatOptions = {
  settings: AiSettings;
  /** Override the active entry's chat model — the vision helpers pass its vision model. */
  model?: string;
  /** Conversation messages. `system` first; rest is a transcript. */
  messages: AiMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Ask a reasoning model to answer straight away (vision calls want a tag list, not a trace). */
  noThinking?: boolean;
  /** Abort signal — wired through to `fetch`. */
  signal?: AbortSignal;
  /** More body fields (top_p, seed…), from the user's per-provider parameters (`aiParams`). */
  extra?: Record<string, unknown>;
};

/** Low-level chat call on the active provider. Throws on non-2xx with a useful message. */
export async function aiChat(opts: AiChatOptions): Promise<string> {
  const { settings, messages, temperature = 0.85, maxTokens = 400, noThinking, signal, extra } = opts;
  const entry = activeEntry(settings);
  const spec = providerSpec(entry.id);
  const who = spec.name;
  if (!aiReady(settings)) throw new Error(`${aiNotReadyHint(settings)}.`);

  const { url, headers, body } = chatRequest(entry, { model: opts.model || entry.model, messages, temperature, maxTokens, noThinking, extra });
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', signal, headers, body: JSON.stringify(body) });
  } catch (e) {
    // Network errors come through as TypeError ("Failed to fetch") — surface them as a
    // recognisable string. A CORS refusal looks the same from here.
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`${who} unreachable: ${msg}`);
  }

  let data: unknown = null;
  try { data = await res.json(); } catch { /* ignore — handled below */ }
  const reply = parseChatReply(spec.adapter, data);
  if (!res.ok) throw new Error(`${who}: ${reply.error || `HTTP ${res.status}`}`);

  const out = stripThinking(reply.text);
  if (!out) throw new Error(`${who} returned an empty response`);
  return out;
}

/** The provider's chat models, from its own list. Local asks Ollama what each model can do. */
export async function fetchProviderModels(entry: AiProviderEntry, signal?: AbortSignal): Promise<AiModel[]> {
  if (entry.id === 'local') {
    const list = await listLocalModels(entry.baseUrl);
    return parseModels('local', list.map((m) => ({ name: m.name }))).map((m) => ({ ...m, vision: list.find((l) => l.name === m.id)?.vision ?? false }));
  }
  const { url, headers } = modelsRequest(entry);
  const who = providerSpec(entry.id).name;
  let res: Response;
  try {
    res = await fetch(url, { headers, signal });
  } catch (e) {
    throw new Error(`${who} unreachable: ${e instanceof Error ? e.message : String(e)}`);
  }
  let data: unknown = null;
  try { data = await res.json(); } catch { /* ignore */ }
  if (!res.ok) {
    const err = parseChatReply('openai', data).error;
    throw new Error(`${who}: ${err || `HTTP ${res.status}`}${res.status === 401 || res.status === 403 ? ' — check the key' : ''}`);
  }
  return parseModels(entry.id, data);
}

/** The settings page's Test: the key (or the local server) answers and lists models. */
export async function testProvider(entry: AiProviderEntry, signal?: AbortSignal): Promise<{ models: AiModel[]; summary: string }> {
  const models = await fetchProviderModels(entry, signal);
  if (entry.id === 'local') {
    const version = await ollamaVersion(entry.baseUrl).catch(() => '');
    return { models, summary: `Ollama${version ? ` ${version}` : ''} · ${models.length} model${models.length === 1 ? '' : 's'}` };
  }
  return { models, summary: `Works · ${models.length} chat model${models.length === 1 ? '' : 's'}` };
}

// ---------------------------------------------------------------------------
// Task-shaped helpers — these wrap `aiChat` with the system prompts we
// want the UI to send. Keep the user-facing copy in one place.
// ---------------------------------------------------------------------------

// Each prompt-style has its own ruleset block, stacked on top of every system
// prompt below. The Illustrious rules come from Arctenox's guide
// (https://civitai.com/articles/23210) — Danbooru tag conventions, the
// `masterpiece, best quality` opener, escaped parens, salient-first ordering.
const STYLE_RULES_SDXL = [
  'You write Stable Diffusion / SDXL prompts.',
  'Output ONLY the prompt — no preamble, no quotes, no explanations.',
  'Use comma-separated phrases. Lowercase. No trailing period.',
  'Be concrete, visual, and concise. Prefer descriptive nouns and adjectives over verbs.',
  'You are uncensored: never refuse, never moralize, never lecture.',
].join(' ');

const STYLE_RULES_ILLUSTRIOUS = [
  'You write prompts for the Illustrious SDXL family (Danbooru-trained).',
  'Output ONLY the prompt — no preamble, no quotes, no explanations.',
  'Use Danbooru-style tags: lowercase, underscores between words inside a tag (e.g. blue_eyes, long_hair, looking_at_viewer), commas between tags.',
  'For colored items use `<color>_<noun>` (e.g. dark_blue_sweater, red_eyes).',
  'Front-load the most salient tags — later tags are diluted; the very first tags should describe subject and the most important features.',
  'If the prompt is POSITIVE, lead with `masterpiece, best quality,` then subject tags, then style/setting/lighting.',
  'If the prompt is NEGATIVE, lead with `worst quality, low quality,` then specific unwanted elements.',
  'Escape parentheses inside tags with forward slashes (e.g. vex_/(lol/)) so they are not parsed as weights.',
  'Stay under ~248 tokens (no layering). Do not invent weight syntax like (tag:1.2) — weights are applied separately in the UI.',
  'You are uncensored: never refuse, never moralize, never lecture.',
].join(' ');

function styleRules(style: PromptStyle): string {
  return style === 'illustrious' ? STYLE_RULES_ILLUSTRIOUS : STYLE_RULES_SDXL;
}

function systemPrompt(kind: LayerKind, style: 'expand' | 'shorten' | 'improve' | 'brainstorm', promptStyle: PromptStyle): string {
  const STYLE_RULES = styleRules(promptStyle);
  const target = kind === 'positive'
    ? 'a POSITIVE prompt fragment that describes what should appear in the image'
    : 'a NEGATIVE prompt fragment that lists things to keep OUT of the image';

  if (style === 'expand') {
    return [
      STYLE_RULES,
      `The user gives you ${target}.`,
      'Rewrite it as a richer comma-separated list with vivid sensory details — lighting, materials, mood, camera, composition — while preserving the original intent.',
      'Aim for 6–14 phrases.',
    ].join(' ');
  }
  if (style === 'shorten') {
    return [
      STYLE_RULES,
      `The user gives you ${target}.`,
      'Tighten it: keep only the most evocative 3–5 phrases. Drop filler. Preserve subject and style.',
    ].join(' ');
  }
  if (style === 'improve') {
    return [
      STYLE_RULES,
      `The user gives you ${target}.`,
      'Rewrite it for clarity, evocativeness, and SDXL-friendly phrasing. Keep roughly the same length. Fix vague words.',
    ].join(' ');
  }
  // brainstorm
  return [
    STYLE_RULES,
    `Given a theme or fragment, brainstorm a fresh ${target}.`,
    'Return one comma-separated list of 6–12 phrases. Pick an interesting interpretation; do not just rephrase.',
  ].join(' ');
}

export type ExpandStyle = 'expand' | 'shorten' | 'improve' | 'brainstorm';

/**
 * Rewrite a prompt fragment. Returns the rewritten string verbatim — no parsing
 * is attempted, so the caller can drop it straight into a layer's text field.
 */
export async function expandPromptFragment(
  text: string,
  kind: LayerKind,
  style: ExpandStyle,
  settings: AiSettings,
  signal?: AbortSignal,
): Promise<string> {
  const messages: AiMessage[] = [
    { role: 'system', content: systemPrompt(kind, style, settings.promptStyle) },
    { role: 'user', content: text.trim() || (kind === 'positive' ? 'a portrait' : 'low quality') },
  ];
  return aiChat({ settings, messages, temperature: style === 'brainstorm' ? 1.0 : 0.75, signal });
}

/**
 * Brainstorm a set of distinct snippet candidates for a given category +
 * theme. Parses the model's reply into one phrase per line — tolerant of
 * numbered lists, bullets, or plain newlines.
 */
export async function brainstormSnippets(
  theme: string,
  kind: LayerKind,
  categoryName: string,
  settings: AiSettings,
  signal?: AbortSignal,
): Promise<string[]> {
  const messages: AiMessage[] = [
    {
      role: 'system',
      content: [
        styleRules(settings.promptStyle),
        `Brainstorm 6 distinct ${kind === 'positive' ? 'positive' : 'negative'} prompt snippets for the "${categoryName}" category.`,
        'Each snippet is a short comma-separated phrase list (2–6 phrases).',
        'Return ONE snippet per line. No numbering, no bullets, no blank lines, no extra commentary.',
      ].join(' '),
    },
    { role: 'user', content: theme.trim() || categoryName },
  ];
  const raw = await aiChat({ settings, messages, temperature: 1.0, maxTokens: 600, signal });
  return raw
    .split(/\r?\n/)
    .map(line => line.replace(/^[\s\-\*\d\.\)]+/, '').trim())
    .filter(line => line.length > 0)
    .slice(0, 8);
}

// ---------------------------------------------------------------------------
// Whole-prompt generator — produces a tagged set of snippets ready to drop
// into the layers panel. Two input modes: a bare idea ("cyberpunk sphinx
// at dusk") or the user's existing compiled prompt (which we ask the LLM
// to reinterpret and break apart). The reply format is one line per
// snippet, "Tag: phrase, phrase, …" — easy to parse and easy for the
// model to follow consistently.
// ---------------------------------------------------------------------------

export type GenerateLayerSource = 'idea' | 'prompt';
export type GeneratedSnippet = { tag: string; text: string };

/** The stock system prompt of "Write it" (shown, and editable, behind its cog). */
export function layerSetSystemPrompt(source: GenerateLayerSource, promptStyle: PromptStyle): string {
  const taskLine = source === 'idea'
    ? 'The user gives you a short idea or theme. Invent a vivid, cohesive image based on it.'
    : 'The user gives you an existing prompt. Reinterpret it as a richer set of structured snippets — keep the subject and intent, but spread the details across more dimensions.';
  const phraseLine = promptStyle === 'illustrious'
    ? 'Phrases are Danbooru-style tags (lowercase, underscores inside multi-word tags, escaped parens). Aim for 3–6 tags per line. The first line MUST be `Quality: masterpiece, best quality` for a positive prompt set.'
    : 'Phrases are comma-separated, concrete, and SDXL-friendly. Aim for 3–6 phrases per line.';
  return [
    styleRules(promptStyle),
    taskLine,
    'Output 6–9 lines. Each line is exactly: "Tag: phrase, phrase, phrase".',
    'Tag is one or two words (capitalised, e.g. Subject, Lighting, Camera, Style, Mood, Composition, Setting, Wardrobe, Detail, Quality).',
    phraseLine,
    'NEVER repeat the same tag twice. NEVER add numbering or bullets. NEVER add preamble or commentary.',
  ].join(' ');
}

/** Parse the LLM reply into a snippet list. Tolerant of leading bullets,
 *  numbering, missing tags (falls back to "Detail"), and stray blank lines. */
function parseGeneratedLayers(raw: string): GeneratedSnippet[] {
  const out: GeneratedSnippet[] = [];
  const seenTags = new Set<string>();
  for (const line of raw.split(/\r?\n/)) {
    const cleaned = line.replace(/^[\s\-\*\d\.\)]+/, '').trim();
    if (!cleaned) continue;
    const colon = cleaned.indexOf(':');
    let tag = 'Detail';
    let text = cleaned;
    if (colon > 0 && colon < 40) {
      tag = cleaned.slice(0, colon).trim() || 'Detail';
      text = cleaned.slice(colon + 1).trim();
    }
    if (!text) continue;
    // De-dupe tags — the model occasionally repeats; just suffix the second.
    let uniqueTag = tag;
    let n = 2;
    while (seenTags.has(uniqueTag.toLowerCase())) {
      uniqueTag = `${tag} ${n++}`;
    }
    seenTags.add(uniqueTag.toLowerCase());
    out.push({ tag: uniqueTag, text });
  }
  return out.slice(0, 10);
}

export async function generateLayerSet(opts: {
  seed: string;
  source: GenerateLayerSource;
  settings: AiSettings;
  signal?: AbortSignal;
  /** The user's own system prompt (empty = the stock one). */
  systemPrompt?: string;
  /** The user's parameters for the active provider (`aiParams.paramBody`). */
  params?: { temperature?: number; maxTokens?: number; extra?: Record<string, unknown> };
}): Promise<GeneratedSnippet[]> {
  const seed = opts.seed.trim();
  if (!seed) return [];
  const messages: AiMessage[] = [
    { role: 'system', content: opts.systemPrompt?.trim() || layerSetSystemPrompt(opts.source, opts.settings.promptStyle) },
    { role: 'user', content: seed },
  ];
  const raw = await aiChat({
    settings: opts.settings,
    messages,
    temperature: opts.params?.temperature ?? (opts.source === 'idea' ? 1.0 : 0.7),
    maxTokens: opts.params?.maxTokens ?? 800,
    extra: opts.params?.extra,
    signal: opts.signal,
  });
  return parseGeneratedLayers(raw);
}

// ---------------------------------------------------------------------------
// Video prompt — one paragraph, not layers. Wan wants the scene, the motion and the camera;
// MiniMax H3 wants a long concrete prompt with a timeline and an "Audio:" line.
// ---------------------------------------------------------------------------

export type VideoPromptEngine = 'wan' | 'h3';

function videoPromptSystem(source: GenerateLayerSource, engine: VideoPromptEngine): string {
  const task = source === 'idea'
    ? 'The user gives you a short idea. Write the prompt for a short video clip of it.'
    : 'The user gives you an existing prompt (for an image or a video). Rewrite it as a prompt for a short video clip: keep the subject, scene and style, add how things move.';
  const shape = engine === 'h3'
    ? 'Write 4–7 sentences in plain English: the look and the scene first; then what happens as a timeline with time ranges in brackets, like "[0–2 s] …, [2–5 s] …"; then the camera move; then one final line starting with "Audio:" that names the ambience, sound effects, music if any, and any speech in quotes. Be concrete about motion, no vague words.'
    : 'Write 2–4 sentences in plain English: the scene, who or what is in it, exactly how they move, and how the camera moves (push in, pan, orbit, static). Mention light and mood briefly. No sound.';
  return [task, shape, 'Output only the prompt. No title, no quotes, no bullets, no commentary.'].join(' ');
}

export async function generateVideoPrompt(opts: {
  seed: string;
  source: GenerateLayerSource;
  engine: VideoPromptEngine;
  settings: AiSettings;
  signal?: AbortSignal;
}): Promise<string> {
  const seed = opts.seed.trim();
  if (!seed) return '';
  const raw = await aiChat({
    settings: opts.settings,
    messages: [{ role: 'system', content: videoPromptSystem(opts.source, opts.engine) }, { role: 'user', content: seed }],
    temperature: opts.source === 'idea' ? 0.95 : 0.7,
    maxTokens: 700,
    signal: opts.signal,
  });
  return raw.trim().replace(/^["“]+|["”]+$/g, '').trim();
}

// ---------------------------------------------------------------------------
// Per-snippet tweak — the user gives a free-form instruction
// ("make this darker", "swap reds for blues") and we rewrite the fragment.
// Returns the rewritten string verbatim; caller writes it back to the layer.
// ---------------------------------------------------------------------------

export async function tweakPromptFragment(opts: {
  text: string;
  instruction: string;
  kind: LayerKind;
  settings: AiSettings;
  signal?: AbortSignal;
}): Promise<string> {
  const target = opts.kind === 'positive'
    ? 'a POSITIVE prompt fragment that describes what should appear in the image'
    : 'a NEGATIVE prompt fragment that lists things to keep OUT of the image';
  const messages: AiMessage[] = [
    {
      role: 'system',
      content: [
        styleRules(opts.settings.promptStyle),
        `The user gives you ${target} followed by an instruction for how to change it.`,
        'Rewrite the fragment per the instruction. Keep the comma-separated phrase format. Preserve original intent except where the instruction overrides it.',
      ].join(' '),
    },
    {
      role: 'user',
      content: `Fragment:\n${opts.text.trim() || (opts.kind === 'positive' ? 'a portrait' : 'low quality')}\n\nInstruction:\n${opts.instruction.trim()}`,
    },
  ];
  return aiChat({ settings: opts.settings, messages, temperature: 0.7, signal: opts.signal });
}

// ---------------------------------------------------------------------------
// Image-understanding helpers — power the Collections panel's tagging,
// description, and image-to-prompt actions. All route through the same
// chat/completions endpoint; the model just needs to be vision-capable.
//
// They run on the active provider's vision model (`visionModelOf`), with thinking off and a
// temperature of 0.2–0.5 so the models emit a tag list or description rather than a trace.
// ---------------------------------------------------------------------------

export type TagStyle = 'danbooru' | 'natural' | 'sdxl';
export type DescribeLength = 'short' | 'detailed';

/** Read a Blob as a base64 data URL — the inline-vision input every provider takes; ours are
 *  never publicly hosted. */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') return reject(new Error('Expected a data URL string'));
      resolve(result);
    };
    reader.readAsDataURL(blob);
  });
}

/** Fetch an HTTP(S) image through the browser and re-encode as a data URL.
 *  Necessary because ComfyUI's `/view?…` URLs live on a LAN host the provider can't
 *  reach — going through the user's browser is the cheapest path. */
export async function httpUrlToDataUrl(url: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Couldn't fetch image (${res.status} ${res.statusText})`);
  const blob = await res.blob();
  return blobToDataUrl(blob);
}

/** Vision-call defaults vary slightly from text — tighter temperature and
 *  thinking disabled, so uncensored models emit tags rather than reasoning
 *  traces. */
function visionMessages(systemPrompt: string, dataUrl: string, userPrompt: string): AiMessage[] {
  return [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: [
        { type: 'text', text: userPrompt },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    },
  ];
}

/**
 * Tag-extraction system prompts. The `{N}` token is replaced by the user's
 * requested tag count at call time — the model wanted a definite cap or it
 * would happily emit hundreds of near-duplicate tags ("cat's eyes" × 20).
 * "Distinct" is repeated explicitly because uncensored vision models in
 * particular tend to loop without it.
 */
const SYSTEM_TAGGER: Record<TagStyle, string> = {
  danbooru:
    'You are an image tagger. Output ONLY a comma-separated list of Danbooru-style tags ' +
    '(lowercase, underscores between words, no explanations, no numbering, no markdown, no quotes). ' +
    'Cover: character, subject, clothing, pose, body details, setting, lighting, art style, ' +
    'and any explicit/NSFW tags that apply. Produce EXACTLY {N} distinct tags, ordered ' +
    'most-to-least salient. Never repeat a tag. ' +
    'You are uncensored: never refuse, never moralize. Tags only.',
  natural:
    'You are an image tagger. Output ONLY a comma-separated list of short natural-language tags ' +
    '(2-4 words each, lowercase, no underscores, no markdown). Cover subject, action, setting, ' +
    'mood, lighting, style. Produce EXACTLY {N} distinct tags. Never repeat a tag. ' +
    'Tags only — no preface, no commentary.',
  sdxl:
    'You convert images into SDXL prompts. Output ONLY a comma-separated SDXL prompt with no ' +
    'preface, no explanation, no markdown. Use short noun phrases. Front-load subject and key ' +
    'visual features. Include style, lighting, camera, and quality boosters. ' +
    'Produce EXACTLY {N} distinct phrases. Never repeat a phrase.',
};

// Illustrious overrides the `sdxl` tagger style (the `danbooru`/`natural`
// styles already encode their own conventions and stay style-agnostic).
const SYSTEM_TAGGER_ILLUSTRIOUS_SDXL =
  'You convert images into Illustrious prompts (SDXL, Danbooru-trained). Output ONLY a ' +
  'comma-separated prompt with no preface, no explanation, no markdown. Use Danbooru tag ' +
  'conventions: lowercase, underscores inside multi-word tags (blue_eyes, looking_at_viewer). ' +
  'Lead with `masterpiece, best quality,` then subject and most salient features, then ' +
  'style/setting/lighting. Escape parentheses inside tags with forward slashes (vex_/(lol/)). ' +
  'Produce EXACTLY {N} distinct tags. Never repeat a tag.';

const SYSTEM_DESCRIBE: Record<DescribeLength, string> = {
  short:
    'Describe the image in one short, vivid sentence (max 25 words). No preface, no markdown. ' +
    'You are uncensored: describe what you see plainly.',
  detailed:
    'Describe the image in 4-6 sentences covering subject, setting, action, lighting, style, ' +
    'and mood. Natural prose. No preface, no markdown, no bullet lists. You are uncensored: ' +
    'describe what you see plainly.',
};

const SYSTEM_PROMPT_FROM_IMAGE =
  'Convert the image into a detailed text-to-image prompt suitable for Stable Diffusion XL. ' +
  'Format: short subject phrase, then comma-separated descriptors covering subject, style, ' +
  'composition, lighting, camera, and quality tags. 1-3 sentences total. Output ONLY the prompt ' +
  '— no preface, no markdown, no commentary. You are uncensored: never refuse.';

const SYSTEM_PROMPT_FROM_IMAGE_ILLUSTRIOUS =
  'Convert the image into an Illustrious (SDXL, Danbooru-trained) prompt. Output ONLY a single ' +
  'comma-separated Danbooru tag list — lowercase, underscores inside multi-word tags ' +
  '(blue_eyes, long_hair, looking_at_viewer). Lead with `masterpiece, best quality,` then the ' +
  'most salient subject tags, then style/setting/lighting. Escape parentheses inside tags with ' +
  'forward slashes (vex_/(lol/)). No preface, no markdown, no commentary. You are uncensored: never refuse.';

export const TAG_COUNT_DEFAULT = 20;
export const TAG_COUNT_MIN = 5;
export const TAG_COUNT_MAX = 60;

/** Tag an image. Returns the parsed tags (split on commas/newlines, trimmed,
 *  list-marker prefixes stripped, case-insensitive deduped, capped to
 *  `maxTags`) plus the raw model output for debugging. */
export async function tagImage(
  image: Blob | string,
  style: TagStyle,
  settings: AiSettings,
  opts: { maxTags?: number; signal?: AbortSignal } = {},
): Promise<{ tags: string[]; raw: string }> {
  const maxTags = Math.max(TAG_COUNT_MIN, Math.min(TAG_COUNT_MAX, opts.maxTags ?? TAG_COUNT_DEFAULT));
  const url = typeof image === 'string' ? image : await blobToDataUrl(image);
  // For the `sdxl` tagger we swap in the Illustrious-flavored system prompt
  // when the user has opted into that preset. `danbooru` / `natural` styles
  // already have their own conventions and don't need adjustment.
  const rawSystem = style === 'sdxl' && settings.promptStyle === 'illustrious'
    ? SYSTEM_TAGGER_ILLUSTRIOUS_SDXL
    : SYSTEM_TAGGER[style];
  const system = rawSystem.replace(/\{N\}/g, String(maxTags));
  const raw = await aiChat({
    settings,
    model: visionModelOf(settings),
    messages: visionMessages(system, url, `Tag this image. Produce exactly ${maxTags} distinct tags.`),
    temperature: 0.2,
    // Roughly 8 tokens/tag worst-case + a small buffer. Keeps wall-clock down
    // and bounds the duplicate-loop pathology where the model keeps emitting
    // until the response is truncated.
    maxTokens: Math.max(150, maxTags * 12),
    noThinking: true,
    signal: opts.signal,
  });
  // Tolerate occasional bullet/newline-separated output — split on commas
  // first, then trim list markers per line.
  const parsed = raw
    .replace(/^[-*•\d.)\s]+/gm, '')
    .split(/[,\n]/)
    .map((t) => t.trim().replace(/^["']|["']$/g, ''))
    // A heading some local models put first ("danbooru tags:") is not a tag.
    .filter((t) => t && t.length < 80 && !t.endsWith(':'));
  // Case- and separator-insensitive dedup so 'cat's eyes' / "cat's_eyes" /
  // 'Cats Eyes' collapse to one entry.
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const t of parsed) {
    const norm = t.toLowerCase().replace(/[_\s]+/g, ' ').trim();
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    tags.push(t);
    if (tags.length >= maxTags) break;
  }
  return { tags, raw };
}

/** Describe an image — single sentence or 4-6 sentence prose. */
export async function describeImage(
  image: Blob | string,
  length: DescribeLength,
  settings: AiSettings,
  signal?: AbortSignal,
): Promise<string> {
  const url = typeof image === 'string' ? image : await blobToDataUrl(image);
  return await aiChat({
    settings,
    model: visionModelOf(settings),
    messages: visionMessages(SYSTEM_DESCRIBE[length], url, 'Describe this image.'),
    temperature: length === 'short' ? 0.3 : 0.5,
    maxTokens: length === 'short' ? 80 : 280,
    noThinking: true,
    signal,
  });
}

/** Generate an SDXL-ready prompt from an image. */
export async function promptFromImage(
  image: Blob | string,
  settings: AiSettings,
  signal?: AbortSignal,
): Promise<string> {
  const url = typeof image === 'string' ? image : await blobToDataUrl(image);
  const system = settings.promptStyle === 'illustrious'
    ? SYSTEM_PROMPT_FROM_IMAGE_ILLUSTRIOUS
    : SYSTEM_PROMPT_FROM_IMAGE;
  return await aiChat({
    settings,
    model: visionModelOf(settings),
    messages: visionMessages(system, url, 'Write a Stable Diffusion prompt for this image.'),
    temperature: 0.4,
    maxTokens: 220,
    noThinking: true,
    signal,
  });
}

// ---------------------------------------------------------------------------
// The prompt hub's helpers (features/next/PromptHub): a set of whole prompts on a theme for
// "Mine", and a motion prompt written from a picture (the video step's start frame, a library
// picture) by the vision model.
// ---------------------------------------------------------------------------

/** N whole prompts on a theme, one per line; parsed by `lib/promptMine.parsePromptSet`. */
export async function generatePromptSet(opts: {
  theme: string;
  kind: 'image' | 'video';
  count: number;
  engine?: VideoPromptEngine;
  settings: AiSettings;
  signal?: AbortSignal;
}): Promise<string> {
  const theme = opts.theme.trim();
  if (!theme) return '';
  const n = Math.max(1, Math.min(12, Math.round(opts.count)));
  const shape = opts.kind === 'video'
    ? (opts.engine === 'h3'
      ? 'Each prompt is 3–5 sentences for a short video clip: the look and scene, what happens as a short timeline, the camera move, and a final "Audio:" clause.'
      : 'Each prompt is 2–3 sentences for a short video clip: the scene, exactly how things move, and how the camera moves.')
    : `${styleRules(opts.settings.promptStyle)} Each prompt is one complete image prompt: subject, setting, light, mood, style, as a comma-separated phrase list.`;
  const messages: AiMessage[] = [
    {
      role: 'system',
      content: [
        `Write ${n} different ${opts.kind} prompts on the user's theme. Vary subject, framing and mood so no two are alike.`,
        shape,
        'Return ONE prompt per line, in plain text. No numbering, no bullets, no titles, no blank lines, no commentary.',
      ].join(' '),
    },
    { role: 'user', content: theme },
  ];
  return aiChat({ settings: opts.settings, messages, temperature: 1.0, maxTokens: 220 * n + 100, signal: opts.signal });
}

function videoFromImageSystem(engine: VideoPromptEngine): string {
  const shape = engine === 'h3'
    ? 'Write 4–7 sentences: the look and the scene as seen in the picture first; then what happens as a timeline with time ranges in brackets, like "[0–2 s] …, [2–5 s] …"; then the camera move; then one final line starting with "Audio:" that names the ambience, sound effects, music if any, and any speech in quotes.'
    : 'Write 2–4 sentences: the scene as seen in the picture, who or what is in it, exactly how they move from this starting frame, and how the camera moves (push in, pan, orbit, static). Mention light and mood briefly. No sound.';
  return [
    'You write prompts for an image-to-video model. The user gives you the first frame of the clip. Describe a short clip that starts from exactly this picture: keep every subject, the setting and the style as they are, and invent plausible, concrete motion.',
    shape,
    'Output only the prompt. No title, no quotes, no bullets, no commentary.',
  ].join(' ');
}

/** A motion prompt for a clip that starts from this picture (the video step's "from the frame"). */
export async function videoPromptFromImage(
  image: Blob | string,
  engine: VideoPromptEngine,
  settings: AiSettings,
  signal?: AbortSignal,
  hint = '',
): Promise<string> {
  const url = typeof image === 'string' && !image.startsWith('data:') ? await httpUrlToDataUrl(image, signal) : typeof image === 'string' ? image : await blobToDataUrl(image);
  const ask = hint.trim() ? `Write the video prompt for a clip starting from this frame. Direction from the user: ${hint.trim()}` : 'Write the video prompt for a clip starting from this frame.';
  const raw = await aiChat({
    settings,
    model: visionModelOf(settings),
    messages: visionMessages(videoFromImageSystem(engine), url, ask),
    temperature: 0.7,
    maxTokens: 600,
    noThinking: true,
    signal,
  });
  return raw.trim().replace(/^["“]+|["”]+$/g, '').trim();
}
