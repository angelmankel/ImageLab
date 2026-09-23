import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Button, Checkbox, Group, Modal, Text } from '@mantine/core';

/**
 * App-styled replacement for `window.confirm()`. Mount `<ConfirmProvider>`
 * once near the app root and call `const confirm = useConfirm()` anywhere —
 * `await confirm(message)` resolves to `true` / `false`.
 *
 * The dialog is the v1 Mantine confirm modal, above any other modal. Esc /
 * overlay click resolve to `false` to match window.confirm semantics.
 */

type ConfirmOptions = {
  /** Headline shown in the dialog title slot (defaults to "Confirm"). */
  title?: string;
  /** Body copy. Required; this is the question the user is answering. */
  message: string;
  /** Label on the destructive button — also drives its styling (red for
   *  destructive verbs like "Delete", accent otherwise). */
  confirmLabel?: string;
  /** Label on the cancel button. Defaults to "Cancel". */
  cancelLabel?: string;
  /** True when the action is destructive (deletes etc.). Styles the confirm
   *  button red instead of accent. Defaults to `true` because every current
   *  caller is a destructive flow — flip to `false` for non-destructive ones. */
  destructive?: boolean;
  /** When set, the dialog renders a "Don't ask again" checkbox. Checking it
   *  + confirming persists `<this key> = true` under SKIP_KEY in localStorage
   *  so future `confirm()` calls with the same key resolve `true` immediately
   *  without showing the dialog. Cleared by `clearConfirmSkips()`. */
  dontAskAgainKey?: string;
};

type ResolvedState = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmContext = createContext<((opts: string | ConfirmOptions) => Promise<boolean>) | null>(null);

/** localStorage key — record of `{ [dontAskAgainKey]: true }` for confirm
 *  dialogs the user has chosen to suppress. Read at confirm() time so a
 *  toggle made in this session takes effect on the next call. */
const SKIP_KEY = 'imagelab.confirmSkip.v1';
const loadSkipMap = (): Record<string, boolean> => {
  try {
    const raw = localStorage.getItem(SKIP_KEY);
    return raw ? JSON.parse(raw) as Record<string, boolean> : {};
  } catch { return {}; }
};
const setSkipped = (k: string) => {
  const m = loadSkipMap();
  m[k] = true;
  try { localStorage.setItem(SKIP_KEY, JSON.stringify(m)); } catch { /* ignore */ }
};
/** Wipe every persisted "don't ask again" choice — exposed for a future
 *  Settings → Reset confirmations affordance. */
export function clearConfirmSkips() {
  try { localStorage.removeItem(SKIP_KEY); } catch { /* ignore */ }
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ResolvedState | null>(null);
  const [dontAsk, setDontAsk] = useState(false);

  const confirm = useCallback((opts: string | ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      const normalized: ConfirmOptions = typeof opts === 'string' ? { message: opts } : opts;
      // Skip the dialog entirely if the user previously checked
      // "Don't ask again" for this key.
      if (normalized.dontAskAgainKey && loadSkipMap()[normalized.dontAskAgainKey]) {
        resolve(true);
        return;
      }
      setDontAsk(false);
      setState({ destructive: true, ...normalized, resolve });
    });
  }, []);

  const settle = (ok: boolean) => {
    if (ok && dontAsk && state?.dontAskAgainKey) {
      setSkipped(state.dontAskAgainKey);
    }
    state?.resolve(ok);
    setState(null);
  };

  const destructive = state?.destructive !== false;
  const confirmLabel = state?.confirmLabel ?? (destructive ? 'Delete' : 'Confirm');
  const cancelLabel = state?.cancelLabel ?? 'Cancel';

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        opened={!!state}
        onClose={() => settle(false)}
        title={state?.title ?? 'Confirm'}
        centered
        size="sm"
        zIndex={400}
      >
        <Text size="sm" c="dimmed" mb="md">{state?.message}</Text>
        {state?.dontAskAgainKey && (
          <Checkbox
            size="xs"
            mb="md"
            label="Don't ask again"
            checked={dontAsk}
            onChange={(e) => setDontAsk(e.currentTarget.checked)}
          />
        )}
        <Group justify="flex-end" gap="xs">
          <Button size="xs" variant="subtle" color="gray" onClick={() => settle(false)}>{cancelLabel}</Button>
          <Button size="xs" color={destructive ? 'red' : undefined} data-autofocus onClick={() => settle(true)}>
            {confirmLabel}
          </Button>
        </Group>
      </Modal>
    </ConfirmContext.Provider>
  );
}
