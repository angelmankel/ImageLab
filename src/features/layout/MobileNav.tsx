/**
 * The one bottom bar on phones, the same in every view: Create (the workspace: Image, Video and
 * Workflow), Collections, Models, and "More" for the rest (the infinite canvas, quick search,
 * settings). A view's own tabs (the workspace's Create / Result / Gallery) sit at the top of the
 * view, so the bottom edge always means "where am I in the app".
 *
 * Desktop keeps the left rail (`Sidebar`).
 */
import { memo, useRef, type ReactNode } from 'react';
import { Badge, Box, Group, Menu, Tabs, Text, UnstyledButton } from '@mantine/core';
import {
  IconBoxModel, IconDots, IconFolders, IconInfinity, IconSearch, IconSettings, IconSparkles,
} from '@tabler/icons-react';
import { useCanvasStore, type MainView } from '@/lib/canvasStore';
import { isWorkspaceView } from '@/lib/workspace';
import { emitApp } from '@/lib/appEvents';

export const MOBILE_NAV_H = 58;

/** Create is the workspace: Image, Video and Workflow are its modes, so one entry covers all three. */
const MAIN: { view: MainView; label: string; icon: ReactNode; active: (v: MainView) => boolean }[] = [
  { view: 'generate', label: 'Create', icon: <IconSparkles size={24} stroke={1.5} />, active: isWorkspaceView },
  { view: 'collections', label: 'Collections', icon: <IconFolders size={24} stroke={1.5} />, active: v => v === 'collections' },
  { view: 'browser', label: 'Models', icon: <IconBoxModel size={24} stroke={1.5} />, active: v => v === 'browser' },
];

const MORE: { view: MainView; label: string; icon: ReactNode }[] = [
  { view: 'canvas', label: 'Infinite canvas', icon: <IconInfinity size={16} /> },
];

export const NavItem = memo(function NavItem({ icon, label, active, onClick, badge }: {
  icon: ReactNode; label: string; active: boolean; onClick?: () => void; badge?: number;
}) {
  return (
    <UnstyledButton
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      style={{
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
        padding: '8px 0', position: 'relative', height: '100%',
        color: active ? 'var(--mantine-primary-color-filled)' : 'var(--mantine-color-dimmed)',
        transition: 'color 150ms ease',
      }}
    >
      {icon}
      <Text size="xs" fw={active ? 600 : 400} truncate style={{ maxWidth: '100%' }}>{label}</Text>
      {!!badge && (
        <Box style={{ position: 'absolute', top: 4, left: '55%', minWidth: 16, height: 16, borderRadius: 8, padding: '0 4px', fontSize: 10, fontWeight: 700, lineHeight: '16px', textAlign: 'center', background: 'var(--mantine-primary-color-filled)', color: 'white' }}>
          {badge}
        </Box>
      )}
    </UnstyledButton>
  );
});

export function MobileNav({ onOpenSettings }: { onOpenSettings: () => void }) {
  const mainView = useCanvasStore((s) => s.mainView);
  const setMainView = useCanvasStore((s) => s.setMainView);
  const inMore = MORE.some((m) => m.view === mainView) || mainView === 'comfy';
  const lastWorkspace = useRef<MainView>(isWorkspaceView(mainView) ? mainView : 'generate');
  if (isWorkspaceView(mainView)) lastWorkspace.current = mainView;
  return (
    <Box
      component="nav"
      aria-label="Views"
      style={{
        borderTop: '1px solid var(--mantine-color-dark-4)', background: 'var(--mantine-color-dark-7)',
        paddingBottom: 'env(safe-area-inset-bottom)', flexShrink: 0, position: 'relative', zIndex: 70,
      }}
    >
      <Group gap={0} h={MOBILE_NAV_H} wrap="nowrap">
        {MAIN.map((m) => (
          // Create keeps the mode you were in: tapping it again from elsewhere returns to that mode.
          <NavItem key={m.view} icon={m.icon} label={m.label} active={m.active(mainView)} onClick={() => { if (!m.active(mainView)) setMainView(m.view === 'generate' ? lastWorkspace.current : m.view); }} />
        ))}
        <Menu position="top-end" withinPortal shadow="md" width={210} offset={6}>
          <Menu.Target>
            <Box style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex' }}>
              <NavItem icon={<IconDots size={24} stroke={1.5} />} label={inMore ? (MORE.find((m) => m.view === mainView)?.label ?? 'More') : 'More'} active={inMore} />
            </Box>
          </Menu.Target>
          <Menu.Dropdown>
            {MORE.map((m) => (
              <Menu.Item key={m.view} leftSection={m.icon} onClick={() => setMainView(m.view)}
                color={mainView === m.view ? 'teal' : undefined}>{m.label}</Menu.Item>
            ))}
            <Menu.Divider />
            <Menu.Item leftSection={<IconSearch size={16} />} onClick={() => emitApp('open-spotlight')}>Quick search</Menu.Item>
            <Menu.Item leftSection={<IconSettings size={16} />} onClick={onOpenSettings}>Settings</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Box>
  );
}

/**
 * A view's own tabs at the top of the screen on phones, drawn like Studio's (so every view's
 * tabs look the same). A badge counts something new behind a tab.
 */
export function ViewTabs<T extends string>({ tabs, value, onChange }: {
  tabs: { value: T; label: string; icon?: ReactNode; badge?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <Tabs value={value} onChange={(v) => v && onChange(v as T)} className="shrink-0 bg-bg-panel">
      <Tabs.List grow>
        {tabs.map((t) => (
          <Tabs.Tab key={t.value} value={t.value} className="min-h-[44px]" leftSection={t.icon}
            rightSection={t.badge ? <Badge size="xs" circle variant="filled">{t.badge}</Badge> : undefined}>
            {t.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs>
  );
}
