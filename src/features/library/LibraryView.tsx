import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { ActionIcon, Alert, Badge, Button, Checkbox, CloseButton, Text, TextInput, Tooltip } from '@mantine/core';
import {
  IconBoxModel, IconDownload, IconFileExport, IconFileImport, IconSearch, IconTrash, IconUpload,
} from '@tabler/icons-react';
import { Select } from '@/components/ui/Select';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useModelMetadataStore } from '@/features/model-metadata/store';
import {
  exportFileName, exportLibrary, libraryTypes, typeLabel, viewEntries, type LibrarySort, type ModelLibraryEntry,
} from '@/lib/modelLibrary';
import { useLibraryStore } from './store';
import { BrowserModeSwitch } from './BrowserModeSwitch';
import { LibraryRow } from './LibraryRow';
import { ALL_SERVERS, useLibraryDownloads } from './useLibraryDownloads';

/**
 * "My models" — every model downloaded through the app, kept on this device.
 *
 *   ┌ header: [Browse | My models]  count            Import  Export ┐
 *   ├ search · type · sort · download-to server                     ┤
 *   ├ [✓] All   n selected   Download selected  Download all  Remove ┤
 *   │ [ ] ▣ Name / version / badges   size·date  on-servers ★★★ ↓ ⋯ │
 *   └───────────────────────────────────────────────────────────────┘
 *
 * Export writes the list as JSON; Import (button or dropping the file anywhere on the view)
 * merges one back in. Pods are thrown away, so this is how a fresh one gets refilled.
 */

const SORTS: Array<{ value: LibrarySort; label: string }> = [
  { value: 'added', label: 'Newest first' },
  { value: 'name', label: 'Name' },
  { value: 'rating', label: 'Rating' },
];
const ALL_TYPES = '__all';

type ImportNotice = { ok: boolean; message: string } | null;

