import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { serversWithModel } from '@/lib/routing';
import { type CivitaiModelVersion, formatFileSize, primaryFile } from './civitai';
import { Section } from './Section';
import { useModelMetadataStore } from './store';
import { Badge, Group, Paper, Stack, Text } from '@mantine/core';
import { IconCheck, IconFile } from '@tabler/icons-react';

/**
 * Primary file: name, size / format / precision, AutoV2 hash, scan status, and
 * which connected server(s) have the model on disk.
 */
export function FileDetails({ version }: { version: CivitaiModelVersion }) {
  const fileName = useModelMetadataStore((s) => s.openFileName);
  const servers = useStore((s) => s.servers);
  const serverInfo = useStore((s) => s.serverInfo);

  // Which servers host the model the modal was opened for. Matched by the
  // local file name against each server's model lists.
  const hostNames = useMemo(() => {
    if (!fileName) return [];
    const ids = new Set(serversWithModel(serverInfo, fileName));
    return servers.filter((s) => ids.has(s.id)).map((s) => s.name);
  }, [fileName, servers, serverInfo]);

  const file = primaryFile(version);
  if (!file) return null;

  const meta = file.metadata ?? { fp: null, size: null, format: null };
  const bits = [formatFileSize(file.sizeKB), meta.format, meta.fp, meta.size].filter(
    (b): b is string => Boolean(b),
  );
  const hash = file.hashes?.AutoV2;
  const scanned = file.virusScanResult === 'Success' && file.pickleScanResult === 'Success';

  return (
    <Section label="File">
      <Paper withBorder p="sm" radius="sm">
        <Stack gap={8}>
          <Group gap="xs" wrap="nowrap">
            <IconFile size={14} className="shrink-0 text-[var(--mantine-color-dimmed)]" />
            <Text size="xs" fw={500} truncate>{file.name}</Text>
          </Group>
          <Text size="xs" c="dimmed">{bits.join(' · ')}</Text>
          {hash && (
            <Group gap="xs" wrap="nowrap">
              <Text size="10px" fw={600} c="dimmed" tt="uppercase">AutoV2</Text>
              <Text size="xs" ff="monospace">{hash}</Text>
              {scanned && (
                <Badge size="xs" variant="light" color="green" ml="auto" leftSection={<IconCheck size={10} />}>
                  Scanned
                </Badge>
              )}
            </Group>
          )}
          {fileName && (
            <Group gap="xs" pt={8} style={{ borderTop: '1px solid var(--mantine-color-dark-4)' }}>
              <Text size="10px" fw={600} c="dimmed" tt="uppercase">Servers</Text>
              {hostNames.length > 0 ? (
                <Group gap={4}>
                  {hostNames.map((n) => (
                    <Badge key={n} size="xs" variant="default" tt="none">{n}</Badge>
                  ))}
                </Group>
              ) : (
                <Text size="xs" c="dimmed">Not on any connected server</Text>
              )}
            </Group>
          )}
        </Stack>
      </Paper>
    </Section>
  );
}
