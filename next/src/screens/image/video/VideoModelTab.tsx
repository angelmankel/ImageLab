/**
 * The Video step's Model tab (rule 4, sized for video): the engine switch (Wan 2.2 · MiniMax
 * H3), the engine's model files as picker rows reading the video server's lists (high / low
 * experts or the H3 checkpoint, the text encoder, the VAEs; "not on the server" when a file is
 * missing, with where to get it), the LoRAs list, and the weight dtype under More. State is
 * the main app's `videoStore`; missing files are `@/lib/videoSections`.
 */
import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { useVideo } from '@/features/video/videoStore';
import { missingVideoFilesBySection } from '@/lib/videoSections';
import { h3ModelFile } from '@/lib/h3Graph';
import type { WeightDtype } from '@/lib/wanGraph';
import { Chip, Tabs } from '~/ui';
import { FilePickRow } from './FilePicker';
import { VideoLoraList } from './VideoLoraList';
import { Section, Fold, Warn, ChipGroup, muted } from './bits';
import { shortFile, type Engine } from './videoStepLogic';

const DTYPES: Array<{ key: WeightDtype; label: string }> = [
  { key: 'default', label: 'default' }, { key: 'fp8_e4m3fn', label: 'fp8 e4m3fn' }, { key: 'fp8_e4m3fn_fast', label: 'fp8 fast' }, { key: 'fp8_e5m2', label: 'fp8 e5m2' },
];

export function VideoModelTab() {
  const v = useVideo();
  const server = useStore((s) => s.server);
  const h3 = v.engine === 'h3';
  const missing = useMemo(() => missingVideoFilesBySection(v, server), [v, server]);
  const files = v.models[v.mode];
  const h = v.h3;

  return (
    <>
      <Section title="Engine">
        <Tabs<Engine> items={[{ key: 'wan', label: 'Wan 2.2' }, { key: 'h3', label: 'MiniMax H3' }]} value={v.engine} onChange={(engine) => v.set({ engine })} />
        <div style={muted}>{h3 ? 'One 33B omni model: video with its own stereo sound, 24 fps, up to 15 s. Slower per clip.' : 'Two 14B experts, silent, 16 fps, quick with the lightx2v speed LoRAs. Switch to H3 for sound.'}</div>
      </Section>

      <Section title="Models">
        {h3 ? (
          <>
            <FilePickRow label={h.mode === 'ref' ? 'Model · ref2va (reference task)' : 'Model · fl2va (text / first frame)'} value={h3ModelFile(h)} files={server.diffusionModels} engine="h3"
              onPick={(f) => v.setH3({ models: { ...h.models, [h.mode === 'ref' ? 'ref2va' : 'fl2va']: f } })} />
            <FilePickRow label="Text encoder · Qwen3-VL" value={h.textEncoder} files={server.textEncoders} engine="h3" onPick={(textEncoder) => v.setH3({ textEncoder })} />
            <FilePickRow label="Video VAE" value={h.videoVae} files={server.vaes} engine="h3" onPick={(videoVae) => v.setH3({ videoVae })} />
            <FilePickRow label="Audio VAE" value={h.audioVae} files={server.vaes} engine="h3" onPick={(audioVae) => v.setH3({ audioVae })} />
          </>
        ) : (
          <>
            <div style={muted}>{v.mode === 't2v' ? 'Text' : 'Image'} → Video has its own pair of experts (the task is in Settings).</div>
            <FilePickRow label="High-noise expert" value={files.high} files={server.diffusionModels} engine="wan" onPick={(f) => v.setModel(v.mode, 'high', f)} />
            <FilePickRow label="Low-noise expert" value={files.low} files={server.diffusionModels} engine="wan" onPick={(f) => v.setModel(v.mode, 'low', f)} />
            <FilePickRow label="Text encoder · UMT5" value={v.textEncoder} files={server.textEncoders} engine="wan" onPick={(textEncoder) => v.set({ textEncoder })} />
            <FilePickRow label="VAE · Wan 2.1" value={v.vae} files={server.vaes} engine="wan" onPick={(vae) => v.set({ vae })} />
          </>
        )}
        {missing.models.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Warn>Not on the server: {missing.models.map(shortFile).join(', ')}</Warn>
            <div style={muted}>{h3 ? 'Hugging Face Comfy-Org/MiniMax-H3 (diffusion_models, text_encoders, vae). The Models screen downloads by URL.' : "Links are in the note of ImageLabDocker's workflows/Wan 2.2 A14B.json; the Models screen downloads by URL."}</div>
          </div>
        )}
        {!server.models.length && <div style={muted}>Reading the server's lists…</div>}
      </Section>

      <Section title="LoRAs" value={(h3 ? h.loras : v.loras).filter((l) => l.on).length || undefined}>
        <VideoLoraList />
      </Section>

      <Fold title="More" summary={`weights ${v.weightDtype.replace(/_/g, ' ')}`}>
        <Section title="Weight dtype">
          <ChipGroup>{DTYPES.map((d) => <Chip key={d.key} small on={v.weightDtype === d.key} onClick={() => v.set({ weightDtype: d.key })}>{d.label}</Chip>)}</ChipGroup>
          <div style={muted}>{h3 ? 'Leave default for the INT8 files: they carry their own quantisation.' : 'How UNETLoader holds the weights. fp8 fast uses the GPU\'s fp8 matmul: quicker, a touch less exact. GGUF files ignore it.'}</div>
        </Section>
      </Fold>
    </>
  );
}
