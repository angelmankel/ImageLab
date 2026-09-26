import { memo, useRef, useState } from 'react';
import { ActionIcon, Badge, Button, Checkbox, Menu, Text, TextInput, Tooltip } from '@mantine/core';
import {
  IconBoxModel, IconCheck, IconDownload, IconDots, IconExternalLink, IconInfoCircle, IconLoader2, IconNote, IconTrash,
} from '@tabler/icons-react';
import { cn } from '@/lib/cn';
import { NOTE_MAX, displayName, formatSizeKB, needsDetails, thumbUrl, typeLabel, type ModelLibraryEntry } from '@/lib/modelLibrary';
import { StarRating } from './StarRating';
import type { EntryStatus } from './useLibraryDownloads';

type Props = {
  entry: ModelLibraryEntry;
  status: EntryStatus | undefined;
  selected: boolean;
  narrow: boolean;
  /** False when no server is online. */
  canDownload: boolean;
  onToggle: (versionId: number) => void;
  onDownload: (entry: ModelLibraryEntry) => void;
  onRemove: (entry: ModelLibraryEntry) => void;
  onRate: (versionId: number, rating: number) => void;
  onNote: (versionId: number, note: string) => void;
  onOpenInfo: (entry: ModelLibraryEntry) => void;
};

function formatDay(ms: number): string {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * One model in "My models". Desktop: a single line (checkbox, thumbnail, name, size / date,
 * install state, stars, actions). Phone: the same parts stacked, with stars and actions on a
 * bottom line so nothing needs sideways scrolling at 390px.
 */
export const LibraryRow = memo(function LibraryRow({
  entry: e, status, selected, narrow, canDownload, onToggle, onDownload, onRemove, onRate, onNote, onOpenInfo,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(e.note);
  const [thumbFailed, setThumbFailed] = useState(false);
  const name = displayName(e);
  const on = status?.on ?? [];
  const installedEverywhere = !!status?.installed;
  const downloading = !!status?.downloading;

  // Enter / Escape unmount the input, which fires blur; this keeps that blur from saving again.
  const cancelled = useRef(false);
  const startEditing = () => { cancelled.current = false; setDraft(e.note); setEditing(true); };
  const saveNote = () => {
    if (!cancelled.current) onNote(e.versionId, draft);
    cancelled.current = true;
    setEditing(false);
  };

  const thumb = (
    <button type="button" onClick={() => onOpenInfo(e)} disabled={!e.modelId}
      className={cn('relative shrink-0 overflow-hidden rounded-md bg-bg-elev', narrow ? 'h-16 w-16' : 'h-14 w-14', e.modelId && 'cursor-pointer')}
      aria-label={`Model info for ${name}`}>
      {e.thumbnailUrl && !thumbFailed
        ? <img src={thumbUrl(e.thumbnailUrl, 160)} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"
            className="h-full w-full object-cover" onError={() => setThumbFailed(true)} />
        : <span className="flex h-full w-full items-center justify-center text-fg-dim"><IconBoxModel size={22} /></span>}
    </button>
  );

  const installBadges = (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      {on.map((s) => (
        <Badge key={s.id} size="xs" variant="light" color="green" tt="none" leftSection={<IconCheck size={10} />}>{s.name}</Badge>
      ))}
      {on.length === 0 && status?.hashMatch && (
        <Tooltip label="A connected server's hash index has this file">
          <Badge size="xs" variant="light" color="green" tt="none" leftSection={<IconCheck size={10} />}>On a server</Badge>
        </Tooltip>
      )}
      {on.length === 0 && !status?.hashMatch && (
        <Badge size="xs" variant="outline" color="gray" tt="none">{canDownload ? 'Not installed' : 'No server online'}</Badge>
      )}
      {downloading && <Badge size="xs" variant="light" tt="none" leftSection={<IconLoader2 size={10} className="animate-spin" />}>Downloading</Badge>}
    </div>
  );

  const downloadLabel = downloading ? 'Downloading…' : installedEverywhere ? 'Installed' : 'Download';
  const actions = (
    <div className="flex shrink-0 items-center gap-1">
      <Button size="compact-xs" variant={installedEverywhere ? 'light' : 'default'} color={installedEverywhere ? 'green' : undefined}
        disabled={!canDownload || downloading || installedEverywhere}
        leftSection={downloading ? <IconLoader2 size={12} className="animate-spin" /> : installedEverywhere ? <IconCheck size={12} /> : <IconDownload size={12} />}
        onClick={() => onDownload(e)}
        title={!canDownload ? 'No servers online' : installedEverywhere ? 'Already on every chosen server' : status?.missing.length ? `Download to ${status.missing.map((s) => s.name).join(', ')}` : undefined}>
        {downloadLabel}
      </Button>
      <Tooltip label="Open on CivitAI">
        <ActionIcon component="a" href={e.pageUrl} target="_blank" rel="noreferrer" variant="subtle" color="gray" size="md" aria-label={`Open ${name} on CivitAI`}>
          <IconExternalLink size={15} />
        </ActionIcon>
      </Tooltip>
      <Menu position="bottom-end" withinPortal shadow="md" width={200}>
        <Menu.Target>
          <ActionIcon variant="subtle" color="gray" size="md" aria-label={`More for ${name}`}><IconDots size={15} /></ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<IconInfoCircle size={14} />} disabled={!e.modelId} onClick={() => onOpenInfo(e)}>Model info</Menu.Item>
          <Menu.Item leftSection={<IconNote size={14} />} onClick={startEditing}>
            {e.note ? 'Edit note' : 'Add note'}
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => onRemove(e)}>Remove from list</Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </div>
  );

  const facts = [formatSizeKB(e.sizeKB), e.addedAt ? `added ${formatDay(e.addedAt)}` : ''].filter(Boolean).join(' · ');

  const info = (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <button type="button" onClick={() => onOpenInfo(e)} disabled={!e.modelId}
        className={cn('min-w-0 text-left', e.modelId ? 'cursor-pointer hover:underline' : 'cursor-default')}>
        <Text size="sm" fw={600} truncate title={name}>{name}</Text>
      </button>
      <Text size="xs" c="dimmed" truncate title={e.fileName || undefined}>
        {[e.versionName, e.fileName && e.fileName !== e.versionName ? e.fileName : ''].filter(Boolean).join(' · ') || (needsDetails(e) ? 'Details not fetched from CivitAI yet' : `Version ${e.versionId}`)}
      </Text>
      <div className="flex min-w-0 flex-wrap items-center gap-1 pt-0.5">
        <Badge size="xs" variant="light" tt="none">{typeLabel(e.type)}</Badge>
        {e.baseModel && <Badge size="xs" variant="light" color="gray" tt="none">{e.baseModel}</Badge>}
        {e.catalog === 'red' && <Badge size="xs" variant="light" color="red" tt="none">civitai.red</Badge>}
        {narrow && facts && <Text size="10px" c="dimmed" className="whitespace-nowrap">{facts}</Text>}
      </div>
      {!editing && e.note && (
        <Text size="xs" c="dimmed" fs="italic" lineClamp={2} className="cursor-pointer" onClick={startEditing}>
          {e.note}
        </Text>
      )}
      {editing && (
        <TextInput size="xs" autoFocus value={draft} maxLength={NOTE_MAX} placeholder="Short note"
          onChange={(ev) => setDraft(ev.currentTarget.value)}
          onBlur={saveNote}
          onKeyDown={(ev) => {
            if (ev.key === 'Enter') saveNote();
            if (ev.key === 'Escape') { cancelled.current = true; setEditing(false); }
          }}
          aria-label={`Note for ${name}`} />
      )}
      {narrow && <div className="pt-1">{installBadges}</div>}
    </div>
  );

  const check = (
    <Checkbox size="sm" checked={selected} onChange={() => onToggle(e.versionId)} aria-label={`Select ${name}`} className="shrink-0" />
  );

  if (narrow) {
    return (
      <div className={cn('flex flex-col gap-1.5 border-b border-border-subtle px-3 py-2.5', selected && 'bg-[var(--mantine-primary-color-light)]')}>
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="pt-5">{check}</div>
          {thumb}
          {info}
        </div>
        <div className="flex items-center justify-between gap-2 pl-7">
          <StarRating value={e.rating} onChange={(n) => onRate(e.versionId, n)} />
          {actions}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-3 border-b border-border-subtle px-3 py-2 hover:bg-bg-panel', selected && 'bg-[var(--mantine-primary-color-light)] hover:bg-[var(--mantine-primary-color-light)]')}>
      {check}
      {thumb}
      {info}
      <div className="flex w-28 shrink-0 flex-col items-end gap-0.5 text-right">
        <Text size="xs">{formatSizeKB(e.sizeKB) || '—'}</Text>
        <Text size="10px" c="dimmed" title={`Last downloaded ${formatDay(e.lastDownloadedAt)}`}>{formatDay(e.addedAt)}</Text>
      </div>
      <div className="w-40 shrink-0">{installBadges}</div>
      <StarRating value={e.rating} onChange={(n) => onRate(e.versionId, n)} />
      {actions}
    </div>
  );
});
