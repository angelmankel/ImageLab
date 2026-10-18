/**
 * An image input on the loaded workflow.
 *
 * A `LoadImage` node's `image` widget is a COMBO listing what is already in ComfyUI's input
 * folder — useless on a phone, where the picture you want is in the camera roll and has never
 * been near the server. So the control is an uploader first and a picker second: choose a file
 * (or take a photo), it goes to `input/imagelab/`, and the widget is set to the name the server
 * gave it back.
 *
 * The upload is the same endpoint and subfolder the generate view uses, so the two never collide
 * and neither can overwrite the person's own files.
 */
import { useRef, useState } from 'react';
import { comfyHttpFor, loadImageRef, uploadImage } from '@/lib/comfy';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/cn';
import { Button, Group, LoadingOverlay, Text } from '@mantine/core';
import { IconCamera, IconPhoto, IconUpload } from '@tabler/icons-react';
import { InputImageBrowserModal } from '@/features/inputImage/InputImageBrowserModal';
import { paramLabel, type WorkflowParam } from './params';

/** A COMBO named `image` on an image-loading node is a picture, not a dropdown. */
export function isImageParam(p: WorkflowParam): boolean {
  return p.type === 'COMBO' && p.name === 'image' && /LoadImage|ImageLoad/i.test(p.nodeType);
}

export function ImageInput({
  param, value, onChange, host, large,
}: {
  param: WorkflowParam;
  value: unknown;
  onChange: (value: unknown) => void;
  host: string;
  large?: boolean;
}) {
  const file = useRef<HTMLInputElement | null>(null);
  const camera = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [dragging, setDragging] = useState(false);

  const current = String(value ?? '');
  // ComfyUI serves an input image from the same /view endpoint as an output, with type=input.
  const preview = current
    ? `${comfyHttpFor(host)}/view?` + new URLSearchParams({
        filename: current.includes('/') ? current.slice(current.lastIndexOf('/') + 1) : current,
        subfolder: current.includes('/') ? current.slice(0, current.lastIndexOf('/')) : '',
        type: 'input',
      })
    : null;

  const accept = async (picked: File | undefined) => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      // Keep the original name so the workflow stays readable in ComfyUI, but make it unique —
      // `overwrite: true` means a second "photo.jpg" would silently replace the first.
      const safe = picked.name.replace(/[^\w.-]+/g, '-');
      const up = await uploadImage(host, picked, `${Date.now()}-${safe}`);
      onChange(loadImageRef(up));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  /** A past generation (or any image URL): fetched through the browser, then uploaded like a file. */
  const acceptUrl = async (url: string, name: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Couldn't fetch the image (HTTP ${res.status})`);
      const blob = await res.blob();
      setBusy(false);
      await accept(new File([blob], name || 'image.png', { type: blob.type || 'image/png' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  /** A dropped file, or a history / Collections thumbnail (`application/x-imagelab-image`). */
  const acceptDrop = async (dt: DataTransfer) => {
    const f = dt.files?.[0];
    if (f) { if (f.type.startsWith('image/')) await accept(f); return; }
    try {
      const parsed = JSON.parse(dt.getData('application/x-imagelab-image') || 'null') as { url?: string; name?: string } | null;
      if (parsed?.url) { await acceptUrl(parsed.url, parsed.name || 'image.png'); return; }
    } catch { /* not ours — try a plain URL */ }
    const url = dt.getData('text/uri-list').split('\n').find(u => u.trim() && !u.startsWith('#'))?.trim();
    if (url && /^https?:|^blob:|^data:/.test(url)) await acceptUrl(url, 'image.png');
  };

  const options = (param.options ?? []).map(String);

  return (
    <div className={cn('flex flex-col gap-2', large ? 'py-2' : 'py-1')}>
      <Text size={large ? 'sm' : 'xs'} fw={500}>{paramLabel(param)}</Text>

      <div
        onClick={() => file.current?.click()}
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); void acceptDrop(e.dataTransfer); }}
        className={cn(
          'relative flex cursor-pointer items-center justify-center overflow-hidden rounded-md',
          'border border-dashed bg-[var(--mantine-color-dark-7)]',
          'transition-colors hover:border-[var(--mantine-primary-color-filled)]',
          dragging ? 'border-[var(--mantine-primary-color-filled)]' : 'border-[var(--mantine-color-dark-4)]',
          large ? 'h-44' : 'h-32',
        )}
      >
        {preview ? (
          <img src={preview} alt={current} className="h-full w-full object-contain" />
        ) : (
          <Text size="xs" c="dimmed" ta="center" px="md">
            {busy ? 'Uploading…' : 'Tap to choose an image, or drop one here (a file or a history thumbnail)'}
          </Text>
        )}
        <LoadingOverlay visible={busy} overlayProps={{ backgroundOpacity: 0.4 }} loaderProps={{ size: 'sm' }} />
      </div>

      <Group gap="xs" grow>
        <Button variant="default" size={large ? 'lg' : 'sm'} leftSection={<IconUpload size={15} />} onClick={() => file.current?.click()}>
          Choose
        </Button>
        <Button variant="default" size={large ? 'lg' : 'sm'} leftSection={<IconPhoto size={15} />} onClick={() => setBrowserOpen(true)} title="Pick one of your generations">
          Gallery
        </Button>
        <Button variant="default" size={large ? 'lg' : 'sm'} leftSection={<IconCamera size={15} />} onClick={() => camera.current?.click()}>
          Camera
        </Button>
      </Group>

      <InputImageBrowserModal
        opened={browserOpen}
        onClose={() => setBrowserOpen(false)}
        onSelect={(url, name) => { setBrowserOpen(false); void acceptUrl(url, name); }}
      />

      {options.length > 0 && (
        <Select
          value={options.includes(current) ? current : ''}
          onValueChange={onChange}
          options={options}
          placeholder="…or one already on the server"
          ariaLabel={`${paramLabel(param)} — already uploaded`}
          triggerClassName={large ? 'h-11 text-[14px]' : undefined}
        />
      )}

      {error && <Text size="xs" c="red.4">{error}</Text>}

      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={e => { void accept(e.target.files?.[0]); e.target.value = ''; }}
      />
      {/* `capture` asks Android to open the camera straight away rather than the file browser. */}
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={e => { void accept(e.target.files?.[0]); e.target.value = ''; }}
      />
    </div>
  );
}
