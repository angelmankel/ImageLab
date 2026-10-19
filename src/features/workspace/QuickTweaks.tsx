/**
 * The few key settings simple mode keeps on screen, one line each. Everything else is a tap away
 * behind Advanced; these are the knobs people reach for between every run.
 */
import { Switch } from '@mantine/core';
import { FieldRow, SliderRow } from '@/components/blocks';
import { useStore } from '@/lib/store';
import { FAST, wanLength } from '@/lib/wanGraph';
import { videoSeconds } from '@/lib/videoSections';
import { useVideo } from '@/features/video/videoStore';

export function ImageQuickTweaks() {
  const steps = useStore(s => s.workflow.steps);
  const cfg = useStore(s => s.workflow.cfg);
  const batch = useStore(s => s.workflow.batch);
  const set = useStore(s => s.setWorkflow);
  return (
    <div className="flex flex-col">
      <SliderRow label="Steps" value={steps} min={1} max={60} step={1} onChange={v => set({ steps: v })} />
      <SliderRow label="CFG" value={cfg} min={1} max={15} step={0.5} onChange={v => set({ cfg: v })} format={v => v.toFixed(1)} />
      <SliderRow label="Images" value={batch} min={1} max={8} step={1} onChange={v => set({ batch: v })} />
    </div>
  );
}

export function VideoQuickTweaks() {
  const v = useVideo();
  return (
    <div className="flex flex-col">
      <FieldRow label="Fast (4 steps)" hint={v.fast ? `lightx2v · CFG ${FAST.cfg} · about 6× faster` : 'Full steps and CFG from Speed & sampling'}>
        <Switch size="md" checked={v.fast} onChange={e => v.set({ fast: e.currentTarget.checked })} aria-label="Fast mode" />
      </FieldRow>
      <SliderRow label="Length" value={v.length} min={5} max={161} step={4} onChange={length => v.set({ length: wanLength(length) })} format={n => `${videoSeconds({ length: n, fps: v.fps })} s`} />
    </div>
  );
}
