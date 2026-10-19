import { useEffect, useRef } from 'react';
import { ActionIcon, Divider, Indicator, Stack, Tooltip } from '@mantine/core';
import {
  IconBoxModel,
  IconFolders,
  IconInfinity,
  IconSettings,
  IconSparkles, IconSearch } from '@tabler/icons-react';
import { Logo } from '@/components/Logo';
import { ComfyIcon } from '@/components/ui/icons';
import { useCanvasStore } from '@/lib/canvasStore';
import { emitApp } from '@/lib/appEvents';
import { isWorkspaceView, type WorkspaceView } from '@/lib/workspace';
import { useFocusMode } from '@/features/studio/StudioView';
import type { MainView } from '@/lib/canvasStore';
import type { Server } from '@/lib/storage';

/**
 * Slim left rail — the app's primary navigation, drawn like v1's AppShell navbar: 56px wide,
 * one `lg` ActionIcon per entry, filled when current, subtle otherwise. Buttons are typed:
 *
 *   - `view`  — switches `mainView` in canvasStore.
 *   - `modal` — opens a focused overlay (Settings) without leaving the current view.
 *
 * Image, Video and Workflow are one entry, **Create**: they are modes of the one workspace
 * (`lib/workspace.ts`), switched inside it, so the rail shows where you are in the app and the
 * workspace shows what you are making. Create returns to the mode you were last in.
 *
 * The rail sits at z-[70] so in-page layers never cover it; overlays (Mantine portals, z>=200)
 * still go above it.
 *
 * Desktop only: phones get `MobileNav`, one bottom bar for every view.
 */
export function Sidebar({
  servers,
  onOpenSettings,
}: {
  servers: Server[];
  onOpenSettings: () => void;
}) {
  const mainView = useCanvasStore((s) => s.mainView);
  const setMainView = useCanvasStore((s) => s.setMainView);
  const comfyServerId = useCanvasStore((s) => s.comfyServerId);
  const setComfyServerId = useCanvasStore((s) => s.setComfyServerId);
  const openComfyServer = (id: string) => {
    setComfyServerId(id);
    setMainView('comfy');
  };

  // The mode to come back to from the canvas or Collections. The persisted mainView already is
  // the last view, so this only matters within a session.
  const lastWorkspace = useRef<WorkspaceView>(isWorkspaceView(mainView) ? mainView : 'generate');
  useEffect(() => { if (isWorkspaceView(mainView)) lastWorkspace.current = mainView; }, [mainView]);
  const inWorkspace = isWorkspaceView(mainView);

  // Focus mode is the workflow mode's promise: no node graph unless you ask for one. It hides the
  // per-server ComfyUI buttons, and it is always on for a phone.
  const focusMode = useFocusMode();

  return (
    <nav
      className="relative z-[70] flex h-full w-[56px] shrink-0 flex-col items-center"
      style={{
        background: 'var(--mantine-color-dark-6)',
        borderRight: '1px solid var(--mantine-color-dark-4)',
      }}
    >
      <Stack gap="xs" p="xs" align="center" className="h-full w-full">
        <Tooltip label="ImageLab" position="right" withArrow>
          <ActionIcon size="lg" variant="transparent" aria-label="ImageLab">
            <Logo size={28} className="shrink-0" />
          </ActionIcon>
        </Tooltip>

        <Tooltip label="Quick search (Ctrl+K)" position="right" withArrow>
          <ActionIcon size="lg" variant="subtle" color="gray" aria-label="Quick search" onClick={() => emitApp('open-spotlight')}>
            <IconSearch size="1.2rem" />
          </ActionIcon>
        </Tooltip>

        <Divider w="100%" />

        <Tooltip label="Create — image, video, workflow" position="right" withArrow>
          <ActionIcon
            size="lg"
            variant={inWorkspace ? 'filled' : 'subtle'}
            aria-label="Create"
            aria-current={inWorkspace ? 'page' : undefined}
            onClick={() => { if (!inWorkspace) setMainView(lastWorkspace.current); }}
          >
            <IconSparkles size="1.2rem" />
          </ActionIcon>
        </Tooltip>
        <ViewButton view="canvas" current={mainView} onSelect={setMainView} label="Infinite canvas" icon={<IconInfinity size="1.2rem" />} />
        <ViewButton view="collections" current={mainView} onSelect={setMainView} label="Collections" icon={<IconFolders size="1.2rem" />} />
        <ViewButton view="browser" current={mainView} onSelect={setMainView} label="Browse models" icon={<IconBoxModel size="1.2rem" />} />

        {/* One ComfyUI button per server — each is a view switcher (mainView='comfy' + the
            server's id), numbered so two servers can be told apart. */}
        {servers.length > 0 && !focusMode && (
          <>
            <Divider w="100%" />
            {servers.map((s, i) => {
              const active = mainView === 'comfy' && comfyServerId === s.id;
              return (
                <Tooltip key={s.id} label={`ComfyUI — ${s.name} (${s.host})`} position="right" withArrow>
                  <Indicator label={i + 1} size={14} offset={4} position="bottom-end" fz={8} fw={700}>
                    <ActionIcon
                      size="lg"
                      variant={active ? 'filled' : 'subtle'}
                      aria-label={`Open ComfyUI for ${s.name}`}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => openComfyServer(s.id)}
                    >
                      <ComfyIcon size={16} />
                    </ActionIcon>
                  </Indicator>
                </Tooltip>
              );
            })}
          </>
        )}

        <div className="flex-1" />

        <Tooltip label="Settings" position="right" withArrow>
          <ActionIcon size="lg" variant="subtle" aria-label="Settings" onClick={onOpenSettings}>
            <IconSettings size="1.2rem" />
          </ActionIcon>
        </Tooltip>
      </Stack>
    </nav>
  );
}

function ViewButton({
  view,
  current,
  onSelect,
  label,
  icon,
}: {
  view: MainView;
  current: MainView;
  onSelect: (v: MainView) => void;
  label: string;
  icon: React.ReactNode;
}) {
  const active = current === view;
  return (
    <Tooltip label={label} position="right" withArrow>
      <ActionIcon
        size="lg"
        variant={active ? 'filled' : 'subtle'}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        onClick={() => onSelect(view)}
      >
        {icon}
      </ActionIcon>
    </Tooltip>
  );
}
