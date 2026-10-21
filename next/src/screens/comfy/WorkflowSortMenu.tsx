/**
 * The workflows list's sort + kind filter (FIXLIST-2, late item after #53): a small icon button in
 * the header. Sort: Name A–Z (default), Name Z–A, Recently used, Recently modified, Node count.
 * Show: all, or image / video / upscale / other. Both remembered per viewer (workflowStore).
 * The button wears the ember tint when either differs from the default.
 */
import { Menu } from '@mantine/core';
import { IconArrowsSort, IconCheck } from '@tabler/icons-react';
import { T } from '~/theme/tokens';
import { useWorkflowStore } from './workflowStore';
import { WORKFLOW_SORTS, type WorkflowShow } from './workflowListLogic';

const SHOWS: ReadonlyArray<{ id: WorkflowShow; label: string }> = [
  { id: 'all', label: 'All workflows' },
  { id: 'image', label: 'Image' },
  { id: 'video', label: 'Video' },
  { id: 'upscale', label: 'Upscale' },
  { id: 'other', label: 'Other' },
];

export function WorkflowSortMenu({ large }: { large?: boolean }) {
  const sort = useWorkflowStore((s) => s.sort);
  const setSort = useWorkflowStore((s) => s.setSort);
  const show = useWorkflowStore((s) => s.show);
  const setShow = useWorkflowStore((s) => s.setShow);
  const changed = sort !== 'name' || show !== 'all';
  const sortLabel = WORKFLOW_SORTS.find((x) => x.id === sort)?.label ?? 'Name A–Z';
  const check = (on: boolean) => (on ? <IconCheck size={14} color="var(--il-ember)" /> : null);
  return (
    <Menu position="bottom-end" zIndex={T.z.popover} width={200} radius={T.radius.md} shadow="lg">
      <Menu.Target>
        <button type="button" className={`il-wf-tool${large ? ' is-large' : ''}`} aria-label={`Sort and filter: ${sortLabel}${show !== 'all' ? `, ${show} only` : ''}`}
          title={`Sort: ${sortLabel}${show !== 'all' ? ` · ${show} only` : ''}`}
          style={{ padding: large ? '0 12px' : '0 8px', ...(changed ? { background: 'var(--il-ember-soft)', color: 'var(--il-ember-hi)' } : {}) }}>
          <IconArrowsSort size={15} />
        </button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Sort</Menu.Label>
        {WORKFLOW_SORTS.map((x) => (
          <Menu.Item key={x.id} onClick={() => setSort(x.id)} rightSection={check(sort === x.id)} style={{ fontWeight: sort === x.id ? 800 : 600 }}>{x.label}</Menu.Item>
        ))}
        <Menu.Divider />
        <Menu.Label>Show</Menu.Label>
        {SHOWS.map((x) => (
          <Menu.Item key={x.id} onClick={() => setShow(x.id)} rightSection={check(show === x.id)} style={{ fontWeight: show === x.id ? 800 : 600 }}>{x.label}</Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
