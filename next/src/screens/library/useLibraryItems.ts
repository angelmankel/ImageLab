/**
 * Library (rule 12) — every image and video as one `LibItem` list, then the visible list after
 * the screen's filters and sort. Images come from the main store's history (`useImageResults`),
 * videos from the video run store (`useVideoResults`). Selectors return store references only;
 * everything derived is built in useMemo (React error #185).
 */
import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { useImageResults, useVideoResults } from '@/features/workspace/results';
import { useLibrary } from './libraryStore';
import { filterItems, sortItems, type LibItem } from './libraryLogic';

export function useAllItems(): LibItem[] {
  const images = useImageResults();
  const videos = useVideoResults();
  const likedVideos = useLibrary((s) => s.likedVideos);
  const hiddenVideos = useLibrary((s) => s.hiddenVideos);
  return useMemo(() => {
    const liked = new Set(likedVideos);
    const hidden = new Set(hiddenVideos);
    const out: LibItem[] = images.map((i) => ({ key: i.key, kind: 'image', url: i.url, filename: i.filename, createdAt: i.createdAt, liked: !!i.entry.liked, entry: i.entry }));
    for (const v of videos) {
      if (hidden.has(v.key)) continue;
      out.push({ key: v.key, kind: v.kind, url: v.url, filename: v.filename, createdAt: v.createdAt, liked: liked.has(v.key) });
    }
    return out;
  }, [images, videos, likedVideos, hiddenVideos]);
}

/** The items the grid shows, in order. */
export function useVisibleItems(all: LibItem[]): LibItem[] {
  const kind = useLibrary((s) => s.kind);
  const bucket = useLibrary((s) => s.bucket);
  const search = useLibrary((s) => s.search);
  const sort = useLibrary((s) => s.sort);
  const collections = useStore((s) => s.collections);
  return useMemo(() => sortItems(filterItems(all, { kind, bucket, search, collections }), sort), [all, kind, bucket, search, sort, collections]);
}
