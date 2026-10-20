/**
 * The LLM parameters each AI provider takes, as data (FIXLIST 11): one table of parameters
 * (label, range, step, default, help) and, per provider, which of them its chat API accepts and
 * under which body key. The "Write it" window shows a provider's list behind its cog; the values
 * the user set go into the request through `paramBody`. Pure, tested (`next/tests/aiParams.test.cjs`).
 * Add a parameter: one row in AI_PARAMS. Teach a provider one: add its id to that provider's list.
 */
import type { AiProviderId } from './aiProviders';

export type AiParamId =
  | 'temperature' | 'top_p' | 'top_k' | 'min_p' | 'max_tokens'
  | 'presence_penalty' | 'frequency_penalty' | 'repetition_penalty' | 'seed';

export interface AiParamSpec {
  id: AiParamId;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  /** What the provider uses when the value is left unset (shown, not sent). */
  default: number;
  int?: boolean;
}

export const AI_PARAMS: Record<AiParamId, AiParamSpec> = {
  temperature: { id: 'temperature', label: 'Temperature', min: 0, max: 2, step: 0.05, default: 0.85, hint: 'How adventurous the wording is. Low = safe and repeatable, high = surprising (and sometimes off the rails).' },
  top_p: { id: 'top_p', label: 'Top P', min: 0, max: 1, step: 0.01, default: 1, hint: 'Only pick from the most likely words that add up to this share. Lower = more focused. Change this or temperature, rarely both.' },
  top_k: { id: 'top_k', label: 'Top K', min: 0, max: 200, step: 1, default: 0, int: true, hint: 'Only pick from the K most likely next words. 0 = no limit.' },
  min_p: { id: 'min_p', label: 'Min P', min: 0, max: 1, step: 0.01, default: 0, hint: 'Drop words less likely than this fraction of the best one. Keeps high temperatures sane.' },
  max_tokens: { id: 'max_tokens', label: 'Max length', min: 64, max: 4096, step: 32, default: 800, int: true, hint: 'The longest answer, in tokens (a token is about ¾ of a word). Reasoning models need room to think too.' },
  presence_penalty: { id: 'presence_penalty', label: 'Presence penalty', min: -2, max: 2, step: 0.05, default: 0, hint: 'Above 0 pushes the model toward new topics instead of ones it already mentioned.' },
  frequency_penalty: { id: 'frequency_penalty', label: 'Frequency penalty', min: -2, max: 2, step: 0.05, default: 0, hint: 'Above 0 makes it repeat the same words less.' },
  repetition_penalty: { id: 'repetition_penalty', label: 'Repetition penalty', min: 0.5, max: 2, step: 0.01, default: 1, hint: 'Above 1 discourages repeating itself. 1 = off.' },
  seed: { id: 'seed', label: 'Seed', min: 0, max: 999999, step: 1, default: 0, int: true, hint: 'Set one to get the same answer for the same input (where the provider supports it). Unset = new every time.' },
};

/** Per provider: the parameters its chat API takes, in display order. */
export const PROVIDER_PARAMS: Record<AiProviderId, AiParamId[]> = {
  local: ['temperature', 'top_p', 'max_tokens', 'presence_penalty', 'frequency_penalty', 'seed'],
  openrouter: ['temperature', 'top_p', 'top_k', 'min_p', 'max_tokens', 'presence_penalty', 'frequency_penalty', 'repetition_penalty', 'seed'],
  openai: ['temperature', 'top_p', 'max_tokens', 'presence_penalty', 'frequency_penalty', 'seed'],
  anthropic: ['temperature', 'top_p', 'top_k', 'max_tokens'],
  deepseek: ['temperature', 'top_p', 'max_tokens', 'presence_penalty', 'frequency_penalty'],
  gemini: ['temperature', 'top_p', 'max_tokens', 'seed'],
  groq: ['temperature', 'top_p', 'max_tokens', 'seed'],
  mistral: ['temperature', 'top_p', 'max_tokens', 'presence_penalty', 'frequency_penalty', 'seed'],
  xai: ['temperature', 'top_p', 'max_tokens', 'presence_penalty', 'frequency_penalty', 'seed'],
  together: ['temperature', 'top_p', 'top_k', 'min_p', 'max_tokens', 'presence_penalty', 'frequency_penalty', 'repetition_penalty', 'seed'],
  venice: ['temperature', 'top_p', 'top_k', 'min_p', 'max_tokens', 'presence_penalty', 'frequency_penalty', 'repetition_penalty', 'seed'],
};

/** Per provider: a different range than the table's (Anthropic and Mistral cap temperature). */
const RANGE: Partial<Record<AiProviderId, Partial<Record<AiParamId, Partial<Pick<AiParamSpec, 'min' | 'max'>>>>>> = {
  anthropic: { temperature: { max: 1 } },
  mistral: { temperature: { max: 1.5 } },
};

/** Per provider: a body key that differs from the parameter id. */
const KEY: Partial<Record<AiProviderId, Partial<Record<AiParamId, string>>>> = {
  mistral: { seed: 'random_seed' },
};

/** The specs a provider shows, with its own ranges. */
export function providerParams(id: AiProviderId): AiParamSpec[] {
  return (PROVIDER_PARAMS[id] ?? []).map((p) => ({ ...AI_PARAMS[p], ...(RANGE[id]?.[p] ?? {}) }));
}

export type AiParamValues = Partial<Record<AiParamId, number>>;

/** A value forced into the provider's range and step. */
export function clampParam(spec: AiParamSpec, v: number): number {
  const c = Math.min(spec.max, Math.max(spec.min, v));
  return spec.int ? Math.round(c) : Number((Math.round(c / spec.step) * spec.step).toFixed(4));
}

/**
 * The set values a provider takes, as body fields. Temperature and max tokens come back apart
 * (`temperature`, `maxTokens`) because the request builder already places those per adapter.
 */
export function paramBody(id: AiProviderId, values: AiParamValues): { temperature?: number; maxTokens?: number; extra: Record<string, number> } {
  const out: { temperature?: number; maxTokens?: number; extra: Record<string, number> } = { extra: {} };
  for (const spec of providerParams(id)) {
    const v = values[spec.id];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    const val = clampParam(spec, v);
    if (spec.id === 'temperature') out.temperature = val;
    else if (spec.id === 'max_tokens') out.maxTokens = val;
    else out.extra[KEY[id]?.[spec.id] ?? spec.id] = val;
  }
  return out;
}
