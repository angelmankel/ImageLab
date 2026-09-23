import { Paper, SimpleGrid, Text } from '@mantine/core';
import { type CivitaiStats, formatCount } from './civitai';

/**
 * Civitai retired the 5-star `rating`/`ratingCount` fields in late 2023; newer
 * models only carry thumbs up/down. Prefer the legacy stars when present,
 * otherwise show the thumbs-up share of the vote.
 */
function formatRating(stats: CivitaiStats): string {
  if (stats.rating != null && (stats.ratingCount ?? 0) > 0) {
    return `${stats.rating.toFixed(1)} ★`;
  }
  const total = stats.thumbsUpCount + stats.thumbsDownCount;
  if (total === 0) return '—';
  return `${Math.round((stats.thumbsUpCount / total) * 100)}%`;
}

/** Download / like / comment / rating counts from `model.stats`. */
export function StatsStrip({ stats }: { stats: CivitaiStats }) {
  const cells: { label: string; value: string }[] = [
    { label: 'Downloads', value: formatCount(stats.downloadCount) },
    { label: 'Likes', value: formatCount(stats.thumbsUpCount) },
    { label: 'Comments', value: formatCount(stats.commentCount) },
    { label: 'Rating', value: formatRating(stats) },
  ];
  return (
    <SimpleGrid cols={4} spacing="xs">
      {cells.map((c) => (
        <Paper key={c.label} withBorder p={8} radius="sm">
          <Text size="sm" fw={600}>{c.value}</Text>
          <Text size="10px" c="dimmed">{c.label}</Text>
        </Paper>
      ))}
    </SimpleGrid>
  );
}
