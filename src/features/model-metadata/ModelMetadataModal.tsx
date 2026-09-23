import { Modal } from '@mantine/core';
import { GalleryColumn } from './GalleryColumn';
import { MetadataColumn } from './MetadataColumn';
import { useModelMetadataStore } from './store';

/**
 * Concrete model-metadata modal — v1's ModelGalleryModal shell (a portalled Mantine modal on a
 * dark.7 ground) around the gallery + metadata columns. Portalled at the modal layer (200) so
 * the side rail (z-70) can never clip it.
 *
 * Mount this once near the app root; it shows itself whenever
 * `useModelMetadataStore.getState().open(entryId, civitaiModelId)` is called
 * (e.g. from a model tile's `onOpen`).
 */
export function ModelMetadataModal() {
  const open = useModelMetadataStore((s) => s.openEntryId != null);
  const close = useModelMetadataStore((s) => s.close);
  // The fullscreen viewer owns Escape while it is up; without this the key would bubble (through
  // the React tree) to the modal and close both at once.
  const fullscreenOpen = useModelMetadataStore((s) => s.fullscreenOpen);
  return (
    <Modal
      opened={open}
      onClose={close}
      closeOnEscape={!fullscreenOpen}
      withCloseButton={false}
      centered
      size="90vw"
      padding={0}
      radius="md"
      overlayProps={{ backgroundOpacity: 0.7, blur: 3 }}
      aria-label="Model details"
      styles={{
        content: {
          maxWidth: 1200,
          height: 'min(820px, 88vh)',
          display: 'flex',
          overflow: 'hidden',
          backgroundColor: 'var(--mantine-color-dark-7)',
        },
        body: { display: 'flex', flex: 1, minHeight: 0, width: '100%', padding: 0 },
      }}
    >
      <GalleryColumn />
      <MetadataColumn />
    </Modal>
  );
}
