/**
 * LoopbackField (v1)
 * ==================
 * Loopback (hires fix): a switch, and when on, the extra img2img rounds' settings. Upscale,
 * denoise, noise injection, steps and CFG can each be fixed or auto-scaled (move from a start
 * value on the first round to an end value on the last). The frame path crops and zooms each
 * round along a path dragged out on a small canvas. A round-by-round table shows what will run.
 */
import { Badge, Collapse, Group, Paper, Slider, Stack, Switch, Text } from '@mantine/core';
import { DEFAULT_LOOPBACK, frameZoom, loopbackRounds, loopbackSizes } from '@/lib/pipeline';
import type { LoopbackRampKey, LoopbackSettings } from '@/lib/types';
import { DEFAULT_FRAME_PATH, FramePathField } from './FramePathField';

export interface LoopbackFieldProps {
  value: LoopbackSettings;
  onChange: (v: LoopbackSettings) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  /** The base image's size, to show what each round ends up at. */
  baseSize?: { width: number; height: number };
}

type Ramp = { start: number; end: number };

export function LoopbackField({ value, onChange, label = 'Loopback (Hires Fix)', description, disabled, baseSize }: LoopbackFieldProps) {
  const sizes = baseSize ? loopbackSizes(value, baseSize.width, baseSize.height) : [];
  const final = sizes[sizes.length - 1];
  const rounds = loopbackRounds(value);
  const set = (patch: Partial<LoopbackSettings>) => onChange({ ...value, ...patch });
  const setRamp = (k: LoopbackRampKey, r: Ramp | undefined) => {
    const ramps = { ...value.ramps };
    if (r) ramps[k] = r; else delete ramps[k];
    set({ ramps });
  };
  // Denoise keeps its older fields (autoDenoise / denoiseStart / denoiseEnd), so saved workflows still load.
  const denoiseRamp: Ramp | undefined = value.autoDenoise
    ? { start: value.denoiseStart ?? DEFAULT_LOOPBACK.denoiseStart!, end: value.denoiseEnd ?? DEFAULT_LOOPBACK.denoiseEnd! }
    : undefined;
  const frame = value.frame ?? DEFAULT_FRAME_PATH;
  const many = rounds.length > 1;

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text size="sm" fw={500}>{label}</Text>
        <Switch checked={value.enabled} onChange={(e) => set({ enabled: e.currentTarget.checked })} size="sm" disabled={disabled} aria-label={label} />
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
              <Slider value={value.iterations} onChange={(v) => set({ iterations: v })} min={1} max={10} step={1}
                marks={[{ value: 1, label: '1' }, { value: 5, label: '5' }, { value: 10, label: '10' }]} disabled={disabled} thumbProps={{ 'aria-label': 'Iterations' }} className="touch-pan-y" />
            </div>
            <Text size="xs" c="dimmed" mt={6}>
              {many ? 'Turn on Auto-scale to move a value from the first round to the last.' : 'Auto-scale needs 2 or more iterations; one round uses the start value.'}
            </Text>
            <RampRow label="Upscale factor" min={1} max={2} step={0.05} format={(v) => `${v.toFixed(2)}×`}
              marks={[1, 1.5, 2]} value={value.upscale} ramp={value.ramps?.upscale} disabled={disabled}
              onValue={(upscale) => set({ upscale })} onRamp={(r) => setRamp('upscale', r)} />
            <RampRow label="Denoise strength" min={0.1} max={1} step={0.05} format={(v) => v.toFixed(2)}
              marks={[0.1, 0.5, 1]} value={value.denoise} ramp={denoiseRamp} disabled={disabled}
              onValue={(denoise) => set({ denoise })}
              onRamp={(r) => set(r ? { autoDenoise: true, denoiseStart: r.start, denoiseEnd: r.end } : { autoDenoise: false })} />
            <RampRow label="Noise injection" min={0} max={2} step={0.05} format={(v) => (v > 0 ? v.toFixed(2) : 'Off')}
              marks={[0, 1, 2]} value={value.noise ?? 0} ramp={value.ramps?.noise} disabled={disabled}
              onValue={(noise) => set({ noise })} onRamp={(r) => setRamp('noise', r)} />
            <RampRow label="Steps" min={1} max={60} step={1} format={(v) => String(Math.round(v))}
              marks={[1, 30, 60]} value={value.steps} ramp={value.ramps?.steps} disabled={disabled}
              onValue={(steps) => set({ steps })} onRamp={(r) => setRamp('steps', r)} />
            <RampRow label="CFG scale" min={1} max={20} step={0.5} format={(v) => v.toFixed(1)}
              marks={[1, 10, 20]} value={value.cfg} ramp={value.ramps?.cfg} disabled={disabled}
              onValue={(cfg) => set({ cfg })} onRamp={(r) => setRamp('cfg', r)} />

            <FramePathField value={frame} onChange={(f) => set({ frame: f })} disabled={disabled}
              aspect={baseSize ? baseSize.width / baseSize.height : 1}
              between={rounds.map((r) => r.frame).filter((f): f is NonNullable<typeof f> => !!f)} />

            {/* What each round will actually run with. */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 11, fontVariantNumeric: 'tabular-nums', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: 'var(--mantine-color-dimmed)', textAlign: 'right' }}>
                    <th style={{ textAlign: 'left', fontWeight: 500 }}>Round</th>
                    {sizes.length > 0 && <th style={{ fontWeight: 500 }}>Size</th>}
                    <th style={{ fontWeight: 500 }}>Denoise</th>
                    <th style={{ fontWeight: 500 }}>Noise</th>
                    <th style={{ fontWeight: 500 }}>Steps</th>
                    <th style={{ fontWeight: 500 }}>CFG</th>
                    {frame.enabled && <th style={{ fontWeight: 500 }}>Zoom</th>}
                  </tr>
                </thead>
                <tbody>
                  {rounds.map((r, i) => (
                    <tr key={i} style={{ textAlign: 'right' }}>
                      <td style={{ textAlign: 'left' }}>{i + 1}</td>
                      {sizes.length > 0 && <td>{sizes[i]?.[0]}×{sizes[i]?.[1]}</td>}
                      <td>{r.denoise.toFixed(2)}</td>
                      <td>{r.noise > 0 ? r.noise.toFixed(2) : '–'}</td>
                      <td>{r.steps}</td>
                      <td>{r.cfg}</td>
                      {frame.enabled && <td>{r.frame ? `×${frameZoom(r.frame).toFixed(2)}` : '–'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Stack>
        </Paper>
      </Collapse>
    </Stack>
  );
}

/**
 * One setting: a single slider, or — with Auto-scale on — a Start and an End slider that the
 * rounds move between. Turning Auto-scale on starts both ends at the current value.
 */
function RampRow({ label, value, ramp, min, max, step, marks, format, onValue, onRamp, disabled }: {
  label: string; value: number; ramp?: Ramp; min: number; max: number; step: number; marks: number[];
  format: (v: number) => string; onValue: (v: number) => void; onRamp: (r: Ramp | undefined) => void; disabled?: boolean;
}) {
  const markList = marks.map((m) => ({ value: m, label: format(m).replace(/\.00?(?=×|$)/, '') }));
  const slider = (v: number, on: (v: number) => void, aria: string) => (
    // The tick labels hang below the track; the padding keeps the next row clear of them.
    <div style={{ paddingBottom: 14 }}>
      <Slider value={v} onChange={on} min={min} max={max} step={step} marks={markList} disabled={disabled} label={null}
        thumbProps={{ 'aria-label': aria }} className="touch-pan-y" />
    </div>
  );
  return (
    <div>
      <Group justify="space-between" mb={4} wrap="nowrap">
        <Text size="xs" c="dimmed">{label}</Text>
        <Group gap="sm" wrap="nowrap">
          {!ramp && <Text size="xs" fw={500}>{format(value)}</Text>}
          <Switch size="xs" checked={!!ramp} disabled={disabled} labelPosition="left" aria-label={`Auto-scale ${label.toLowerCase()}`}
            label={<Text size="xs" c="dimmed">Auto-scale</Text>}
            onChange={(e) => onRamp(e.currentTarget.checked ? { start: value, end: value } : undefined)} />
        </Group>
      </Group>
      {ramp ? (
        <Stack gap={2}>
          <Group justify="space-between"><Text size="xs" c="dimmed">Start</Text><Text size="xs" fw={500}>{format(ramp.start)}</Text></Group>
          {slider(ramp.start, (v) => onRamp({ ...ramp, start: v }), `${label} start`)}
          <Group justify="space-between"><Text size="xs" c="dimmed">End</Text><Text size="xs" fw={500}>{format(ramp.end)}</Text></Group>
          {slider(ramp.end, (v) => onRamp({ ...ramp, end: v }), `${label} end`)}
        </Stack>
      ) : slider(value, onValue, label)}
    </div>
  );
}
