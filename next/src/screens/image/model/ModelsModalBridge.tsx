/**
 * The picker window for "Change ▾" and "+ Add": the models agent's big `ModelsModal` (every
 * CivitAI model of the kind, Downloaded / Favourites / tag filters) from `~/screens/models`, read
 * at render time so this compiles before it exists. Kinds with no CivitAI mapping (`kind` null:
 * text encoders, "other" loaders) and the time before the big modal exists get the small
 * server-file grid `ModelPickerModal` (its pick is always an installed file). `baseModels` narrows
 * the big modal's base-model filter while it is open (the Video step: Wan / H3) and puts the
 * user's own choice back on close.
 */
import { useEffect, useRef, type ComponentType } from 'react';
import * as Models from '~/screens/models';
import type { ModelPick, ModelsModalProps } from './pickTypes';
import { ModelPickerModal } from './ModelPickerModal';
import type { ModelPickerGrid } from './ModelPickerGrid';

type GridProps = Parameters<typeof ModelPickerGrid>[0];

export function installedPick(file: string): ModelPick {
  return { installed: true, file, model: { id: 0, name: file, type: '', tags: [] }, version: { id: 0, name: '', trainedWords: [] } };
}

type ModelsStore = { getState: () => { filters: { baseModels: string[] }; setFilters: (p: { baseModels: string[] }) => void } };

/** While a base-model lock is wanted and the modal is open, the models store's filter is ours. */
function useBaseModelLock(active: boolean, baseModels: string[] | undefined) {
  const prev = useRef<string[] | null>(null);
  const store = (Models as unknown as Record<string, unknown>).useModels as ModelsStore | undefined;
  useEffect(() => {
    if (!store || !active || !baseModels?.length) return;
    const s = store.getState();
    prev.current = s.filters.baseModels;
    s.setFilters({ baseModels });
    return () => { store.getState().setFilters({ baseModels: prev.current ?? [] }); prev.current = null; };
  }, [store, active, baseModels]);
}

export function ModelsModalBridge({ fallback, baseModels, kind, ...props }: Omit<ModelsModalProps, 'kind'> & { kind: ModelsModalProps['kind'] | null; baseModels?: string[]; fallback: Omit<GridProps, 'onPick'> }) {
  const Big = (Models as unknown as Record<string, unknown>).ModelsModal as ComponentType<ModelsModalProps> | undefined;
  const big = !!Big && !!kind;
  useBaseModelLock(big && props.opened, baseModels);
  if (big) return <Big {...props} kind={kind ?? undefined} />;
  return <ModelPickerModal opened={props.opened} onClose={props.onClose} title={props.title ?? 'Pick a model'} {...fallback} onPick={(file) => props.onPick?.(installedPick(file))} />;
}
