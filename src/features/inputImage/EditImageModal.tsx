import { useMemo, useState, type ReactNode } from 'react';
import {
  Badge, Box, Button, Group, Image, Menu, Modal, ScrollArea, SimpleGrid, Slider, Stack, Text,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconAdjustments, IconArrowBackUp, IconBackground, IconCheck, IconChevronDown, IconContrast, IconCrop,
  IconFlipHorizontal, IconFlipVertical, IconRotateClockwise,
} from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { runImageTool, removeBackgroundGraph } from '@/lib/imageJobs';
import {
  rotate90, flipHorizontal, flipVertical, invert,
  applyFilters, crop, cssFilterString, NEUTRAL_FILTERS, isNeutralFilters,
  resizeDataUrlForUpload, blobToImageState,
  type CssFilters, type CropRect,
} from './imageOps';
import { CropOverlay } from './CropOverlay';
import type { InputImageState } from '@/lib/types';

type Props = {
  image: InputImageState;
  onClose: () => void;
};

type Mode = 'idle' | 'adjustments' | 'crop';

/** One entry in the in-modal edit-history stack. Each tool that mutates the
 *  image pushes a step here; the menu lets the user revert to any of
 *  them. Modal-local — closing and re-opening starts a fresh stack at the
 *  current `workflow.inputImage`. */
type HistoryStep = { state: InputImageState; label: string; at: number };

/**
 * Pre-generation image editor. Quick client-side ops (rotate, flip, invert,
 * crop, brightness/contrast/saturation/blur) bake immediately into a fresh
 * Canvas; Remove BG offloads to ComfyUI via `runImageTool` and swaps the
 * result back into the workflow's `inputImage`. Tools share the same image
 * state, so chaining works (crop → remove bg → adjust → ...).
 *
 * A Mantine modal sized to the viewport: side by side on a desktop, stacked and full screen on a
 * phone, with the tools scrolling on their own so nothing is ever cut off.
 */
