/**
 * Where the tab layout is edited: order, names, icons, which tabs show, which section lives in
 * which tab, plus the label mode and the summary strip. Every change applies (and saves) at once;
 * "Reset layout" puts the built-in tabs back.
 *
 * Reordering works three ways — drag a row here, drag a tab on the bar, or the arrow buttons —
 * because a phone has no precise drag and a keyboard has none at all.
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActionIcon, Button, Group, Modal, Paper, SegmentedControl, Select, Stack, Switch, Text, TextInput, Tooltip,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconArrowDown, IconArrowUp, IconEye, IconEyeOff, IconGripVertical, IconPlus, IconRestore, IconTrash,
} from '@tabler/icons-react';
import {
  DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as Popover from '@/components/ui/popover';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/cn';
import { MAX_LABEL, type PanelTab, type SectionId } from '@/lib/panelTabs';
import { usePanelTabs, type TabLabelMode } from './panelTabsStore';
import { SECTION_META, TAB_ICONS, tabIcon } from './sections';

export function CustomizeTabsModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const narrow = useMediaQuery('(max-width: 48em)') ?? false;
  const tabs = usePanelTabs(s => s.tabs);
  const labels = usePanelTabs(s => s.labels);
  const strip = usePanelTabs(s => s.strip);
  const st = usePanelTabs.getState;
  const confirm = useConfirm();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    if (e.over && e.active.id !== e.over.id) st().moveTab(String(e.active.id), String(e.over.id));
  };

  const reset = async () => {
    const ok = await confirm({
      title: 'Reset tab layout',
      message: 'Put the built-in tabs back in their original order, names and icons? Your own tabs are removed; no setting or prompt is touched.',
      confirmLabel: 'Reset',
    });
    if (ok) st().resetLayout();
  };

  const tabOptions = tabs.map(t => ({ value: t.id, label: t.label }));

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={600}>Customise tabs</Text>}
      centered
      size="lg"
      fullScreen={narrow}
      styles={{
        content: { display: 'flex', flexDirection: 'column', ...(narrow ? {} : { maxHeight: '85vh' }) },
        body: { flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' },
      }}
    >
      <Stack gap="md">
        <Text size="xs" c="dimmed">
          Drag rows (or tabs on the bar) to reorder — on touch, hold first. Alt+1…9 opens the tabs in bar order.
          Move a section to any tab, or add your own tab and gather the sections you use most.
        </Text>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={tabs.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <Stack gap="xs">
              {tabs.map((t, i) => (
                <TabRow key={t.id} tab={t} first={i === 0} last={i === tabs.length - 1} tabOptions={tabOptions} />
              ))}
            </Stack>
          </SortableContext>
        </DndContext>

        <Button variant="light" leftSection={<IconPlus size={16} />} onClick={() => st().addTab()} style={{ alignSelf: 'flex-start' }}>
          Add tab
        </Button>

        <Stack gap={6}>
          <Text size="sm" fw={500}>Tab labels</Text>
          <SegmentedControl
            fullWidth
            value={labels}
            onChange={v => st().setLabels(v as TabLabelMode)}
            data={[
              { value: 'auto', label: 'Auto' },
              { value: 'labels', label: 'Icon + name' },
              { value: 'icons', label: 'Icons only' },
            ]}
            aria-label="Tab labels"
          />
          <Text size="xs" c="dimmed">Auto shows every name while they fit and only the open tab's name when they do not.</Text>
        </Stack>

        <Switch
          checked={strip}
          onChange={e => st().setStrip(e.currentTarget.checked)}
          label="Summary strip"
          description="Model · sampler · steps · size · seed under the tabs; tap a part to jump to it."
        />

        <Group justify="space-between" pt="xs" style={{ borderTop: '1px solid var(--mantine-color-dark-4)' }}>
          <Button variant="subtle" color="red" leftSection={<IconRestore size={16} />} onClick={() => { void reset(); }}>Reset layout</Button>
          <Button onClick={onClose}>Done</Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function TabRow({ tab, first, last, tabOptions }: {
  tab: PanelTab; first: boolean; last: boolean; tabOptions: { value: string; label: string }[];
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id });
  const st = usePanelTabs.getState;
  const Icon = tabIcon(tab.icon);

  // Typed names are committed on blur / Enter: the store trims, which would eat a space mid-word.
  const [name, setName] = useState(tab.label);
  useEffect(() => setName(tab.label), [tab.label]);
  const commit = () => { st().renameTab(tab.id, name); setName(usePanelTabs.getState().tabs.find(t => t.id === tab.id)?.label ?? name); };

  return (
    <Paper
      ref={setNodeRef}
      withBorder
      radius="md"
      p="xs"
      style={{ transform: CSS.Translate.toString(transform), transition, opacity: tab.hidden ? 0.65 : 1, zIndex: isDragging ? 2 : undefined, position: 'relative' }}
      aria-label={`Tab ${tab.label}`}
    >
      <Group gap={6} wrap="nowrap">
        <ActionIcon ref={setActivatorNodeRef} variant="subtle" color="gray" {...attributes} {...listeners}
          aria-label={`Drag ${tab.label}`} style={{ cursor: 'grab', touchAction: 'none' }}>
          <IconGripVertical size={16} />
        </ActionIcon>
        <IconPicker value={tab.icon} label={tab.label} onChange={icon => st().setTabIcon(tab.id, icon)}>
          <Icon size={18} stroke={1.6} />
        </IconPicker>
        <TextInput
          value={name}
          onChange={e => setName(e.currentTarget.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          maxLength={MAX_LABEL}
          size="xs"
          aria-label="Tab name"
          style={{ flex: 1, minWidth: 0 }}
        />
        <Tooltip label={tab.hidden ? 'Show this tab' : 'Hide this tab'}>
          <ActionIcon variant={tab.hidden ? 'light' : 'subtle'} color="gray" onClick={() => st().setTabHidden(tab.id, !tab.hidden)}
            aria-label={tab.hidden ? `Show ${tab.label}` : `Hide ${tab.label}`} aria-pressed={!!tab.hidden}>
            {tab.hidden ? <IconEyeOff size={16} /> : <IconEye size={16} />}
          </ActionIcon>
        </Tooltip>
        <ActionIcon variant="subtle" color="gray" disabled={first} onClick={() => st().moveTabBy(tab.id, -1)} aria-label={`Move ${tab.label} up`}><IconArrowUp size={16} /></ActionIcon>
        <ActionIcon variant="subtle" color="gray" disabled={last} onClick={() => st().moveTabBy(tab.id, 1)} aria-label={`Move ${tab.label} down`}><IconArrowDown size={16} /></ActionIcon>
        {tab.custom && (
          <Tooltip label="Delete this tab (its sections go back to their usual tabs)">
            <ActionIcon variant="subtle" color="red" onClick={() => st().removeTab(tab.id)} aria-label={`Delete ${tab.label}`}><IconTrash size={16} /></ActionIcon>
          </Tooltip>
        )}
      </Group>

      <Stack gap={4} mt={6} pl={30}>
        {!tab.sections.length && <Text size="xs" c="dimmed">Empty — not shown on the bar. Move a section here from another tab.</Text>}
        {tab.sections.map((s, i) => (
          <SectionRow key={s} section={s} tabId={tab.id} first={i === 0} last={i === tab.sections.length - 1} tabOptions={tabOptions} />
        ))}
      </Stack>
    </Paper>
  );
}

function SectionRow({ section, tabId, first, last, tabOptions }: {
  section: SectionId; tabId: string; first: boolean; last: boolean; tabOptions: { value: string; label: string }[];
}) {
  const st = usePanelTabs.getState;
  const { title, icon: Icon } = SECTION_META[section];
  return (
    <Group gap={6} wrap="nowrap">
      <Icon size={15} stroke={1.5} style={{ flexShrink: 0, opacity: 0.7 }} />
      <Text size="xs" style={{ flex: 1, minWidth: 0 }} truncate>{title}</Text>
      <Select
        size="xs"
        w={132}
        data={tabOptions}
        value={tabId}
        onChange={v => { if (v && v !== tabId) st().moveSection(section, v); }}
        allowDeselect={false}
        searchable={false}
        aria-label={`Tab for ${title}`}
        comboboxProps={{ withinPortal: true }}
      />
      {!(first && last) && <>
        <ActionIcon size="sm" variant="subtle" color="gray" disabled={first} onClick={() => st().moveSectionBy(section, -1)} aria-label={`Move ${title} up`}><IconArrowUp size={14} /></ActionIcon>
        <ActionIcon size="sm" variant="subtle" color="gray" disabled={last} onClick={() => st().moveSectionBy(section, 1)} aria-label={`Move ${title} down`}><IconArrowDown size={14} /></ActionIcon>
      </>}
    </Group>
  );
}

function IconPicker({ value, label, onChange, children }: { value: string; label: string; onChange: (icon: string) => void; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger>
        <ActionIcon variant="light" color="gray" aria-label={`Icon for ${label}`}>{children}</ActionIcon>
      </Popover.Trigger>
      <Popover.Content side="bottom" align="start" className="rounded-lg border border-border-default bg-bg-elev p-2 shadow-lg">
        <div className="grid grid-cols-8 gap-1" role="listbox" aria-label="Tab icon">
          {Object.entries(TAB_ICONS).map(([key, I]) => (
            <button key={key} type="button" role="option" aria-selected={key === value} aria-label={key}
              onClick={() => { onChange(key); setOpen(false); }}
              className={cn('flex h-8 w-8 items-center justify-center rounded-md text-fg-secondary hover:bg-bg-base',
                key === value && 'bg-accent text-white hover:bg-accent')}>
              <I size={16} stroke={1.6} />
            </button>
          ))}
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}
