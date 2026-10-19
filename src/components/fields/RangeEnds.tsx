/**
 * What the two ends of a slider do, in a few words each, under the track: the low end's note on
 * the left, the high end's on the right, so the words sit where the thumb goes.
 */
import { Group, Text } from '@mantine/core';

/** [what a low value does, what a high value does]. */
export type Ends = readonly [low: string, high: string];

export function RangeEnds({ ends }: { ends: Ends }) {
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md" aria-hidden>
      <Text size="xs" c="dimmed" lh={1.3}>← {ends[0]}</Text>
      <Text size="xs" c="dimmed" lh={1.3} ta="right">{ends[1]} →</Text>
    </Group>
  );
}
