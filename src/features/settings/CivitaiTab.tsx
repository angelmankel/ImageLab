import { Stack, Text, PasswordInput, Anchor, Code } from '@mantine/core';
import { IconKey } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { SettingsSection } from './SettingsSection';

/**
 * CivitAI — browser-side credentials for the model browser and metadata
 * lookups. Distinct from the ImageLab extension's `CIVITAI_TOKEN` env var,
 * which only authenticates downloads server-side. This token is attached as
 * a bearer header on every browser-direct call to civitai.com / civitai.red,
 * and is what unlocks the full adult catalog on the Red side.
 */
export function CivitaiTab() {
  const civitai = useStore(s => s.civitai);
  const setCivitai = useStore(s => s.setCivitai);

  return (
    <Stack gap="lg">
      <SettingsSection
        title="API Key"
        description={
          <>
            Authenticates the in-app model browser and metadata lookups against CivitAI.
            Required to see the full adult catalog on Civitai Red — unauthed requests get
            a filtered subset. This is separate from the <Code>CIVITAI_TOKEN</Code> env var
            on your ComfyUI server, which only handles downloads.
          </>
        }
      >
        <PasswordInput
          placeholder="civitai api token"
          aria-label="CivitAI API key"
          leftSection={<IconKey size={16} />}
          value={civitai.apiKey}
          onChange={(e) => setCivitai({ apiKey: e.currentTarget.value })}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
        />
        <Text size="xs" c="dimmed">
          Generate at{' '}
          <Anchor href="https://civitai.com/user/account" target="_blank" rel="noreferrer" size="xs">civitai.com/user/account</Anchor>
          {' '}(API Keys section). For the Red catalog, mint the token while signed in to{' '}
          <Anchor href="https://civitai.red/user/account" target="_blank" rel="noreferrer" size="xs">civitai.red</Anchor>
          {' '}— some pre-split tokens are not accepted there. Make sure X / XXX browsing
          levels are enabled on the source account.
        </Text>
      </SettingsSection>
    </Stack>
  );
}
