/**
 * The Video step's Settings tab (rule 5, sized for video): Task · Size (presets per engine, or
 * my own width / height on the engine's grid) · Length (seconds chips at the engine's fps) ·
 * Speed (Fast / Turbo with the step counts) · Seed; then "More" (Sampling: steps, switch, CFG,
 * shift, sampler; Guidance & speedups) and "Upscale + Finish" (upscale, interpolation, colour
 * match, encode) folded. Values and rules are the main app's `videoStore` / `wanGraph`; the look
 * is this file. Chips to tap, sliders for the rest.
 */
import { useStore } from '@/lib/store';
import { useVideo } from '@/features/video/videoStore';
import { CONTAINER_CODECS, H3_TURBO_LORAS, effectiveSampling, h3EffectiveSteps, type VideoEncode } from '@/lib/wanGraph';
import { Chip, SliderRow, Switch } from '~/ui';
import { FilePickRow } from './FilePicker';
import { Section, Fold, ChipGroup, Warn, muted } from './bits';
import {
  SIZE_PRESETS, fpsOf, lengthChips, secondsOf, sideStep, snapFrames, snapSide, speedLabel, tasksFor, visibleFields, type Task,
} from './videoStepLogic';
import { taskOf } from './videoChain';

const SAMPLERS = ['euler', 'res_multistep', 'uni_pc', 'dpmpp_2m', 'lcm'];
const SCHEDULERS = ['simple', 'normal', 'beta', 'sgm_uniform'];
const fmt1 = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));

