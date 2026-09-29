/**
 * The one bottom bar on phones, the same in every view: the main views with a label each, and
 * "More" for the rest (Studio, the infinite canvas, quick search, settings). A view's own tabs
 * (Generate: Parameters / Image / Gallery; Video: Settings / Video; Studio's) sit at the top of
 * the view, so the bottom edge always means "where am I in the app".
 *
 * Desktop keeps the left rail (`Sidebar`).
 */
import { memo, type ReactNode } from 'react';
import { Badge, Box, Group, Menu, Tabs, Text, UnstyledButton } from '@mantine/core';
import {
  IconBoxModel, IconDots, IconFolders, IconInfinity, IconMovie, IconPalette, IconSearch, IconSettings, IconWand,
} from '@tabler/icons-react';
import { useCanvasStore, type MainView } from '@/lib/canvasStore';
import { emitApp } from '@/lib/appEvents';

export const MOBILE_NAV_H = 58;

const MAIN: { view: MainView; label: string; icon: ReactNode }[] = [
  { view: 'generate', label: 'Generate', icon: <IconPalette size={24} stroke={1.5} /> },
  { view: 'video', label: 'Video', icon: <IconMovie size={24} stroke={1.5} /> },
  { view: 'collections', label: 'Collections', icon: <IconFolders size={24} stroke={1.5} /> },
  { view: 'browser', label: 'Models', icon: <IconBoxModel size={24} stroke={1.5} /> },
];

const MORE: { view: MainView; label: string; icon: ReactNode }[] = [
  { view: 'studio', label: 'Studio', icon: <IconWand size={16} /> },
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
          <NavItem key={m.view} icon={m.icon} label={m.label} active={mainView === m.view} onClick={() => setMainView(m.view)} />
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
