import { Select, type MantineSize } from '@mantine/core';
import { useStore } from '@/lib/store';
import { activeEntry, aiModelLabel, providerSpec, shortModelName } from '@/lib/aiProviders';
import { useProviderModels } from './aiModelsStore';

/**
 * The active provider's chat model, for the places that offer a quick switch (Prompt Studio,
 * "Write it", Mine). Only that provider's models are listed, searchable; the provider itself is
 * chosen in Settings → AI helper. A provider that is not set up yet shows its saved model only.
 */
export function AiModelPicker({ size = 'sm', label, className }: { size?: MantineSize; label?: string; className?: string }) {
  const ai = useStore((s) => s.ai);
  const setAiProvider = useStore((s) => s.setAiProvider);
  const entry = activeEntry(ai);
  const spec = providerSpec(entry.id);
  const { models, error } = useProviderModels(entry);

  const items = models.map((m) => ({ value: m.id, label: aiModelLabel(m) }));
  // The chosen id stays listed while the list is missing or no longer has it.
  if (entry.model && !models.some((m) => m.id === entry.model)) {
    items.unshift({ value: entry.model, label: `${shortModelName(entry.model)}${error || !entry.tested ? ' (offline)' : ''}` });
  }
  const group = !entry.tested ? `${spec.name} · set up in Settings` : error && !models.length ? `${spec.name} (offline)` : spec.name;

  return (
    <Select
      autoComplete="off"
      data-1p-ignore
      data-lpignore="true"
      size={size}
      label={label}
      className={className}
      aria-label="AI model"
      value={entry.model || null}
      placeholder={entry.tested ? 'Pick a model' : `${spec.name} is not set up`}
      allowDeselect={false}
      searchable
      nothingFoundMessage="No model matches"
      maxDropdownHeight={360}
      comboboxProps={{ withinPortal: true, shadow: 'md', zIndex: 320 }}
      data={[{ group, items }]}
      onChange={(v) => { if (v) setAiProvider(entry.id, { model: v }); }}
    />
  );
}
