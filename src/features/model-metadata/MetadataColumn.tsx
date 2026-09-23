import type { ReactNode } from 'react';
import {
  Anchor, Avatar, Badge, Box, Button, CloseButton, Group, ScrollArea, Skeleton, Stack, Text, Title,
} from '@mantine/core';
import { IconExternalLink, IconRefresh } from '@tabler/icons-react';
import { civitaiModelUrl } from './civitai';
import { useModelMetadataStore, useSelectedVersion } from './store';
import { Section } from './Section';
import { StatsStrip } from './StatsStrip';
import { VersionSelector } from './VersionSelector';
import { VersionNotes } from './VersionNotes';
import { TriggerWords } from './TriggerWords';
import { RecommendedSettings } from './RecommendedSettings';
import { AboutSection } from './AboutSection';
import { FileDetails } from './FileDetails';
import { LicenseChips } from './LicenseChips';
import { DownloadAction } from './DownloadAction';

/** v1's side panel: a fixed-width column with a left border, header / scroll body / footer. */
function Column({ children }: { children: ReactNode }) {
  return (
    <Box
      w={380}
      className="flex min-h-0 shrink-0 flex-col"
      style={{ borderLeft: '1px solid var(--mantine-color-dark-4)', backgroundColor: 'var(--mantine-color-dark-6)' }}
    >
      {children}
    </Box>
  );
}

function Header({ children }: { children: ReactNode }) {
  return (
    <Stack gap="xs" p="md" className="shrink-0" style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }}>
      {children}
    </Stack>
  );
}

function Body({ children }: { children: ReactNode }) {
  return (
    <ScrollArea scrollbars="y" className="min-h-0 flex-1" type="auto" offsetScrollbars>
      <Stack gap="md" p="md">{children}</Stack>
    </ScrollArea>
  );
}

function Footer({ children }: { children: ReactNode }) {
  return (
    <Group gap="xs" p="md" className="shrink-0" style={{ borderTop: '1px solid var(--mantine-color-dark-4)' }}>
      {children}
    </Group>
  );
}

function Close() {
  const close = useModelMetadataStore((s) => s.close);
  return <CloseButton aria-label="Close" onClick={close} />;
}

/**
 * Right column of the metadata modal — header + scrollable metadata sections +
 * footer. Each section is its own component in this folder so the column stays
 * a thin composition and the pieces stay independently maintainable.
 */
export function MetadataColumn() {
  const load = useModelMetadataStore((s) => s.load);
  const model = useModelMetadataStore((s) => s.model);
  const error = useModelMetadataStore((s) => s.error);
  const close = useModelMetadataStore((s) => s.close);
  const retry = useModelMetadataStore((s) => s.retry);
  const openModelId = useModelMetadataStore((s) => s.openModelId);
  const version = useSelectedVersion();

  return (
    <Column>
      {load === 'loading' || load === 'idle' ? (
        <MetadataSkeleton />
      ) : load === 'error' || !model || !version ? (
        <MetadataErrorState
          error={error ?? 'Failed to load metadata.'}
          modelId={openModelId}
          onRetry={retry}
        />
      ) : (
        <>
          <Header>
            <Group gap="xs" wrap="nowrap">
              <Badge size="sm" variant="light">{model.type}</Badge>
              {model.nsfw && <Badge size="sm" variant="light" color="red">NSFW</Badge>}
              <div className="flex-1" />
              <Close />
            </Group>
            <Title order={4} lh={1.25}>{model.name}</Title>
            <Group gap={6}>
              <Avatar src={model.creator?.image ?? null} size={20} radius="xl" />
              <Text size="xs" c="dimmed">by {model.creator?.username ?? 'unknown'}</Text>
              <Text size="xs" c="dark.3">·</Text>
              <Anchor href={civitaiModelUrl(model.id)} target="_blank" rel="noreferrer" size="xs" className="inline-flex items-center gap-1">
                Civitai <IconExternalLink size={12} />
              </Anchor>
            </Group>
          </Header>

          <Body>
            <StatsStrip stats={model.stats} />
            <Section label="Version">
              <VersionSelector />
            </Section>
            <VersionNotes version={version} />
            <TriggerWords version={version} />
            <RecommendedSettings />
            {model.description && <AboutSection description={model.description} />}
            {(model.tags ?? []).length > 0 && (
              <Section label="Tags">
                <Group gap={6}>
                  {model.tags.map((t) => (
                    <Badge key={t} size="sm" variant="default" tt="none">{t}</Badge>
                  ))}
                </Group>
              </Section>
            )}
            <FileDetails version={version} />
            <LicenseChips model={model} />
          </Body>

          <Footer>
            <Button
              component="a"
              href={civitaiModelUrl(model.id)}
              target="_blank"
              rel="noreferrer"
              size="xs"
              variant="default"
              rightSection={<IconExternalLink size={13} />}
            >
              Civitai
            </Button>
            <div className="flex-1" />
            <DownloadAction version={version} />
            <Button size="xs" onClick={close}>Done</Button>
          </Footer>
        </>
      )}
    </Column>
  );
}