export function VideoSettingsTab() {
  const v = useVideo();
  const server = useStore((s) => s.server);
  const h3 = v.engine === 'h3';
  const h = v.h3;
  const task = taskOf(v);
  const fields = visibleFields(v.engine, task);
  const width = h3 ? h.width : v.width, height = h3 ? h.height : v.height;
  const setSize = (s: { width: number; height: number }) => (h3 ? v.setH3(s) : v.set(s));
  const custom = !SIZE_PRESETS[v.engine].some((g) => g.items.some((p) => p.width === width && p.height === height));
  const fps = fpsOf(v.engine, v.fps);
  const frames = h3 ? snapFrames('h3', h.length) : snapFrames('wan', v.length);
  const setFrames = (n: number) => (h3 ? v.setH3({ length: snapFrames('h3', n) }) : v.set({ length: snapFrames('wan', n) }));
  const eff = effectiveSampling(v);
  const speedOn = h3 ? h.turbo.on : v.fast;
  const steps = h3 ? h3EffectiveSteps(h) : eff.steps;
  const setTask = (t: Task) => (h3 ? v.setH3({ mode: t }) : v.set({ mode: t === 'ref' ? 'i2v' : t }));
  const samplers = server.samplers.length ? SAMPLERS.filter((s) => server.samplers.includes(s)) : SAMPLERS;
  const schedulers = server.schedulers.length ? SCHEDULERS.filter((s) => server.schedulers.includes(s)) : SCHEDULERS;
  const fr = v.fastRecipe;
  const setFr = (p: Partial<typeof fr>) => v.set({ fastRecipe: { ...fr, ...p } });
  const enc = v.encode;
  const setEnc = (p: Partial<VideoEncode>) => v.set({ encode: { ...enc, ...p } });

  return (
    <>
      <Section title="Task">
        <ChipGroup>{tasksFor(v.engine).map((t) => <Chip key={t.key} on={task === t.key} onClick={() => setTask(t.key)}>{t.label}</Chip>)}</ChipGroup>
        <div style={muted}>{task === 'i2v' ? 'The start picture is in Composition: the previous step\'s output, or one of yours.' : task === 'ref' ? 'Up to 9 reference pictures in Composition; name them <Picture 1>… in the prompt.' : 'Text alone.'}</div>
      </Section>

      <Section title="Size" value={`${width} × ${height}`}>
        {SIZE_PRESETS[v.engine].map((g) => (
          <ChipGroup key={g.group} title={g.group}>
            {g.items.map((p) => <Chip key={`${p.width}x${p.height}`} on={p.width === width && p.height === height} onClick={() => setSize({ width: p.width, height: p.height })}>{p.label}<span style={{ fontWeight: 600, color: 'var(--il-muted)', fontSize: 10 }}>{p.width}×{p.height}</span></Chip>)}
          </ChipGroup>
        ))}
        <Fold title="Set width and height myself" defaultOpen={custom}>
          <SliderRow id="width" label="Width" value={width} min={sideStep(v.engine) * 8} max={1536} step={sideStep(v.engine)} onChange={(w) => setSize({ width: snapSide(v.engine, w), height })} />
          <SliderRow id="height" label="Height" value={height} min={sideStep(v.engine) * 8} max={1536} step={sideStep(v.engine)} onChange={(hh) => setSize({ width, height: snapSide(v.engine, hh) })} />
          <div style={muted}>Multiples of {sideStep(v.engine)}.{h3 ? ' H3 stretches the first frame to this canvas.' : ' WanImageToVideo crops the start frame to this shape.'}</div>
        </Fold>
      </Section>

      <Section title="Length" value={`${secondsOf(frames, fps)} s · ${frames} f`}>
        <ChipGroup>{lengthChips(v.engine, fps).map((c) => <Chip key={c.frames} on={c.frames === frames} onClick={() => setFrames(c.frames)}>{c.seconds} s<span style={{ fontWeight: 600, color: 'var(--il-muted)', fontSize: 10 }}>{c.frames} f</span></Chip>)}</ChipGroup>
        <SliderRow id="video.frames" label="Frames" value={frames} min={5} max={h3 ? 362 : 161} step={h3 ? 17 : 4} onChange={setFrames} hint={h3 ? '← short, quick · long, slow →  (17n + 5 at 24 fps)' : '← short, quick · long, may drift →  (4n + 1)'} />
        {fields.fps && <ChipGroup title="Frame rate">{[16, 24].map((n) => <Chip key={n} small on={v.fps === n} onClick={() => v.set({ fps: n })}>{n} fps</Chip>)}</ChipGroup>}
        {fields.audio && <Switch label="Soundtrack (stereo, from the model)" checked={h.audio} onChange={(audio) => v.setH3({ audio })} />}
      </Section>

      <Section title="Speed" value={speedLabel(v.engine, speedOn, steps)}>
        {h3 ? (
          <>
            <Switch label="Turbo (lightx2v distill LoRA)" checked={h.turbo.on} onChange={(on) => v.setH3({ turbo: { ...h.turbo, on } })} />
            {h.turbo.on && h.mode !== 'ref' && (
              <ChipGroup title="Steps">
                <Chip small on={h.turbo.steps === 8} onClick={() => v.setH3({ turbo: { ...h.turbo, lora: H3_TURBO_LORAS.fl2va8, steps: 8 } })}>8 steps</Chip>
                <Chip small on={h.turbo.steps === 4} onClick={() => v.setH3({ turbo: { ...h.turbo, lora: H3_TURBO_LORAS.fl2va4, steps: 4 } })}>4 steps · 768p</Chip>
              </ChipGroup>
            )}
            {h.turbo.on && h.mode === 'ref' && <div style={muted}>The reference task's turbo LoRA runs {h.turbo.stepsRef} steps.</div>}
            {!h.turbo.on && <ChipGroup title="Steps">{[12, 20, 30].map((n) => <Chip key={n} small on={h.steps === n} onClick={() => v.setH3({ steps: n })}>{n}</Chip>)}</ChipGroup>}
            {h.turbo.on && !server.loras.includes(h.mode === 'ref' ? h.turbo.loraRef : h.turbo.lora) && server.loras.length > 0 && <Warn>turbo LoRA not on the server</Warn>}
          </>
        ) : (
          <>
            <Switch label={`Fast (lightx2v, ${fr.steps} steps, CFG ${fr.cfg})`} checked={v.fast} onChange={(fast) => v.set({ fast })} />
            {v.fast ? (
              <>
                <ChipGroup title="Steps">{[4, 6, 8].map((n) => <Chip key={n} small on={fr.steps === n} onClick={() => setFr({ steps: n, switchStep: Math.min(fr.switchStep, n), motionSteps: Math.min(fr.motionSteps, n) })}>{n}</Chip>)}</ChipGroup>
                <ChipGroup title="Motion pass (steps without the speed LoRA)">{[0, 1, 2].map((n) => <Chip key={n} small on={fr.motionSteps === n} onClick={() => setFr({ motionSteps: Math.min(n, fr.switchStep) })}>{n === 0 ? 'off' : n}</Chip>)}</ChipGroup>
                <div style={muted}>About 6× faster, nearly the same look. A motion pass of 1–2 brings movement back when clips look slow.</div>
                {['high', 'low'].some((w) => !server.loras.includes(v.fastLoras[v.mode][w as 'high' | 'low'])) && server.loras.length > 0 && <Warn>a speed LoRA is not on the server (Model tab)</Warn>}
              </>
            ) : (
              <ChipGroup title="Steps">{[8, 20, 30].map((n) => <Chip key={n} small on={v.steps === n} onClick={() => v.set({ steps: n, switchStep: Math.min(v.switchStep, n) })}>{n}</Chip>)}</ChipGroup>
            )}
          </>
        )}
      </Section>

      <Section title="Seed" value={v.randomizeSeed ? 'random' : String(v.seed)}>
        <Switch label="New random seed each run" checked={v.randomizeSeed} onChange={(randomizeSeed) => v.set({ randomizeSeed })} />
        {!v.randomizeSeed && (
          <input type="number" min={0} value={v.seed} onChange={(e) => v.set({ seed: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} aria-label="Seed"
            style={{ height: 34, border: 0, borderRadius: 10, background: 'var(--il-bg-deep)', color: 'var(--il-fg)', fontSize: 13, fontWeight: 700, padding: '0 10px', outline: 'none', fontVariantNumeric: 'tabular-nums' }} />
        )}
      </Section>

      <Fold title="More" summary={h3 ? `${steps} steps · CFG ${fmt1(h.cfg)} · ${h.sampler}` : `${eff.steps} steps · CFG ${fmt1(eff.cfg)} · ${v.sampler}`}>
        <Section title="Sampling">
          {h3 ? (
            <>
              <SliderRow label="Steps" value={h.turbo.on ? h3EffectiveSteps(h) : h.steps} min={2} max={50} step={1} onChange={(n) => v.setH3({ steps: n })} hint={h.turbo.on ? 'Turbo sets the steps.' : '← quicker · more detail →'} />
              <SliderRow label="CFG" value={h.cfg} min={1} max={6} step={0.5} presets={[1, 2, 3]} format={fmt1} onChange={(cfg) => v.setH3({ cfg })} hint="1 is the template (no negative); above it the zeroed negative costs a second pass." />
              <SliderRow label="Shift · video" value={h.shiftVideo} min={1} max={20} step={0.5} format={fmt1} onChange={(shiftVideo) => v.setH3({ shiftVideo })} />
              <SliderRow label="Shift · audio" value={h.shiftAudio} min={1} max={20} step={0.5} format={fmt1} onChange={(shiftAudio) => v.setH3({ shiftAudio })} />
              <ChipGroup title="Sampler">{samplers.map((s) => <Chip key={s} small on={h.sampler === s} onClick={() => v.setH3({ sampler: s })}>{s}</Chip>)}</ChipGroup>
              <ChipGroup title="Scheduler">{schedulers.map((s) => <Chip key={s} small on={h.scheduler === s} onClick={() => v.setH3({ scheduler: s })}>{s}</Chip>)}</ChipGroup>
            </>
          ) : (
            <>
              <SliderRow label="Steps" value={eff.steps} min={2} max={60} step={1} onChange={(n) => (v.fast ? setFr({ steps: n, switchStep: Math.min(fr.switchStep, n) }) : v.set({ steps: n, switchStep: Math.min(v.switchStep, n) }))} hint="← quicker · more detail →" />
              {fields.expertSwitch && <SliderRow label="Switch to low-noise at step" value={eff.switchStep} min={0} max={eff.steps} step={1} onChange={(n) => (v.fast ? setFr({ switchStep: n, motionSteps: Math.min(fr.motionSteps, n) }) : v.set({ switchStep: n }))} hint="← less motion, more detail · more motion →" />}
              <SliderRow label="CFG" value={eff.cfg} min={1} max={10} step={0.5} presets={v.fast ? [1] : [1, 3.5, 5]} format={fmt1} onChange={(cfg) => (v.fast ? setFr({ cfg }) : v.set({ cfg }))} hint={v.fast ? '1 is the distilled value (half the work per step).' : '← looser · follows the prompt, may burn →'} />
              <SliderRow id="video.shift" label="Shift" value={v.shift} min={1} max={20} step={0.5} presets={[5, 8]} format={fmt1} onChange={(shift) => v.set({ shift })} />
              <ChipGroup title="Sampler">{samplers.map((s) => <Chip key={s} small on={v.sampler === s} onClick={() => v.set({ sampler: s })}>{s}</Chip>)}</ChipGroup>
              <ChipGroup title="Scheduler">{schedulers.map((s) => <Chip key={s} small on={v.scheduler === s} onClick={() => v.set({ scheduler: s })}>{s}</Chip>)}</ChipGroup>
            </>
          )}
        </Section>
        <Section title={h3 ? 'VRAM patches' : 'Guidance & speedups'}>
          {h3 ? (
            <>
              <Switch label={`Attention in head groups (×${h.lowVram.headChunks})`} checked={h.lowVram.attention} onChange={(attention) => v.setH3({ lowVram: { ...h.lowVram, attention } })} />
              <Switch label={`Chunked feed-forward (×${h.lowVram.chunks})`} checked={h.lowVram.feedForward} onChange={(feedForward) => v.setH3({ lowVram: { ...h.lowVram, feedForward } })} />
              <div style={muted}>Exact in output, lower peak VRAM, a little slower. For a shared card.</div>
            </>
          ) : (
            <>
              <Switch label={`NAG — the negative at CFG 1${v.guidance.nag.on ? ` (scale ${v.guidance.nag.scale})` : ''}`} checked={v.guidance.nag.on} onChange={(on) => v.set({ guidance: { ...v.guidance, nag: { ...v.guidance.nag, on } } })} />
              {v.guidance.nag.on && <SliderRow label="NAG scale" value={v.guidance.nag.scale} min={1} max={20} step={0.5} presets={[5, 11]} format={fmt1} onChange={(scale) => v.set({ guidance: { ...v.guidance, nag: { ...v.guidance.nag, scale } } })} />}
              <Switch label="CFG-Zero*" checked={v.guidance.cfgZeroStar} onChange={(cfgZeroStar) => v.set({ guidance: { ...v.guidance, cfgZeroStar } })} />
              <Switch label={`EasyCache${v.speedups.easyCache.on ? ` (${v.speedups.easyCache.threshold})` : ''}`} checked={v.speedups.easyCache.on} onChange={(on) => v.set({ speedups: { ...v.speedups, easyCache: { ...v.speedups.easyCache, on } } })} />
              <Switch label="torch.compile" checked={v.speedups.torchCompile} onChange={(torchCompile) => v.set({ speedups: { ...v.speedups, torchCompile } })} />
              <Switch label={`Long clip in windows${v.longClip.on ? ` (${v.longClip.windowFrames}/${v.longClip.overlapFrames})` : ''}`} checked={v.longClip.on} onChange={(on) => v.set({ longClip: { ...v.longClip, on } })} />
            </>
          )}
        </Section>
      </Fold>

      <Fold title="Upscale + Finish" summary={[v.upscale.on ? `${v.upscale.scale}×` : null, v.interpolate.on ? `${v.interpolate.multiplier}× frames` : null, `${enc.container.toUpperCase()} ${enc.codec === 'h264' ? 'H.264' : 'AV1'}`].filter(Boolean).join(' · ')}>
        <Section title="Upscale" value={v.upscale.on ? `${v.upscale.scale}×` : 'off'}>
          <ChipGroup>
            <Chip small on={!v.upscale.on} onClick={() => v.set({ upscale: { ...v.upscale, on: false } })}>Off</Chip>
            {[1.5, 2, 3, 4].map((n) => <Chip key={n} small on={v.upscale.on && v.upscale.scale === n} onClick={() => v.set({ upscale: { ...v.upscale, on: true, scale: n } })}>{n}×</Chip>)}
          </ChipGroup>
          {v.upscale.on && (
            <>
              <ChipGroup title="How">
                <Chip small on={v.upscale.method === 'model'} onClick={() => v.set({ upscale: { ...v.upscale, method: 'model' } })}>Upscale model</Chip>
                <Chip small on={v.upscale.method === 'resize'} onClick={() => v.set({ upscale: { ...v.upscale, method: 'resize' } })}>Plain resize</Chip>
              </ChipGroup>
              {v.upscale.method === 'model' && <FilePickRow label="Upscale model" value={v.upscale.model} files={server.upscaleModels} onPick={(model) => v.set({ upscale: { ...v.upscale, model } })} />}
            </>
          )}
        </Section>
        <Section title="Frame interpolation" value={v.interpolate.on ? `${v.interpolate.multiplier}× → ${fps * v.interpolate.multiplier} fps` : 'off'}>
          <ChipGroup>
            <Chip small on={!v.interpolate.on} onClick={() => v.set({ interpolate: { ...v.interpolate, on: false } })}>Off</Chip>
            {[2, 3, 4].map((n) => <Chip key={n} small on={v.interpolate.on && v.interpolate.multiplier === n} onClick={() => v.set({ interpolate: { ...v.interpolate, on: true, multiplier: n } })}>{n}×</Chip>)}
          </ChipGroup>
          {v.interpolate.on && <FilePickRow label="RIFE / FILM model" value={v.interpolate.model} files={server.interpolationModels ?? []} onPick={(model) => v.set({ interpolate: { ...v.interpolate, model } })} />}
        </Section>
        {fields.colorMatch && (
          <Section title="Colour match to the start frame">
            <Switch label={`On${v.colorMatch.on ? ` (${v.colorMatch.method})` : ''}`} checked={v.colorMatch.on} onChange={(on) => v.set({ colorMatch: { ...v.colorMatch, on } })} />
            {v.colorMatch.on && <SliderRow label="Strength" value={v.colorMatch.strength} min={0} max={1} step={0.05} presets={[0.5, 1]} format={(x) => x.toFixed(2)} onChange={(strength) => v.set({ colorMatch: { ...v.colorMatch, strength } })} />}
          </Section>
        )}
        <Section title="File">
          <ChipGroup title="Container">{(['mp4', 'mkv', 'webm'] as const).map((c) => <Chip key={c} small on={enc.container === c} onClick={() => setEnc({ container: c, codec: CONTAINER_CODECS[c].includes(enc.codec) ? enc.codec : CONTAINER_CODECS[c][0] })}>{c.toUpperCase()}</Chip>)}</ChipGroup>
          <ChipGroup title="Codec">{CONTAINER_CODECS[enc.container].map((c) => <Chip key={c} small on={enc.codec === c} onClick={() => setEnc({ codec: c })}>{c === 'h264' ? 'H.264' : 'AV1'}</Chip>)}</ChipGroup>
          <Switch label={`Set the quality (CRF)${enc.crf != null ? ` · ${enc.crf}` : ''}`} checked={enc.crf != null} onChange={(on) => setEnc({ crf: on ? (enc.codec === 'h264' ? 23 : 30) : null })} />
          {enc.crf != null && <SliderRow label="CRF" value={enc.crf} min={0} max={51} step={1} presets={[18, 23, 28]} onChange={(crf) => setEnc({ crf })} hint="← bigger, better · smaller →" />}
        </Section>
      </Fold>
    </>
  );
}
