/**
 * Rule 14: the saved workflows of the chosen server: header (count + Import), search, rows.
 * Shared by the desktop left panel and the phone's Workflows tab (`large`).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { TextInput } from '@mantine/core';
import { IconFileImport, IconSearch } from '@tabler/icons-react';
import { useStudio } from '@/features/studio/studioStore';
import { WorkflowRow } from './WorkflowRow';
import { useComfyFrame } from './comfyFrame';
import './workflowMenu';
import type { useComfyWorkflows } from './useComfyWorkflows';

type Workflows = ReturnType<typeof useComfyWorkflows>;

export function WorkflowList({ wf, large, scroll = true }: { wf: Workflows; large?: boolean; scroll?: boolean }) {
  const [query, setQuery] = useState('');
  const studioPath = useStudio((s) => s.path);
  const framePath = useComfyFrame((s) => (s.status === 'ready' ? s.openPath : undefined));
  const openPath = framePath === undefined ? studioPath : framePath;
  const fileRef = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(t); }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? wf.rows.filter((r) => r.path.toLowerCase().includes(q)) : wf.rows;
  }, [wf.rows, query]);

  const list = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {shown.map((r) => (
        <WorkflowRow key={r.key} row={r} large={large} now={now} selected={r.path === openPath}
          onSelect={() => void wf.select(r)} onUse={() => void wf.addAsStep(r)} onDelete={() => void wf.remove(r)} />
      ))}
      {!shown.length && (
        <div style={{ padding: '14px 8px', fontSize: 12, fontWeight: 600, color: 'var(--il-muted)', textAlign: 'center' }}>
          {wf.error ? wf.error : !wf.ready ? 'Reading the server…' : query ? `No workflow called “${query}”.` : 'No saved workflows yet. Save one in ComfyUI, or import a JSON file.'}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0, flex: scroll ? 1 : undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 2px' }}>
        <span style={{ fontSize: 15, fontWeight: 800 }}>Workflows</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)' }}>{wf.rows.length} saved</span>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={!wf.ready}
            title="Import a workflow JSON file into this server"
            style={{ height: 28, padding: '0 10px', border: 0, borderRadius: 999, background: 'var(--il-card)', color: 'var(--il-fg2)', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: wf.ready ? 'pointer' : 'default', opacity: wf.ready ? 1 : 0.5 }}>
            <IconFileImport size={14} />Import
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden
            onChange={(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (f) void wf.importFile(f); }} />
        </span>
      </div>
      {wf.rows.length > 5 && (
        <TextInput value={query} onChange={(e) => setQuery(e.currentTarget.value)} placeholder="Search" aria-label="Search workflows"
          leftSection={<IconSearch size={14} />} size="sm" radius={14}
          styles={{ input: { background: 'var(--il-card)', borderColor: 'var(--il-line-strong)', fontWeight: 600 } }} />
      )}
      {scroll
        ? <div className="il-scroll" style={{ flex: 1, minHeight: 0, margin: '0 -2px', touchAction: 'pan-y' }}>{list}</div>
        : <div style={{ background: 'var(--il-card)', borderRadius: 20, padding: 6 }}>{list}</div>}
    </div>
  );
}
