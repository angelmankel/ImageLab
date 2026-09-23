import type { Job } from './types';

export function jobActivity(jobs: Job[], submitting: boolean, online: boolean) {
  const running = jobs.find(j => j.status === 'running');
  const queued = jobs.filter(j => j.status === 'queued').length;
  if (running) {
    const progress = running.progress;
    const percent = progress && progress.max > 0 ? Math.min(100, Math.max(0, Math.round(progress.value / progress.max * 100))) : null;
    return { active: true, label: percent === null ? 'Processing image' : 'Sampling pass', percent,
      detail: progress ? `${progress.value} / ${progress.max} steps` : 'Waiting for the next progress update', queued };
  }
  if (submitting) return { active: true, label: 'Preparing generation', percent: null, detail: 'Preparing and queueing your image', queued };
  if (queued) return { active: true, label: 'Queued', percent: null, detail: 'Waiting for the server', queued };
  return { active: false, label: online ? 'Ready' : 'Offline', percent: null, detail: '', queued: 0 };
}
