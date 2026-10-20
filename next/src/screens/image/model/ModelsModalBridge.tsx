/**
 * The picker window for "Change ▾" and "+ Add": the models agent's big `ModelsModal` (every
 * CivitAI model of the kind, Downloaded / Favourites / tag filters) from `~/screens/models`, read
 * at render time so this compiles before it exists; until then the small installed-only
 * `ModelPickerModal` stands in (its pick is always an installed file).
 */
import type { ComponentType } from 'react';
import * as Models from '~/screens/models';
import type { ModelPick, ModelsModalProps } from './pickTypes';
import { ModelPickerModal } from './ModelPickerModal';
import type { ModelPickerGrid } from './ModelPickerGrid';

type GridProps = Parameters<typeof ModelPickerGrid>[0];

export function installedPick(file: string): ModelPick {
  return { installed: true, file, model: { id: 0, name: file, type: '', tags: [] }, version: { id: 0, name: '', trainedWords: [] } };
}

export function ModelsModalBridge({ fallback, ...props }: ModelsModalProps & { fallback: Omit<GridProps, 'onPick'> }) {
  const Big = (Models as unknown as Record<string, unknown>).ModelsModal as ComponentType<ModelsModalProps> | undefined;
  if (Big) return <Big {...props} />;
  return <ModelPickerModal opened={props.opened} onClose={props.onClose} title={props.title ?? 'Pick a model'} {...fallback} onPick={(file) => props.onPick?.(installedPick(file))} />;
}
