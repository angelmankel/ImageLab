import { Modal } from '@mantine/core';
import type { ReactNode } from 'react';

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title?: string;
  children: ReactNode;
  className?: string;
};

/** A small centred dialog — the v1 Mantine modal. */
export function Dialog({ open, onOpenChange, title, children, className }: Props) {
  return (
    <Modal opened={open} onClose={() => onOpenChange(false)} title={title} centered size="sm" className={className}>
      {children}
    </Modal>
  );
}
