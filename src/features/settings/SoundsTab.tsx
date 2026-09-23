import { useCallback, useEffect, useRef } from 'react';
import { Stack, Group, Slider, Text, Button } from '@mantine/core';
import { IconVolume, IconVolumeOff, IconPlayerPlay } from '@tabler/icons-react';
import { playCompleteSound, playSubmitSound, useSoundStore } from '@/lib/sounds';
import { SettingsSection } from './SettingsSection';

const PREVIEW_DEBOUNCE_MS = 400;

/** Volume for the generation sounds, with v1's debounced chime preview. Stored in this browser only. */
export function SoundsTab() {
  const volume = useSoundStore(s => s.volume);
  const setVolume = useSoundStore(s => s.setVolume);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleChange = useCallback((value: number) => {
    setVolume(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(playCompleteSound, PREVIEW_DEBOUNCE_MS);
  }, [setVolume]);

  const label = volume === 0 ? 'Muted' : `${Math.round(volume * 100)}%`;

  return (
    <Stack gap="lg">
      <SettingsSection
        title="Sounds"
        description="A short blip when a generation is queued, and a soft chime when its image arrives. Set the volume to 0 to turn them off."
      >
        <Group gap="sm" wrap="nowrap">
          {volume === 0 ? <IconVolumeOff size={18} opacity={0.5} /> : <IconVolume size={18} />}
          <Slider
            value={volume}
            onChange={handleChange}
            min={0}
            max={1}
            step={0.05}
            label={label}
            aria-label="Sound volume"
            style={{ flex: 1 }}
          />
          <Text size="sm" c="dimmed" w={48} ta="right">{label}</Text>
        </Group>
        <Group gap="sm">
          <Button variant="light" size="xs" leftSection={<IconPlayerPlay size={14} />} disabled={volume === 0} onClick={playSubmitSound}>
            Play queued sound
          </Button>
          <Button variant="light" size="xs" leftSection={<IconPlayerPlay size={14} />} disabled={volume === 0} onClick={playCompleteSound}>
            Play finished sound
          </Button>
        </Group>
      </SettingsSection>
    </Stack>
  );
}
