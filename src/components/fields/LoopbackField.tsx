/**
 * LoopbackField (v1)
 * ==================
 * Loopback (hires fix): a switch, and when on, the iterations, upscale factor, denoise, steps
 * and CFG for the extra img2img rounds.
 */
import { Badge, Collapse, Group, Paper, Slider, Stack, Switch, Text } from '@mantine/core';
import { DEFAULT_LOOPBACK, loopbackDenoises, loopbackSizes } from '@/lib/pipeline';
import { StepperInput } from './StepperInput';
import type { LoopbackSettings } from '@/lib/types';

export interface LoopbackFieldProps {
  value: LoopbackSettings;
  onChange: (v: LoopbackSettings) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  /** The base image's size, to show what each round ends up at. */
  baseSize?: { width: number; height: number };
}

export function LoopbackField({ value, onChange, label = 'Loopback (Hires Fix)', description, disabled, baseSize }: LoopbackFieldProps) {
  const sizes = baseSize ? loopbackSizes(value, baseSize.width, baseSize.height) : [];
  const final = sizes[sizes.length - 1];
  const denoises = loopbackDenoises(value);
  const set = <K extends keyof LoopbackSettings>(k: K, v: LoopbackSettings[K]) => onChange({ ...value, [k]: v });
  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text size="sm" fw={500}>{label}</Text>
        <Switch checked={value.enabled} onChange={(e) => set('enabled', e.currentTarget.checked)} size="sm" disabled={disabled} aria-label={label} />
      </Group>
      {description && <Text size="xs" c="dimmed">{description}</Text>}
      <Collapse in={value.enabled}>
        <Paper withBorder p="sm" mt="xs">
          <Stack gap="md">
            {baseSize && final && (
              <Group justify="space-between" wrap="nowrap" gap="xs">
                <Text size="xs" c="dimmed">Final size</Text>
                <Badge variant="light" size="lg" radius="sm" style={{ fontVariantNumeric: 'tabular-nums', textTransform: 'none' }}>
                  {final[0]} × {final[1]}
                </Badge>
              </Group>
            )}
            <div>
              <Group justify="space-between" mb={4}>
                <Text size="xs" c="dimmed">Iterations</Text>
                <Text size="xs" fw={500}>{value.iterations}</Text>
              </Group>
              <Slider value={value.iterations} onChange={(v) => set('iterations', v)} min={1} max={10} step={1}
                marks={[{ value: 1, label: '1' }, { value: 5, label: '5' }, { value: 10, label: '10' }]} disabled={disabled} thumbProps={{ 'aria-label': 'Iterations' }} className="touch-pan-y" />
            </div>
            <div>
              <Group justify="space-between" mb={4} mt="xs">
                <Text size="xs" c="dimmed">Upscale Factor</Text>
                <Text size="xs" fw={500}>{value.upscale.toFixed(2)}x</Text>
              </Group>
              <Slider value={value.upscale} onChange={(v) => set('upscale', v)} min={1} max={2} step={0.05}
                marks={[{ value: 1, label: '1x' }, { value: 1.5, label: '1.5x' }, { value: 2, label: '2x' }]} disabled={disabled} thumbProps={{ 'aria-label': 'Upscale factor' }} className="touch-pan-y" />
            </div>
            <div>
              <Group justify="space-between" mt="xs" mb={6} wrap="nowrap">
                <Text size="xs" c="dimmed">Denoise Strength</Text>
                <Switch
                  size="xs"
                  checked={!!value.autoDenoise}
                  onChange={(e) => set('autoDenoise', e.currentTarget.checked)}
                  label={<Text size="xs" c="dimmed">Auto-scale</Text>}
                  labelPosition="left"
                  disabled={disabled}
                  aria-label="Auto-scale denoise"
                />
              </Group>
              {value.autoDenoise ? (
                <Stack gap="xs">
                  <DenoiseSlider label="Start" value={value.denoiseStart ?? DEFAULT_LOOPBACK.denoiseStart!} onChange={(v) => set('denoiseStart', v)} disabled={disabled} />
                  <DenoiseSlider label="End" value={value.denoiseEnd ?? DEFAULT_LOOPBACK.denoiseEnd!} onChange={(v) => set('denoiseEnd', v)} disabled={disabled} />
                  <Text size="xs" c="dimmed">
                    {denoises.length > 1 ? `Per round: ${denoises.map((d) => d.toFixed(2)).join(' → ')}` : 'One round uses the start value.'}
                  </Text>
                </Stack>
              ) : (
                <DenoiseSlider value={value.denoise} onChange={(v) => set('denoise', v)} disabled={disabled} />
              )}
            </div>
            <StepperInput mt="xs" label="Steps" description="Number of sampling steps per iteration" value={value.steps}
              onChange={(v) => set('steps', v)} min={1} max={100} size="xs" disabled={disabled} styles={{ input: { textAlign: 'center' } }} />
            <StepperInput label="CFG Scale" description="Classifier-free guidance scale" value={value.cfg}
              onChange={(v) => set('cfg', v)} min={0.1} max={20} step={0.5} size="xs" disabled={disabled} styles={{ input: { textAlign: 'center' } }} />
          </Stack>
        </Paper>
      </Collapse>
    </Stack>
  );
}

/** One denoise slider, with its value on the right of its label. */
function DenoiseSlider({ label, value, onChange, disabled }: { label?: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  // The tick labels hang below the track; the padding keeps the next label clear of them.
  return (
    <div style={{ paddingBottom: 14 }}>
      {label && (
        <Group justify="space-between" mb={4}>
          <Text size="xs" c="dimmed">{label}</Text>
          <Text size="xs" fw={500}>{value.toFixed(2)}</Text>
        </Group>
      )}
      {!label && <Text size="xs" fw={500} ta="right" mb={4}>{value.toFixed(2)}</Text>}
      <Slider value={value} onChange={onChange} min={0.1} max={1} step={0.05}
        marks={[{ value: 0.1, label: '0.1' }, { value: 0.5, label: '0.5' }, { value: 1, label: '1.0' }]} disabled={disabled}
        thumbProps={{ 'aria-label': label ? `Denoise ${label.toLowerCase()}` : 'Denoise strength' }} className="touch-pan-y" />
    </div>
  );
}
