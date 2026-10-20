/**
 * Right-click / long-press on a model tile in the Models browser (FIXLIST 45). The tile hands its
 * own callbacks as the target (they come from hooks), so the menu does exactly what its buttons do.
 */
import { IconCheck, IconCopy, IconExternalLink, IconHeart, IconInfoCircle, IconPhoto } from '@tabler/icons-react';
import type { CivitaiModel } from '@/lib/civitai';
import { useModels } from '~/screens/models/modelsStore';
import { isLocalModel } from '~/screens/models/localModels';
import { registerMenu } from '../registry';

export interface ModelTileTarget {
  model: CivitaiModel;
  /** Open the pictures (the viewer). */
  view: () => void;
  /** Open the details panel. */
  open: () => void;
  /** Use in the step / pick; null when that needs a download first. */
  use: (() => void) | null;
}

const civitaiUrl = (m: CivitaiModel) => `https://civitai.com/models/${m.id}`;

registerMenu<ModelTileTarget>('model-tile', [
  { id: 'view', label: 'View pictures', icon: IconPhoto, group: 'open', action: (t) => t.view() },
  { id: 'open', label: 'Details', icon: IconInfoCircle, group: 'open', action: (t) => t.open() },
  { id: 'use', label: 'Use in the step', icon: IconCheck, group: 'use', enabled: (t) => !!t.use || 'Download it first', action: (t) => t.use?.() },
  {
    id: 'fav', label: 'Favourite', icon: IconHeart, group: 'use', visible: (t) => !isLocalModel(t.model),
    checked: (t) => useModels.getState().favourites.includes(t.model.id),
    action: (t) => useModels.getState().toggleFavourite(t.model.id),
  },
  { id: 'civitai', label: 'Open on CivitAI', icon: IconExternalLink, group: 'web', visible: (t) => !isLocalModel(t.model), action: (t) => window.open(civitaiUrl(t.model), '_blank', 'noopener') },
  { id: 'copy', label: 'Copy CivitAI link', icon: IconCopy, group: 'web', visible: (t) => !isLocalModel(t.model), action: (t) => navigator.clipboard?.writeText(civitaiUrl(t.model)).catch(() => undefined) },
]);
