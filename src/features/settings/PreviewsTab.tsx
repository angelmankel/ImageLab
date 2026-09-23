import { Stack, Radio } from '@mantine/core';
import { useStore } from '@/lib/store';
import { PREVIEW_SOURCES, type ModelPreviewSource } from '@/lib/storage';
import { SettingsSection } from './SettingsSection';

/**
 * Previews — which image the model-picker hover slideshow starts on. Setting
 * persists to localStorage (`imagelab.previewSource.v1`) so it survives
 * refreshes.
 */
export function PreviewsTab() {
  const previewSource = useStore(s => s.modelPreviewSource);
  const setPreviewSource = useStore(s => s.setModelPreviewSource);
  return (
    <Stack gap="lg">
      <SettingsSection
        title="Preview Order"
        description="How the model picker's hover slideshow chooses its first image and orders the rest. The slideshow auto-advances and cross-fades through every CivitAI image (and any local generations you've made with that model)."
      >
        <Radio.Group value={previewSource} onChange={(v) => setPreviewSource(v as ModelPreviewSource)}>
          <Stack gap="sm">
            {PREVIEW_SOURCES.map(opt => (
              <Radio key={opt.value} value={opt.value} label={opt.label} description={opt.description} />
            ))}
          </Stack>
        </Radio.Group>
      </SettingsSection>
    </Stack>
  );
}
