/**
 * One knob from the loaded workflow, rendered as whatever control its declared type deserves.
 *
 * Nothing here is workflow-specific: the type, the options and the range all come from
 * `/object_info`, so a node nobody has seen before still gets a sensible control.
 *
 * Touch first. Every control is at least 44px tall, sliders get a big thumb, and a numeric knob
 * shows its value as text beside the track so a fingertip never has to be precise to read it.
 */
import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { Switch } from '@/components/ui/Switch';
import { ActionIcon, Button, Group, Text, Textarea, TextInput, Tooltip } from '@mantine/core';
import { IconArrowBackUp, IconDice5 } from '@tabler/icons-react';
import { cn } from '@/lib/cn';
import { paramLabel, randomSeed, type WorkflowParam } from './params';

interface Props {
  param: WorkflowParam;
  value: unknown;
  onChange: (value: unknown) => void;
  onReset?: () => void;
  /** Bigger type and spacing for the phone's simple mode. */
  large?: boolean;
}

export function ParamField({ param, value, onChange, onReset, large }: Props) {
  const label = paramLabel(param);
  // "Changed" means changed from what the workflow itself was saved with — not from the node
  // class's default. A prompt node's class default is the empty string, so comparing against that
  // marked every workflow's own prompt as edited and offered to "reset" it to nothing.
  const changed = value !== param.value;

  return (
    <div className={cn('flex flex-col gap-1.5', large ? 'py-2' : 'py-1')}>
      <Group justify="space-between" gap="xs" wrap="nowrap" mih={22}>
        <Text size={large ? 'sm' : 'xs'} fw={500} truncate>{label}</Text>
        <Group gap={4} wrap="nowrap" className="shrink-0">
          {(param.type === 'INT' || param.type === 'FLOAT') && (
            <Text size={large ? 'sm' : 'xs'} className="tabular-nums">
              {formatNumber(value, param)}
            </Text>
          )}
          {changed && onReset && (
            <Tooltip label="Back to the value saved in ComfyUI" withArrow>
              <ActionIcon size="sm" variant="subtle" color="gray" aria-label={`Reset ${label}`} onClick={onReset}>
                <IconArrowBackUp size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>
      <Control param={param} value={value} onChange={onChange} large={large} />
    </div>
  );
}

function Control({ param, value, onChange, large }: Omit<Props, 'onReset'>) {
  switch (param.type) {
    case 'BOOLEAN':
      return (
        <div className="flex h-11 items-center">
          <Switch checked={Boolean(value)} onCheckedChange={onChange} ariaLabel={paramLabel(param)} />
        </div>
      );

    case 'COMBO': {
      const options = (param.options ?? []).map(o => String(o));
      if (!options.length) {
        // A combo whose list is empty means the server has nothing to offer — no checkpoints
        // installed, say. Saying so beats an empty dropdown that looks broken.
        return <Text size="xs" c="dimmed">Nothing installed for this input.</Text>;
      }
      return (
        <Select
          value={String(value ?? options[0])}
          onValueChange={onChange}
          options={options}
          ariaLabel={paramLabel(param)}
          triggerClassName={large ? 'h-11 text-[14px]' : undefined}
        />
      );
    }

    case 'STRING':
      return param.multiline ? (
        <Textarea
          value={String(value ?? '')}
          onChange={e => onChange(e.currentTarget.value)}
          rows={large ? 4 : 3}
          size={large ? 'md' : 'sm'}
          aria-label={paramLabel(param)}
          classNames={{ input: 'scroll-y !resize-y' }}
        />
      ) : (
        <TextInput
          value={String(value ?? '')}
          onChange={e => onChange(e.currentTarget.value)}
          size={large ? 'lg' : 'sm'}
          aria-label={paramLabel(param)}
        />
      );

    case 'INT':
    case 'FLOAT': {
      // A seed has a nominal range of 0..2^63; a slider across that is meaningless, so it gets a
      // number box and a dice instead.
      if (param.seedLike) {
        return (
          <Group gap="xs" wrap="nowrap">
            <TextInput
              inputMode="numeric"
              value={String(value ?? 0)}
              onChange={e => onChange(Number(e.currentTarget.value.replace(/[^0-9]/g, '')) || 0)}
              aria-label={paramLabel(param)}
              size={large ? 'lg' : 'sm'}
              ff="monospace"
              className="min-w-0 flex-1"
            />
            <Button
              variant="default"
              size={large ? 'lg' : 'sm'}
              leftSection={<IconDice5 size={16} />}
              onClick={() => onChange(randomSeed())}
              className="shrink-0"
            >
              Roll
            </Button>
          </Group>
        );
      }
      const { min, max, step } = sliderRange(param);
      return (
        <div className="flex h-11 items-center">
          <Slider
            value={Number(value ?? param.default ?? min)}
            onValueChange={onChange}
            min={min}
            max={max}
            step={step}
            ariaLabel={paramLabel(param)}
            className="w-full"
          />
        </div>
      );
    }

    default:
      return <Text size="xs" c="dimmed">{String(value ?? '')}</Text>;
  }
}

/**
 * A usable slider range.
 *
 * object_info's declared bounds are frequently the type's limits rather than anything a person
 * would want — steps can say 0..10000, cfg 0..100. Where the declared range is absurd, narrow it
 * to the part people actually use, but never so far that it excludes the workflow's own value.
 */
function sliderRange(p: WorkflowParam) {
  const isFloat = p.type === 'FLOAT';
  let min = p.min ?? 0;
  let max = p.max ?? (isFloat ? 10 : 100);
  const SANE: Record<string, [number, number]> = {
    steps: [1, 100], cfg: [1, 20], denoise: [0, 1], guidance: [0, 20],
    width: [256, 2048], height: [256, 2048], batch_size: [1, 8],
  };
  const sane = SANE[p.name];
  if (sane) { min = Math.max(min, sane[0]); max = Math.min(max, sane[1]); }
  const current = Number(p.value);
  if (Number.isFinite(current)) { min = Math.min(min, current); max = Math.max(max, current); }
  const step = p.step ?? (isFloat ? 0.05 : 1);
  return { min, max, step };
}

function formatNumber(value: unknown, p: WorkflowParam) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? '');
  if (p.type === 'INT') return String(Math.round(n));
  // Show only as many decimals as the step implies, so 0.6 is not "0.6000000000000001".
  const decimals = (p.step ?? 0.05) < 0.01 ? 3 : (p.step ?? 0.05) < 0.1 ? 2 : 2;
  return n.toFixed(decimals);
}
