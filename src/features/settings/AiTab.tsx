import { Anchor, Radio, Stack, Text } from '@mantine/core';
import { useStore } from '@/lib/store';
import { aiStatusLine, keyState, providerReady, providerSpec, shortModelName, type PromptStyle } from '@/lib/aiProviders';
import { SettingsSection } from './SettingsSection';
import { AiModelPicker } from '@/features/ai/AiModelPicker';
import { LocalLlmSection } from '@/features/ai/LocalLlmSection';

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
 * Classic Settings → AI: which of the added providers is active (one radio; the same store the
 * new UI edits), its model, the prompt style, and the local model manager. Cloud providers and
 * their keys are set up and tested in the new UI's Settings → AI helper.
 */
export function AiTab() {
  const ai = useStore(s => s.ai);
  const setAi = useStore(s => s.setAi);
  const setActiveAi = useStore(s => s.setActiveAi);

  return (
    <Stack gap="lg">
      <SettingsSection
        title="Active provider"
        description={`Used by every AI helper: Prompt Studio, expand / shorten / improve, brainstorm, per-layer tweak, and the Collections image tools. ${aiStatusLine(ai)}.`}
      >
        <Radio.Group value={ai.active} onChange={(v) => setActiveAi(v as typeof ai.active)}>
          <Stack gap="xs">
            {ai.providers.map((p) => {
              const spec = providerSpec(p.id);
              const state = keyState(p);
              const note = providerReady(p)
                ? shortModelName(p.model)
                : p.id === 'local' ? (p.tested ? 'no model picked' : 'server not checked yet')
                  : state === 'none' ? 'no key' : state === 'pending' ? 'key not tested' : 'no model picked';
              return <Radio key={p.id} value={p.id} label={spec.name} description={note} />;
            })}
          </Stack>
        </Radio.Group>
        <Text size="xs" c="dimmed">
          Add cloud providers (OpenRouter, OpenAI, Anthropic, Gemini…), enter and test their keys in the{' '}
          <Anchor href="next/#/settings/ai" size="xs">new UI's Settings → AI helper</Anchor>.
        </Text>
        <AiModelPicker label="Model" />
      </SettingsSection>

      <SettingsSection
        title="Prompt Style"
        description="Applied to every AI helper: generate, expand / shorten / improve, brainstorm, per-layer tweak, and image → prompt."
      >
        <Radio.Group value={ai.promptStyle} onChange={(v) => setAi({ promptStyle: v as PromptStyle })}>
          <Stack gap="sm">
            {STYLE_OPTIONS.map(opt => (
              <Radio key={opt.id} value={opt.id} label={opt.label} description={opt.blurb} />
            ))}
          </Stack>
        </Radio.Group>
      </SettingsSection>

      <SettingsSection
        title="Local LLM"
        description="Your own uncensored models on Ollama (winold's RTX A4500, or this pod's). Free, private, and no rate limits. Calls go from this tab straight to the server."
      >
        <LocalLlmSection />
      </SettingsSection>
    </Stack>
  );
}