/**
 * Skeleton shown while the CivitAI metadata fetch is in flight. Mirrors the
 * real column's structure (header chips → title → byline → stats strip →
 * section blocks → footer) so the layout doesn't shift when the data lands.
 * Subtle pulse so it reads as "loading" without being distracting.
 */
function MetadataSkeleton() {
  return (
    <>
      <Header>
        <Group gap="xs" wrap="nowrap">
          <Skeleton h={18} w={64} radius="sm" />
          <div className="flex-1" />
          <Close />
        </Group>
        <Skeleton h={22} w="75%" />
        <Group gap={6}>
          <Skeleton h={20} w={20} circle />
          <Skeleton h={10} w={128} />
        </Group>
      </Header>
      <Body>
        {/* Stats strip */}
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} h={46} />)}
        </div>
        {/* Version selector */}
        <Stack gap={6}>
          <Skeleton h={10} w={64} />
          <Skeleton h={30} />
        </Stack>
        {/* Two text-section placeholders */}
        {Array.from({ length: 2 }).map((_, i) => (
          <Stack key={i} gap={6}>
            <Skeleton h={10} w={96} />
            <Skeleton h={10} />
            <Skeleton h={10} w="83%" />
            <Skeleton h={10} w="66%" />
          </Stack>
        ))}
        {/* File details */}
        <Stack gap={6}>
          <Skeleton h={10} w={80} />
          <Skeleton h={64} />
        </Stack>
      </Body>
      <Footer>
        <Skeleton h={30} w={90} />
        <div className="flex-1" />
        <Skeleton h={30} w={110} />
        <Skeleton h={30} w={56} />
      </Footer>
    </>
  );
}

/**
 * Failure state — explains what broke and gives the user usable escape
 * hatches instead of a dead text blob. Always offers Retry; when we know
 * the CivitAI model id (the common path, since both `open()` and the
 * file-resolver set it before fetching), the "Open on Civitai" link is
 * deep-linked so the user can manually grab the model from there.
 */
function MetadataErrorState({
  error, modelId, onRetry,
}: { error: string; modelId: number | null; onRetry: () => void }) {
  return (
    <>
      <Header>
        <Group gap="xs" wrap="nowrap">
          <Badge size="sm" variant="light" color="red">Error</Badge>
          <div className="flex-1" />
          <Close />
        </Group>
        <Title order={4} lh={1.25}>Couldn’t load metadata</Title>
        <Text size="xs" c="dimmed">{error}</Text>
      </Header>
      <Body>
        <Text size="xs" c="dimmed">
          The CivitAI request didn’t come back in time. You can retry, or open the model directly on CivitAI to download a version yourself.
        </Text>
      </Body>
      <Footer>
        <Button size="xs" variant="default" leftSection={<IconRefresh size={13} />} onClick={onRetry}>
          Retry
        </Button>
        {modelId != null && (
          <Button
            component="a"
            href={civitaiModelUrl(modelId)}
            target="_blank"
            rel="noreferrer"
            size="xs"
            variant="default"
            rightSection={<IconExternalLink size={13} />}
          >
            Open on Civitai
          </Button>
        )}
      </Footer>
    </>
  );
}
