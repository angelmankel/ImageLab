/**
 * The models picker as a modal (models-picker brief, item 1): one big window every picker opens —
 * the window minus a 20px margin on desktop (no viewport units: item 26) (Ember look, glass backdrop), full screen on the phone with a top Back.
 * `kind` locks the type filter to the step's kind and makes "Use" / "Add & download" call `onPick`;
 * without `kind` it is the free browser (the rail's Models entry).
 */
import { useMemo } from 'react';
import { Modal } from '@mantine/core';
import { IconChevronLeft, IconX } from '@tabler/icons-react';
import { useIsPhone } from '~/app/useIsPhone';
import { T } from '~/theme/tokens';
import { KIND_LABEL, type ModelKindKey } from './civitaiQuery';
import type { ModelPick } from './pick';
import { PickContext } from './pickContext';
import { DesktopBrowser, PhoneBrowser } from './ModelsBrowser';

export function ModelsModal({ opened, onClose, kind, onPick, title }: {
  opened: boolean; onClose: () => void; kind?: ModelKindKey; onPick?: (pick: ModelPick) => void; title?: string;
}) {
  const phone = useIsPhone();
  const ctx = useMemo(() => ({ kind: kind ?? null, onPick: onPick ?? null, close: onClose }), [kind, onPick, onClose]);
  const heading = title ?? (kind ? `Pick a ${KIND_LABEL[kind].replace(/s$/, '')}` : 'Models');

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      fullScreen={phone}
      centered
      // No vw / vh (fix list 2 item 26): the UI scale's CSS zoom scales viewport units too, so the
      // window ran off the screen. Percentages of Mantine's fixed, full-window inner always fit.
      size={phone ? undefined : 'calc(100% - 8px)'}
      xOffset={phone ? 0 : 20}
      yOffset={phone ? 0 : 20}
      zIndex={T.z.modal}
      radius={phone ? 0 : T.radius.xl}
      padding={0}
      overlayProps={{ backgroundOpacity: 0.55, blur: 6 }}
      transitionProps={{ transition: 'pop', duration: 160 }}
      styles={{
        content: { background: 'var(--il-bg)', border: phone ? 0 : '1px solid var(--il-line-soft)', height: '100%', maxHeight: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
        body: { padding: 0, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', height: '100%' },
      }}
    >
      <PickContext.Provider value={ctx}>
        {phone ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: 48, flex: 'none', display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', borderBottom: '1px solid var(--il-line)' }}>
              <button type="button" onClick={onClose} aria-label="Back" style={{ height: 40, padding: '0 12px 0 6px', border: 0, borderRadius: 999, background: 'transparent', color: 'var(--il-fg)', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <IconChevronLeft size={18} stroke={2.6} />Back
              </button>
              <span style={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>{heading}</span>
              <span style={{ width: 76 }} />
            </div>
            <div style={{ flex: 1, minHeight: 0 }}><PhoneBrowser /></div>
          </div>
        ) : (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: 44, flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px 0 16px', borderBottom: '1px solid var(--il-line)' }}>
              <span style={{ fontWeight: 800, fontSize: 15 }}>{heading}</span>
              {kind && <span className="il-eyebrow">· {KIND_LABEL[kind]} on CivitAI</span>}
              <div style={{ flex: 1 }} />
              <button type="button" onClick={onClose} aria-label="Close" style={{ width: 32, height: 32, border: 0, borderRadius: 10, background: 'transparent', color: 'var(--il-fg2)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><IconX size={16} stroke={2.4} /></button>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex' }}><DesktopBrowser /></div>
          </div>
        )}
      </PickContext.Provider>
    </Modal>
  );
}
