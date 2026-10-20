/**
 * The settings categories (left list on desktop, the phone's first page) and the shape of one
 * setting row in the registry. A row is a small record — id, category, label, hint, keywords —
 * so the search is data-driven (settingsLogic.ts), plus the component that renders its control.
 */
import type { ReactElement } from 'react';
import { IconBrush, IconBulb, IconCube, IconInfoCircle, IconPalette, IconServer, IconSparkles, IconVolume } from '@tabler/icons-react';
import type { CategoryId, SearchableRow } from './settingsLogic';

export type { CategoryId };

export interface Category {
  id: CategoryId;
  label: string;
  description: string;
  icon: typeof IconServer;
}

export const CATEGORIES: readonly Category[] = [
  { id: 'servers', label: 'Servers', description: 'The ComfyUI servers that render images and video.', icon: IconServer },
  { id: 'ai', label: 'AI helper', description: 'The provider and model that write, improve and read prompts. Keys stay in this browser; calls go straight from this tab to the active provider.', icon: IconSparkles },
  { id: 'models', label: 'Models & CivitAI', description: 'CivitAI access and how model previews play.', icon: IconCube },
  { id: 'appearance', label: 'Appearance', description: 'Sizes and looks of the library.', icon: IconPalette },
  { id: 'themes', label: 'Themes', description: 'Colours, fonts, size, shape and motion. Every change shows at once.', icon: IconBrush },
  { id: 'sounds', label: 'Sounds', description: 'Volume, mute, and which sounds play: queued, done, clicks, toggles, hover.', icon: IconVolume },
  { id: 'hints', label: 'Hints', description: 'The help text on every parameter: on or off (H), and each text, editable.', icon: IconBulb },
  { id: 'about', label: 'About', description: 'This app, the classic UI, and where your settings live.', icon: IconInfoCircle },
];

export const categoryById = (id: CategoryId): Category => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];

export interface SettingDef extends SearchableRow {
  /** Rows of a category with many settings sit under small titled groups, in first-seen order. */
  group?: string;
  /** The control always goes under the label (lists, chip rows, sliders). */
  wide?: boolean;
  /** The control is small (a switch, a short tab row): stays beside the label on the phone too. */
  compact?: boolean;
  /** Links shown after the hint ("Get one at openrouter.ai"). */
  links?: ReadonlyArray<{ text: string; href: string }>;
  /** The control. A component, so it may use hooks. */
  Control: () => ReactElement;
  /** Shown right of the label on a wide row (a slider's value). */
  Value?: () => ReactElement;
}
