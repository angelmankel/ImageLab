/**
 * Settings → AI: the model every AI helper uses ("Write it", tagging, image → prompt): Venice in
 * the cloud or a local Ollama model, Venice's key, the prompt style, and the server URLs.
 * Logic = `@/lib/store` venice settings; the model switch is the main app's `AiModelPicker`
 * (a Mantine Select, so it wears the Ember theme).
 */
import { PasswordInput, TextInput } from '@mantine/core';
import { useStore } from '@/lib/store';
import { LOCAL_LLM_DEFAULT_BASE_URL, VENICE_DEFAULT_BASE_URL, type PromptStyle } from '@/lib/storage';
import { AiModelPicker } from '@/features/ai/AiModelPicker';
import { Tabs } from '~/ui';
import { Field, inputStyles, monoInputStyles, SettingsCard } from './SettingsCard';

export function AiCard() {
  const venice = useStore((s) => s.venice);
  const setVenice = useStore((s) => s.setVenice);
  return (
    <SettingsCard title="AI" description="Writes and edits prompts. Keys stay in this browser; calls go straight from this tab to the provider.">
      <Field label="Model">
        <AiModelPicker size="sm" />
      </Field>
      <Field label="Prompt style">
        <Tabs<PromptStyle> compact value={venice.promptStyle} onChange={(promptStyle) => setVenice({ promptStyle })}
          items={[{ key: 'sdxl', label: 'Generic SDXL' }, { key: 'illustrious', label: 'Illustrious tags' }]} />
      </Field>
      <Field label="Venice API key" hint={<>Get one at <a href="https://venice.ai/settings/api" target="_blank" rel="noreferrer">venice.ai/settings/api</a></>}>
        <PasswordInput value={venice.apiKey} onChange={(e) => setVenice({ apiKey: e.currentTarget.value })} placeholder="vn-…" aria-label="Venice API key"
          size="sm" spellCheck={false} autoCapitalize="off" autoComplete="off" styles={inputStyles} />
      </Field>
      <Field label="Local LLM server" hint="Ollama root, no /v1.">
        <TextInput value={venice.localBaseUrl} onChange={(e) => setVenice({ localBaseUrl: e.currentTarget.value })} placeholder={LOCAL_LLM_DEFAULT_BASE_URL}
          aria-label="Local LLM server" size="sm" spellCheck={false} autoCapitalize="off" autoComplete="off" styles={monoInputStyles} />
      </Field>
      <Field label="Venice base URL" hint="Leave empty for Venice. Any OpenAI-compatible endpoint works.">
        <TextInput value={venice.baseUrl} onChange={(e) => setVenice({ baseUrl: e.currentTarget.value })} placeholder={VENICE_DEFAULT_BASE_URL}
          aria-label="Venice base URL" size="sm" spellCheck={false} autoCapitalize="off" autoComplete="off" styles={monoInputStyles} />
      </Field>
    </SettingsCard>
  );
}
