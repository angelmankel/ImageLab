/**
 * The tab bodies of the Refine / Upscale / Remove BG steps (fix list 15, 22, 43). Composition is
 * the shared `InputTab` (the step's input picture: follows the step above by default). Here:
 *
 *  - Prompt: Refine (and Upscale with "Refine after upscale") re-sample with step 1's prompt —
 *    shown read-only with a jump to step 1; Upscale / Remove BG have none.
 *  - Model: Refine uses step 1's model (shown, with a jump); Upscale picks its upscale model;
 *    Remove BG its background-removal model.
 *  - Parameters: Refine = the Loopback card on the step's own settings; Upscale = factor and
 *    "Refine after upscale" (off by default) with its denoise + steps; Remove BG = a note.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useStore } from '@/lib/store';
import { compileLayers } from '@/lib/prompt';
import { useModeHost } from '@/features/workspace/modeHost';
import { useRoute } from '~/app/routeStore';
import { useSteps, DEFAULT_REFINE, DEFAULT_UPSCALE, clampFactor, modelScale, type Step } from '~/app/stepsStore';
import { removeBgModels, REMOVE_BG_MODEL } from '~/app/removeBg';
import { Button, Chip, SliderRow, Switch } from '~/ui';
import { T } from '~/theme/tokens';
import { LoopbackCard } from '../settings/LoopbackCard';
import { useStepInput } from '../useStepOutput';

const card: React.CSSProperties = { background: 'var(--il-card)', borderRadius: T.radius.xl, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 };
const title: React.CSSProperties = { fontSize: 12, fontWeight: 800, color: 'var(--il-fg)' };
const muted: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--il-muted)', lineHeight: 1.45 };

function Card({ head, children }: { head: string; children: ReactNode }) {
  return <div style={card}><div style={title}>{head}</div>{children}</div>;
}

const goStep1 = () => { const st = useSteps.getState(); st.setActive(st.steps[0].id); useRoute.getState().go('step'); };

/** The size of the picture the step will take (for the "1024 → 2048" labels), when it can be read. */
function useInputSize(step: Step): { width: number; height: number } | null {
  const res = useStepInput(step);
  const url = res.kind === 'chained' || res.kind === 'explicit' ? res.src.url : null;
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    if (!url) { setSize(null); return; }
    let live = true;
    const img = new Image();
    img.onload = () => { if (live) setSize({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.src = url;
    return () => { live = false; };
  }, [url]);
  return size;
}

const params = (step: Step) => useSteps.getState().updateParams.bind(null, step.id);

// ── Prompt ───────────────────────────────────────────────────────────────────────────────

function SessionPrompt({ why }: { why: string }) {
  const layers = useStore((s) => s.layers);
  const text = compileLayers(layers, 'positive');
  return (
    <Card head="Prompt · step 1's">
      <div style={muted}>{why}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-fg2)', background: 'var(--il-bg-deep)', borderRadius: T.radius.md, padding: '8px 10px', maxHeight: 160, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{text || 'No prompt yet.'}</div>
      <div><Button size="sm" onClick={goStep1}>Edit it in step 1</Button></div>
    </Card>
  );
}

export function RefinePromptTab() {
  return <SessionPrompt why="Refine re-samples the picture with step 1's prompt, so its details stay on topic." />;
}

export function UpscalePromptTab({ step }: { step: Step }) {
  if (step.params?.upscale?.refine) return <SessionPrompt why="“Refine after upscale” re-samples with step 1's prompt." />;
  return <Card head="No prompt"><div style={muted}>Upscale makes the picture bigger with an upscale model; it needs no prompt. Turn on “Refine after upscale” in Parameters for a light re-sample with step 1's prompt.</div></Card>;
}

export function RemoveBgPromptTab() {
  return <Card head="No prompt"><div style={muted}>Remove BG finds the subject and makes everything else transparent (a PNG with alpha). It needs no prompt.</div></Card>;
}

// ── Model ────────────────────────────────────────────────────────────────────────────────

