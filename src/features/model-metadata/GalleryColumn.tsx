import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { useStore } from '@/lib/store';
import { useShortcut, ShortcutPriority } from '@/hooks/useShortcut';
import { PreviewThumb } from '@/features/models/primitives';
import { FullscreenImage, type FullscreenItem } from '@/components/FullscreenImage';
import {
  ActionIcon, Box, Button, Group, SegmentedControl, Skeleton, Text, Tooltip, UnstyledButton,
} from '@mantine/core';
import {
  IconChevronLeft, IconHeart, IconHeartFilled, IconPhoto, IconPlayerPause, IconPlayerPlay, IconTrash,
} from '@tabler/icons-react';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { urlToImageState } from '@/features/inputImage/imageOps';
import type { CivitaiImage, NsfwFilter } from './civitai';
import { GenerationSettings } from './GenerationSettings';
import { useModelMetadataStore, useSelectedVersion, type GallerySource } from './store';
import { useLocalGalleryImages, type LocalGalleryImage } from './useLocalGalleryImages';

const NSFW_OPTIONS: { value: NsfwFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'sfw', label: 'SFW' },
  { value: 'nsfw', label: 'NSFW' },
];

const SOURCE_OPTIONS: { value: GallerySource; label: string }[] = [
  { value: 'civitai',  label: 'Civit.ai' },
  { value: 'imagelab', label: 'ImageLab' },
];

const SLIDESHOW_MS = 3000;

/** Normalised "thing the gallery is rendering". Civit images carry their meta;
 *  local ones carry their HistoryEntry so the hero-overlay actions can target
 *  it directly. */
type GalleryItem =
  | { kind: 'civitai'; image: CivitaiImage; url: string }
  | { kind: 'local';   image: LocalGalleryImage; url: string };

/**
 * Left column of the metadata modal: a source toggle (Civit.ai / ImageLab) +
 * NSFW filter + slideshow play/pause, then a vertical thumbnail rail, the
 * selected image shown large, and a collapsible generation-settings panel.
 *
 * In ImageLab mode the gallery is the user's own history filtered to entries
 * that used this model file, sorted newest first. The hero gains a top-right
 * overlay with delete / favorite actions that act on the underlying entry.
 */
