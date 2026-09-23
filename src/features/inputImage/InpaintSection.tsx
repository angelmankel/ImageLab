import { useEffect, useState } from 'react';
import {
  ActionIcon, Box, Button, Code, Collapse, Group, Image, SegmentedControl, Select, SimpleGrid, Stack,
  Switch, Text, Tooltip, UnstyledButton,
} from '@mantine/core';
import { IconBrush, IconChevronDown, IconChevronRight, IconMask, IconUpload, IconX } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { useCanvasStore } from '@/lib/canvasStore';
import { canvasStorage } from '@/lib/canvasStorageInstance';
import { uid } from '@/lib/storage';
import { useCollapsed } from '@/hooks/useCollapsed';
import { FieldWrapper } from '@/components/fields/FieldWrapper';
import { SliderField } from '@/components/fields/SliderField';
import { SelectField } from '@/components/fields/SelectField';
import { DenoiseField } from '@/features/controls/DenoiseField';
import { MaskPainter } from './MaskPainter';
import { loadHtmlImage } from './imageOps';

const VARIANTS: Array<{
  value: 'auto' | 'destructive' | 'denoising';
  label: string;
  hint: string;
}> = [
  { value: 'auto', label: 'Auto', hint: 'Picks by denoise: ≥0.99 destructive, else denoising' },
  { value: 'destructive', label: 'Destructive', hint: 'VAEEncodeForInpaint — model creates from scratch in the mask, denoise forced to 1.0' },
  { value: 'denoising', label: 'Denoising', hint: 'SetLatentNoiseMask — model varies the underlying pixels at the current denoise' },
];

const RESOLUTION_OPTIONS = ['Auto', '512', '768', '1024', '1536', '2048'];

/**
 * Preset bundles for the most common inpaint flavours. Each writes a full
 * combo of variant + context + feather + denoise + invertMask so the user
 * doesn't have to reason about how those knobs interact. "Custom" is the
 * fall-through when no preset matches the current values.
 */
type InpaintPreset = {
  id: 'inpaint' | 'replace' | 'extend' | 'refine';
  label: string;
  blurb: string;
  patch: {
    inpaintVariant: 'auto' | 'destructive' | 'denoising';
    inpaintContextExtend: number;
    inpaintFeather: number;
    inpaintMaskExpand: number;
    inpaintInvertMask: boolean;
    inputDenoise: number;
    inpaintTargetSize: 'auto' | number;
  };
};

const PRESETS: InpaintPreset[] = [
  {
    id: 'inpaint',
    label: 'Inpaint area',
    blurb: 'Vary an area, keep its overall look (denoise ≈ 0.6)',
    patch: {
      inpaintVariant: 'denoising',
      inpaintContextExtend: 1.5,
      inpaintFeather: 8,
      inpaintInvertMask: false,
      inputDenoise: 0.6,
      inpaintTargetSize: 1024,
      inpaintMaskExpand: 0,
    },
  },
  {
    id: 'replace',
    label: 'Replace area',
    blurb: 'Generate the masked area from scratch (full denoise)',
    patch: {
      inpaintVariant: 'destructive',
      inpaintContextExtend: 2.0,
      inpaintFeather: 16,
      inpaintInvertMask: false,
      inputDenoise: 1.0,
      inpaintTargetSize: 1024,
      inpaintMaskExpand: 0,
    },
  },
  {
    id: 'extend',
    label: 'Extend image',
    blurb: 'Outpaint — fill only the empty area next to existing content',
    patch: {
      inpaintVariant: 'destructive',
      inpaintContextExtend: 2.5,
      inpaintFeather: 24,
      inpaintInvertMask: true,
      inputDenoise: 1.0,
      inpaintTargetSize: 1024,
      inpaintMaskExpand: 0,
    },
  },
  {
    id: 'refine',
    label: 'Refine details',
    blurb: 'Gentle pass — clean up details without changing composition',
    patch: {
      inpaintVariant: 'denoising',
      inpaintContextExtend: 1.2,
      inpaintFeather: 6,
      inpaintInvertMask: false,
      inputDenoise: 0.35,
      inpaintTargetSize: 1024,
      inpaintMaskExpand: 0,
    },
  },
];

function presetMatches(p: InpaintPreset, current: {
  inpaintVariant: 'auto' | 'destructive' | 'denoising';
  inpaintContextExtend: number;
  inpaintFeather: number;
  inpaintMaskExpand: number;
  inpaintInvertMask: boolean;
  inputDenoise: number;
  inpaintTargetSize: 'auto' | number;
}) {
  return (
    p.patch.inpaintVariant === current.inpaintVariant &&
    Math.abs(p.patch.inpaintContextExtend - current.inpaintContextExtend) < 0.05 &&
    p.patch.inpaintFeather === current.inpaintFeather &&
    p.patch.inpaintMaskExpand === current.inpaintMaskExpand &&
    p.patch.inpaintInvertMask === current.inpaintInvertMask &&
    Math.abs(p.patch.inputDenoise - current.inputDenoise) < 0.02 &&
    p.patch.inpaintTargetSize === current.inpaintTargetSize
  );
}

