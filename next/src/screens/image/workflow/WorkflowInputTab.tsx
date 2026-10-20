/**
 * The Workflow step's Input tab: the workflow's LoadImage widget(s), each through THE shared drop
 * zone (`~/compose`, fix list 41). The first is THE input: My image · Last from N · Pick from N
 * (on Generate `startWorkflowStepRun` fetches a chained picture, uploads it to the step's host and
 * sets it into the widget), or a picture of your own — uploaded at once, the widget set to the
 * server's name; Library → On the server picks a file already there. More LoadImage nodes get a
 * small zone each. Raw node names ("Load Image #8") are never shown (`slotLabel`).
 */
import { useMemo, useState } from 'react';
import { notifications } from '@mantine/notifications';
import { loadImageRef, uploadImage } from '@/lib/comfy';
import { useStudio } from '@/features/studio/studioStore';
import { inputViewUrl } from '@/features/studio/ImageInput';
import type { WorkflowParam } from '@/features/studio/params';
import { useSteps, stepTitle, type Step } from '~/app/stepsStore';
import { ImageDropZone, StepImageInput, rememberOrigin, slotLabel, useOrigin } from '~/compose';
import { Hint } from './Hint';
import { WorkflowPicker } from './WorkflowPicker';
import { rememberUpload } from './stepRun';
import { markStepEdited, useWorkflowStepHost } from './useWorkflowStepHost';
import { isImageParam, uploadName } from './workflowStepLogic';

const NO_VALUES: Record<string, unknown> = {};

/** Upload a picture to the host and point the widget at it; returns the widget's new value. */
function useUploader(host: string | null, step: Step, p: WorkflowParam, setAsStepInput: boolean) {
  const [busy, setBusy] = useState(false);
  const setValue = useStudio((s) => s.setValue);
  const setStepInput = useSteps((s) => s.setStepInput);
  const send = async (blob: Blob, name: string, sourceUrl?: string): Promise<string | null> => {
    if (!host) { notifications.show({ color: 'red', title: 'No workflow server', message: 'Connect a server first.', autoClose: 3000 }); return null; }
    setBusy(true);
    try {
      const up = await uploadImage(host, blob, uploadName(name, Date.now()));
      const ref = loadImageRef(up);
      setValue(p.id, ref);
      markStepEdited(step.id);
      const url = inputViewUrl(host, ref) ?? '';
      rememberUpload(host, url, ref);
      if (sourceUrl) rememberUpload(host, sourceUrl, ref);
      if (setAsStepInput) setStepInput(step.id, { url, name });
      return ref;
    } catch (err) {
      notifications.show({ color: 'red', title: 'Upload failed', message: err instanceof Error ? err.message : String(err), autoClose: 3000 });
      return null;
    } finally { setBusy(false); }
  };
  return { busy, send };
}

function Picture({ host, p, value, step, main }: { host: string | null; p: WorkflowParam; value: unknown; step: Step; main: boolean }) {
  const setValue = useStudio((s) => s.setValue);
  const setStepInput = useSteps((s) => s.setStepInput);
  const up = useUploader(host, step, p, main);
  const cur = String(value ?? '');
  const slot = `wf:${step.id}:${p.id}`;
  const origin = useOrigin(slot, cur);
  const preview = host && cur ? inputViewUrl(host, cur) : null;
  const options = (p.options ?? []).map(String);
  const server = useMemo(() => (host && options.length ? { files: options, viewUrl: (f: string) => inputViewUrl(host, f) } : null), [host, options.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <ImageDropZone
      url={preview}
      name={cur}
      origin={origin}
      small={!main}
      busy={up.busy}
      server={server}
      target={main ? { id: `input:${step.id}`, label: `Input of ${stepTitle(useSteps.getState().steps, step.id)}` } : null}
      pasteAnywhere={main}
      onBlob={async ({ blob, name, sourceUrl }, from) => { const ref = await up.send(blob, name, sourceUrl); if (ref) rememberOrigin(slot, from, ref); }}
      onServerFile={(f) => { setValue(p.id, f); markStepEdited(step.id); rememberOrigin(slot, 'server', f); }}
      onClear={main && step.input ? () => setStepInput(step.id, null) : undefined}
    />
  );
}

export function WorkflowInputTab({ step }: { step: Step }) {
  const { ref, host, open, loading } = useWorkflowStepHost(step);
  const params = useStudio((s) => s.params);
  const values = useStudio((s) => (s.path ? s.values[s.path] ?? NO_VALUES : NO_VALUES));
  const images = open ? params.filter(isImageParam) : [];
  const [main, ...more] = images;
  const valueOf = (p: WorkflowParam) => (p.id in values ? values[p.id] : p.value);

  return (
    <>
      {!ref && <WorkflowPicker step={step} />}
      {!ref && <Hint>Pick a workflow first.</Hint>}
      {loading && <Hint>Opening {ref?.name}…</Hint>}
      {open && !images.length && <Hint>This workflow takes no input picture.</Hint>}
      {main && <StepImageInput step={step} title={slotLabel(main.nodeLabel, 0)} own={<Picture host={host} p={main} value={valueOf(main)} step={step} main />} />}
      {more.map((p, i) => (
        <div key={p.id} style={{ background: 'var(--il-card)', borderRadius: 14, padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--il-fg)' }}>{slotLabel(p.nodeLabel, i + 1)}</div>
          <Picture host={host} p={p} value={valueOf(p)} step={step} main={false} />
        </div>
      ))}
    </>
  );
}
