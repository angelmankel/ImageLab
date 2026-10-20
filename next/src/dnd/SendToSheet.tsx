/**
 * The Send-to sheet (fix list 42's phone fallback): one tap per registered drop target, grouped
 * (Inputs · Collections · Session · Steps). Opened by `openSendTo(payload)` — a long-press on a
 * picture (`useLongPress`) or a menu entry. Mounted once by `DragLayer`'s host (App). Targets ≥ 44px.
 */
import { Modal } from '@mantine/core';
import { IconPhoto, IconFolder, IconLayoutGrid, IconPlus, IconArrowRight } from '@tabler/icons-react';
import { T } from '~/theme/tokens';
import { useDropTargets, useTargets } from './targets';

const GROUP_LABEL: Record<string, string> = { input: 'Use as input', collection: 'Add to a collection', session: 'Sessions', step: 'Steps' };
const GROUP_ICON: Record<string, typeof IconPhoto> = { input: IconPhoto, collection: IconFolder, session: IconLayoutGrid, step: IconPlus };

export function SendToSheet() {
  const sending = useTargets((s) => s.sending);
  const close = useTargets((s) => s.closeSendTo);
  const targets = useDropTargets();
  const usable = sending ? targets.filter((t) => !t.accept || t.accept(sending)) : [];
  const groups = Array.from(new Set(usable.map((t) => t.group)));
  return (
    <Modal opened={!!sending} onClose={close} title="Send to…" centered size="sm" zIndex={T.z.popover} styles={{ body: { paddingTop: 4 } }}>
      {sending && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <img src={sending.kind === 'url' ? sending.url : URL.createObjectURL(sending.file)} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', background: 'var(--il-bg-deep)', flex: 'none' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--il-fg2)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sending.name}</span>
        </div>
      )}
      {usable.length === 0 && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-muted)', padding: '8px 0' }}>Nothing on screen takes a picture right now.</div>}
      {groups.map((g) => {
        const Icon = GROUP_ICON[g] ?? IconArrowRight;
        return (
          <div key={g} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: .4, textTransform: 'uppercase', color: 'var(--il-muted)', margin: '6px 2px' }}>{GROUP_LABEL[g] ?? g}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {usable.filter((t) => t.group === g).map((t) => (
                <button key={t.id} type="button" onClick={() => { close(); t.onDrop(sending!); }}
                  style={{ minHeight: 44, padding: '0 12px', border: 0, borderRadius: 12, background: 'var(--il-card)', color: 'var(--il-fg)', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left', cursor: 'pointer' }}>
                  <Icon size={16} stroke={2.2} color="var(--il-ember)" /><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</span><IconArrowRight size={14} color="var(--il-muted)" />
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </Modal>
  );
}
