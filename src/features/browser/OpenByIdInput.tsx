import { useState } from 'react';
import { parseCivitaiRef, fetchCivitaiModelIdForVersion } from '@/lib/civitai';
import { useModelMetadataStore } from '@/features/model-metadata/store';
import { Button, Group, Text, TextInput } from '@mantine/core';

/**
 * Header input for opening any CivitAI model by id, version id, AIR urn, or
 * URL. On a successful parse it opens the metadata modal pre-targeted at
 * that model (and the specific version if one was provided), where the
 * user can hit the existing Download / Sync action.
 *
 * Accepted formats — covered by `parseCivitaiRef`:
 *   - bare id:        `257749`
 *   - explicit:       `model:257749` / `version:290640`
 *   - AIR urn:        `urn:air:sdxl:checkpoint:civitai:257749@290640`
 *   - model URL:      `https://civitai.com/models/257749?modelVersionId=290640`
 *   - version URL:    `https://civitai.com/api/v1/model-versions/290640`
 *   (civitai.com or civitai.red both work)
 */
export function OpenByIdInput({ fullWidth }: { fullWidth?: boolean } = {}) {
  const openModel = useModelMetadataStore((s) => s.open);
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const ref = parseCivitaiRef(raw);
    if (!ref.modelId && !ref.versionId) {
      setError('Could not parse an id from that.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      let modelId = ref.modelId;
      if (modelId == null && ref.versionId != null) {
        // Resolve version → parent model so the modal has something to load.
        const resolved = await fetchCivitaiModelIdForVersion(ref.versionId);
        if (resolved == null) {
          setError('Could not resolve that version id on CivitAI.');
          return;
        }
        modelId = resolved;
      }
      if (modelId == null) return;
      openModel(`open-by-id:${modelId}:${ref.versionId ?? 'latest'}`, modelId, ref.versionId);
      setRaw('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} style={fullWidth ? { width: '100%' } : undefined}>
      <Group gap={6} wrap="nowrap">
        <TextInput
          size="xs"
          w={fullWidth ? undefined : 260}
          style={fullWidth ? { flex: 1 } : undefined}
          value={raw}
          onChange={(e) => { setRaw(e.currentTarget.value); if (error) setError(null); }}
          placeholder="Open by id / AIR urn / URL…"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          title="Paste a CivitAI model id, version id, AIR urn, or model URL"
          error={!!error}
          className="min-w-0"
        />
        <Button
          type="submit"
          size="xs"
          variant="default"
          disabled={busy || raw.trim().length === 0}
          loading={busy}
          title="Open this model in the metadata modal"
        >
          Open
        </Button>
        {error && (
          <Text role="alert" title={error} size="xs" c="red.5">
            {error}
          </Text>
        )}
      </Group>
    </form>
  );
}
