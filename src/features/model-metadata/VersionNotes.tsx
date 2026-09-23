import { type CivitaiModelVersion, stripHtml } from './civitai';
import { Text } from '@mantine/core';
import { Section } from './Section';

/**
 * The selected version's own notes / changelog (`version.description`) — distinct
 * from the model-level "About". Hidden when the version has no notes.
 */
export function VersionNotes({ version }: { version: CivitaiModelVersion }) {
  const notes = stripHtml(version.description);
  if (!notes) return null;
  return (
    <Section label="Version notes">
      <Text size="xs" c="dimmed" lineClamp={6} className="whitespace-pre-line leading-relaxed">
        {notes}
      </Text>
    </Section>
  );
}
