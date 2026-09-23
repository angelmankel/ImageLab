import { useEffect, useRef, useState, type ComponentType } from 'react';
import { useCanvasStore } from '@/lib/canvasStore';
import { CANVAS_TOOLS, type CanvasToolId } from '@/lib/canvasTools';
import {
  MoveToolIcon, BrushIcon, EraserIcon, EyedropperIcon, FitViewIcon, type IconProps,
} from '@/components/ui/icons';
import { BrushSettingsPanel } from './BrushSettingsPopover';
import { ActionIcon, Divider, Tooltip } from '@mantine/core';

/**
 * Color-swatch button — circular, shows current brush color. Click opens
 * the browser's native color picker directly (via a hidden <input
 * type="color"> we click() programmatically). No intermediate popover, no
 * extra clicks.
 */
function ColorSwatch({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="relative">
      <Tooltip label={`Brush color (${color})`} position="right" withArrow>
        <ActionIcon
          size="lg"
          radius="xl"
          onClick={() => inputRef.current?.click()}
          aria-label="Brush color"
          className="pointer-events-auto border-2 !border-[var(--mantine-color-dark-2)] shadow-lg hover:!border-[var(--mantine-color-gray-4)]"
          style={{ backgroundColor: color }}
        />
      </Tooltip>
      <input
        ref={inputRef}
        type="color"
        value={color}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        onChange={(e) => onChange((e.target as HTMLInputElement).value)}
        // Visually hidden but kept in flow so click() works in every
        // browser (some require a non-display:none input).
        className="pointer-events-none absolute left-0 top-0 h-[34px] w-[34px] cursor-pointer opacity-0"
        aria-hidden
      />
    </div>
  );
}

const TOOL_ICONS: Record<CanvasToolId, ComponentType<IconProps>> = {
  move: MoveToolIcon,
  brush: BrushIcon,
  erase: EraserIcon,
  eyedropper: EyedropperIcon,
  // Reuse FitView (frame-corners glyph) — visually matches a marquee rect.
  select: FitViewIcon,
};

/** Tools whose icon button can toggle a settings popover when re-clicked. */
const HAS_SETTINGS: ReadonlySet<CanvasToolId> = new Set(['brush', 'erase']);

/**
 * Floating tool palette for the infinite canvas. Reads its button list
 * from `CANVAS_TOOLS`. The first slot is the brush-color swatch — a
 * circular button that opens a color-picker popover, separate from the
 * tool-specific settings panel.
 */
export function CanvasToolbar() {
  const mainView = useCanvasStore(s => s.mainView);
  const activeTool = useCanvasStore(s => s.activeTool);
  const setActiveTool = useCanvasStore(s => s.setActiveTool);
  const brushColor = useCanvasStore(s => s.brush.color);
  const setBrush = useCanvasStore(s => s.setBrush);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const prevToolRef = useRef(activeTool);
  useEffect(() => {
    if (prevToolRef.current !== activeTool) {
      prevToolRef.current = activeTool;
      setSettingsOpen(false);
    }
  }, [activeTool]);

  if (mainView !== 'canvas') return null;

  const handleToolClick = (id: CanvasToolId) => {
    if (id !== activeTool) {
      setActiveTool(id);
      setSettingsOpen(false);
      return;
    }
    if (HAS_SETTINGS.has(id)) setSettingsOpen(o => !o);
  };

  return (
    <div className="relative flex flex-col gap-1">
      {settingsOpen && <BrushSettingsPanel />}

      <ColorSwatch color={brushColor} onChange={(c) => setBrush({ color: c })} />
      {/* Thin separator between color and tools */}
      <Divider my={2} />

      {CANVAS_TOOLS.map(tool => {
        const active = tool.id === activeTool;
        const Icon = TOOL_ICONS[tool.id];
        return (
          // v1 tool buttons: filled when current, the default grey otherwise.
          <Tooltip key={tool.id} label={`${tool.label} (${tool.shortcutKey.toUpperCase()})`} position="right" withArrow>
            <ActionIcon
              size="lg"
              variant={active ? 'filled' : 'default'}
              onClick={() => handleToolClick(tool.id)}
              aria-label={tool.label}
              aria-pressed={active}
              className="pointer-events-auto shadow-lg"
            >
              <Icon size={16} />
            </ActionIcon>
          </Tooltip>
        );
      })}
    </div>
  );
}

