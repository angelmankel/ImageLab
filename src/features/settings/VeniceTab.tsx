import { Stack, Text, TextInput, PasswordInput, Radio, Anchor, Code } from '@mantine/core';
import { IconKey, IconSparkles, IconWorld } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { VENICE_DEFAULT_MODEL, VENICE_DEFAULT_BASE_URL, type PromptStyle } from '@/lib/storage';
import { SettingsSection } from './SettingsSection';

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
 * Venice AI — uncensored chat-completion provider used by the Snippet
 * Library's "improve / expand / brainstorm" actions and the Collections
 * AI tools. Stored locally; never leaves the browser except via direct
 * calls to api.venice.ai.
 */
export function VeniceTab() {
  const venice = useStore(s => s.venice);
  const setVenice = useStore(s => s.setVenice);

  return (
    <Stack gap="lg">
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
        <TextInput
          label="Model"
          description={<>Default: <Code>{VENICE_DEFAULT_MODEL}</Code>. Any Venice chat model id works (e.g. <Code>llama-3.3-70b</Code>).</>}
          placeholder={VENICE_DEFAULT_MODEL}
          leftSection={<IconSparkles size={16} />}
          value={venice.model}
          onChange={(e) => setVenice({ model: e.currentTarget.value })}
          spellCheck={false}
        />
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

      <SettingsSection title="Base URL" description="Advanced — leave empty to use the default.">
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
