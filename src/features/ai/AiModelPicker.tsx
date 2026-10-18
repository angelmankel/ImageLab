import { Select, type MantineSize } from '@mantine/core';
import { useStore } from '@/lib/store';
import { VENICE_DEFAULT_MODEL } from '@/lib/storage';
import { formatBytes, modelLabel } from '@/lib/llmModels';
import { useLocalModels, useLocalModelsFor } from './localModelsStore';

/**
 * One switch for every AI helper: Venice (cloud) or any model installed on the local Ollama
 * server. Values are `venice::<model>` / `local::<name>`. The local list loads on first show.
 */
export function AiModelPicker({ size = 'sm', label, className }: { size?: MantineSize; label?: string; className?: string }) {
  const venice = useStore((s) => s.venice);
  const setVenice = useStore((s) => s.setVenice);
  const models = useLocalModels((s) => s.models);
  const error = useLocalModels((s) => s.error);
  useLocalModelsFor(venice.localBaseUrl);

  const veniceModel = venice.model || VENICE_DEFAULT_MODEL;
  const localItems = models.map((m) => ({
    value: `local::${m.name}`,
    label: `${modelLabel(m.name)}  (${[m.params, formatBytes(m.bytes)].filter(Boolean).join(', ')})`,
  }));
  // Keep the chosen local model listed while the server is offline, so the select is not blank.
  if (venice.localModel && !models.some((m) => m.name === venice.localModel)) {
    localItems.unshift({ value: `local::${venice.localModel}`, label: `${modelLabel(venice.localModel)} (offline)` });
  }
  const value = venice.provider === 'local' && venice.localModel ? `local::${venice.localModel}` : `venice::${veniceModel}`;

  return (
    <Select
      size={size}
      label={label}
      className={className}
      aria-label="AI model"
      value={value}
      allowDeselect={false}
      comboboxProps={{ withinPortal: true, shadow: 'md', zIndex: 320 }}
      data={[
        { group: 'Venice (cloud)', items: [{ value: `venice::${veniceModel}`, label: `Venice · ${veniceModel}${venice.apiKey ? '' : ' (no key)'}` }] },
        {
          group: error && !models.length ? 'Local (server offline)' : 'Local (Ollama)',
          items: localItems,
        },
      ]}
      onChange={(v) => {
        if (!v) return;
        const [kind, ...rest] = v.split('::');
        const id = rest.join('::');
        if (kind === 'local') setVenice({ provider: 'local', localModel: id });
        else setVenice({ provider: 'venice' });
      }}
    />
  );
}
