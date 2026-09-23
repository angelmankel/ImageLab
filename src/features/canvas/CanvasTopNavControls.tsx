import { IconButton } from '@/components/ui/IconButton';
import { GridIcon, MaskIcon, SparkleIcon, TrashIcon } from '@/components/ui/icons';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useShortcut, ShortcutPriority } from '@/hooks/useShortcut';
import { useCanvasStore } from '@/lib/canvasStore';
import { useStore } from '@/lib/store';
import { defaultWorkflow, defaultLayers } from '@/lib/storage';
import { ActionIcon, Badge, Button } from '@mantine/core';
import { IconX } from '@tabler/icons-react';

/**
 * Top-nav chip showing the current Select-tool rect — size + a clear button.
 * Only renders when a selection exists, so it disappears whenever the user
 * isn't actively scoping a generation.
 */
export function SelectionInfo() {
  const selection = useCanvasStore(s => s.activeSelection);
  const clear = useCanvasStore(s => s.clearActiveSelection);
  if (!selection) return null;
  return (
    <Badge
      size="lg"
      variant="light"
      color="yellow"
      radius="sm"
      tt="none"
      className="shadow-sm"
      rightSection={
        <ActionIcon
          size="xs"
          variant="subtle"
          color="yellow"
          onClick={() => clear()}
          title="Clear selection (Esc)"
          aria-label="Clear selection"
        >
          <IconX size={12} />
        </ActionIcon>
      }
    >
      <span className="font-mono tabular-nums">
        {Math.round(selection.w)}×{Math.round(selection.h)}
      </span>
      <span className="ml-1.5 text-[10px] opacity-80">selected</span>
    </Badge>
  );
}

/**
 * Toggle the red-tinted mask overlay drawn on top of layers that have a
 * painted inpaint mask. Reads + writes `canvasStore.masksVisible`.
 */
export function MaskVisibilityToggle() {
  const on = useCanvasStore(s => s.masksVisible);
  const setOn = useCanvasStore(s => s.setMasksVisible);
  return (
    <IconButton
      state={on ? 'on' : 'off'}
      role="switch"
      aria-checked={on}
      aria-label={on ? 'Hide painted masks' : 'Show painted masks'}
      title={on
        ? 'Painted masks are SHOWING on layers. Click to hide.'
        : 'Painted masks are HIDDEN. Click to show as a red overlay.'}
      onClick={() => setOn(!on)}
    >
      <MaskIcon size={16} filled={on} />
    </IconButton>
  );
}

/**
 * Auto-frame toggle — uses the shared `IconButton`'s `state` API, which
 * applies on-state styling via a `data-[state=on]:` attribute selector. That
 * beats the default utilities on specificity regardless of stylesheet order,
 * so consumer overrides reliably win without the inline workaround this
 * component used to have.
 */
export function AutoFrameToggle() {
  const on = useStore(s => s.autoFrameOnComplete);
  const setOn = useStore(s => s.setAutoFrameOnComplete);
  return (
    <IconButton
      state={on ? 'on' : 'off'}
      role="switch"
      aria-checked={on}
      aria-label={on ? 'Auto-frame on complete: on' : 'Auto-frame on complete: off'}
      title={on
        ? 'Auto-frame is ON — finished images jump to view. Click to turn off.'
        : 'Auto-frame is OFF — canvas stays put when a job finishes. Click to turn on.'}
      onClick={() => setOn(!on)}
    >
      <SparkleIcon size={16} filled={on} />
    </IconButton>
  );
}

/**
 * Top-nav action — wipes every canvas layer AND resets the global workflow
 * params to defaults. Two-clicks-to-fire (Confirm dialog) since this nukes
 * the whole scene; can't be undone. Disabled when there's already nothing
 * to clear (no layers AND workflow is already the default).
 */