/** Object URL for a stored mask blob, for the preview. Revoked when the id changes. */
function useMaskPreview(blobId: string | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blobId) { setUrl(null); return; }
    let objectUrl: string | null = null;
    let cancelled = false;
    void canvasStorage.getBlob(blobId).then(blob => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [blobId]);
  return url;
}

/**
 * Turn any dropped image into a mask in the painter's format: white = inpaint, black = keep,
 * at the layer's bounds size. Transparent pixels count as keep.
 */
async function imageFileToMask(file: File, w: number, h: number): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadHtmlImage(url);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('No 2D context');
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < data.data.length; i += 4) {
      const d = data.data;
      const lum = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) * (d[i + 3] / 255);
      const v = lum > 128 ? 255 : 0;
      d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
    const blob = await new Promise<Blob | null>(r => c.toBlob(b => r(b), 'image/png'));
    if (!blob) throw new Error('Could not encode the mask');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Inpaint controls for any active canvas layer (#38 collapsed the per-type
 * gating). All layer-targeted gens run through the inpaint pipeline now,
 * so this section is visible whenever a layer is active.
 *
 * The mask block follows v1's MaskField: a black-and-white preview that doubles as a drop zone,
 * with Paint / Clear beside it. The inpaint pipeline uses InpaintCropImproved → KSampler →
 * InpaintStitchImproved on the server. The controls map directly to crop node params:
 *   - Variant     → which KSampler-priming node we use inside the crop
 *   - Context     → context_from_mask_extend_factor (crop padding around mask)
 *   - Resolution  → output_resize_to_target_size + output_target_w/h
 *   - Edge blend  → mask_blend_pixels (stitch seam softness)
 */
