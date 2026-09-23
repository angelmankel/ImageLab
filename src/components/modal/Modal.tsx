import { createContext, useContext, type ReactNode } from 'react';
import { Modal as MModal } from '@mantine/core';
import { cn } from '@/lib/cn';
import { CloseIcon } from '@/components/ui/icons';

/**
 * Generic, controlled modal base.
 *
 * A Mantine modal: portal, dimmed overlay, centred panel. Escape and overlay
 * clicks both call `onClose`. The panel is otherwise an empty shell — compose
 * its contents with the `Modal.*` slot components below, or pass arbitrary
 * children. Concrete modals (e.g. the model-metadata modal) live in their own
 * folders and only use this for the shell.
 */

type ModalContextValue = { onClose: () => void };
const ModalContext = createContext<ModalContextValue | null>(null);

function useModalContext(component: string): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error(`<Modal.${component}> must be rendered inside <Modal>`);
  return ctx;
}

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Extra classes for the panel — set width / max-width here. */
  panelClassName?: string;
  /** id of the element that labels the dialog, for a11y. */
  labelledBy?: string;
};

function ModalRoot({ open, onClose, children, panelClassName, labelledBy }: ModalProps) {
  // The v1 Mantine modal: portalled above every panel and rail, focus-trapped, closed by Escape
  // or a click on the overlay. The panel's own layout (columns, header/body/footer) is the slots below.
  return (
    <ModalContext.Provider value={{ onClose }}>
      <MModal
        opened={open}
        onClose={onClose}
        withCloseButton={false}
        centered
        size="auto"
        padding={0}
        overlayProps={{ backgroundOpacity: 0.7, blur: 3 }}
        aria-labelledby={labelledBy}
        classNames={{
          content: cn('flex max-h-[90vh] !overflow-hidden', panelClassName),
          body: 'flex min-h-0 w-full flex-1 !p-0',
        }}
      >
        {children}
      </MModal>
    </ModalContext.Provider>
  );
}

/** Close button wired to the modal's `onClose`. */
function ModalClose({ className }: { className?: string }) {
  const { onClose } = useModalContext('Close');
  return (
    <button
      type="button"
      aria-label="Close"
      onClick={onClose}
      className={cn(
        'flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border border-border-default',
        'bg-bg-elev text-fg-tertiary outline-none transition-colors',
        'hover:border-border-strong hover:text-fg-secondary focus-visible:border-accent',
        className,
      )}
    >
      <CloseIcon size={14} />
    </button>
  );
}

/** A vertical column inside the panel — header / scrollable body / footer rhythm. */
function ModalColumn({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex min-h-0 min-w-0 flex-col', className)}>{children}</div>;
}

function ModalHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('shrink-0 border-b border-border-subtle px-5 py-4', className)}>{children}</div>
  );
}

function ModalBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('scroll-y min-h-0 flex-1 px-5 py-4', className)}>{children}</div>;
}

function ModalFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('shrink-0 border-t border-border-subtle bg-bg-base/40 px-5 py-3.5', className)}>
      {children}
    </div>
  );
}

export const Modal = Object.assign(ModalRoot, {
  Close: ModalClose,
  Column: ModalColumn,
  Header: ModalHeader,
  Body: ModalBody,
  Footer: ModalFooter,
});