export function ClearCanvasButton() {
  const canvasLayerCount = useCanvasStore(s => s.canvasLayers.length);
  const clearAllCanvasLayers = useCanvasStore(s => s.clearAllCanvasLayers);
  const setActiveLayer = useCanvasStore(s => s.setActiveLayer);
  const confirm = useConfirm();
  const disabled = canvasLayerCount === 0;

  const onClick = async () => {
    if (disabled) return;
    const ok = await confirm({
      title: 'Clear canvas',
      message: `Remove all ${canvasLayerCount} layer${canvasLayerCount === 1 ? '' : 's'} and reset all parameters to defaults? This can't be undone.`,
      confirmLabel: 'Clear all',
    });
    if (!ok) return;
    // Deselect first so the panel-set scope-sync flips back to the global
    // backup before we overwrite that backup with defaults. Otherwise the
    // sync would restore stale params on next layer activation.
    setActiveLayer(null);
    clearAllCanvasLayers();
    useStore.setState({
      workflow: defaultWorkflow(),
      layers: defaultLayers(),
      _globalWorkflowBackup: null,
      _globalLayersBackup: null,
    });
  };

  return (
    <IconButton
      aria-label="Clear canvas"
      title={disabled ? 'Canvas is already empty' : 'Clear every layer and reset parameters to defaults'}
      onClick={onClick}
      disabled={disabled}
      className="disabled:cursor-not-allowed disabled:opacity-40"
    >
      <TrashIcon size={16} />
    </IconButton>
  );
}

/**
 * Renderless companion to the canvas TopNav — registers Delete / Backspace
 * to fire the same confirm-then-remove flow the Layers panel uses. Lives
 * inside <ConfirmProvider>, so useConfirm() is safe.
 */
export function CanvasDeleteShortcut() {
  const removeCanvasLayer = useCanvasStore(s => s.removeCanvasLayer);
  const confirm = useConfirm();

  useShortcut(['Delete', 'Backspace'], (e) => {
    const cs = useCanvasStore.getState();
    const activeId = cs.activeLayerId;
    if (!activeId) return;
    const layer = cs.canvasLayers.find(l => l.id === activeId);
    if (!layer) return;
    e.preventDefault();
    void (async () => {
      const ok = await confirm({
        title: 'Delete layer',
        message: `Delete “${layer.name}”? Its per-layer history will also be removed.`,
        confirmLabel: 'Delete',
        dontAskAgainKey: 'canvas.deleteLayer',
      });
      if (ok) removeCanvasLayer(activeId);
    })();
  }, {
    priority: ShortcutPriority.Global,
    when: () => {
      const cs = useCanvasStore.getState();
      return cs.mainView === 'canvas' && cs.activeLayerId !== null;
    },
  });

  return null;
}

/**
 * Grid snap toggle — shows the current grid step inline. Click the chip to
 * toggle snap-to-grid. Keyboard `[` / `]` adjust the step in 64-unit
 * increments (wired in useGlobalShortcuts).
 */
export function GridSnapToggle() {
  const gridStep = useCanvasStore(s => s.gridStep);
  const snapEnabled = useCanvasStore(s => s.snapEnabled);
  const setSnapEnabled = useCanvasStore(s => s.setSnapEnabled);
  return (
    <Button
      size="compact-md"
      h={34}
      variant={snapEnabled ? 'filled' : 'default'}
      leftSection={<GridIcon size={14} filled={snapEnabled} />}
      role="switch"
      aria-checked={snapEnabled}
      aria-label={snapEnabled ? `Snap to grid: on (${gridStep}px)` : `Snap to grid: off (${gridStep}px)`}
      title={snapEnabled
        ? `Snap is ON — layer bounds snap to ${gridStep}px grid. Click to disable.\n[ / ] adjust grid step.`
        : `Snap is OFF — bounds drag freely. Click to enable. Grid: ${gridStep}px.\n[ / ] adjust grid step.`}
      onClick={() => setSnapEnabled(!snapEnabled)}
      data-state={snapEnabled ? 'on' : 'off'}
      ff="monospace"
      fz={11}
    >
      <span className="tabular-nums">{gridStep}</span>
    </Button>
  );
}
