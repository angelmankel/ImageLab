/**
 * The saved workflows of the chosen server (FIXLIST-2 #53; mockup
 * agent-handoffs/fixlist2-mockups/53-workflows-list.html): header "Workflows · N" with New (when
 * the embedded ComfyUI can make one) and Import; search + sort (Recent / A–Z) once the list is
 * longer than SEARCH_FROM; one-line rows (./WorkflowRow); an empty state with New / Import.
 * Shared by the desktop left panel and the phone's Workflows tab (`large`).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { IconFileImport, IconPlus, IconSortAscendingLetters, IconClockHour3, IconTopologyStar3 } from '@tabler/icons-react';
import { useStudio } from '@/features/studio/studioStore';
import { SearchField } from '~/ui';
import { WorkflowRow } from './WorkflowRow';
import { useComfyFrame } from './comfyFrame';
import { useWorkflowStore } from './workflowStore';
import { SEARCH_FROM, shownRows } from './workflowListLogic';
import type { ComfyWorkflowTarget } from './workflowMenu';
import './workflowMenu';
import './workflowList.css';
import type { useComfyWorkflows, ComfyWorkflowRow } from './useComfyWorkflows';

type Workflows = ReturnType<typeof useComfyWorkflows>;

export function WorkflowList({ wf, large, scroll = true }: { wf: Workflows; large?: boolean; scroll?: boolean }) {
  const [query, setQuery] = useState('');
  const studioPath = useStudio((s) => s.path);
  const frameStatus = useComfyFrame((s) => s.status);
  const framePath = useComfyFrame((s) => (s.status === 'ready' ? s.openPath : undefined));
  const openPath = framePath === undefined ? studioPath : framePath;
  const sort = useWorkflowStore((s) => s.sort);
  const setSort = useWorkflowStore((s) => s.setSort);
  const fileRef = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t); }, []);

  const many = wf.rows.length > SEARCH_FROM;
  const shown = useMemo(() => shownRows(wf.rows, many ? query : '', sort), [wf.rows, query, sort, many]);
  const canCreate = !large && frameStatus === 'ready';

  const targetOf = (r: ComfyWorkflowRow): ComfyWorkflowTarget => ({
    row: r,
    open: () => void wf.select(r),
    use: () => void wf.addAsStep(r),
    rename: () => void wf.rename(r),
    duplicate: () => void wf.duplicate(r),
    saveAs: () => void wf.saveAs(r),
    remove: () => void wf.remove(r),
  });

  const importBtn = (label = 'Import') => (
    <button type="button" className={`il-wf-tool${large ? ' is-large' : ''}`} onClick={() => fileRef.current?.click()} disabled={!wf.ready}
      title="Import a workflow .json into this server">
      <IconFileImport size={14} />{label}
    </button>
  );
  const newBtn = (
    <button type="button" className={`il-wf-tool${large ? ' is-large' : ''}`} onClick={() => void wf.create()} title="Start a blank workflow in ComfyUI">
      <IconPlus size={14} stroke={2.6} />New
    </button>
  );

  const empty = !wf.rows.length;
  const body = empty ? (
    <div style={{ flex: scroll ? 1 : undefined, minHeight: 200, border: '1px dashed var(--il-line-strong)', borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, textAlign: 'center' }}>
      <span aria-hidden style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--il-card)', color: 'var(--il-dim)', display: 'grid', placeItems: 'center' }}>
        <IconTopologyStar3 size={22} />
      </span>
      {wf.error ? (
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-err)' }}>{wf.error}</span>
      ) : !wf.ready ? (
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-muted)' }}>Reading the server…</span>
      ) : (
        <>
          <span style={{ fontSize: 13, fontWeight: 800 }}>No saved workflows</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-muted)', maxWidth: 220 }}>Build one in ComfyUI and save it, or bring in a .json file.</span>
          <span style={{ display: 'flex', gap: 6 }}>{canCreate && newBtn}{importBtn()}</span>
        </>
      )}
    </div>
  ) : (
    <div role="listbox" aria-label="Saved workflows" style={{ display: 'flex', flexDirection: 'column', gap: large ? 2 : 1 }}>
      {shown.map((r) => <WorkflowRow key={r.key} row={r} large={large} now={now} selected={r.path === openPath} target={targetOf(r)} />)}
      {!shown.length && (
        <div style={{ padding: '14px 8px', fontSize: 12, fontWeight: 600, color: 'var(--il-muted)', textAlign: 'center' }}>No workflow matches “{query}”.</div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0, flex: scroll ? 1 : undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 2px', flex: 'none' }}>
        <span style={{ fontSize: large ? 15 : 13, fontWeight: 800 }}>Workflows</span>
        {!empty && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)' }}>· {wf.rows.length}</span>}
        <span style={{ flex: 1 }} />
        {!empty && canCreate && newBtn}
        {!empty && importBtn()}
        <input ref={fileRef} type="file" accept=".json,application/json" hidden
          onChange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (f) void wf.importFile(f); }} />
      </div>
      {many && (
        <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
          <SearchField value={query} onChange={setQuery} placeholder="Search workflows" h={large ? 40 : 30} style={{ flex: 1, minWidth: 0 }} />
          <button type="button" className={`il-wf-tool${large ? ' is-large' : ''}`} style={{ height: large ? 40 : 30 }}
            onClick={() => setSort(sort === 'recent' ? 'name' : 'recent')} aria-label={`Sorted by ${sort === 'recent' ? 'recent' : 'name'}`}
            title={sort === 'recent' ? 'Recent first · tap for A–Z' : 'A–Z · tap for recent first'}>
            {sort === 'recent' ? <IconClockHour3 size={14} /> : <IconSortAscendingLetters size={14} />}
            {sort === 'recent' ? 'Recent' : 'A–Z'}
          </button>
        </div>
      )}
      {scroll
        ? <div className="il-scroll" style={{ flex: 1, minHeight: 0, margin: '0 -2px', padding: '0 2px', touchAction: 'pan-y', display: 'flex', flexDirection: 'column' }}>{body}</div>
        : <div style={empty ? undefined : { background: 'var(--il-card)', borderRadius: 20, padding: 6 }}>{body}</div>}
    </div>
  );
}
