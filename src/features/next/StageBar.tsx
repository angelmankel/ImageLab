/**
 * The slim bar that floats over the top of the stage (desktop) or sits above it (phone): the
 * steps (Image · Video · Workflow — `mainView` underneath, so "Send to video" still lands here),
 * what is happening (connection, server, queue, downloads, one pill per running job), and the
 * stage's own buttons: fullscreen, filmstrip, the two columns.
 */
import type { ReactNode } from 'react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { IconLayoutSidebarLeftExpand, IconLayoutSidebarRightExpand, IconLayoutSidebarLeftCollapse, IconLayoutSidebarRightCollapse, IconMaximize, IconPhotoOff, IconPhoto } from '@tabler/icons-react';
import { ModeSwitch } from '@/components/blocks/ModeSwitch';
import { JobTray } from '@/components/blocks/JobTray';
import { JobStatusCluster } from '@/features/layout/JobStatusCluster';
import { useDesktopLayout } from '@/features/desktop/desktopLayoutStore';
import { cn } from '@/lib/cn';
import { useNext } from './nextStore';

export function StageBar({ floating, onFullscreen, fullscreenDisabled, extra }: {
  /** Over the stage, with a translucent back; else in flow (the phone). */
  floating: boolean;
  onFullscreen?: () => void;
  fullscreenDisabled?: boolean;
  /** More buttons at the end (the phone's gallery toggle). */
  extra?: ReactNode;
}) {
  const leftOpen = useDesktopLayout(s => s.leftOpen);
  const rightOpen = useDesktopLayout(s => s.rightOpen);
  const setLeftOpen = useDesktopLayout(s => s.setLeftOpen);
  const setRightOpen = useDesktopLayout(s => s.setRightOpen);
  const filmstrip = useNext(s => s.filmstrip);
  const setFilmstrip = useNext(s => s.setFilmstrip);

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2',
        floating
          ? 'pointer-events-none absolute inset-x-0 top-0 z-20 py-2'
          : 'shrink-0 py-1.5',
      )}
    >
      <div data-no-swipe className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-xl', floating && 'pointer-events-auto bg-bg-panel/75 px-2 py-1 backdrop-blur-md shadow-md')}>
        {floating && (
          <Tooltip label={leftOpen ? 'Hide the controls' : 'Show the controls'} withArrow>
            <ActionIcon variant="subtle" color="gray" size="lg" onClick={() => setLeftOpen(!leftOpen)} aria-label={leftOpen ? 'Hide the controls column' : 'Show the controls column'}>
              {leftOpen ? <IconLayoutSidebarLeftCollapse size={18} /> : <IconLayoutSidebarLeftExpand size={18} />}
            </ActionIcon>
          </Tooltip>
        )}
        <div className="shrink-0"><ModeSwitch size={floating ? 'xs' : 'sm'} fullWidth={!floating} /></div>
        <div className="scroll-x-thin flex min-w-0 flex-1 items-center gap-2" style={{ touchAction: 'pan-x' }}>
          <JobStatusCluster />
          <JobTray compact={!floating} />
        </div>
        {onFullscreen && (
          <Tooltip label="Fullscreen (Space)" withArrow>
            <ActionIcon variant="subtle" color="gray" size="lg" onClick={onFullscreen} disabled={fullscreenDisabled} aria-label="Fullscreen">
              <IconMaximize size={18} />
            </ActionIcon>
          </Tooltip>
        )}
        <Tooltip label={filmstrip ? 'Hide the filmstrip' : 'Show the filmstrip'} withArrow>
          <ActionIcon variant="subtle" color="gray" size="lg" onClick={() => setFilmstrip(!filmstrip)} aria-label={filmstrip ? 'Hide the filmstrip' : 'Show the filmstrip'} aria-pressed={filmstrip}>
            {filmstrip ? <IconPhoto size={18} /> : <IconPhotoOff size={18} />}
          </ActionIcon>
        </Tooltip>
        {extra}
        {floating && (
          <Tooltip label={rightOpen ? 'Hide the gallery' : 'Show the gallery'} withArrow>
            <ActionIcon variant="subtle" color="gray" size="lg" onClick={() => setRightOpen(!rightOpen)} aria-label={rightOpen ? 'Hide the gallery column' : 'Show the gallery column'}>
              {rightOpen ? <IconLayoutSidebarRightCollapse size={18} /> : <IconLayoutSidebarRightExpand size={18} />}
            </ActionIcon>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
