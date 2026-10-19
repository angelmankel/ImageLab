import { Stack, Text, TextInput, PasswordInput, Radio, Anchor, Code, Select } from '@mantine/core';
import { IconKey, IconSparkles, IconWorld } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { VENICE_DEFAULT_MODEL, VENICE_DEFAULT_BASE_URL, type PromptStyle } from '@/lib/storage';
import { SettingsSection } from './SettingsSection';
import { AiModelPicker } from '@/features/ai/AiModelPicker';
import { LocalLlmSection } from '@/features/ai/LocalLlmSection';
import { useVeniceModels, useVeniceModelsFor } from '@/features/ai/veniceModelsStore';
import { veniceModelLabel } from '@/lib/veniceModels';

type StyleOption = { id: PromptStyle; label: string; blurb: string };

const STYLE_OPTIONS: StyleOption[] = [
  {
    id: 'sdxl',
    label: 'Generic SDXL',
    blurb: 'Comma-separated natural-language phrases. Works with most SDXL / Pony / Flux checkpoints.',
  },
  {
    id: 'illustrious',
    label: 'Illustrious / Danbooru',
    blurb: 'Danbooru tag syntax (underscores, escaped parens) plus the `masterpiece, best quality` opener — follows Arctenox\'s Illustrious guide.',
  },
];

/**
 * AI settings: which model every helper uses (Venice in the cloud, or a model on
 * the local Ollama server), the prompt style, Venice's key, and the local model
 * manager. Stored locally; calls go straight from this tab to the provider.
 */
export function VeniceTab() {
  const venice = useStore(s => s.venice);
  const setVenice = useStore(s => s.setVenice);

  return (
    <Stack gap="lg">
      <SettingsSection
        title="Active model"
        description="Used by every AI helper: Prompt Studio, expand / shorten / improve, brainstorm, per-layer tweak, and the Collections image tools."
      >
        <AiModelPicker />
      </SettingsSection>

      <SettingsSection
        title="Venice AI"
        description="Venice AI provides uncensored, privacy-respecting chat completions. The Snippet Library uses it to brainstorm new ideas, expand or tighten prompts, and improve wording. Your API key is stored in this browser only — calls go directly to Venice from your tab."
      >
        <PasswordInput
          label="API Key"
          description={
            <>
              Get a key at{' '}
              <Anchor href="https://venice.ai/settings/api" target="_blank" rel="noreferrer" size="xs">venice.ai/settings/api</Anchor>
              {' · '}
              <Anchor href="https://docs.venice.ai/overview/getting-started" target="_blank" rel="noreferrer" size="xs">docs</Anchor>
            </>
          }
          placeholder="vn-…"
          leftSection={<IconKey size={16} />}
          value={venice.apiKey}
          onChange={(e) => setVenice({ apiKey: e.currentTarget.value })}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
        />
        <VeniceModelSelect />
      </SettingsSection>

      <SettingsSection
        title="Prompt Style"
        description="Applied to every AI helper: generate, expand / shorten / improve, brainstorm, per-layer tweak, and image → prompt."
      >
        <Radio.Group value={venice.promptStyle} onChange={(v) => setVenice({ promptStyle: v as PromptStyle })}>
          <Stack gap="sm">
            {STYLE_OPTIONS.map(opt => (
              <Radio key={opt.id} value={opt.id} label={opt.label} description={opt.blurb} />
            ))}
          </Stack>
        </Radio.Group>
      </SettingsSection>

      <SettingsSection
        title="Local LLM"
        description="Your own uncensored models on Ollama (winold's RTX A4500). Free, private, and no rate limits. Calls go from this tab straight to the server."
      >
        <LocalLlmSection />
      </SettingsSection>

      <SettingsSection title="Venice Base URL" description="Advanced — leave empty to use the default.">
        <TextInput
          placeholder={VENICE_DEFAULT_BASE_URL}
          aria-label="Base URL"
          leftSection={<IconWorld size={16} />}
          value={venice.baseUrl}
          onChange={(e) => setVenice({ baseUrl: e.currentTarget.value })}
          spellCheck={false}
        />
        <Text size="xs" c="dimmed">
          Any OpenAI-compatible endpoint will work if you prefer a different provider.
        </Text>
      </SettingsSection>
    </Stack>
  );
}

/** Venice's chat models from its own list (searchable), so no model id has to be typed. */
function VeniceModelSelect() {
  const venice = useStore(s => s.venice);
  const setVenice = useStore(s => s.setVenice);
  const models = useVeniceModels(s => s.models);
  const error = useVeniceModels(s => s.error);
  useVeniceModelsFor(venice.baseUrl);
  const current = venice.model || VENICE_DEFAULT_MODEL;
  const data = models.map(m => ({ value: m.id, label: veniceModelLabel(m) }));
  if (!models.some(m => m.id === current)) data.unshift({ value: current, label: current });

  return (
    <Select
      label="Model"
      description={error
        ? <>Could not load Venice's model list ({error}). Showing the saved model.</>
        : <>Default: <Code>{VENICE_DEFAULT_MODEL}</Code>. Type to search {models.length || ''} models.</>}
      leftSection={<IconSparkles size={16} />}
      value={current}
      onChange={(v) => { if (v) setVenice({ model: v }); }}
      data={data}
      searchable
      allowDeselect={false}
      nothingFoundMessage="No model matches"
      maxDropdownHeight={360}
      comboboxProps={{ withinPortal: true, shadow: 'md', zIndex: 320 }}
    />
  );
}
