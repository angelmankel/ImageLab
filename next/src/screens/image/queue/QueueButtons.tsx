/**
 * Item 14: the top bar's queue, split in two. "Jobs N" opens the job queue (every running / queued
 * generate job, × each, Cancel all); "↓ N · 37%" opens the Download queue (`DownloadList`: the real
 * model downloads with cancel / retry / clear finished). A failed download shows a red dot on it.
 */
import { useState, type ReactNode } from 'react';
import { Popover } from '@mantine/core';
import { IconArrowDown, IconListDetails } from '@tabler/icons-react';
import { useDownloadsStore } from '@/features/downloads/store';
import { useQueue } from '~/app/queue';
import { Pill, Count } from '~/ui';
import { T } from '~/theme/tokens';
import { QueueList } from '../QueueList';
import { DownloadList } from './DownloadList';
import { downloadCounts } from './downloadLogic';
import { vw } from '~/theme/uiScale';

function QueuePopover({ title, target, children, open, setOpen }: { title: string; target: ReactNode; children: ReactNode; open: boolean; setOpen: (o: boolean) => void }) {
  return (
    <Popover opened={open} onChange={setOpen} position="bottom-end" shadow="lg" width={360} withinPortal zIndex={T.z.popover}>
      <Popover.Target><span style={{ display: 'inline-flex' }}>{target}</span></Popover.Target>
      <Popover.Dropdown style={{ background: 'var(--il-panel)', border: '1px solid var(--il-line-soft)', borderRadius: T.radius.xl, padding: T.pad.panel, maxWidth: `calc(${vw(100)} - 24px)` }}>
        <div className="il-eyebrow" style={{ margin: '2px 2px 8px' }}>{title}</div>
        <div className="il-scroll" style={{ maxHeight: 400, touchAction: 'pan-y' }}>{children}</div>
      </Popover.Dropdown>
    </Popover>
  );
}

export function JobQueueButton() {
  const { rows } = useQueue();
  const [open, setOpen] = useState(false);
  return (
    <QueuePopover title="Job queue" open={open} setOpen={setOpen}
      target={<Pill onClick={() => setOpen(!open)} title="Job queue" active={open}><IconListDetails size={16} />Jobs <Count n={rows.length} tone={rows.length ? 'ember' : 'muted'} /></Pill>}>
      <QueueList />
    </QueuePopover>
  );
}

export function DownloadQueueButton() {
  const rows = useDownloadsStore((s) => s.rows);
  const agg = useDownloadsStore((s) => s.aggregateProgress)();
  const [open, setOpen] = useState(false);
  const { active, failed } = downloadCounts(rows);
  const pct = active && agg != null ? Math.round(agg * 100) : null;
  return (
    <QueuePopover title="Download queue" open={open} setOpen={setOpen}
      target={(
        <Pill onClick={() => setOpen(!open)} title="Download queue" active={open} style={{ position: 'relative' }}>
          <IconArrowDown size={15} stroke={2.4} color={active ? 'var(--il-ember-hi)' : undefined} />
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{active}{pct != null ? ` · ${pct}%` : ''}</span>
          {failed > 0 && <span aria-label={`${failed} failed`} style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: '50%', background: 'var(--il-err)' }} />}
        </Pill>
      )}>
      <DownloadList />
    </QueuePopover>
  );
}
