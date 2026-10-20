/**
 * Settings → CivitAI: the API key the model browser and metadata lookups send (separate from the
 * server's CIVITAI_TOKEN, which only downloads). Logic = `@/lib/store` civitai settings.
 */
import { PasswordInput } from '@mantine/core';
import { useStore } from '@/lib/store';
import { inputStyles, SettingsCard } from './SettingsCard';

export function CivitaiCard() {
  const civitai = useStore((s) => s.civitai);
  const setCivitai = useStore((s) => s.setCivitai);
  return (
    <SettingsCard
      title="CivitAI"
      description={<>Unlocks the full catalog in Models. Make one at <a href="https://civitai.com/user/account" target="_blank" rel="noreferrer">civitai.com/user/account</a> (for Red, while signed in to <a href="https://civitai.red/user/account" target="_blank" rel="noreferrer">civitai.red</a>).</>}
    >
      <PasswordInput value={civitai.apiKey} onChange={(e) => setCivitai({ apiKey: e.currentTarget.value })} placeholder="CivitAI API key" aria-label="CivitAI API key"
        size="sm" spellCheck={false} autoCapitalize="off" autoComplete="off" styles={inputStyles} />
    </SettingsCard>
  );
}
