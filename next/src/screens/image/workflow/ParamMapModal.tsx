/**
 * Item 39: the mapping editor ("Labels & controls"), opened from the ComfyUI screen (right-click
 * a saved workflow) or from a Workflow step's Settings tab. One row per widget, under its raw node
 * name (here, and only here, so you can tell them apart): the label the step shows, its group,
 * the control, a hint, hidden, and — for text boxes — whether it is the prompt, the negative or
 * just text. Blank = automatic (the placeholder shows what the step uses). Saved as you type.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Loader, Modal } from '@mantine/core';
import { IconEye, IconEyeOff, IconRestore, IconTags, IconX } from '@tabler/icons-react';
import { loadSavedWorkflow, comfyHttpFor } from '@/lib/comfy';
import { readParams, type WorkflowParam } from '@/features/studio/params';
import { useStudio } from '@/features/studio/studioStore';
import { objectInfoNow } from '@/features/studio/useStudioRun';
import type { EditorWorkflowWithSubgraphs, ObjectInfo } from '@/lib/workflowGraph';
import { useIsPhone } from '~/app/useIsPhone';
import { T } from '~/theme/tokens';
import { Button } from '~/ui';
import { ROLES, ROLE_INFO, resolveParams, type Control, type ParamMapping, type Role } from './paramMap';
import { useMapEditor, useParamMap, useWorkflowMap } from './paramMapStore';
import { groupByNode } from './workflowStepLogic';
import { registerMenu } from '~/app/contextMenu';
import type { ComfyWorkflowTarget } from '~/screens/comfy/workflowMenu';
import { dvh, vh } from '~/theme/uiScale';

// The ComfyUI screen's saved-workflow menu gets "Labels & controls" (the row key is `host|path`).
registerMenu<ComfyWorkflowTarget>('comfy-workflow', [
  { id: 'labels', label: 'Labels & controls…', icon: IconTags, group: 'open', order: 5,
    action: (t) => useMapEditor.getState().open({ host: t.row.key.slice(0, t.row.key.lastIndexOf('|')), path: t.row.path, name: t.row.name }) },
]);

async function paramsFor(host: string, path: string): Promise<WorkflowParam[]> {
  const st = useStudio.getState();
  if (st.path === path && st.workflow) return st.params;
  const info: ObjectInfo = objectInfoNow(host) ?? await fetch(`${comfyHttpFor(host)}/object_info`).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<ObjectInfo>; });
  const wf = await loadSavedWorkflow(host, path);
  return readParams(wf as EditorWorkflowWithSubgraphs, info);
}

const input: CSSProperties = { height: 30, border: '1px solid var(--il-line-strong)', borderRadius: 8, background: 'var(--il-bg-deep)', color: 'var(--il-fg)', fontSize: 12, fontWeight: 600, padding: '0 8px', outline: 'none', fontFamily: 'inherit', minWidth: 0 };

function controlsFor(p: WorkflowParam): Control[] {
  if (p.type === 'INT' || p.type === 'FLOAT') return ['auto', 'slider', 'box'];
  if (p.type === 'COMBO') return ['auto', 'chips', 'select'];
  return [];
}
const CONTROL_LABEL: Record<Control, string> = { auto: 'Auto', slider: 'Slider', box: 'Number box', chips: 'Chips', select: 'Dropdown' };

function Row({ path, r, m, phone }: { path: string; r: ReturnType<typeof resolveParams>[number]; m: ParamMapping; phone: boolean }) {
  const setMapping = useParamMap((s) => s.setMapping);
  const set = (patch: ParamMapping) => setMapping(path, r.p.id, patch);
  const controls = controlsFor(r.p);
  const isText = r.p.type === 'STRING' && r.p.multiline;
  const roleOptions: Array<Role | 'none' | ''> = isText ? ['', 'positive', 'negative', 'none'] : ['', ...ROLES.filter((x) => x !== 'positive' && x !== 'negative'), 'none'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0', borderTop: '1px solid var(--il-line-soft)', opacity: m.hidden ? 0.55 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 700, color: 'var(--il-muted)', fontFamily: 'ui-monospace, monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.p.name} <span style={{ color: 'var(--il-dim)' }}>· {r.p.type.toLowerCase()}</span></span>
        <Button tone="ghost" size="sm" on={!!m.hidden} icon={m.hidden ? <IconEyeOff size={14} /> : <IconEye size={14} />} tooltip={m.hidden ? 'Hidden in the step · show it' : 'Hide it in the step'} onClick={() => set({ hidden: !m.hidden })} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: phone ? '1fr' : '1.2fr 1fr 0.9fr', gap: 6 }}>
        <input aria-label="Label" placeholder={r.label} value={m.label ?? ''} onChange={(e) => set({ label: e.target.value })} style={input} />
        <input aria-label="Group" placeholder={r.group} value={m.group ?? ''} onChange={(e) => set({ group: e.target.value })} style={input} />
        <select aria-label="Role" value={m.role ?? ''} onChange={(e) => set({ role: (e.target.value || undefined) as Role | 'none' | undefined })} style={{ ...input, cursor: 'pointer' }}>
          {roleOptions.map((o) => <option key={o || 'auto'} value={o}>{o === '' ? `Auto${r.role ? ` (${ROLE_INFO[r.role].label})` : ''}` : o === 'none' ? (isText ? 'Just text' : 'No role') : ROLE_INFO[o].label}</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: phone || !controls.length ? '1fr' : '2fr 1fr', gap: 6 }}>
        <input aria-label="Hint" placeholder="Hint (the tooltip) — blank = the stock one" value={m.hint ?? ''} onChange={(e) => set({ hint: e.target.value })} style={input} />
        {controls.length > 0 && (
          <select aria-label="Control" value={m.control ?? 'auto'} onChange={(e) => set({ control: e.target.value === 'auto' ? undefined : e.target.value as Control })} style={{ ...input, cursor: 'pointer' }}>
            {controls.map((c) => <option key={c} value={c}>{CONTROL_LABEL[c]}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}

function Body({ host, path }: { host: string; path: string }) {
  const phone = useIsPhone();
  const [params, setParams] = useState<WorkflowParam[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const map = useWorkflowMap(path);
  const clearMap = useParamMap((s) => s.clearMap);
  const studioTarget = useStudio((s) => (s.path === path ? s.targetId() : null));
  useEffect(() => {
    let live = true;
    setParams(null); setError(null);
    paramsFor(host, path).then((p) => { if (live) setParams(p); }).catch((e) => { if (live) setError(e instanceof Error ? e.message : String(e)); });
    return () => { live = false; };
  }, [host, path]);
  const target = studioTarget ?? params?.find((p) => p.type === 'STRING' && p.multiline && /positive/i.test(p.nodeLabel))?.id ?? params?.find((p) => p.type === 'STRING' && p.multiline && !/negative/i.test(p.nodeLabel))?.id ?? null;
  const resolved = useMemo(() => (params ? resolveParams(params, target, map) : []), [params, target, map]);
  const groups = useMemo(() => groupByNode(params ?? []), [params]);
  const byId = useMemo(() => new Map(resolved.map((r) => [r.p.id, r])), [resolved]);
  // Pictures and model files have their own tabs: only the widgets the Prompt / Settings tabs show.
  const editable = (p: WorkflowParam) => !(p.type === 'COMBO' && (p.name === 'image' || (p.options ?? []).some((o) => /\.(safetensors|ckpt|pt|pth|bin|gguf|sft)$/i.test(String(o)))));

  if (error) return <div style={{ padding: 20, color: 'var(--il-err)', fontSize: 13, fontWeight: 600 }}>Could not read the workflow: {error}</div>;
  if (!params) return <div style={{ padding: 30, display: 'grid', placeItems: 'center' }}><Loader size="sm" color="orange" /></div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--il-line)' }}>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--il-muted)' }}>Blank = automatic: the grey text is what the step shows now. Saved as you type.</span>
        {Object.keys(map).length > 0 && <Button tone="ghost" size="sm" icon={<IconRestore size={13} />} onClick={() => clearMap(path)}>All automatic</Button>}
      </div>
      <div className="il-scroll" style={{ flex: 1, minHeight: 0, padding: '4px 16px 16px', touchAction: 'pan-y' }}>
        {groups.map((g) => {
          const items = g.items.filter(editable);
          if (!items.length) return null;
          return (
            <section key={g.nodeId} style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800 }}>{g.label} <span style={{ color: 'var(--il-dim)', fontWeight: 700 }}>#{g.nodeId}</span></div>
              {items.map((p) => <Row key={p.id} path={path} r={byId.get(p.id)!} m={map[p.id] ?? {}} phone={phone} />)}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** Mount once per screen that can open the editor (ComfyUI screens, the Workflow step). */
export function ParamMapModal() {
  const target = useMapEditor((s) => s.target);
  const close = useMapEditor((s) => s.close);
  const phone = useIsPhone();
  return (
    <Modal opened={!!target} onClose={close} withCloseButton={false} centered fullScreen={phone} size={phone ? undefined : 760} zIndex={T.z.modal} radius={phone ? 0 : T.radius.xl} padding={0}
      overlayProps={{ backgroundOpacity: 0.55, blur: 6 }}
      styles={{ content: { background: 'var(--il-panel)', border: phone ? 0 : '1px solid var(--il-line-soft)', height: phone ? dvh(100) : vh(86), display: 'flex', flexDirection: 'column', overflow: 'hidden' }, body: { padding: 0, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } }}>
      {target && (
        <>
          <div style={{ height: 52, flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px 0 16px', borderBottom: '1px solid var(--il-line)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>Labels &amp; controls</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{target.name} · how its settings look in a Workflow step</div>
            </div>
            <Button tone="ghost" size={phone ? 'lg' : 'sm'} icon={<IconX size={16} stroke={2.4} />} tooltip="Close" onClick={close} />
          </div>
          <Body host={target.host} path={target.path} />
        </>
      )}
    </Modal>
  );
}
