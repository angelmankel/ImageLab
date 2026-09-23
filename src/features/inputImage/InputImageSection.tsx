import { useRef, useState } from 'react';
import {
  ActionIcon, Badge, Box, Group, Image, LoadingOverlay, Select, Stack, Text, Tooltip,
} from '@mantine/core';
import { IconBrush, IconLink, IconPhoto, IconUnlink, IconUpload, IconX } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { FieldWrapper } from '@/components/fields/FieldWrapper';
import { DenoiseField } from '@/features/controls/DenoiseField';
import { fileToImageState, urlToImageState } from './imageOps';
import { EditImageModal } from './EditImageModal';
import { InputImageBrowserModal } from './InputImageBrowserModal';

const SIZE_OPTIONS = ['256', '384', '512', '640', '768', '896', '1024', '1280', '1536', '1792', '2048'];

/**
 * "Input image" section, after v1's InputImageField — drop a file, paste from
 * the clipboard, click to browse files, or pick a past generation. Once set,
 * the drop zone becomes the preview, with Edit / Replace / Clear over it and
 * the img2img Denoise + size range knobs below.
 */
export function InputImageSection() {
  const inputImage = useStore(s => s.workflow.inputImage);
  const inputMaxSize = useStore(s => s.workflow.inputMaxSize);
  const inputMinSize = useStore(s => s.workflow.inputMinSize);
  const setWorkflow = useStore(s => s.setWorkflow);
  const setStatus = useStore(s => s.setStatus);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [sizeLocked, setSizeLocked] = useState(false);

  const load = async (read: () => Promise<{ dataUrl: string; name: string; width: number; height: number }>, verb: string) => {
    setLoading(true);
    try {
      const state = await read();
      setWorkflow({ inputImage: state });
      setStatus(`Loaded ${state.width}×${state.height} input image`, 'ok');
    } catch (err) {
      setStatus(`Failed to ${verb} image: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const ingest = async (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setStatus(`${file.name} is not an image`, 'error');
      return;
    }
    await load(() => fileToImageState(file), 'read');
  };

  /**
   * Unified drop handler — accepts:
   *   1. Native files (the existing flow)
   *   2. History/Collections drag payload (`application/x-imagelab-image`):
   *      `{ url, name }` — we fetch the URL and ingest the blob.
   *   3. `text/uri-list` / `text/plain` containing an http(s) URL fallback.
   */
  const handleDataTransfer = async (dt: DataTransfer | null | undefined) => {
    if (!dt) return;
    const file = dt.files?.[0];
    if (file) { await ingest(file); return; }
    let url = '';
    let name = 'image.png';
    try {
      const json = dt.getData('application/x-imagelab-image');
      if (json) {
        const parsed = JSON.parse(json) as { url?: string; name?: string };
        if (parsed.url) { url = parsed.url; name = parsed.name || name; }
      }
    } catch { /* ignore — fall through to uri-list */ }
    if (!url) {
      const fromList = dt.getData('text/uri-list').split('\n').find(s => s.trim() && !s.startsWith('#'));
      url = fromList?.trim() || dt.getData('text/plain').trim();
    }
    if (!url || !/^https?:|^blob:|^data:/.test(url)) return;
    await load(() => urlToImageState(url, name), 'load');
  };

  const openFilePicker = () => fileInputRef.current?.click();
  const enabled = inputImage != null;

  return (
    // The section header already says "Input image", so the v1 label row is folded into the
    // action row: dimensions on the left, the actions on the right.
    <Stack gap="xs" pb="xs">
      <Group gap={4} justify="flex-end">
        {enabled && (
          <Badge size="xs" variant="light" color="blue" mr="auto">{inputImage.width} × {inputImage.height}</Badge>
        )}
        <Tooltip label="Browse generated images">
          <ActionIcon variant="subtle" size="sm" onClick={() => setBrowserOpen(true)} aria-label="Browse generated images">
            <IconPhoto size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={enabled ? 'Replace with a different image' : 'Upload an image'}>
          <ActionIcon variant="subtle" size="sm" onClick={openFilePicker} aria-label={enabled ? 'Replace input image' : 'Upload input image'}>
            <IconUpload size={16} />
          </ActionIcon>
        </Tooltip>
        {enabled && (
          <>
            <Tooltip label="Edit image">
              <ActionIcon variant="subtle" size="sm" onClick={() => setEditorOpen(true)} aria-label="Edit input image">
                <IconBrush size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Clear image">
              <ActionIcon variant="subtle" size="sm" color="red" onClick={() => setWorkflow({ inputImage: null })} aria-label="Clear input image">
                <IconX size={16} />
              </ActionIcon>
            </Tooltip>
          </>
        )}
      </Group>

      {/* Drop zone / preview. Empty, a click uploads; with an image, a click opens the editor. */}
      <Box
        role="button"
        tabIndex={0}
        aria-label={enabled ? 'Edit input image' : 'Drop image, click, or paste'}
        onClick={enabled ? () => setEditorOpen(true) : openFilePicker}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          if (enabled) setEditorOpen(true); else openFilePicker();
        }}
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setDragging(false);
          await handleDataTransfer(e.dataTransfer);
        }}
        onPaste={async (e) => {
          const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'));
          const f = item?.getAsFile();
          if (f) await ingest(f);
        }}
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '1',
          maxHeight: 200,
          borderRadius: 'var(--mantine-radius-md)',
          border: `2px dashed ${dragging ? 'var(--mantine-primary-color-5)' : 'var(--mantine-color-dark-4)'}`,
          backgroundColor: dragging ? 'var(--mantine-primary-color-9)' : 'var(--mantine-color-dark-6)',
          cursor: 'pointer',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
        }}
      >
        <LoadingOverlay visible={loading} />
        {enabled ? (
          <>
            <Image src={inputImage.dataUrl} alt={inputImage.name} fit="contain" h="100%" w="100%" />
            <Box style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 6px', background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}>
              <Text size="xs" c="white" truncate title={inputImage.name}>{inputImage.name}</Text>
            </Box>
          </>
        ) : (
          <Stack align="center" gap="xs" px="sm">
            <IconUpload size={32} style={{ opacity: 0.5 }} color={dragging ? 'var(--mantine-primary-color-5)' : undefined} />
            <Text size="xs" c="dimmed" ta="center">Drop image here or click to upload</Text>
            <Text size="xs" c="dimmed" ta="center">Paste from clipboard (Ctrl+V) · drag a history thumbnail here</Text>
          </Stack>
        )}
      </Box>

      {enabled && (
        <>
          <DenoiseField />
          <FieldWrapper label="Size range" description="Longest edge the image is scaled into">
            <Group gap={6} wrap="nowrap">
              <Select
                data={SIZE_OPTIONS}
                value={String(inputMinSize)}
                onChange={(v) => {
                  const min = Number(v) || 0;
                  if (sizeLocked) setWorkflow({ inputMinSize: min, inputMaxSize: min });
                  else setWorkflow({ inputMinSize: min, inputMaxSize: Math.max(min, inputMaxSize) });
                }}
                allowDeselect={false}
                comboboxProps={{ withinPortal: true }}
                aria-label="Input image min size"
                style={{ flex: 1 }}
              />
              <Tooltip label={sizeLocked ? 'Unlink min/max' : 'Link min/max to the same value'}>
                <ActionIcon
                  variant={sizeLocked ? 'light' : 'subtle'}
                  color={sizeLocked ? undefined : 'gray'}
                  onClick={() => {
                    const next = !sizeLocked;
                    setSizeLocked(next);
                    if (next) setWorkflow({ inputMaxSize: inputMinSize });
                  }}
                  aria-pressed={sizeLocked}
                  aria-label={sizeLocked ? 'Unlink min/max' : 'Link min/max'}
                >
                  {sizeLocked ? <IconLink size={16} /> : <IconUnlink size={16} />}
                </ActionIcon>
              </Tooltip>
              <Select
                data={SIZE_OPTIONS}
                value={String(inputMaxSize)}
                onChange={(v) => {
                  const max = Number(v) || 1024;
                  if (sizeLocked) setWorkflow({ inputMinSize: max, inputMaxSize: max });
                  else setWorkflow({ inputMaxSize: max, inputMinSize: Math.min(inputMinSize, max) });
                }}
                allowDeselect={false}
                comboboxProps={{ withinPortal: true }}
                aria-label="Input image max size"
                style={{ flex: 1 }}
              />
            </Group>
          </FieldWrapper>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          await ingest(f);
        }}
      />

      <InputImageBrowserModal
        opened={browserOpen}
        onClose={() => setBrowserOpen(false)}
        onSelect={(url, name) => { setBrowserOpen(false); void load(() => urlToImageState(url, name), 'load'); }}
      />

      {editorOpen && inputImage && (
        <EditImageModal image={inputImage} onClose={() => setEditorOpen(false)} />
      )}
    </Stack>
  );
}
