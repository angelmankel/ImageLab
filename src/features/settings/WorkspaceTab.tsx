/** Settings → Workspace: the new steps layout (`features/next`) or the classic folding cards. */
import { Stack, Switch, Text } from '@mantine/core';
import { SettingsSection } from './SettingsSection';
import { useNext } from '@/features/next/nextStore';

export function WorkspaceTab() {
  const classic = useNext(s => s.classic);
  const setClassic = useNext(s => s.setClassic);
  const filmstrip = useNext(s => s.filmstrip);
  const setFilmstrip = useNext(s => s.setFilmstrip);
  return (
    <Stack gap="lg">
      <SettingsSection title="Layout" description="Image, Video and Workflow as steps with a full-height stage and settings as chips, or the classic folding cards.">
        <Switch label="Classic workspace" description="The previous layout: section cards, Simple / Advanced, the results strip under the picture." checked={classic} onChange={e => setClassic(e.currentTarget.checked)} />
        <Switch label="Filmstrip over the stage" description="Recent results as thumbnails floating along the bottom of the stage (the new layout; the bar's button toggles it too)." checked={filmstrip} onChange={e => setFilmstrip(e.currentTarget.checked)} />
      </SettingsSection>
      <Text size="xs" c="dimmed">Keys in the new layout: Ctrl/⌘+Enter generates, ←/→ step through results, Space opens the shown result or the live preview full screen, Esc closes.</Text>
    </Stack>
  );
}
