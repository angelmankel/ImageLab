/**
 * Settings → Models: "Image size" — Model default or Custom (fix list 2: "a 'Model default'
 * resolution option, also on the Settings page"). The same switch as the Composition tab's.
 */
import { useStore } from '@/lib/store';
import type { SettingDef } from '~/screens/settings/categories';
import { Seg } from './Seg';
import { nearestRatio } from './sizeLogic';
import { useComposition, type SizeMode } from './sizeStore';

function ImageSizeCtl() {
  const mode = useComposition((s) => s.sizeMode);
  const set = (m: SizeMode) => {
    if (m === 'model') { const w = useStore.getState().workflow; useComposition.getState().setRatio(nearestRatio(w.width, w.height).id); }
    useComposition.getState().setSizeMode(m);
  };
  return <div style={{ width: 240, maxWidth: '100%' }}><Seg<SizeMode> label="Image size" items={[{ key: 'model', label: 'Model default' }, { key: 'custom', label: 'Custom' }]} value={mode} onChange={set} /></div>;
}

export const COMPOSITION_ROWS: readonly SettingDef[] = [
  {
    id: 'models.imageSize', category: 'models', label: 'Image size',
    hint: "Model default: each model type's own pixel count in the shape you pick (SD 1.5 512², SDXL 1024², Qwen 1328²). Custom: the width and height you set in Composition.",
    keywords: ['resolution', 'width', 'height', 'aspect', 'composition', 'default', 'native', 'pixels', 'size'], Control: ImageSizeCtl,
  },
];
