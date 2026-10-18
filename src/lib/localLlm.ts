/**
 * Local LLM server (Ollama) and the Hugging Face GGUF catalog, called straight from the browser.
 *
 * Ollama runs on a LAN box (winold, RTX A4500) behind Traefik as https://llm.blueoceanswim.com —
 * the page is HTTPS, so a plain-http LAN address would be blocked as mixed content. Ollama sends
 * CORS headers for any origin (`OLLAMA_ORIGINS=*`) and Hugging Face's API allows any origin too.
 *
 * Chat itself goes through `veniceChat` (Ollama's OpenAI-compatible `/v1`); this file is the
 * model manager: list, pull with progress, delete, unload, and browse Hugging Face.
 */
import { ggufChoices, parsePullLine, type GgufChoice, type HfTreeFile, type PullProgress } from './llmModels';

export type LocalModel = {
  name: string;
  bytes: number;
  params: string;
  quant: string;
  family: string;
  vision: boolean;
  thinking: boolean;
};

export type RunningModel = { name: string; vramBytes: number; expiresAt: string };

export function ollamaRoot(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '').replace(/\/v1$/, '');
}

async function ollamaJson<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${ollamaRoot(baseUrl)}${path}`, init);
  } catch (e) {
    throw new Error(`Local LLM unreachable: ${e instanceof Error ? e.message : String(e)}`);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Local LLM: ${data?.error || `HTTP ${res.status}`}`);
  return data as T;
}

export async function ollamaVersion(baseUrl: string): Promise<string> {
  const r = await ollamaJson<{ version: string }>(baseUrl, '/api/version');
  return r.version;
}

type TagsResponse = {
  models?: Array<{
    name: string;
    size: number;
    details?: { parameter_size?: string; quantization_level?: string; family?: string };
  }>;
};

/** Installed models, with what each can do (`/api/show` per model: vision, thinking). */
export async function listLocalModels(baseUrl: string): Promise<LocalModel[]> {
  const tags = await ollamaJson<TagsResponse>(baseUrl, '/api/tags');
  const models = tags.models ?? [];
  const caps = await Promise.all(models.map((m) =>
    ollamaJson<{ capabilities?: string[] }>(baseUrl, '/api/show', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: m.name }),
    }).then((r) => r.capabilities ?? []).catch(() => [] as string[])));
  return models
    .map((m, i) => ({
      name: m.name,
      bytes: m.size,
      params: m.details?.parameter_size ?? '',
      quant: m.details?.quantization_level ?? '',
      family: m.details?.family ?? '',
      vision: caps[i].includes('vision'),
      thinking: caps[i].includes('thinking'),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Models loaded in GPU memory right now. */
export async function listRunningModels(baseUrl: string): Promise<RunningModel[]> {
  const r = await ollamaJson<{ models?: Array<{ name: string; size_vram: number; expires_at: string }> }>(baseUrl, '/api/ps');
  return (r.models ?? []).map((m) => ({ name: m.name, vramBytes: m.size_vram, expiresAt: m.expires_at }));
}

export async function deleteLocalModel(baseUrl: string, name: string): Promise<void> {
  await ollamaJson(baseUrl, '/api/delete', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: name }),
  });
}

/** Free the GPU now instead of waiting for the keep-alive to run out. */
export async function unloadLocalModel(baseUrl: string, name: string): Promise<void> {
  await ollamaJson(baseUrl, '/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: name, keep_alive: 0 }),
  });
}

/** Download a model (an Ollama library name or `hf.co/{repo}:{quant}`), reporting progress.
 *  Aborting stops the download; Ollama keeps the finished parts and resumes on the next pull. */
export async function pullLocalModel(
  baseUrl: string,
  name: string,
  onProgress: (p: PullProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${ollamaRoot(baseUrl)}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: name, stream: true }),
      signal,
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new Error(`Local LLM unreachable: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    throw new Error(`Pull failed: ${data?.error || `HTTP ${res.status}`}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let last: PullProgress | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const p = parsePullLine(line);
      if (!p) continue;
      if (p.error) throw new Error(`Pull failed: ${p.error}`);
      last = p;
      onProgress(p);
    }
  }
  const tail = parsePullLine(buf);
  if (tail?.error) throw new Error(`Pull failed: ${tail.error}`);
  if (tail) last = tail;
  if (last?.status !== 'success') throw new Error('Pull ended before it finished');
}

// ---------------------------------------------------------------------------
// Hugging Face GGUF catalog
// ---------------------------------------------------------------------------

export type HfRepo = { id: string; downloads: number; likes: number; updated: string };
export type HfSort = 'downloads' | 'likes' | 'lastModified' | 'trendingScore';

export async function searchHfGguf(query: string, sort: HfSort, signal?: AbortSignal): Promise<HfRepo[]> {
  const params = new URLSearchParams({ filter: 'gguf', sort, direction: '-1', limit: '40' });
  if (query.trim()) params.set('search', query.trim());
  const res = await fetch(`https://huggingface.co/api/models?${params}`, { signal });
  if (!res.ok) throw new Error(`Hugging Face: HTTP ${res.status}`);
  const rows = (await res.json()) as Array<{ id: string; downloads?: number; likes?: number; lastModified?: string }>;
  return rows.map((r) => ({ id: r.id, downloads: r.downloads ?? 0, likes: r.likes ?? 0, updated: r.lastModified ?? '' }));
}

export type HfRepoFiles = { choices: GgufChoice[]; hasProjector: boolean };

/** The quant choices in a repo, and whether it ships a vision projector (Ollama pulls it along). */
export async function hfRepoFiles(repoId: string, signal?: AbortSignal): Promise<HfRepoFiles> {
  const res = await fetch(`https://huggingface.co/api/models/${repoId}/tree/main?recursive=true`, { signal });
  if (!res.ok) throw new Error(`Hugging Face: HTTP ${res.status}`);
  const files = (await res.json()) as HfTreeFile[];
  return {
    choices: ggufChoices(files),
    hasProjector: files.some((f) => /\.gguf$/i.test(f.path) && /mmproj/i.test(f.path)),
  };
}