export function LibraryView({ narrow }: { narrow: boolean }) {
  const entries = useLibraryStore((s) => s.entries);
  const importText = useLibraryStore((s) => s.importText);
  const remove = useLibraryStore((s) => s.remove);
  const setRating = useLibraryStore((s) => s.setRating);
  const setNote = useLibraryStore((s) => s.setNote);
  const fillMissingDetails = useLibraryStore((s) => s.fillMissingDetails);
  const openModel = useModelMetadataStore((s) => s.open);
  const confirm = useConfirm();

  const [search, setSearch] = useState('');
  const [type, setType] = useState(ALL_TYPES);
  const [sort, setSort] = useState<LibrarySort>('added');
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [notice, setNotice] = useState<ImportNotice>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const dragDepth = useRef(0);

  useEffect(() => { void fillMissingDetails(); }, [fillMissingDetails]);

  const types = useMemo(() => libraryTypes(entries), [entries]);
  const typeFilter = type !== ALL_TYPES && types.includes(type) ? type : '';
  const visible = useMemo(() => viewEntries(entries, { search, type: typeFilter, sort }), [entries, search, typeFilter, sort]);
  const filtered = visible.length !== entries.length;
  const { online, target, setTarget, status, downloadMany } = useLibraryDownloads(entries);

  // Actions work on what is selected *and shown*, so a filter never hides what they touch.
  const picked = useMemo(() => visible.filter((e) => selected.has(e.versionId)), [visible, selected]);
  const allShownPicked = visible.length > 0 && picked.length === visible.length;

  const toggle = useCallback((versionId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(versionId)) next.delete(versionId); else next.add(versionId);
      return next;
    });
  }, []);
  const selectAll = () => setSelected(new Set(visible.map((e) => e.versionId)));
  const selectNone = () => setSelected(new Set());

  const run = async (list: ModelLibraryEntry[]) => {
    setBusy(true);
    try { await downloadMany(list); } finally { setBusy(false); }
  };
  const downloadOne = useCallback((e: ModelLibraryEntry) => { void downloadMany([e]); }, [downloadMany]);
  const downloadAll = async () => {
    const todo = visible.filter((e) => {
      const st = status.get(e.versionId);
      return st && !st.installed && !st.downloading;
    });
    const skip = visible.filter((e) => status.get(e.versionId)?.installed).length;
    if (todo.length === 0) {
      await run(visible); // reports "skipped N already installed"
      return;
    }
    const where = target === ALL_SERVERS ? 'every online server that lacks it' : online.find((s) => s.id === target)?.name ?? 'the chosen server';
    const ok = await confirm({
      title: 'Download all',
      message: `Start ${todo.length} download${todo.length === 1 ? '' : 's'} on ${where}?${skip ? ` ${skip} already installed will be skipped.` : ''}`,
      confirmLabel: 'Download',
      destructive: false,
    });
    if (ok) await run(visible);
  };

  const removeOne = useCallback(async (e: ModelLibraryEntry) => {
    const ok = await confirm({
      title: 'Remove from list',
      message: `Remove “${e.modelName || e.fileName || e.versionId}” from My models? The file on the servers is not touched.`,
      confirmLabel: 'Remove',
    });
    if (ok) remove([e.versionId]);
  }, [confirm, remove]);
  const removePicked = async () => {
    const ok = await confirm({
      title: 'Remove from list',
      message: `Remove ${picked.length} model${picked.length === 1 ? '' : 's'} from My models? Files on the servers are not touched.`,
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    remove(picked.map((e) => e.versionId));
    selectNone();
  };

  const openInfo = useCallback((e: ModelLibraryEntry) => {
    if (e.modelId) openModel(`library:${e.versionId}`, e.modelId, e.versionId);
  }, [openModel]);

  // ── export / import ──
  const doExport = () => {
    const now = new Date();
    const blob = new Blob([JSON.stringify(exportLibrary(entries, now.getTime()), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFileName(now);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setNotice({ ok: false, message: `${file.name} is too large to be a model list.` });
      return;
    }
    try {
      const r = importText(await file.text());
      setNotice({ ok: r.ok, message: r.ok ? r.message : `${file.name}: ${r.message}` });
    } catch {
      setNotice({ ok: false, message: `Could not read ${file.name}.` });
    }
  };

  const hasFiles = (ev: DragEvent) => Array.from(ev.dataTransfer?.types ?? []).includes('Files');
  const dropHandlers = {
    onDragEnter: (ev: DragEvent) => {
      if (!hasFiles(ev)) return;
      ev.preventDefault();
      dragDepth.current++;
      setDragging(true);
    },
    onDragOver: (ev: DragEvent) => {
      if (!hasFiles(ev)) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'copy';
    },
    onDragLeave: (ev: DragEvent) => {
      if (!hasFiles(ev)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    },
    onDrop: (ev: DragEvent) => {
      if (!hasFiles(ev)) return;
      ev.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      void importFile(ev.dataTransfer.files[0]);
    },
  };

  const noServer = online.length === 0;
  const serverOptions = [
    { value: ALL_SERVERS, label: online.length > 1 ? 'All online servers' : online[0]?.name ?? 'No servers online' },
    ...(online.length > 1 ? online.map((s) => ({ value: s.id, label: s.name })) : []),
  ];
  const typeOptions = [{ value: ALL_TYPES, label: 'All types' }, ...types.map((t) => ({ value: t, label: typeLabel(t) }))];

  const fileButtons = narrow ? (
    <div className="flex shrink-0 items-center gap-1">
      <Tooltip label="Import a list">
        <ActionIcon size="lg" variant="default" onClick={() => fileRef.current?.click()} aria-label="Import a model list">
          <IconFileImport size={16} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Export the list">
        <ActionIcon size="lg" variant="default" onClick={doExport} disabled={entries.length === 0} aria-label="Export the model list">
          <IconFileExport size={16} />
        </ActionIcon>
      </Tooltip>
    </div>
  ) : (
    <div className="flex shrink-0 items-center gap-1.5">
      <Button size="xs" variant="default" leftSection={<IconFileImport size={14} />} onClick={() => fileRef.current?.click()}>
        Import
      </Button>
      <Button size="xs" variant="default" leftSection={<IconFileExport size={14} />} onClick={doExport} disabled={entries.length === 0}>
        Export
      </Button>
    </div>
  );

  const toolbar = (
    <div className={narrow ? 'flex flex-col gap-2' : 'flex items-center gap-2'}>
      <TextInput size="xs" className={narrow ? '' : 'w-64'} placeholder="Search my models" value={search}
        onChange={(ev) => setSearch(ev.currentTarget.value)} leftSection={<IconSearch size={14} />}
        rightSection={search ? <CloseButton size="xs" onClick={() => setSearch('')} aria-label="Clear search" /> : null}
        aria-label="Search my models" />
      <div className={narrow ? 'grid grid-cols-2 gap-2' : 'flex items-center gap-2'}>
        <Select size="xs" className={narrow ? '' : 'w-36 flex-none'} value={typeFilter || ALL_TYPES} onValueChange={setType} options={typeOptions} ariaLabel="Filter by type" />
        <Select size="xs" className={narrow ? '' : 'w-36 flex-none'} value={sort} onValueChange={(v) => setSort(v as LibrarySort)} options={SORTS} ariaLabel="Sort" />
        <div className={narrow ? 'col-span-2 flex items-center gap-2' : 'flex items-center gap-2'}>
          <Text size="xs" c="dimmed" className="shrink-0">Download to</Text>
          <Select size="xs" className={narrow ? '' : 'w-48 flex-none'} value={target} onValueChange={setTarget} options={serverOptions} ariaLabel="Download to" />
        </div>
      </div>
    </div>
  );

  const bulkBar = (
    <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-border-subtle bg-bg-base px-3 py-1.5">
      <Checkbox size="sm" label={allShownPicked ? 'None' : 'All'} checked={allShownPicked} indeterminate={picked.length > 0 && !allShownPicked}
        onChange={() => (allShownPicked ? selectNone() : selectAll())} disabled={visible.length === 0}
        aria-label={allShownPicked ? 'Select none' : 'Select all'} />
      {picked.length > 0 && (
        <Button size="compact-xs" variant="subtle" color="gray" onClick={selectNone}>Clear ({picked.length})</Button>
      )}
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <Button size="compact-sm" leftSection={narrow ? undefined : <IconDownload size={13} />} disabled={noServer || busy || picked.length === 0}
          onClick={() => void run(picked)} aria-label="Download selected">
          {narrow ? 'Download' : 'Download selected'}{picked.length ? ` (${picked.length})` : ''}
        </Button>
        <Button size="compact-sm" variant="default" leftSection={narrow ? undefined : <IconDownload size={13} />} disabled={noServer || busy || visible.length === 0}
          onClick={() => void downloadAll()}>
          {filtered ? `${narrow ? 'All' : 'Download all'} shown (${visible.length})` : 'Download all'}
        </Button>
        {narrow ? (
          <ActionIcon size="md" variant="subtle" color="red" disabled={picked.length === 0} onClick={() => void removePicked()} aria-label="Remove selected from list">
            <IconTrash size={15} />
          </ActionIcon>
        ) : (
          <Button size="compact-sm" variant="subtle" color="red" leftSection={<IconTrash size={13} />} disabled={picked.length === 0}
            onClick={() => void removePicked()} aria-label="Remove selected from list">
            Remove
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative flex h-full w-full min-w-0 flex-col bg-bg-base" {...dropHandlers}>
      <header className="flex shrink-0 flex-col gap-2 border-b border-border-subtle bg-bg-panel px-3 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {!narrow && <IconBoxModel size={16} className="text-[var(--mantine-color-dimmed)]" />}
          <BrowserModeSwitch />
          {/* The switch already shows the total; the badge earns its place when a filter hides some. */}
          {(!narrow || filtered) && (
            <Badge size="sm" variant="light" color="gray" tt="none" className="shrink-0">
              {filtered ? `${visible.length} of ${entries.length}` : `${entries.length} model${entries.length === 1 ? '' : 's'}`}
            </Badge>
          )}
          <div className="ml-auto">{fileButtons}</div>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden
            onChange={(ev) => { void importFile(ev.currentTarget.files?.[0]); ev.currentTarget.value = ''; }} />
        </div>
        {entries.length > 0 && toolbar}
      </header>

      {notice && (
        <Alert className="m-2 shrink-0" variant="light" color={notice.ok ? 'teal' : 'red'} withCloseButton onClose={() => setNotice(null)}
          title={notice.ok ? 'Import done' : 'Could not import'}>
          {notice.message}
        </Alert>
      )}

      {entries.length > 0 && bulkBar}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-16 text-center">
            <IconBoxModel size={40} className="text-fg-dim" />
            <Text fw={600}>No models yet</Text>
            <Text size="sm" c="dimmed">
              Every model you download from the browser or a model’s info window is listed here, on this device.
              Export the list to keep a copy; import it on a new device, or use it to refill a fresh pod.
            </Text>
            <Button variant="default" leftSection={<IconFileImport size={14} />} onClick={() => fileRef.current?.click()}>
              Import a list
            </Button>
            <Text size="xs" c="dimmed">…or drop an exported .json file here.</Text>
          </div>
        ) : visible.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="xl">No models match.</Text>
        ) : (
          visible.map((e) => (
            <LibraryRow
              key={e.versionId}
              entry={e}
              status={status.get(e.versionId)}
              selected={selected.has(e.versionId)}
              narrow={narrow}
              canDownload={!noServer}
              onToggle={toggle}
              onDownload={downloadOne}
              onRemove={removeOne}
              onRate={setRating}
              onNote={setNote}
              onOpenInfo={openInfo}
            />
          ))
        )}
      </div>

      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-10 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-bg-base)_85%,transparent)]">
          <IconUpload size={32} className="text-[var(--color-accent)]" />
          <Text fw={600}>Drop a model list to import it</Text>
          <Text size="xs" c="dimmed">Merged by version — nothing already here is lost</Text>
        </div>
      )}
    </div>
  );
}
