import { Paper, SimpleGrid, Text } from '@mantine/core';
import { Section } from './Section';
import { useVersionImages } from './store';

/**
 * Civitai has no structured "recommended settings" field — they're usually
 * buried in the description prose. As a useful approximation we surface the
 * params from a representative gallery image as the version's typical settings.
 * The images come from the Images API (via `useVersionImages`), which keeps
 * each image's `meta`; the `models/:id` payload strips it.
 */
export function RecommendedSettings() {
  const images = useVersionImages();
  const meta = images.find((img) => img.meta)?.meta ?? null;
  if (!meta) return null;

  const cells: { label: string; value: string }[] = [
    { label: 'CFG scale', value: meta.cfgScale != null ? String(meta.cfgScale) : '—' },
    { label: 'Steps', value: meta.steps != null ? String(meta.steps) : '—' },
    { label: 'Sampler', value: meta.sampler ?? '—' },
  ];

  return (
    <Section label="Typical settings">
      <SimpleGrid cols={3} spacing="xs">
        {cells.map((c) => (
          <Paper key={c.label} withBorder p={8} radius="sm">
            <Text size="xs" fw={600} truncate>{c.value}</Text>
            <Text size="10px" c="dimmed">{c.label}</Text>
          </Paper>
        ))}
      </SimpleGrid>
    </Section>
  );
}
