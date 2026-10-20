/**
 * The picker grid in a window: opened by "Change ▾" and by the "+ Add" circle. One tap picks and
 * closes. Full screen on the phone.
 */
import { Modal } from '@mantine/core';
import { useIsPhone } from '~/app/useIsPhone';
import { T } from '~/theme/tokens';
import { ModelPickerGrid } from './ModelPickerGrid';

type GridProps = Parameters<typeof ModelPickerGrid>[0];

export function ModelPickerModal({ opened, onClose, title, ...grid }: { opened: boolean; onClose: () => void; title: string } & GridProps) {
  const phone = useIsPhone();
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      size={760}
      centered
      fullScreen={phone}
      zIndex={T.z.modal}
      radius={T.radius.xl}
      overlayProps={{ backgroundOpacity: 0.6, blur: 2 }}
      styles={{
        content: { background: 'var(--il-panel)', border: '1px solid var(--il-line-soft)' },
        header: { background: 'var(--il-panel)', minHeight: 44, paddingInline: 14 },
        title: { fontWeight: 800, fontSize: 14 },
        body: { padding: '4px 14px 14px' },
      }}
    >
      <ModelPickerGrid {...grid} maxHeight={phone ? 'calc(100dvh - 160px)' : '64vh'} />
    </Modal>
  );
}
