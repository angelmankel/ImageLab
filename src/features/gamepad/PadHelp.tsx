/**
 * The controller's button card: what each button does here, named as printed on the pad in hand
 * (a Switch pad says A where an Xbox pad says B for the same press). Minus opens it; B, A or Minus
 * closes it, and so does a tap.
 */
import { createPortal } from 'react-dom';
import { IconX } from '@tabler/icons-react';
import { familyName, padLabels, type PadFamily, type PadKey } from '@/lib/gamepad';
import type { WorkspaceMode } from '@/lib/workspace';

type HelpKey = PadKey | 'dpad';
interface Row { keys: HelpKey[]; text: string }

function rows(desktop: boolean, mode: WorkspaceMode | null): { title: string; rows: Row[] }[] {
  return [
    {
      title: 'Everywhere',
      rows: [
        { keys: ['a'], text: 'Press the highlighted control. Nothing highlighted: Generate.' },
        { keys: ['b'], text: 'Back: close what is open, leave a settings page, hide the highlight. Nothing left: Stop the run.' },
        { keys: ['plus'], text: 'Generate, or Stop while it runs. Works while typing too.' },
        { keys: ['dpad'], text: 'Move the highlight. ◀ ▶ change the highlighted setting (a slider, a number, a choice, a switch).' },
        { keys: ['zl', 'zr'], text: `Hold with ◀ ▶ for ten steps at a time. A tap: ${desktop ? 'older / newer result' : 'Create · Result · Gallery'}.` },
        { keys: ['l', 'r'], text: 'Previous / next mode: Image · Video · Workflow.' },
        { keys: ['x'], text: mode === 'workflow' ? 'New seeds for every seed in the workflow.' : 'New seed.' },
        { keys: ['y'], text: 'Favourite the image on screen (Image mode).' },
        { keys: ['lstick'], text: 'Press: the result full screen, and back.' },
        { keys: ['rstick'], text: 'Press: Simple / Advanced. Tilt: scroll.' },
        { keys: ['minus'], text: 'This card.' },
      ],
    },
    {
      title: 'Full screen',
      rows: [
        { keys: ['dpad', 'l', 'r'], text: '◀ ▶, L or R: previous / next, as the arrow keys.' },
        { keys: ['y'], text: 'Favourite (images).' },
        { keys: ['b', 'lstick'], text: 'Close.' },
      ],
    },
  ];
}

function Badge({ label }: { label: string }) {
  return (
    <span className="inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full border border-border-default bg-bg-elev px-2 text-[12px] font-semibold text-fg-primary">
      {label}
    </span>
  );
}

export function PadHelp({ family, desktop, mode, onClose }: { family: PadFamily; desktop: boolean; mode: WorkspaceMode | null; onClose: () => void }) {
  const labels = padLabels(family);
  const lone = family === 'joycon-l' || family === 'joycon-r';
  const label = (k: HelpKey) => (k === 'dpad' ? (lone ? labels.lstick : '✚') : labels[k]);

  return createPortal(
    <div data-pad-layer="help" data-no-swipe role="presentation" onClick={onClose}
      className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/60 p-4">
      <div onClick={e => e.stopPropagation()} style={{ touchAction: 'pan-y' }}
        className="scroll-y max-h-full w-full max-w-[460px] overflow-y-auto rounded-xl border border-border-default bg-bg-panel p-4 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-fg-primary">Controller</div>
            <div className="text-[12px] text-fg-muted">
              {familyName(family)}{lone ? ' — the right-hand button confirms, as on a Switch' : ''}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-secondary outline-none active:bg-bg-elev">
            <IconX size={18} />
          </button>
        </div>
        {rows(desktop, mode).map(group => (
          <section key={group.title} className="mb-3 last:mb-0">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">{group.title}</div>
            <div className="flex flex-col gap-1.5">
              {group.rows.map(row => {
                const keys = row.keys.map(label).filter(Boolean);
                if (!keys.length) return null;
                return (
                  <div key={row.keys.join()} className="flex items-start gap-3">
                    <div className="flex w-[92px] shrink-0 flex-wrap gap-1">{keys.map((k, i) => <Badge key={i} label={k} />)}</div>
                    <div className="pt-1 text-[13px] leading-snug text-fg-secondary">{row.text}</div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        <p className="mt-3 text-[11px] leading-relaxed text-fg-muted">
          The highlight shows after a controller press and hides on a touch or a click. Text boxes keep the controller out, except {labels.plus} and {labels.b} (leave the box).
        </p>
      </div>
    </div>,
    document.body,
  );
}