export function GalleryColumn() {
  const load = useModelMetadataStore((s) => s.load);
  const version = useSelectedVersion();
  const versionId = version?.id ?? null;
  const gallery = useModelMetadataStore((s) =>
    versionId != null ? s.versionGalleries[versionId] : undefined,
  );
  const selectedIndex = useModelMetadataStore((s) => s.selectedImageIndex);
  const selectImage = useModelMetadataStore((s) => s.selectImage);
  const loadMore = useModelMetadataStore((s) => s.loadMore);
  const nsfwFilter = useModelMetadataStore((s) => s.nsfwFilter);
  const setNsfwFilter = useModelMetadataStore((s) => s.setNsfwFilter);
  const gallerySource = useModelMetadataStore((s) => s.gallerySource);
  const setGallerySource = useModelMetadataStore((s) => s.setGallerySource);
  const openFileName = useModelMetadataStore((s) => s.openFileName);
  const genParamsOpen = useModelMetadataStore((s) => s.genParamsOpen);
  const setGenParamsOpen = useModelMetadataStore((s) => s.setGenParamsOpen);
  const slideshowPlaying = useStore((s) => s.slideshowPlaying);
  const setSlideshowPlaying = useStore((s) => s.setSlideshowPlaying);
  const fullscreenOpen = useModelMetadataStore((s) => s.fullscreenOpen);
  const setFullscreenOpen = useModelMetadataStore((s) => s.setFullscreenOpen);

  const removeHistoryEntry = useStore((s) => s.removeHistoryEntry);
  const toggleHistoryLiked = useStore((s) => s.toggleHistoryLiked);
  const setWorkflow = useStore((s) => s.setWorkflow);
  const setStatus = useStore((s) => s.setStatus);
  const closeModal = useModelMetadataStore((s) => s.close);
  const [settingInput, setSettingInput] = useState<'idle' | 'busy'>('idle');

  // Civit.ai images — prefer the paginated Images-API set; fall back to the
  // model payload's (meta-less) list until the first page lands.
  const civitaiImages: CivitaiImage[] = gallery?.items ?? version?.images ?? [];
  const localImages: LocalGalleryImage[] = useLocalGalleryImages(openFileName);

  // Unified, source-aware view used by the rendering below — everything from
  // here on doesn't need to know which gallery it's looking at.
  const items: GalleryItem[] = useMemo(() => {
    if (gallerySource === 'imagelab') {
      return localImages.map((img) => ({ kind: 'local' as const, image: img, url: img.url }));
    }
    return civitaiImages.map((img) => ({ kind: 'civitai' as const, image: img, url: img.url }));
  }, [gallerySource, civitaiImages, localImages]);

  const total = items.length;
  const hero = items[selectedIndex] ?? items[0] ?? null;
  const hasMore = gallerySource === 'civitai' && gallery?.nextCursor != null;
  const loadingMore = gallerySource === 'civitai' && (gallery?.loading ?? false);
  // For Civit.ai: a loaded-but-empty gallery means the NSFW filter matched
  // nothing. For ImageLab: there's no async load, so empty just means no local
  // history yet.
  const emptyCivitai = gallerySource === 'civitai' && gallery != null && civitaiImages.length === 0;
  const emptyImageLab = gallerySource === 'imagelab' && localImages.length === 0;

  // Clamp the selection whenever the list shrinks (delete in imagelab, or a
  // filter switch on civitai) so we never render a `null` hero with stale state.
  useEffect(() => {
    if (total === 0) return;
    if (selectedIndex >= total) selectImage(total - 1);
  }, [total, selectedIndex, selectImage]);

  // In-modal slideshow auto-advance. Manual nav resets the timer via the
  // selectedIndex dependency. Paused while fullscreen is open so we don't
  // double-step against FullscreenImage's own timer.
  useEffect(() => {
    if (!slideshowPlaying || total < 2 || fullscreenOpen) return;
    const t = setInterval(() => selectImage((selectedIndex + 1) % total), SLIDESHOW_MS);
    return () => clearInterval(t);
  }, [slideshowPlaying, fullscreenOpen, selectedIndex, total, selectImage]);

  // Arrow keys + spacebar while the modal is open and fullscreen is closed.
  // Overlay priority — when the metadata modal is open it should beat the
  // history panel behind it. Fullscreen viewer (TopOverlay) still wins on top.
  useShortcut('ArrowLeft', (e) => {
    if (total < 2) return;
    e.preventDefault();
    selectImage((selectedIndex - 1 + total) % total);
  }, { priority: ShortcutPriority.Overlay, when: () => !fullscreenOpen });
  useShortcut('ArrowRight', (e) => {
    if (total < 2) return;
    e.preventDefault();
    selectImage((selectedIndex + 1) % total);
  }, { priority: ShortcutPriority.Overlay, when: () => !fullscreenOpen });
  useShortcut('Space', (e) => {
    if (total < 1) return;
    e.preventDefault();
    setFullscreenOpen(true);
  }, { priority: ShortcutPriority.Overlay, when: () => !fullscreenOpen });

  const fullscreenItems = useMemo<FullscreenItem[]>(
    () => items.map((it, i) => ({ key: `${gallerySource}-${versionId ?? 'v'}-${i}-${it.url}`, url: it.url })),
    [items, versionId, gallerySource],
  );

  const localHero = hero?.kind === 'local' ? hero.image : null;
  const civitaiHero = hero?.kind === 'civitai' ? hero.image : null;

  // "Set as input image" — fetch the currently-selected gallery image, decode
  // it to a dataURL, and stash it on the workflow. Works for both gallery
  // sources (Civit.ai CDN and ComfyUI `/view` URLs both serve images).
  const setAsInputImage = async (alsoClose: boolean) => {
    if (!hero || settingInput === 'busy') return;
    const url = hero.url;
    // Derive a readable filename — Civit URLs end in a stable id; local
    // entries already carry a filename on the source HistoryEntry.
    const name = hero.kind === 'local'
      ? (hero.image.entry.filename || 'imagelab.png')
      : (url.split('/').pop()?.split('?')[0] || 'civitai.png');
    setSettingInput('busy');
    setStatus('Loading image as input…', 'busy');
    try {
      const state = await urlToImageState(url, name);
      setWorkflow({ inputImage: state });
      setStatus(`Set as input image (${state.width}×${state.height})`, 'ok');
      if (alsoClose) closeModal();
    } catch (err) {
      setStatus(`Couldn't load image: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setSettingInput('idle');
    }
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      {/* Header — source toggle, slideshow play/pause, NSFW filter (civitai only). */}
      <Group
        gap="xs"
        px="sm"
        py={8}
        wrap="nowrap"
        className="shrink-0"
        style={{ borderBottom: '1px solid var(--mantine-color-dark-4)' }}
      >
        <Text size="xs" fw={600} c="dimmed">Gallery</Text>
        <SegmentedControl
          size="xs"
          data={SOURCE_OPTIONS}
          value={gallerySource}
          onChange={(v) => setGallerySource(v as GallerySource)}
          aria-label="Gallery source"
        />
        <div className="flex-1" />
        <Tooltip label={slideshowPlaying ? 'Pause slideshow' : 'Play slideshow'} withArrow>
          <ActionIcon
            variant={slideshowPlaying ? 'filled' : 'default'}
            onClick={() => setSlideshowPlaying(!slideshowPlaying)}
            aria-label={slideshowPlaying ? 'Pause slideshow' : 'Play slideshow'}
            aria-pressed={slideshowPlaying}
          >
            {slideshowPlaying ? <IconPlayerPause size={14} /> : <IconPlayerPlay size={14} />}
          </ActionIcon>
        </Tooltip>
        {hero && (
          <>
            <Button
              size="xs"
              variant="default"
              leftSection={<IconPhoto size={14} />}
              onClick={() => setAsInputImage(false)}
              loading={settingInput === 'busy'}
              title="Use this image as the input image (img2img)"
            >
              Use as input
            </Button>
            <Button
              size="xs"
              onClick={() => setAsInputImage(true)}
              disabled={settingInput === 'busy'}
              title="Use this image as the input image and close this modal"
            >
              Use & close
            </Button>
          </>
        )}
        {gallerySource === 'civitai' && (
          <SegmentedControl
            size="xs"
            data={NSFW_OPTIONS}
            value={nsfwFilter}
            onChange={(v) => setNsfwFilter(v as NsfwFilter)}
            aria-label="NSFW filter"
          />
        )}
      </Group>

      <div className="flex min-h-0 flex-1">
        {load === 'loading' || load === 'idle' ? (
          <GallerySkeleton />
        ) : emptyCivitai ? (
          <Text size="sm" c="dimmed" ta="center" className="flex flex-1 items-center justify-center p-8">
            No {nsfwFilter === 'sfw' ? 'SFW' : nsfwFilter === 'nsfw' ? 'NSFW' : ''} images in this gallery.
          </Text>
        ) : emptyImageLab ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1 p-8 text-center">
            <Text size="sm" c="dimmed">No local history with this model yet.</Text>
            <Text size="xs" c="dark.3">Generate something to start building one.</Text>
          </div>
        ) : (
          <>
            {/* Vertical, single-column, scrollable thumbnail rail. */}
            {items.length > 1 && (
              <div
                className="scroll-y flex min-h-0 w-[112px] shrink-0 flex-col gap-1.5 p-1.5"
                style={{ borderRight: '1px solid var(--mantine-color-dark-4)' }}
              >
                {/* v1 thumbnails: 2px primary ring on the selected one, the rest dimmed. */}
                {items.map((it, i) => (
                  <UnstyledButton
                    key={`${it.url}-${i}`}
                    onClick={() => selectImage(i)}
                    aria-label={`Image ${i + 1}`}
                    aria-current={i === selectedIndex || undefined}
                    className={cn(
                      'aspect-square w-full shrink-0 overflow-hidden rounded-sm border-2 transition-all duration-150',
                      i === selectedIndex
                        ? 'border-[var(--mantine-primary-color-filled)] opacity-100'
                        : 'border-transparent opacity-70 hover:opacity-100',
                    )}
                  >
                    <PreviewThumb src={it.url} className="h-full w-full" />
                  </UnstyledButton>
                ))}
                {hasMore && (
                  <>
                    {/* Sentinel — auto-fires `loadMore` via IntersectionObserver
                        with ~1 rail-height of headroom, so users never have to
                        click to load the next page. A small pulsing bar gives
                        feedback while the request is in flight. */}
                    <LoadMoreSentinel onIntersect={loadMore} disabled={loadingMore} />
                    {loadingMore && <Skeleton h={28} className="shrink-0" />}
                  </>
                )}
              </div>
            )}

            {/* Main image — a square sized to fit the available height. Click
                or spacebar opens the fullscreen viewer. In ImageLab mode the
                hero is overlaid with delete / favorite actions. */}
            <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden p-3">
              <button
                type="button"
                onClick={() => hero && setFullscreenOpen(true)}
                disabled={!hero}
                aria-label="Open image fullscreen"
                title="Open fullscreen (space)"
                className="group relative aspect-square h-full max-w-full cursor-pointer overflow-hidden rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--mantine-primary-color-filled)] disabled:cursor-default"
              >
                <PreviewThumb
                  src={hero?.url}
                  label="preview"
                  fit="contain"
                  className="h-full w-full"
                />
              </button>
              {localHero && (
                <HeroActions
                  liked={!!localHero.entry.liked}
                  onToggleLike={() => toggleHistoryLiked(localHero.entry.id)}
                  onDelete={() => {
                    // Step the selection back one so the next-newer entry takes
                    // its place rather than letting selectedIndex point past the
                    // end of the new list.
                    if (selectedIndex > 0) selectImage(selectedIndex - 1);
                    removeHistoryEntry(localHero.entry.id);
                  }}
                />
              )}
            </div>

            {/* Generation settings — collapsible panel to the right of the image.
                Closed by default. Only meaningful for Civit.ai images (their
                `meta` carries the prompt/sampler/etc.); ImageLab images don't
                expose it via this panel today, so the strip stays hidden. */}
            {gallerySource === 'civitai' && (
              genParamsOpen ? (
                <Box
                  w={300}
                  p="sm"
                  className="flex shrink-0 flex-col"
                  style={{ borderLeft: '1px solid var(--mantine-color-dark-4)' }}
                >
                  <GenerationSettings image={civitaiHero} onCollapse={() => setGenParamsOpen(false)} />
                </Box>
              ) : (
                <UnstyledButton
                  onClick={() => setGenParamsOpen(true)}
                  title="Show generation settings"
                  className="flex w-[34px] shrink-0 flex-col items-center justify-center gap-2 py-3 text-[var(--mantine-color-dimmed)] transition-colors hover:bg-[var(--mantine-color-dark-6)] hover:text-[var(--mantine-color-text)]"
                  style={{ borderLeft: '1px solid var(--mantine-color-dark-4)' }}
                >
                  <IconChevronLeft size={14} />
                  <span className="text-[10px] font-semibold [writing-mode:vertical-rl]">
                    Generation settings
                  </span>
                </UnstyledButton>
              )
            )}
          </>
        )}
      </div>

      {fullscreenOpen && hero && (
        <FullscreenImage
          items={fullscreenItems}
          index={selectedIndex}
          onIndexChange={selectImage}
          onClose={() => setFullscreenOpen(false)}
          playing={slideshowPlaying}
          onPlayingChange={setSlideshowPlaying}
          slideshowMs={SLIDESHOW_MS}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton — shown until the metadata fetch lands. Mirrors the real
// layout (thumbnail rail + square hero) so the column doesn't shift when the
// gallery data arrives.
// ---------------------------------------------------------------------------

function GallerySkeleton() {
  return (
    <>
      <div
        className="flex min-h-0 w-[112px] shrink-0 flex-col gap-1.5 p-1.5"
        style={{ borderRight: '1px solid var(--mantine-color-dark-4)' }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square w-full shrink-0" h="auto" radius="sm" />
        ))}
      </div>
      <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center p-3">
        <Skeleton className="aspect-square h-full max-w-full" w="auto" radius="md" />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Hero overlay — favorite + delete actions for ImageLab history images.
// ---------------------------------------------------------------------------

function HeroActions({
  liked, onToggleLike, onDelete,
}: { liked: boolean; onToggleLike: () => void; onDelete: () => void }) {
  const confirm = useConfirm();
  const ask = async () => {
    if (await confirm('Delete this image from your history? This cannot be undone.')) onDelete();
  };
  // v1 viewer actions: filled ActionIcons at 0.8 opacity over the image.
  return (
    <Group gap="xs" className="pointer-events-none !absolute right-4 top-4">
      <Tooltip label={liked ? 'Remove from favorites' : 'Mark as favorite'} withArrow>
        <ActionIcon
          variant="filled"
          color={liked ? 'yellow' : 'dark'}
          size="lg"
          onClick={onToggleLike}
          aria-label={liked ? 'Remove from favorites' : 'Mark as favorite'}
          aria-pressed={liked}
          className="pointer-events-auto"
          style={{ opacity: 0.8 }}
        >
          {liked ? <IconHeartFilled size="1.2rem" /> : <IconHeart size="1.2rem" />}
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Delete from history" withArrow>
        <ActionIcon
          variant="filled"
          color="red"
          size="lg"
          onClick={ask}
          aria-label="Delete from history"
          className="pointer-events-auto"
          style={{ opacity: 0.8 }}
        >
          <IconTrash size="1.2rem" />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

/** Bottom-of-rail sentinel that fires `onIntersect` whenever it enters view,
 *  with a 600px rootMargin so the next page kicks off before the user reaches
 *  the bottom. `disabled` (typically the loadingMore flag) suppresses
 *  re-entrant calls while a request is already in flight. */
function LoadMoreSentinel({ onIntersect, disabled }: {
  onIntersect: () => void;
  disabled: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (disabled) return;
      if (entries.some((e) => e.isIntersecting)) onIntersect();
    }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [onIntersect, disabled]);
  return <div ref={ref} aria-hidden className="h-px w-full shrink-0" />;
}

