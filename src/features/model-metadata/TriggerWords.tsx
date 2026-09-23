import type { CivitaiModelVersion } from './civitai';
import { Section } from './Section';
import { Badge, Group, Tooltip } from '@mantine/core';
import { IconCopy } from '@tabler/icons-react';

/** A version's `trainedWords` as click-to-copy chips. Hidden when there are none. */
export function TriggerWords({ version }: { version: CivitaiModelVersion }) {
  const trainedWords = version.trainedWords ?? [];
  if (trainedWords.length === 0) return null;
  const copy = (word: string) => {
    navigator.clipboard?.writeText(word).catch(() => { /* clipboard unavailable */ });
  };
  return (
    <Section label="Trigger words">
      <Group gap={6}>
        {trainedWords.map((word) => (
          <Tooltip key={word} label="Copy" withArrow>
            <Badge
              component="button"
              type="button"
              onClick={() => copy(word)}
              size="md"
              variant="light"
              tt="none"
              rightSection={<IconCopy size={11} />}
              className="cursor-pointer"
            >
              {word}
            </Badge>
          </Tooltip>
        ))}
      </Group>
    </Section>
  );
}
