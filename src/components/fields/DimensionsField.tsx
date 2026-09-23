/**
 * DimensionsField (v1)
 * ====================
 * Width × height with an aspect-ratio preview, and two ways in: a grouped resolution preset
 * list, or width/height sliders with optional number inputs.
 */
import { useMemo, useState } from 'react';
import { ActionIcon, Box, Collapse, Group, SegmentedControl, Select, Slider, Stack, Text } from '@mantine/core';
import { StepperInput } from './StepperInput';
import { IconKeyboard, IconKeyboardOff } from '@tabler/icons-react';
import { FieldWrapper } from './FieldWrapper';

export interface Dimensions { width: number; height: number }

type InputMode = 'presets' | 'sliders';

const DIMENSION_PRESETS = [
  { group: 'Square', items: [
    { value: '512x512', label: '512 × 512' },
    { value: '768x768', label: '768 × 768' },
    { value: '1024x1024', label: '1024 × 1024' },
    { value: '1536x1536', label: '1536 × 1536' },
  ] },
  { group: 'Landscape', items: [
    { value: '1152x896', label: '1152 × 896 (4:3)' },
    { value: '1216x832', label: '1216 × 832 (3:2)' },
    { value: '1344x768', label: '1344 × 768 (16:9)' },
    { value: '1536x640', label: '1536 × 640 (21:9)' },
  ] },
  { group: 'Portrait', items: [
    { value: '896x1152', label: '896 × 1152 (3:4)' },
    { value: '832x1216', label: '832 × 1216 (2:3)' },
    { value: '768x1344', label: '768 × 1344 (9:16)' },
    { value: '640x1536', label: '640 × 1536 (9:21)' },
  ] },
];
const ALL_PRESET_VALUES = DIMENSION_PRESETS.flatMap((g) => g.items.map((i) => i.value));
const SLIDER_MARKS = [
  { value: 512, label: '512' },
  { value: 1024, label: '1024' },
  { value: 1536, label: '1536' },
  { value: 2048, label: '2048' },
];
const MODE_KEY = 'imagelab.dimensionsMode.v1';

export interface DimensionsFieldProps {
  value: Dimensions;
  onChange: (v: Dimensions) => void;
  label?: string;
  disabled?: boolean;
}

export function DimensionsField({ value, onChange, label = 'Dimensions', disabled }: DimensionsFieldProps) {
  const [inputMode, setInputModeRaw] = useState<InputMode>(() => {
    try { return localStorage.getItem(MODE_KEY) === 'sliders' ? 'sliders' : 'presets'; } catch { return 'presets'; }
  });
  const setInputMode = (m: InputMode) => { setInputModeRaw(m); try { localStorage.setItem(MODE_KEY, m); } catch { /* ignore */ } };
  const [showNumberInputs, setShowNumberInputs] = useState(false);

  const { width, height } = value;
  const current = useMemo(() => {
    const f = `${width}x${height}`;
    return ALL_PRESET_VALUES.includes(f) ? f : null;
  }, [width, height]);
  const presetData = current ? DIMENSION_PRESETS : [...DIMENSION_PRESETS, { group: 'Current', items: [{ value: `${width}x${height}`, label: `${width} × ${height}` }] }];

  const megapixels = ((width * height) / 1_000_000).toFixed(2);

  return (
    <FieldWrapper
      label={label}
      rightSection={
        <SegmentedControl
          value={inputMode}
          onChange={(v) => setInputMode(v as InputMode)}
          data={[{ label: 'Presets', value: 'presets' }, { label: 'Sliders', value: 'sliders' }]}
          size="xs"
          disabled={disabled}
        />
      }
    >
      <Stack gap="sm">
        <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, height: 120 }}>
          <Box
            style={{
              width: Math.min(70, 70 * (width / height)),
              height: Math.min(70, 70 * (height / width)),
              minWidth: 25,
              minHeight: 25,
              borderRadius: 4,
              border: '2px solid var(--mantine-primary-color-filled)',
              backgroundColor: 'color-mix(in srgb, var(--mantine-primary-color-filled) 20%, transparent)',
              boxShadow: '0 0 12px color-mix(in srgb, var(--mantine-primary-color-filled) 50%, transparent)',
              transition: 'all 0.2s ease',
            }}
          />
          <Text size="sm" fw={600} c="white" ta="center" style={{ fontVariantNumeric: 'tabular-nums' }}>{width}×{height}</Text>
          <Text size="xs" c="dimmed">{megapixels} MP</Text>
        </Box>

        {inputMode === 'presets' && (
          <Select
            placeholder="Select resolution..."
            data={presetData}
            value={`${width}x${height}`}
            onChange={(v) => {
              const m = v?.match(/^(\d+)x(\d+)$/);
              if (m) onChange({ width: Number(m[1]), height: Number(m[2]) });
            }}
            size="sm"
            allowDeselect={false}
            searchable
            disabled={disabled}
            aria-label="Resolution preset"
            comboboxProps={{ withinPortal: true }}
            styles={{ groupLabel: { fontWeight: 600, color: 'var(--mantine-color-dimmed)' } }}
          />
        )}

        {inputMode === 'sliders' && (
          <Stack gap="md">
            {(['width', 'height'] as const).map((k) => (
              <Box key={k}>
                <Group justify="space-between" mb={4}>
                  <Text size="xs" c="dimmed">{k === 'width' ? 'Width' : 'Height'}</Text>
                  <Text size="xs" fw={500} style={{ fontVariantNumeric: 'tabular-nums' }}>{value[k]}</Text>
                </Group>
                <Slider
                  value={value[k]}
                  onChange={(v) => onChange({ ...value, [k]: v })}
                  min={256}
                  max={2048}
                  step={64}
                  marks={SLIDER_MARKS}
                  size="sm"
                  disabled={disabled}
                  thumbProps={{ 'aria-label': k }}
                  className="touch-pan-y"
                  styles={{ markLabel: { fontSize: 10 } }}
                />
              </Box>
            ))}
            <Group justify="flex-end">
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={() => setShowNumberInputs(!showNumberInputs)}
                title={showNumberInputs ? 'Hide number inputs' : 'Show number inputs'}
                aria-label={showNumberInputs ? 'Hide number inputs' : 'Show number inputs'}
              >
                {showNumberInputs ? <IconKeyboardOff size={14} /> : <IconKeyboard size={14} />}
              </ActionIcon>
            </Group>
            <Collapse in={showNumberInputs}>
              <Group grow>
                <StepperInput label="Width" value={width} onChange={(w) => onChange({ ...value, width: w })} min={64} max={4096} step={8} size="xs" disabled={disabled} styles={{ input: { textAlign: 'center' } }} />
                <StepperInput label="Height" value={height} onChange={(h) => onChange({ ...value, height: h })} min={64} max={4096} step={8} size="xs" disabled={disabled} styles={{ input: { textAlign: 'center' } }} />
              </Group>
            </Collapse>
          </Stack>
        )}
      </Stack>
    </FieldWrapper>
  );
}
