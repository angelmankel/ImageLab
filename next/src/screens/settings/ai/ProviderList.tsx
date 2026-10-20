/**
 * The providers list on the AI helper pane: one row per added provider — radio (make it the
 * active one) · name · key-state dot (green tested, ember untested, dim no key) · its model ·
 * › opens its page — then "+ Add provider", a picker of the supported providers not added yet.
 */
import { useState } from 'react';
import { IconChevronRight, IconPlus } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { addableProviders, keyState, providerSpec, shortModelName, type AiProviderEntry, type AiProviderId } from '@/lib/aiProviders';
import { Chip, Dot, Row } from '~/ui';
import { openProviderPage } from './useOpenProvider';

const DOT: Record<ReturnType<typeof keyState>, string> = { ok: 'var(--il-ok)', pending: 'var(--il-ember)', none: 'var(--il-dim)' };
const DOT_TITLE: Record<ReturnType<typeof keyState>, string> = { ok: 'Tested, works', pending: 'Not tested yet', none: 'No key' };

function ProviderRow({ entry, active, first, onActivate }: { entry: AiProviderEntry; active: boolean; first?: boolean; onActivate: () => void }) {
  const spec = providerSpec(entry.id);
  const state = keyState(entry);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, borderTop: first ? 0 : '1px solid var(--il-line)' }}>
      <button
        type="button" role="radio" aria-checked={active} aria-label={`Use ${spec.name}`} title={active ? `${spec.name} is the active provider` : `Make ${spec.name} the active provider`}
        onClick={onActivate}
        style={{ width: 28, height: 28, flex: 'none', border: 0, background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}
      >
        <span aria-hidden style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${active ? 'var(--il-ember)' : 'var(--il-line-strong)'}`, display: 'grid', placeItems: 'center' }}>
          {active && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--il-ember)' }} />}
        </span>
      </button>
      <button
        type="button" onClick={() => openProviderPage(entry.id)} aria-label={`Open ${spec.name}`}
        style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 2px', border: 0, background: 'transparent', color: 'var(--il-fg)', textAlign: 'left', cursor: 'pointer' }}
      >
        <span style={{ fontSize: 13, fontWeight: active ? 800 : 700, whiteSpace: 'nowrap' }}>{spec.name}</span>
        <span title={DOT_TITLE[state]} style={{ display: 'inline-flex' }}><Dot color={DOT[state]} size={7} /></span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 600, color: 'var(--il-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {entry.model ? shortModelName(entry.model) : 'no model'}
        </span>
        <IconChevronRight size={16} stroke={2.2} style={{ color: 'var(--il-dim)', flex: 'none' }} />
      </button>
    </div>
  );
}

function AddProvider() {
  const ai = useStore((s) => s.ai);
  const addAiProvider = useStore((s) => s.addAiProvider);
  const [picking, setPicking] = useState(false);
  const addable = addableProviders(ai);
  if (!addable.length) return null;
  const add = (id: AiProviderId) => { addAiProvider(id); setPicking(false); openProviderPage(id); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8, borderTop: '1px solid var(--il-line)' }}>
      <Row wrap>
        <Chip dashed icon={<IconPlus size={13} stroke={2.4} />} on={picking} onClick={() => setPicking((v) => !v)} title="Add one of the supported providers">Add provider</Chip>
        {picking && addable.map((p) => <Chip key={p.id} small onClick={() => add(p.id)} title={p.note}>{p.name}</Chip>)}
      </Row>
    </div>
  );
}

export function ProviderList() {
  const ai = useStore((s) => s.ai);
  const setActiveAi = useStore((s) => s.setActiveAi);
  return (
    <div role="radiogroup" aria-label="AI providers" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {ai.providers.map((p, i) => <ProviderRow key={p.id} entry={p} active={p.id === ai.active} first={i === 0} onActivate={() => setActiveAi(p.id)} />)}
      <AddProvider />
    </div>
  );
}