function SessionModel({ why }: { why: string }) {
  const name = useStore((s) => s.workflow.checkpoints[0]?.name ?? '');
  const loras = useStore((s) => s.workflow.loras?.filter((l) => l.on && l.name).length ?? 0);
  return (
    <Card head="Model · step 1's">
      <div style={muted}>{why}</div>
      <div style={{ fontSize: 13, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>{name.replace(/\.(safetensors|ckpt|gguf)$/i, '') || 'No model picked'}</div>
      {loras > 0 && <div style={muted}>+ {loras} LoRA{loras === 1 ? '' : 's'}</div>}
      <div><Button size="sm" onClick={goStep1}>Change it in step 1</Button></div>
    </Card>
  );
}

export function RefineModelTab() {
  return <SessionModel why="Refine re-samples with the session's model and LoRAs (step 1), so the style matches." />;
}

/** The server's list for the step's runner host, read from the server info the app already has. */
function useUpscaleModels(): string[] | null {
  const host = useModeHost('workflow');
  return useStore((s) => {
    const server = s.servers.find((x) => x.host === host);
    return server ? s.serverInfo[server.id]?.upscaleModels ?? null : null;
  });
}

const shortName = (f: string) => f.replace(/\.(pth|pt|safetensors|ckpt|bin|onnx)$/i, '');

export function UpscaleModelTab({ step }: { step: Step }) {
  const models = useUpscaleModels();
  const p = { ...DEFAULT_UPSCALE, ...step.params?.upscale };
  const set = params(step);
  const chosen = p.model && models?.includes(p.model) ? p.model : models?.[0] ?? '';
  return (
    <>
      <Card head="Upscale model">
        {models === null && <div style={muted}>Reading the server…</div>}
        {models?.length === 0 && (
          <div style={muted}>This server has no upscale model, so the step does a plain lanczos resize (sharp edges stay soft). Put a model such as 4x-UltraSharp or 2xNomosUni in ComfyUI's <b>models/upscale_models</b> and it shows here.</div>
        )}
        {!!models?.length && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {models.map((m) => <Chip key={m} small on={m === chosen} onClick={() => set({ upscale: { ...p, model: m } })} title={m}>{shortName(m)} · ×{modelScale(m)}</Chip>)}
          </div>
        )}
      </Card>
      {p.refine && <SessionModel why="“Refine after upscale” re-samples with the session's model (step 1)." />}
    </>
  );
}

export function RemoveBgModelTab({ step }: { step: Step }) {
  const host = useModeHost('workflow');
  const [models, setModels] = useState<string[] | null | undefined>(undefined);
  useEffect(() => { let live = true; if (host) void removeBgModels(host).then((m) => { if (live) setModels(m); }); return () => { live = false; }; }, [host]);
  const chosen = step.params?.removeBg?.model || (models?.includes(REMOVE_BG_MODEL) ? REMOVE_BG_MODEL : models?.[0] ?? '');
  const set = params(step);
  return (
    <Card head="Background removal model">
      {models === undefined && <div style={muted}>Reading the server…</div>}
      {models === null && <div style={{ ...muted, color: 'var(--il-warn)' }}>This server has no background removal node. Update ComfyUI (core “Remove Background”, BiRefNet).</div>}
      {models?.length === 0 && <div style={{ ...muted, color: 'var(--il-warn)' }}>No model yet: put birefnet.safetensors in ComfyUI's models/background_removal.</div>}
      {!!models?.length && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {models.map((m) => <Chip key={m} small on={m === chosen} onClick={() => set({ removeBg: { model: m } })} title={m}>{shortName(m)}</Chip>)}
        </div>
      )}
      <div style={muted}>BiRefNet finds the subject; everything else turns transparent.</div>
    </Card>
  );
}

// ── Parameters ───────────────────────────────────────────────────────────────────────────

export function RefineSettingsTab({ step }: { step: Step }) {
  const size = useInputSize(step);
  const lb = { ...DEFAULT_REFINE, ...step.params?.refine };
  return <LoopbackCard always title="Refine rounds" value={lb} size={size} onChange={(next) => params(step)({ refine: { ...next, enabled: true } })} />;
}

const FACTORS = [1.5, 2, 3, 4];

export function UpscaleSettingsTab({ step }: { step: Step }) {
  const size = useInputSize(step);
  const p = { ...DEFAULT_UPSCALE, ...step.params?.upscale };
  const set = (patch: Partial<typeof p>) => params(step)({ upscale: { ...p, ...patch } });
  const out = size ? `${size.width}×${size.height} → ${Math.round((size.width * p.factor) / 8) * 8}×${Math.round((size.height * p.factor) / 8) * 8}` : undefined;
  return (
    <>
      <div style={card}>
        <SliderRow label="Scale" value={p.factor} min={1} max={4} step={0.25} presets={FACTORS} format={(v) => `×${v}`} hint={out} onChange={(v) => set({ factor: clampFactor(v) })} />
      </div>
      <div style={card}>
        <Switch label="Refine after upscale" description="a light re-sample with step 1's model and prompt: crisper detail at the new size" checked={p.refine} onChange={(refine) => set({ refine })} />
        {p.refine && (
          <>
            <SliderRow label="Denoise" value={p.denoise} min={0.05} max={0.7} step={0.05} presets={[0.2, 0.3, 0.4, 0.5]} format={(v) => v.toFixed(2)} hint="← keep the picture · more new detail →" onChange={(denoise) => set({ denoise })} />
            <SliderRow label="Steps" value={p.steps} min={4} max={40} step={1} presets={[8, 12, 20]} onChange={(steps) => set({ steps })} />
          </>
        )}
      </div>
    </>
  );
}

export function RemoveBgSettingsTab() {
  return <Card head="Nothing to set"><div style={muted}>Remove BG has no knobs: pick the model in Model if the server has several. The result is a PNG with transparency, shown on a checkerboard.</div></Card>;
}
