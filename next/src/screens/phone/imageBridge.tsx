/**
 * The phone's handle on what the Shell + Image step agent exports from `~/screens/image`:
 *   - `StepPanel`   the step panel body (workflow row + Prompt · Model · Settings · Input), props `{ phone, stepId }`
 *   - `useGenerate` `() => { generate, generateRandom, stop, running }` — the desktop Generate's own function
 *   - `AppEffects`  the root effects (connection, jobs…) the desktop shell mounts
 * Looked up by name at call time, so the build passes before they exist and picks them up the
 * moment they do. Each has a small fallback here; the orchestrator can turn these into plain
 * imports once `~/screens/image` exports them.
 */
import type { ComponentType } from 'react';
import * as ImageScreens from '~/screens/image';
import { fireFromStore } from '@/features/generate/GenerateButton';
import { useStore } from '@/lib/store';
import { useComfyConnection } from '@/hooks/useComfyConnection';
import { useModelProfileSync } from '@/hooks/useModelProfileSync';
import { useVideoServerProbe } from '@/hooks/useVideoServerProbe';

export interface GenerateApi {
  /** Generate with the seed as set. */
  generate: () => void;
  /** Generate with a fresh random seed. */
  generateRandom: () => void;
  /** Stop this step's running job. */
  stop: () => void;
  /** This step's own job is running. */
  running: boolean;
}

export interface StepPanelProps { phone?: boolean; stepId?: string }

const mod = ImageScreens as unknown as Record<string, unknown>;

// ── StepPanel ────────────────────────────────────────────────────────────────

function FallbackStepPanel() {
  return (
    <div style={{ padding: 10, color: 'var(--il-muted)', fontWeight: 700 }}>step panel loading</div>
  );
}

export function StepPanel(props: StepPanelProps) {
  const C = (mod['StepPanel'] as ComponentType<StepPanelProps> | undefined) ?? FallbackStepPanel;
  return <C {...props} />;
}

// ── useGenerate ──────────────────────────────────────────────────────────────

/** Fallback: the main app's image Generate (`fireFromStore`), Stop = cancel the running image job. */
function useFallbackGenerate(): GenerateApi {
  const running = useStore((s) => s.isSubmitting || s.jobs.some((j) => j.status === 'running'));
  return {
    generate: () => { void fireFromStore(false); },
    generateRandom: () => { void fireFromStore(true); },
    stop: () => {
      const st = useStore.getState();
      const job = st.jobs.find((j) => j.status === 'running');
      if (job) st.cancelJob(job.id);
    },
    running,
  };
}

const resolvedUseGenerate = (): (() => GenerateApi) =>
  (mod['useGenerate'] as (() => GenerateApi) | undefined) ?? useFallbackGenerate;

/** Same hook every render (the export never changes after load), so the hook order is stable. */
export function useGenerate(): GenerateApi {
  return resolvedUseGenerate()();
}

// ── AppEffects ───────────────────────────────────────────────────────────────

/** Fallback: the main app's connection + model-type + video-server effects, so jobs run on the phone. */
function FallbackAppEffects() {
  useComfyConnection();
  useModelProfileSync();
  useVideoServerProbe();
  return null;
}

export function AppEffects() {
  const C = (mod['AppEffects'] as ComponentType | undefined) ?? FallbackAppEffects;
  return <C />;
}
