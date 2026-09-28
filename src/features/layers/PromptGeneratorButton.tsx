import { cloneElement, useEffect, useMemo, useRef, useState } from 'react';
import { ActionIcon, Modal } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconSparkles } from '@tabler/icons-react';
import * as Popover from '@/components/ui/popover';
import { useStore } from '@/lib/store';
import { compileLayers } from '@/lib/prompt';
import { generateLayerSet, type GenerateLayerSource } from '@/lib/venice';
import { CloseIcon, SparkleIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

/**
 * Header-level action in the Prompt tab: opens a popover with two modes for
 * synthesizing a fresh positive-layer set via Venice — "from an idea" (the
 * user types a theme) and "from the current final prompt" (we feed the
 * compiled positive string back to the model and ask for a richer breakdown).
 *
 * On success we wipe every positive layer and install the generated set in
 * their place. Negative layers are untouched (they're usually quality
 * boilerplate the user wants to keep across regenerations).
 *
 * Phones (under 48em) get a full-screen window instead: a 340px popover beside a button has no room
 * there, went off the screen, and jumped around while the keyboard opened and closed.
 */
export function PromptGeneratorButton({ variant = 'text' }: { variant?: 'text' | 'icon' }) {
  const [open, setOpen] = useState(false);
  const narrow = useMediaQuery('(max-width: 48em)') ?? false;
  const venice = useStore(s => s.venice);
  const disabled = !venice.apiKey;
  const title = disabled
    ? 'Set a Venice API key in Settings → AI to enable prompt generation'
    : 'Prompt Studio — draft prompt parts with AI';

  const trigger = variant === 'icon' ? (
          <ActionIcon size="sm" variant="subtle" color="violet" disabled={disabled} title={title} aria-label="Generate prompt with AI">
            <IconSparkles size="1rem" />
          </ActionIcon>
        ) : (
          <button
            type="button"
            disabled={disabled}
            title={title}
            className={cn(
              'flex h-6 items-center gap-1 rounded-md px-1.5 text-[10px] font-medium transition-colors',
              'text-fg-dim hover:bg-bg-elev hover:text-accent-fg',
              'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-fg-dim',
            )}
            aria-label="Generate prompt with AI"
          >
            <SparkleIcon size={12} />
            Draft with AI
          </button>
        );

  if (narrow) {
    return (
      <>
        {cloneElement(trigger, { onClick: () => setOpen(true) })}
        <Modal
          opened={open}
          onClose={() => setOpen(false)}
          fullScreen
          withCloseButton={false}
          padding={0}
          transitionProps={{ transition: 'fade', duration: 120 }}
          styles={{
            content: { display: 'flex', flexDirection: 'column', height: '100dvh', backgroundColor: 'var(--mantine-color-dark-7)' },
            body: {
              flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
              paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            },
          }}
        >
          {open && <PromptGeneratorPopover onClose={() => setOpen(false)} phone />}
        </Modal>
      </>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        {trigger}
      </Popover.Trigger>
      <Popover.Content
        side="right"
        align="start"
        sideOffset={6}
        className="flex max-h-[min(560px,calc(100dvh-16px))] w-[340px] flex-col rounded-xl border border-border-default bg-bg-elev shadow-2xl"
      >
        {open && <PromptGeneratorPopover onClose={() => setOpen(false)} />}
      </Popover.Content>
    </Popover.Root>
  );
}

/** `phone`: bigger text and touch targets, and the idea box does not grab focus (the keyboard
 *  would cover the window the moment it opens). */
function PromptGeneratorPopover({ onClose, phone = false }: { onClose: () => void; phone?: boolean }) {
  const layers = useStore(s => s.layers);
  const venice = useStore(s => s.venice);
  const replaceLayers = useStore(s => s.replaceLayers);

  const compiledPositive = useMemo(() => compileLayers(layers, 'positive'), [layers]);

  const [source, setSource] = useState<GenerateLayerSource>('idea');
  const [idea, setIdea] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Closing the popover (Escape, a click outside) unmounts this, which cancels a run in flight.
  useEffect(() => () => abortRef.current?.abort(), []);

  const canRun = source === 'idea'
    ? idea.trim().length > 0
    : compiledPositive.trim().length > 0;

  const run = async () => {
    if (busy || !canRun) return;
    setError(null);
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const seed = source === 'idea' ? idea : compiledPositive;
      const items = await generateLayerSet({
        seed,
        source,
        settings: venice,
        signal: ctrl.signal,
      });
      if (ctrl.signal.aborted) return;
      if (items.length === 0) {
        setError('AI returned no usable snippets — try rephrasing.');
        return;
      }
      replaceLayers('positive', items);
      onClose();
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  return (
    <>
      <header className={cn('flex shrink-0 items-center gap-2 border-b border-border-subtle', phone ? 'px-4 py-3' : 'px-3 py-2')}>
        <SparkleIcon size={phone ? 16 : 13} className="text-accent-fg" />
        <span className={cn('font-semibold uppercase tracking-section text-fg-secondary', phone ? 'text-[13px]' : 'text-[11px]')}>
          Generate prompt
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={cn('ml-auto flex items-center justify-center rounded-md text-fg-dim hover:bg-bg-card hover:text-fg-secondary', phone ? 'h-10 w-10' : 'h-6 w-6')}
        >
          <CloseIcon size={phone ? 18 : 12} />
        </button>
      </header>

      <div className={cn('scroll-y flex min-h-0 flex-1 flex-col', phone ? 'gap-4 p-4 [&_*]:!text-[14px]' : 'gap-3 p-3')}>
        <div role="tablist" className="flex rounded-md border border-border-default bg-bg-input p-0.5">
          <SourceTab active={source === 'idea'} onClick={() => setSource('idea')}>
            From idea
          </SourceTab>
          <SourceTab
            active={source === 'prompt'}
            onClick={() => setSource('prompt')}
            disabled={compiledPositive.trim().length === 0}
            disabledTitle="No compiled positive prompt yet — add some layers first"
          >
            From final prompt
          </SourceTab>
        </div>

        {source === 'idea' ? (
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-section text-fg-dim">Your idea</span>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="cyberpunk sphinx at dusk, neon rain, …"
              rows={phone ? 5 : 3}
              autoFocus={!phone}
              className="w-full resize-none rounded-md border border-border-default bg-bg-input px-2.5 py-2 text-[12px] text-fg-secondary outline-none placeholder:text-fg-dim focus:border-accent"
            />
          </label>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-section text-fg-dim">Final prompt (input)</span>
            <pre className="max-h-[110px] overflow-y-auto whitespace-pre-wrap rounded-md border border-border-default bg-bg-input px-2.5 py-2 font-mono text-[10.5px] leading-relaxed text-fg-tertiary">
              {compiledPositive || '(empty)'}
            </pre>
          </div>
        )}

        <p className="text-[10.5px] leading-snug text-fg-muted">
          Replaces every <span className="font-semibold text-fg-tertiary">positive</span> layer with a fresh set.
          Negative layers stay untouched.
        </p>

        {error && (
          <div className="rounded-md border border-status-err/60 bg-status-err/15 px-2.5 py-1.5 text-[11px] text-status-err">
            {error}
          </div>
        )}
      </div>

      <footer className={cn('flex shrink-0 items-center justify-end gap-2 border-t border-border-subtle', phone ? 'px-4 py-3 [&>button]:px-4 [&>button]:py-2 [&>button]:!text-[14px]' : 'px-3 py-2')}>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-md border border-border-default bg-bg-elev px-2.5 py-1 text-[11px] font-medium text-fg-tertiary transition-colors hover:border-border-strong hover:text-fg-secondary disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={run}
          disabled={busy || !canRun}
          className="flex items-center gap-1.5 rounded-md border border-accent bg-accent px-3 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SparkleIcon size={11} />
          {busy ? 'Generating…' : 'Generate'}
        </button>
      </footer>
    </>
  );
}

function SourceTab({
  active, onClick, disabled, disabledTitle, children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  disabledTitle?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledTitle : undefined}
      aria-pressed={active}
      className={cn(
        'flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors',
        active
          ? 'bg-accent-soft text-accent-fg'
          : 'text-fg-tertiary hover:text-fg-secondary',
        disabled && 'cursor-not-allowed opacity-40 hover:text-fg-tertiary',
      )}
    >
      {children}
    </button>
  );
}
