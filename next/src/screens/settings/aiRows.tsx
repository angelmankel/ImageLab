/**
 * Settings → AI helper: the model every AI helper uses ("Write it", Improve, tagging, image →
 * prompt) in three groups — Provider (Venice / Local, the model, the prompt style), Venice (key,
 * base URL) and Local LLM (where the Ollama runs: Home PC / This pod, the server URL).
 * Logic = `@/lib/store` venice settings; the model switch is the main app's `AiModelPicker`.
 */
import { PasswordInput, TextInput } from '@mantine/core';
import { useStore } from '@/lib/store';
import { LOCAL_LLM_DEFAULT_BASE_URL, VENICE_DEFAULT_BASE_URL, podLlmUrl, type AiProvider, type PromptStyle } from '@/lib/storage';
import { ollamaRoot } from '@/lib/localLlm';
import { AiModelPicker } from '@/features/ai/AiModelPicker';
import { Chip, Row, Tabs } from '~/ui';
import type { SettingDef } from './categories';
import { ctlStyle, inputStyles, monoInputStyles } from './inputs';

function ProviderCtl() {
  const provider = useStore((s) => s.venice.provider);
  const setVenice = useStore((s) => s.setVenice);
  return (
    <Tabs<AiProvider> compact fill={false} value={provider} onChange={(p) => setVenice({ provider: p })}
      items={[{ key: 'venice', label: 'Venice', title: 'Venice, in the cloud' }, { key: 'local', label: 'Local', title: 'An Ollama server of yours' }]} />
  );
}

function ModelCtl() {
  return <div style={ctlStyle}><AiModelPicker size="sm" /></div>;
}

function StyleCtl() {
  const promptStyle = useStore((s) => s.venice.promptStyle);
  const setVenice = useStore((s) => s.setVenice);
  return (
    <Tabs<PromptStyle> compact fill={false} value={promptStyle} onChange={(promptStyle) => setVenice({ promptStyle })}
      items={[{ key: 'sdxl', label: 'Generic SDXL' }, { key: 'illustrious', label: 'Illustrious tags' }]} />
  );
}

function VeniceKeyCtl() {
  const apiKey = useStore((s) => s.venice.apiKey);
  const setVenice = useStore((s) => s.setVenice);
  return (
    <PasswordInput value={apiKey} onChange={(e) => setVenice({ apiKey: e.currentTarget.value })} placeholder="vn-…" aria-label="Venice API key"
      size="sm" spellCheck={false} autoCapitalize="off" autoComplete="off" styles={inputStyles} style={ctlStyle} />
  );
}

function VeniceUrlCtl() {
  const baseUrl = useStore((s) => s.venice.baseUrl);
  const setVenice = useStore((s) => s.setVenice);
  return (
    <TextInput value={baseUrl} onChange={(e) => setVenice({ baseUrl: e.currentTarget.value })} placeholder={VENICE_DEFAULT_BASE_URL}
      aria-label="Venice base URL" size="sm" spellCheck={false} autoCapitalize="off" autoComplete="off" styles={monoInputStyles} style={ctlStyle} />
  );
}

function WhereCtl() {
  const localBaseUrl = useStore((s) => s.venice.localBaseUrl);
  const setVenice = useStore((s) => s.setVenice);
  const pod = podLlmUrl();
  const here = ollamaRoot(localBaseUrl);
  const places = [{ label: 'Home PC', url: LOCAL_LLM_DEFAULT_BASE_URL }, ...(pod ? [{ label: 'This pod', url: pod }] : [])];
  const custom = !places.some((p) => ollamaRoot(p.url) === here);
  return (
    <Row wrap>
      {places.map((p) => <Chip key={p.url} small on={ollamaRoot(p.url) === here} title={p.url} onClick={() => setVenice({ localBaseUrl: p.url })}>{p.label}</Chip>)}
      {custom && <Chip small on title={localBaseUrl}>Custom</Chip>}
    </Row>
  );
}

function LocalUrlCtl() {
  const localBaseUrl = useStore((s) => s.venice.localBaseUrl);
  const setVenice = useStore((s) => s.setVenice);
  return (
    <TextInput value={localBaseUrl} onChange={(e) => setVenice({ localBaseUrl: e.currentTarget.value })} placeholder={LOCAL_LLM_DEFAULT_BASE_URL}
      aria-label="Local LLM server" size="sm" spellCheck={false} autoCapitalize="off" autoComplete="off" styles={monoInputStyles} style={ctlStyle} />
  );
}

export const AI_ROWS: readonly SettingDef[] = [
  {
    id: 'ai.provider', category: 'ai', group: 'Provider', label: 'Provider', compact: true,
    hint: 'Venice in the cloud, or an Ollama model on a box of yours.',
    keywords: ['venice', 'local', 'ollama', 'cloud', 'llm', 'backend'], Control: ProviderCtl,
  },
  {
    id: 'ai.model', category: 'ai', group: 'Provider', label: 'Model',
    hint: 'The chat model every helper uses: Write it, Improve, tagging, image → prompt. Picking a model also picks its provider.',
    keywords: ['llm', 'chat', 'ollama', 'venice', 'qwen', 'uncensored', 'write it', 'improve'], Control: ModelCtl,
  },
  {
    id: 'ai.style', category: 'ai', group: 'Provider', label: 'Prompt style', compact: true,
    hint: 'Generic SDXL prose, or Illustrious / Danbooru tags.',
    keywords: ['sdxl', 'illustrious', 'danbooru', 'tags', 'pony', 'natural'], Control: StyleCtl,
  },
  {
    id: 'ai.veniceKey', category: 'ai', group: 'Venice', label: 'Venice API key',
    hint: 'Stays in this browser; calls go straight from this tab to Venice.',
    links: [{ text: 'Get one at venice.ai', href: 'https://venice.ai/settings/api' }],
    keywords: ['token', 'secret', 'credentials', 'cloud', 'password'], Control: VeniceKeyCtl,
  },
  {
    id: 'ai.veniceUrl', category: 'ai', group: 'Venice', label: 'Venice base URL',
    hint: 'Leave empty for Venice. Any OpenAI-compatible endpoint works.',
    keywords: ['endpoint', 'openai', 'compatible', 'api', 'server'], Control: VeniceUrlCtl,
  },
  {
    id: 'ai.where', category: 'ai', group: 'Local LLM', label: 'Where it runs', compact: true,
    hint: 'Home PC = the Ollama behind llm.blueoceanswim.com; This pod = the Ollama the pod starts itself.',
    keywords: ['ollama', 'home', 'pod', 'local', 'gpu', 'winold'], Control: WhereCtl,
  },
  {
    id: 'ai.localUrl', category: 'ai', group: 'Local LLM', label: 'Local LLM server',
    hint: 'Ollama root, no /v1.',
    keywords: ['ollama', 'url', 'host', 'endpoint', 'local', 'server'], Control: LocalUrlCtl,
  },
];
