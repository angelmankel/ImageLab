/**
 * Settings → AI helper: the providers (one active, radio; each with its own key, model and
 * vision model on its own page — `ai/ProviderPage`), "+ Add provider" from the supported set,
 * and the global prompt style. Logic = `@/lib/store` ai settings (`@/lib/aiProviders`).
 */
import { useStore } from '@/lib/store';
import { aiStatusLine, type PromptStyle } from '@/lib/aiProviders';
import { Tabs } from '~/ui';
import type { SettingDef } from './categories';
import { ProviderList } from './ai/ProviderList';

function StatusValue() {
  const ai = useStore((s) => s.ai);
  return <>{aiStatusLine(ai)}</>;
}

function ProvidersCtl() {
  return <ProviderList />;
}

function StyleCtl() {
  const promptStyle = useStore((s) => s.ai.promptStyle);
  const setAi = useStore((s) => s.setAi);
  return (
    <Tabs<PromptStyle> compact fill={false} value={promptStyle} onChange={(promptStyle) => setAi({ promptStyle })}
      items={[{ key: 'sdxl', label: 'Generic SDXL' }, { key: 'illustrious', label: 'Illustrious tags' }]} />
  );
}

export const AI_ROWS: readonly SettingDef[] = [
  {
    id: 'ai.providers', category: 'ai', label: 'Providers', wide: true,
    hint: 'Only the active one is called; each keeps its own key, model and vision model. Local is your Ollama and is always here.',
    keywords: ['provider', 'venice', 'openrouter', 'openai', 'anthropic', 'claude', 'deepseek', 'gemini', 'google', 'groq', 'mistral', 'xai', 'grok', 'together', 'local', 'ollama', 'cloud', 'llm', 'backend', 'api key', 'token', 'secret', 'model', 'vision', 'add', 'remove', 'test'],
    Control: ProvidersCtl, Value: StatusValue,
  },
  {
    id: 'ai.style', category: 'ai', label: 'Prompt style', compact: true,
    hint: 'Generic SDXL prose, or Illustrious / Danbooru tags. Applies to every helper.',
    keywords: ['sdxl', 'illustrious', 'danbooru', 'tags', 'pony', 'natural'], Control: StyleCtl,
  },
];