export function EditImageModal({ image, onClose }: Props) {
  const setWorkflow = useStore(s => s.setWorkflow);
  const setStatus = useStore(s => s.setStatus);
  const inputMaxSize = useStore(s => s.workflow.inputMaxSize);
  const peekNextServer = useStore(s => s.peekNextServer);
  const narrow = useMediaQuery('(max-width: 48em)') ?? false;

  // Modal-session history. The first entry is the image we were opened with
  // and is never mutated — that's what "Reset to original" jumps back to.
  // Lazy `useState` initialiser so the original is captured ONCE, regardless
  // of how many times the `image` prop changes via parent re-renders.
  const [history, setHistory] = useState<HistoryStep[]>(() => [
    { state: image, label: 'Original', at: Date.now() },
  ]);
  const [cursor, setCursor] = useState(0);
  const current = history[cursor];

  const [mode, setMode] = useState<Mode>('idle');
  const [filters, setFilters] = useState<CssFilters>(NEUTRAL_FILTERS);
  const [busy, setBusy] = useState<string | null>(null);

  // Commit edited state up to the workflow store *and* push a new history
  // step. Doing this on every op (instead of waiting for a final "Apply")
  // means a server-side tool job can fail without leaving the user with
  // mismatched local state. Edits made after a revert truncate the tail of
  // the stack — standard undo behaviour.
  const commit = (next: InputImageState, label: string) => {
    setHistory(prev => {
      const truncated = prev.slice(0, cursor + 1);
      return [...truncated, { state: next, label, at: Date.now() }];
    });
    setCursor(c => c + 1);
    setWorkflow({ inputImage: next });
  };

  /** Jump to any earlier history step (no truncation here — only commits
   *  truncate, so the user can re-pick a later step until they edit again). */
  const revertTo = (idx: number) => {
    const step = history[idx];
    if (!step) return;
    setCursor(idx);
    setWorkflow({ inputImage: step.state });
  };

  const runClientOp = async (
    name: string,
    fn: (dataUrl: string) => Promise<{ dataUrl: string; width: number; height: number }>,
  ) => {
    if (busy) return;
    setBusy(name);
    try {
      const r = await fn(current.state.dataUrl);
      commit({ dataUrl: r.dataUrl, name: current.state.name, width: r.width, height: r.height }, name);
    } catch (err) {
      setStatus(`${name} failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleRotate = () => runClientOp('Rotate', d => rotate90(d, 1));
  const handleFlipH  = () => runClientOp('Flip H', flipHorizontal);
  const handleFlipV  = () => runClientOp('Flip V', flipVertical);
  const handleInvert = () => runClientOp('Invert', invert);
  const handleReset  = () => revertTo(0);

  const handleApplyFilters = async () => {
    if (isNeutralFilters(filters)) { setMode('idle'); return; }
    await runClientOp('Adjustments', d => applyFilters(d, filters));
    setFilters(NEUTRAL_FILTERS);
    setMode('idle');
  };

  const handleApplyCrop = async (rect: CropRect) => {
    await runClientOp('Crop', d => crop(d, rect));
    setMode('idle');
  };

  const handleRemoveBg = async () => {
    if (busy) return;
    const target = peekNextServer();
    if (!target) { setStatus('No server available to run Remove BG', 'error'); return; }
    setBusy('Remove BG');
    setStatus(`Removing background on ${target.name}…`, 'busy');
    try {
      const blob = await resizeDataUrlForUpload(current.state.dataUrl, Math.max(inputMaxSize, 1024));
      const out = await runImageTool(target.host, blob, current.state.name, removeBackgroundGraph);
      const next = await blobToImageState(out, current.state.name.replace(/\.[^.]+$/, '') + '-rmbg.png');
      commit(next, 'Remove BG');
      setStatus(`Background removed`, 'ok');
    } catch (err) {
      setStatus(`Remove BG failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  // Adjustments preview is applied via CSS filter so it's instant — only
  // baked into the actual image when the user hits Apply.
  const previewFilter = mode === 'adjustments' ? cssFilterString(filters) : 'none';

  return (
    <Modal
      opened
      onClose={onClose}
      fullScreen={narrow}
      size="calc(min(1100px, 95vw))"
      centered
      padding={0}
      title={
        <Group gap="xs">
          <Text fw={600}>Edit input image</Text>
          <Badge size="sm" variant="light" color="blue">{current.state.width} × {current.state.height}</Badge>
          {busy && <Badge size="sm" variant="light">{busy}…</Badge>}
        </Group>
      }
      styles={{
        content: { display: 'flex', flexDirection: 'column', height: narrow ? '100dvh' : 'min(720px, 90dvh)', overflow: 'hidden' },
        // `padding={0}` is for the body; the header keeps v1's padding.
        header: { flexShrink: 0, padding: 'var(--mantine-spacing-sm) var(--mantine-spacing-md)' },
        body: { flex: 1, minHeight: 0, display: 'flex', flexDirection: narrow ? 'column' : 'row', padding: 0 },
      }}
    >
      {/* Preview */}
      {/* A size container, so the frame can fit both ways in CSS: the crop overlay covers the
          frame, and the frame must be exactly the image, never a letterboxed box around it. */}
      <Box
        style={{ flex: narrow ? '1 1 45%' : 1, minHeight: 0, minWidth: 0, containerType: 'size' }}
        className="relative flex items-center justify-center overflow-hidden bg-bg-base/40"
      >
        <div
          className="relative flex items-center justify-center"
          style={{
            aspectRatio: `${current.state.width} / ${current.state.height}`,
            width: `min(${current.state.width}px, calc(100cqw - 32px), calc((100cqh - 32px) * ${current.state.width / current.state.height}))`,
          }}
        >
          <img
            src={current.state.dataUrl}
            alt=""
            style={{ filter: previewFilter }}
            className="block h-full w-full select-none rounded-md object-contain shadow-lg"
            draggable={false}
          />
          {mode === 'crop' && (
            <CropOverlay
              imageWidth={current.state.width}
              imageHeight={current.state.height}
              onApply={handleApplyCrop}
              onCancel={() => setMode('idle')}
            />
          )}
        </div>
      </Box>

      {/* Tools rail — scrolls on its own so the Done button is always reachable. */}
      <Box
        style={{ width: narrow ? '100%' : 280, flex: narrow ? '1 1 55%' : 'none', minHeight: 0 }}
        className={narrow ? 'flex flex-col border-t border-border-default bg-bg-panel' : 'flex flex-col border-l border-border-default bg-bg-panel'}
      >
        <ScrollArea scrollbars="y" style={{ flex: 1, minHeight: 0 }} type="auto">
          <Stack gap="md" p="sm">
            <ToolSection title="Quick">
              <SimpleGrid cols={2} spacing={6}>
                <ToolButton icon={<IconRotateClockwise size={14} />} label="Rotate 90°" onClick={handleRotate} disabled={!!busy} />
                <ToolButton icon={<IconFlipHorizontal size={14} />} label="Flip H" onClick={handleFlipH} disabled={!!busy} />
                <ToolButton icon={<IconFlipVertical size={14} />} label="Flip V" onClick={handleFlipV} disabled={!!busy} />
                <ToolButton icon={<IconContrast size={14} />} label="Invert" onClick={handleInvert} disabled={!!busy} />
              </SimpleGrid>
            </ToolSection>

            <ToolSection title="Crop" hint="Drag corners to size, drag inside to move, then Apply.">
              {mode === 'crop' ? (
                <Button variant="default" size="xs" fullWidth onClick={() => setMode('idle')}>Cancel crop</Button>
              ) : (
                <ToolButton icon={<IconCrop size={14} />} label="Crop image" onClick={() => setMode('crop')} disabled={!!busy} />
              )}
            </ToolSection>

            <ToolSection title="Adjustments">
              {mode === 'adjustments' ? (
                <Stack gap="sm">
                  <FilterRow label="Brightness" value={filters.brightness} min={0} max={2} step={0.01}
                    onChange={(v) => setFilters({ ...filters, brightness: v })} />
                  <FilterRow label="Contrast"   value={filters.contrast}   min={0} max={2} step={0.01}
                    onChange={(v) => setFilters({ ...filters, contrast: v })} />
                  <FilterRow label="Saturation" value={filters.saturation} min={0} max={2} step={0.01}
                    onChange={(v) => setFilters({ ...filters, saturation: v })} />
                  <FilterRow label="Blur"       value={filters.blur}       min={0} max={20} step={0.1}
                    onChange={(v) => setFilters({ ...filters, blur: v })} />
                  <Group gap={6} grow>
                    <Button variant="default" size="xs" onClick={() => { setFilters(NEUTRAL_FILTERS); setMode('idle'); }}>Cancel</Button>
                    <Button size="xs" onClick={handleApplyFilters} disabled={!!busy}>Apply</Button>
                  </Group>
                </Stack>
              ) : (
                <ToolButton icon={<IconAdjustments size={14} />} label="Open adjustments" onClick={() => setMode('adjustments')} disabled={!!busy} />
              )}
            </ToolSection>

            <ToolSection title="AI" hint="Runs as a separate ComfyUI job (BRIA RMBG). Replaces the current image with the result.">
              <Button
                variant="light"
                size="xs"
                fullWidth
                leftSection={<IconBackground size={14} />}
                onClick={handleRemoveBg}
                disabled={!!busy && busy !== 'Remove BG'}
                loading={busy === 'Remove BG'}
              >
                Remove background
              </Button>
            </ToolSection>
          </Stack>
        </ScrollArea>

        <Stack gap={6} p="sm" className="shrink-0 border-t border-border-default">
          <Button.Group>
            <Button
              variant="default"
              size="xs"
              style={{ flex: 1 }}
              leftSection={<IconArrowBackUp size={14} />}
              onClick={handleReset}
              disabled={!!busy || cursor === 0}
            >
              Reset to original
            </Button>
            <Menu position="top-end" width={260} withinPortal shadow="md">
              <Menu.Target>
                <Button variant="default" size="xs" px={8} disabled={!!busy || history.length < 2} aria-label="Version history" title="Version history">
                  <IconChevronDown size={14} />
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <HistoryList history={history} cursor={cursor} onPick={revertTo} />
              </Menu.Dropdown>
            </Menu>
          </Button.Group>
          <Button fullWidth onClick={onClose}>Done</Button>
        </Stack>
      </Box>
    </Modal>
  );
}

function HistoryList({
  history, cursor, onPick,
}: {
  history: HistoryStep[];
  cursor: number;
  onPick: (idx: number) => void;
}) {
  // Newest-first reads better in a dropdown — but keep the underlying indexes
  // so onPick references the real history array.
  const reversed = useMemo(
    () => history.map((s, i) => ({ step: s, idx: i })).reverse(),
    [history],
  );
  return (
    <>
      <Menu.Label>Version history</Menu.Label>
      <ScrollArea.Autosize scrollbars="y" mah={320}>
        {reversed.map(({ step, idx }) => {
          const active = idx === cursor;
          return (
            <Menu.Item
              key={`${step.at}-${idx}`}
              onClick={() => onPick(idx)}
              leftSection={<Image src={step.state.dataUrl} alt="" w={40} h={40} radius="sm" fit="cover" />}
              rightSection={active ? <IconCheck size={14} color="var(--mantine-primary-color-filled)" /> : null}
              bg={active ? 'var(--mantine-primary-color-light)' : undefined}
            >
              <Text size="sm" fw={500} truncate c={active ? 'var(--mantine-primary-color-light-color)' : undefined}>
                {idx === 0 ? 'Original' : step.label}
              </Text>
              <Text size="xs" c="dimmed" ff="monospace">
                {step.state.width}×{step.state.height}
                {idx > 0 && ` · step ${idx}`}
              </Text>
            </Menu.Item>
          );
        })}
      </ScrollArea.Autosize>
    </>
  );
}

function ToolSection({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Stack gap={6}>
      <Text size="xs" fw={700} c="dimmed" tt="uppercase">{title}</Text>
      {children}
      {hint && <Text size="xs" c="dimmed">{hint}</Text>}
    </Stack>
  );
}

function ToolButton({
  icon, label, onClick, disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button variant="default" size="xs" fullWidth leftSection={icon} onClick={onClick} disabled={disabled}>
      {label}
    </Button>
  );
}

/** v1 sub-parameter row: a dimmed label and its value above a plain slider. */
function FilterRow({
  label, value, min, max, step, onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const shown = step >= 1 ? value.toFixed(0) : step >= 0.1 ? value.toFixed(1) : value.toFixed(2);
  return (
    <div>
      <Group justify="space-between" mb={4}>
        <Text size="xs" c="dimmed">{label}</Text>
        <Text size="xs" fw={500} className="tabular-nums">{shown}</Text>
      </Group>
      <Slider value={value} onChange={onChange} min={min} max={max} step={step} label={null} thumbProps={{ 'aria-label': label }} className="touch-pan-y" />
    </div>
  );
}
