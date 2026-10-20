/**
 * The Video step's Model tab (rule 4: ONE model component for all models): the engine switch
 * (Wan 2.2 · MiniMax H3), then the universal `ModelList` on the Video step's own api — Experts /
 * Model · LoRAs · Text encoder · VAE(s) as circles with the same card, "+ Add" and "Change ▾"
 * into the big models modal as the Image step; a file the server lacks is the dimmed "not on
 * server" / "not downloaded" state with the Download button. The weight dtype sits under More.
 * State is the main app's `videoStore`.
 */
import { useStore } from '@/lib/store';
import { useVideo } from '@/features/video/videoStore';
import type { WeightDtype } from '@/lib/wanGraph';
import { Chip, Tabs } from '~/ui';
import { ModelList } from '~/screens/image/model';
import { Section, Fold, ChipGroup, muted } from './bits';
import type { Engine } from './videoStepLogic';
import { VIDEO_KINDS, videoLabels } from './videoKinds';
import { useVideoKindApi } from './useVideoKindApi';

const DTYPES: Array<{ key: WeightDtype; label: string }> = [
  { key: 'default', label: 'default' }, { key: 'fp8_e4m3fn', label: 'fp8 e4m3fn' }, { key: 'fp8_e4m3fn_fast', label: 'fp8 fast' }, { key: 'fp8_e5m2', label: 'fp8 e5m2' },
];

export function VideoModelTab() {
  const engine = useVideo((s) => s.engine);
  const mode = useVideo((s) => s.mode);
  const weightDtype = useVideo((s) => s.weightDtype);
  const set = useVideo((s) => s.set);
  const listsReady = useStore((s) => s.server.models.length > 0);
  const h3 = engine === 'h3';

  return (
    <>
      <Section title="Engine">
        <Tabs<Engine> items={[{ key: 'wan', label: 'Wan 2.2' }, { key: 'h3', label: 'MiniMax H3' }]} value={engine} onChange={(e) => set({ engine: e })} />
        <div style={muted}>{h3 ? 'One 33B omni model: video with its own stereo sound, 24 fps, up to 15 s. Slower per clip.' : `Two 14B experts, silent, 16 fps, quick with the lightx2v speed LoRAs. ${mode === 't2v' ? 'Text' : 'Image'} → Video has its own pair (the task is in Parameters).`}</div>
      </Section>

      <ModelList kinds={VIDEO_KINDS} useApi={useVideoKindApi} labels={videoLabels(engine)} />
      {!listsReady && <div style={muted}>Reading the server's lists…</div>}

      <Fold title="More" summary={`weights ${weightDtype.replace(/_/g, ' ')}`}>
        <Section title="Weight dtype">
          <ChipGroup>{DTYPES.map((d) => <Chip key={d.key} small on={weightDtype === d.key} onClick={() => set({ weightDtype: d.key })}>{d.label}</Chip>)}</ChipGroup>
          <div style={muted}>{h3 ? 'Leave default for the INT8 files: they carry their own quantisation.' : 'How UNETLoader holds the weights. fp8 fast uses the GPU\'s fp8 matmul: quicker, a touch less exact. GGUF files ignore it.'}</div>
        </Section>
      </Fold>
    </>
  );
}
