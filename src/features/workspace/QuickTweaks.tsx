/**
 * The few key settings simple mode keeps on screen, one line each. Everything else is a tap away
 * behind Advanced; these are the knobs people reach for between every run.
 */
import { Switch } from '@mantine/core';
import { FieldRow, SliderRow } from '@/components/blocks';
import { useStore } from '@/lib/store';
import { FAST, H3_FPS, h3EffectiveSteps, h3Length, wanLength } from '@/lib/wanGraph';
import { framesSeconds, videoSeconds } from '@/lib/videoSections';
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
  if (v.engine === 'h3') {
    const h = v.h3;
    return (
      <div className="flex flex-col">
        <FieldRow label={`Turbo (${h.mode === 'ref' ? h.turbo.stepsRef : h.turbo.steps} steps)`} hint={h.turbo.on ? `lightx2v turbo LoRA · ${h3EffectiveSteps(h)} steps` : `${h.steps} steps from Speed & sampling`}>
          <Switch size="md" checked={h.turbo.on} onChange={e => v.setH3({ turbo: { ...h.turbo, on: e.currentTarget.checked } })} aria-label="Turbo LoRA" />
        </FieldRow>
        <FieldRow label="Audio" hint={h.audio ? 'Stereo soundtrack from the model' : 'Silent clip (skips the audio decode)'}>
          <Switch size="md" checked={h.audio} onChange={e => v.setH3({ audio: e.currentTarget.checked })} aria-label="Audio" />
        </FieldRow>
        <SliderRow label="Length" value={h.length} min={22} max={362} step={17} onChange={length => v.setH3({ length: h3Length(length) })} format={n => `${framesSeconds(h3Length(n), H3_FPS)} s`} />
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      <FieldRow label="Fast (4 steps)" hint={v.fast ? `lightx2v · CFG ${FAST.cfg} · about 6× faster` : 'Full steps and CFG from Speed & sampling'}>
        <Switch size="md" checked={v.fast} onChange={e => v.set({ fast: e.currentTarget.checked })} aria-label="Fast mode" />
      </FieldRow>
      <SliderRow label="Length" value={v.length} min={5} max={161} step={4} onChange={length => v.set({ length: wanLength(length) })} format={n => `${videoSeconds({ length: n, fps: v.fps })} s`} />
    </div>
  );
}