export function InpaintSection() {
  const activeLayerId = useCanvasStore(s => s.activeLayerId);
  const activeLayer = useCanvasStore(s =>
    s.activeLayerId ? s.canvasLayers.find(l => l.id === s.activeLayerId) ?? null : null);
  const updateCanvasLayer = useCanvasStore(s => s.updateCanvasLayer);
  const [maskOpen, setMaskOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inpaintFeather = useStore(s => s.workflow.inpaintFeather);
  const inpaintMaskExpand = useStore(s => s.workflow.inpaintMaskExpand);
  const inpaintVariant = useStore(s => s.workflow.inpaintVariant);
  const inpaintContextExtend = useStore(s => s.workflow.inpaintContextExtend);
  const inpaintTargetSize = useStore(s => s.workflow.inpaintTargetSize);
  const inpaintInvertMask = useStore(s => s.workflow.inpaintInvertMask);
  const inputDenoise = useStore(s => s.workflow.inputDenoise);
  const inpaintUseControlnet = useStore(s => s.workflow.inpaintUseControlnet);
  const inpaintControlnet = useStore(s => s.workflow.inpaintControlnet);
  const inpaintControlnetStrength = useStore(s => s.workflow.inpaintControlnetStrength);
  const controlnets = useStore(s => s.server.controlnets);
  const setWorkflow = useStore(s => s.setWorkflow);
  const setStatus = useStore(s => s.setStatus);
  // Persist the Advanced disclosure across reloads — without this users who
  // tweak knobs every session have to re-open it every time.
  const [advancedCollapsed, , setAdvancedCollapsed] = useCollapsed('inpaint.advanced', true);
  const advancedOpen = !advancedCollapsed;
  const setAdvancedOpen = (v: boolean) => setAdvancedCollapsed(!v);
  const maskBlobId = activeLayer?.paintedMaskBlobId;
  const maskUrl = useMaskPreview(maskBlobId);

  if (!activeLayerId || !activeLayer) return null;

  const targetSelectValue = inpaintTargetSize === 'auto' ? 'Auto' : String(inpaintTargetSize);
  // Destructive variant forces denoise to 1.0 inside the graph (see
  // buildGraph), so the denoise slider has no effect there — hide it
  // instead of letting the user fiddle with a no-op control.
  const denoiseApplies = inpaintVariant !== 'destructive';

  const current = { inpaintVariant, inpaintContextExtend, inpaintFeather, inpaintMaskExpand, inpaintInvertMask, inputDenoise, inpaintTargetSize };
  const activePreset = PRESETS.find(p => presetMatches(p, current))?.id ?? null;
  const applyPreset = (p: InpaintPreset) => {
    setWorkflow(p.patch);
  };

  const clearMask = () => updateCanvasLayer(activeLayerId, { paintedMaskBlobId: undefined });
  const importMask = async (file: File | null | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const w = Math.max(1, Math.round(activeLayer.bounds.w));
      const h = Math.max(1, Math.round(activeLayer.bounds.h));
      const blob = await imageFileToMask(file, w, h);
      const blobId = uid();
      await canvasStorage.putBlob(blobId, blob);
      updateCanvasLayer(activeLayerId, { paintedMaskBlobId: blobId });
      setStatus(`Mask loaded at ${w}×${h}`, 'ok');
    } catch (err) {
      setStatus(`Failed to load mask: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  };

  return (
    <Stack gap="sm">
      <Group gap={8}>
        <IconMask size={16} stroke={1.6} />
        <Text size="sm" fw={600}>Inpaint</Text>
      </Group>

      {/* Mask — a painted mask replaces the default full-bounds mask at queue time. */}
      <FieldWrapper
        label="Inpainting mask"
        rightSection={maskBlobId && (
          <Tooltip label="Clear mask">
            <ActionIcon variant="subtle" size="xs" color="red" onClick={clearMask} aria-label="Clear mask">
              <IconX size={14} />
            </ActionIcon>
          </Tooltip>
        )}
      >
        <Stack gap="xs">
          <Box
            role="button"
            tabIndex={0}
            aria-label={maskBlobId ? 'Edit mask' : 'Paint mask'}
            onClick={() => setMaskOpen(true)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMaskOpen(true); } }}
            onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); void importMask(e.dataTransfer.files?.[0]); }}
            onPaste={(e) => {
              const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'));
              void importMask(item?.getAsFile());
            }}
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '2',
              maxHeight: 120,
              borderRadius: 'var(--mantine-radius-md)',
              border: `2px dashed ${dragging ? 'var(--mantine-primary-color-5)' : 'var(--mantine-color-dark-4)'}`,
              backgroundColor: dragging ? 'var(--mantine-primary-color-9)' : 'var(--mantine-color-dark-6)',
              cursor: 'pointer',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
          >
            {maskBlobId && maskUrl ? (
              <Image src={maskUrl} alt="Mask" fit="contain" h="100%" w="100%" style={{ filter: 'grayscale(100%)' }} />
            ) : (
              <Stack align="center" gap={4}>
                {dragging ? <IconUpload size={24} style={{ opacity: 0.5 }} /> : <IconBrush size={24} style={{ opacity: 0.5 }} />}
                <Text size="xs" c="dimmed" ta="center">Click to paint a mask, or drop one here</Text>
              </Stack>
            )}
          </Box>
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <Text size="xs" c="dimmed" style={{ minWidth: 0 }}>
              {maskBlobId ? 'Custom mask · white = regenerate' : 'Mask: full bounds'}
            </Text>
            <Button size="compact-xs" variant="light" className="shrink-0" leftSection={<IconBrush size={12} />} onClick={() => setMaskOpen(true)}>
              {maskBlobId ? 'Edit mask' : 'Paint mask'}
            </Button>
          </Group>
        </Stack>
      </FieldWrapper>
      <MaskPainter open={maskOpen} onClose={() => setMaskOpen(false)} layerId={activeLayerId} />

      {/* Mask shape + expand + feather sit next to the mask so the whole "mask" toolkit reads as
          one cluster. They drive both the inpaint pipeline and the live preview overlay on the canvas. */}
      <FieldWrapper
        label="Mask shape"
        description={inpaintInvertMask
          ? 'Only the parts of the layer not covered by another visible layer — for extending past existing content.'
          : 'The entire layer bounds (default).'}
      >
        <SegmentedControl
          fullWidth
          size="xs"
          value={inpaintInvertMask ? 'invert' : 'full'}
          onChange={(v) => setWorkflow({ inpaintInvertMask: v === 'invert' })}
          aria-label="Mask shape"
          data={[{ value: 'full', label: 'Full bounds' }, { value: 'invert', label: 'Non-overlap only' }]}
        />
      </FieldWrapper>

      <SliderField
        label="Mask expand"
        description="Dilate the mask outward by N pixels before inpainting"
        value={inpaintMaskExpand}
        onChange={(v) => setWorkflow({ inpaintMaskExpand: Math.round(v) })}
        min={0}
        max={256}
        step={1}
        defaultValue={0}
      />

      <SliderField
        label="Mask feather"
        description="Soften the mask edge, in pixels"
        value={inpaintFeather}
        onChange={(v) => setWorkflow({ inpaintFeather: Math.round(v) })}
        min={0}
        max={31}
        step={1}
        defaultValue={8}
      />

      {/* ControlNet inpaint bias — alternate mode. Adds a ControlNet
          conditioning step around the sampler so edits tend to seam better
          and outpainting matches surrounding style. Requires the
          `controlnet_aux` custom node (for InpaintPreprocessor) and an
          SDXL-class inpaint CN in `ComfyUI/models/controlnet/`.
          Always rendered so the user can see whether ControlNet wiring is
          available, and what to install if it isn't. */}
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Text size="sm" fw={500}>ControlNet inpaint</Text>
          <Text size="xs" c="dimmed">Seams and outpainting follow the surrounding style</Text>
        </div>
        <Tooltip label="No ControlNet models found. Drop one into ComfyUI/models/controlnet/ and restart the server." disabled={controlnets.length > 0}>
          <Switch
            checked={inpaintUseControlnet}
            onChange={(e) => setWorkflow({ inpaintUseControlnet: e.currentTarget.checked })}
            disabled={controlnets.length === 0}
            aria-label="ControlNet inpaint"
          />
        </Tooltip>
      </Group>
      {controlnets.length === 0 && (
        <Text size="xs" c="dimmed">
          No ControlNet models detected on the active server(s). Drop an SDXL inpaint CN
          into <Code>ComfyUI/models/controlnet/</Code> and restart ComfyUI.
        </Text>
      )}
      {inpaintUseControlnet && controlnets.length > 0 && (
        <>
          <SelectField
            label="ControlNet model"
            value={inpaintControlnet || null}
            onChange={(v) => setWorkflow({ inpaintControlnet: v })}
            data={controlnets}
            placeholder="Pick an inpaint CN"
            clearable
          />
          <SliderField
            label="ControlNet strength"
            value={inpaintControlnetStrength}
            onChange={(v) => setWorkflow({ inpaintControlnetStrength: Math.round(v * 100) / 100 })}
            min={0}
            max={2}
            step={0.05}
            defaultValue={1}
          />
        </>
      )}

      {/* Top-level preset picker — picks a sensible bundle for the most
          common flavours of inpainting. The advanced knobs below fine-tune. */}
      <SimpleGrid cols={2} spacing={6}>
        {PRESETS.map(p => {
          const isActive = activePreset === p.id;
          return (
            <UnstyledButton
              key={p.id}
              onClick={() => applyPreset(p)}
              title={p.blurb}
              aria-pressed={isActive}
              className={isActive
                ? 'rounded-md border border-accent bg-accent-soft px-2 py-1.5 text-left'
                : 'rounded-md border border-border-default bg-bg-input px-2 py-1.5 text-left transition-colors hover:border-border-strong'}
            >
              <Text size="xs" fw={600} c={isActive ? 'var(--mantine-primary-color-light-color)' : undefined}>{p.label}</Text>
              <Text size="10px" c="dimmed" lh={1.3}>{p.blurb}</Text>
            </UnstyledButton>
          );
        })}
      </SimpleGrid>

      {/* v1 collapsible sub-group header: chevron, name, and a hint of state. */}
      <UnstyledButton onClick={() => setAdvancedOpen(!advancedOpen)} aria-expanded={advancedOpen}>
        <Group gap={6} py={4}>
          {advancedOpen ? <IconChevronDown size={14} style={{ opacity: 0.5 }} /> : <IconChevronRight size={14} style={{ opacity: 0.5 }} />}
          <Text size="sm" fw={500}>Advanced</Text>
          {!activePreset && <Text size="sm" c="dimmed">custom</Text>}
        </Group>
      </UnstyledButton>

      <Collapse in={advancedOpen}>
        <Stack gap="sm">
          {denoiseApplies && <DenoiseField />}

          <FieldWrapper label="Variant" description={VARIANTS.find(v => v.value === inpaintVariant)?.hint}>
            <SegmentedControl
              fullWidth
              size="xs"
              value={inpaintVariant}
              onChange={(v) => setWorkflow({ inpaintVariant: v as typeof inpaintVariant })}
              aria-label="Inpaint variant"
              data={VARIANTS.map(v => ({ value: v.value, label: v.label }))}
            />
          </FieldWrapper>

          <FieldWrapper
            label="Resolution"
            rightSection={<Text size="xs" c="dimmed">{inpaintTargetSize === 'auto' ? 'from crop' : `${inpaintTargetSize}²`}</Text>}
          >
            <Select
              data={RESOLUTION_OPTIONS}
              value={targetSelectValue}
              onChange={(v) => { if (v) setWorkflow({ inpaintTargetSize: v === 'Auto' ? 'auto' : Number(v) }); }}
              allowDeselect={false}
              comboboxProps={{ withinPortal: true }}
              aria-label="Inpaint sampling resolution"
            />
          </FieldWrapper>

          <SliderField
            label="Context"
            description="How far the crop reaches around the mask, as a multiple of its size"
            value={inpaintContextExtend}
            onChange={(v) => setWorkflow({ inpaintContextExtend: Math.round(v * 10) / 10 })}
            min={1}
            max={3}
            step={0.1}
            defaultValue={1.5}
          />
        </Stack>
      </Collapse>
    </Stack>
  );
}
