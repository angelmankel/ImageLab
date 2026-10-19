import { Select, type MantineSize } from '@mantine/core';
import { useStore } from '@/lib/store';
import { LOCAL_LLM_DEFAULT_BASE_URL, VENICE_DEFAULT_MODEL, podLlmUrl } from '@/lib/storage';
import { ollamaRoot } from '@/lib/localLlm';
import { formatBytes, modelLabel } from '@/lib/llmModels';
import { veniceModelLabel } from '@/lib/veniceModels';
import { useLocalModels, useLocalModelsFor } from './localModelsStore';
import { useVeniceModels, useVeniceModelsFor } from './veniceModelsStore';

/**
 * One switch for every AI helper: Venice (cloud) or any model installed on the local Ollama
 * server. Values are `venice::<model>` / `local::<name>`. Both lists load on first show; Venice's
 * is every chat model it offers, searchable.
 */
export function AiModelPicker({ size = 'sm', label, className }: { size?: MantineSize; label?: string; className?: string }) {
  const venice = useStore((s) => s.venice);
  const setVenice = useStore((s) => s.setVenice);
  const models = useLocalModels((s) => s.models);
  const error = useLocalModels((s) => s.error);
  const veniceModels = useVeniceModels((s) => s.models);
  useLocalModelsFor(venice.localBaseUrl);
  useVeniceModelsFor(venice.baseUrl);

  const veniceModel = venice.model || VENICE_DEFAULT_MODEL;
  const localItems = models.map((m) => ({
    value: `local::${m.name}`,
    label: `${modelLabel(m.name)}  (${[m.params, formatBytes(m.bytes)].filter(Boolean).join(', ')})`,
  }));
  // Keep the chosen local model listed while the server is offline, so the select is not blank.
  if (venice.localModel && !models.some((m) => m.name === venice.localModel)) {
    localItems.unshift({ value: `local::${venice.localModel}`, label: `${modelLabel(venice.localModel)} (offline)` });
  }
  const noKey = venice.apiKey ? '' : ' (no key)';
  const veniceItems = veniceModels.map((m) => ({ value: `venice::${m.id}`, label: `${veniceModelLabel(m)}${noKey}` }));
  // The chosen id stays listed when the list failed to load or no longer has it.
  if (!veniceModels.some((m) => m.id === veniceModel)) {
    veniceItems.unshift({ value: `venice::${veniceModel}`, label: `${veniceModel}${noKey}` });
  }
  const root = ollamaRoot(venice.localBaseUrl);
  const server = root === ollamaRoot(LOCAL_LLM_DEFAULT_BASE_URL) ? 'home PC' : podLlmUrl() && root === ollamaRoot(podLlmUrl()) ? 'this pod' : 'Ollama';
  const value = venice.provider === 'local' && venice.localModel ? `local::${venice.localModel}` : `venice::${veniceModel}`;

  return (
    <Select
      size={size}
      label={label}
      className={className}
      aria-label="AI model"
      value={value}
      allowDeselect={false}
      searchable
      nothingFoundMessage="No model matches"
      maxDropdownHeight={360}
      comboboxProps={{ withinPortal: true, shadow: 'md', zIndex: 320 }}
      data={[
        { group: 'Venice (cloud)', items: veniceItems },
        {
          group: error && !models.length ? `Local · ${server} (offline)` : `Local · ${server}`,
          items: localItems,
        },
      ]}
      onChange={(v) => {
        if (!v) return;
        const [kind, ...rest] = v.split('::');
        const id = rest.join('::');
        if (kind === 'local') setVenice({ provider: 'local', localModel: id });
        else setVenice({ provider: 'venice', model: id });
      }}
    />
  );
}
