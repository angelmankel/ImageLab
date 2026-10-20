// The AI helper's providers (src/lib/aiProviders.ts): the catalogue, the old single-provider save
// migrated once, readiness of the active provider, model lists filtered per provider, and the
// request each adapter sends. No real key anywhere here.
const { test } = require('node:test');
const assert = require('node:assert/strict');
// Objects made inside the vm realm have another Object prototype: compare them loosely.
const { deepEqual } = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
function load(name) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../src/lib', name + '.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports });
  return exports;
}
const P = load('aiProviders');

const entry = (id, extra = {}) => ({ ...P.newProviderEntry(id), ...extra });
const settings = (active, providers, extra = {}) => ({ ...P.defaultAiSettings(), active, providers, ...extra });

test('catalogue: eleven providers, Local first, https roots, known adapters', () => {
  assert.equal(P.AI_PROVIDERS.length, 11);
  assert.equal(P.AI_PROVIDERS[0].id, 'local');
  deepEqual([...new Set(P.AI_PROVIDER_IDS)].length, 11);
  for (const p of P.AI_PROVIDERS) {
    assert.match(p.baseUrl, /^https:\/\//, p.id);
    assert.ok(['openai', 'anthropic', 'ollama'].includes(p.adapter), p.id);
    assert.ok(p.note.length > 10, p.id);
    if (p.id !== 'local') assert.ok(p.keyUrl, p.id);
  }
  assert.equal(P.providerSpec('anthropic').adapter, 'anthropic');
  assert.equal(P.providerSpec('local').adapter, 'ollama');
  assert.equal(P.providerSpec('nope').id, 'local');
  assert.ok(P.isProviderId('xai'));
  assert.ok(!P.isProviderId('azure'));
  assert.ok(!P.isProviderId(3));
});

test('defaults: Local only, active', () => {
  const d = P.defaultAiSettings();
  assert.equal(d.active, 'local');
  deepEqual(d.providers.map((p) => p.id), ['local']);
  assert.equal(d.providers[0].baseUrl, 'https://llm.blueoceanswim.com');
  assert.equal(d.promptStyle, 'sdxl');
  assert.equal(P.newProviderEntry('openai').baseUrl, 'https://api.openai.com/v1');
  assert.equal(P.newProviderEntry('openai').tested, false);
});

test('migration: a Venice key becomes a tested Venice entry, Local keeps its models, active follows the old provider', () => {
  const old = { apiKey: 'vn-old', model: 'venice-uncensored-1-2', baseUrl: '', promptStyle: 'illustrious', provider: 'venice',
    localBaseUrl: 'https://llm.blueoceanswim.com', localModel: 'qwen3:8b', localVisionModel: 'gemma3:4b', localVramGb: 20 };
  const s = P.migrateVeniceSettings(old);
  deepEqual(s.providers.map((p) => p.id), ['local', 'venice']);
  assert.equal(s.active, 'venice');
  const v = P.providerEntry(s, 'venice');
  assert.equal(v.apiKey, 'vn-old');
  assert.equal(v.model, 'venice-uncensored-1-2');
  assert.equal(v.baseUrl, 'https://api.venice.ai/api/v1');
  assert.equal(v.tested, true);
  const l = P.providerEntry(s, 'local');
  assert.equal(l.model, 'qwen3:8b');
  assert.equal(l.visionModel, 'gemma3:4b');
  assert.equal(l.tested, true);
  assert.equal(s.promptStyle, 'illustrious');
  assert.equal(s.localVramGb, 20);
  assert.ok(P.aiReady(s));
});

test('migration: provider local stays local; no key = no Venice entry; a custom Venice URL is kept', () => {
  const local = P.migrateVeniceSettings({ apiKey: 'vn-x', provider: 'local', localModel: 'qwen3:8b' });
  assert.equal(local.active, 'local');
  assert.equal(local.providers.length, 2);
  const none = P.migrateVeniceSettings({ apiKey: '', model: 'x', provider: 'venice', localModel: '' });
  deepEqual(none.providers.map((p) => p.id), ['local']);
  assert.equal(none.active, 'local');
  assert.equal(none.providers[0].tested, false);
  assert.ok(!P.aiReady(none));
  const custom = P.migrateVeniceSettings({ apiKey: 'vn-x', baseUrl: 'https://proxy.example/v1/', model: '' });
  assert.equal(P.providerEntry(custom, 'venice').baseUrl, 'https://proxy.example/v1/');
  assert.equal(P.providerEntry(custom, 'venice').model, 'venice-uncensored');
  deepEqual(P.migrateVeniceSettings(null), P.defaultAiSettings());
  assert.equal(P.migrateVeniceSettings({ localVramGb: 0 }).localVramGb, 20);
});

test('normalize: Local added and first, unknown providers dropped, fields typed, active checked', () => {
  const s = P.normalizeAiSettings({ active: 'openai', providers: [{ id: 'openai', apiKey: 'k', model: 'gpt-4.1', tested: 'yes' }, { id: 'azure' }, { id: 'local', model: 5 }, { id: 'openai' }], promptStyle: 'nope', localVramGb: -1 });
  deepEqual(s.providers.map((p) => p.id), ['local', 'openai']);
  assert.equal(s.active, 'openai');
  assert.equal(s.providers[1].tested, false);
  assert.equal(s.providers[1].visionModel, '');
  assert.equal(s.providers[1].baseUrl, 'https://api.openai.com/v1');
  assert.equal(s.providers[0].model, '');
  assert.equal(s.promptStyle, 'sdxl');
  assert.equal(s.localVramGb, 20);
  assert.equal(P.normalizeAiSettings({ active: 'groq', providers: [] }).active, 'local');
  deepEqual(P.normalizeAiSettings('junk'), P.defaultAiSettings());
  deepEqual(P.normalizeAiSettings(null), P.defaultAiSettings());
});

test('patchProvider: a new key or URL drops tested; a model change keeps it; the Test button sets it', () => {
  const e = entry('openai', { apiKey: 'a', tested: true, model: 'gpt-4.1' });
  assert.equal(P.patchProvider(e, { apiKey: 'b' }).tested, false);
  assert.equal(P.patchProvider(e, { apiKey: 'a' }).tested, true);
  assert.equal(P.patchProvider(e, { baseUrl: 'https://x' }).tested, false);
  assert.equal(P.patchProvider(e, { model: 'o3' }).tested, true);
  assert.equal(P.patchProvider(e, { apiKey: 'b', tested: true }).tested, true);
  assert.equal(P.patchProvider(entry('openai'), { tested: true }).tested, true);
});

test('add / remove / activate: no duplicates, Local stays, removing the active one falls back to Local', () => {
  let s = P.addProvider(P.defaultAiSettings(), 'groq');
  s = P.addProvider(s, 'groq');
  deepEqual(s.providers.map((p) => p.id), ['local', 'groq']);
  deepEqual(P.addableProviders(s).map((p) => p.id), ['openrouter', 'openai', 'anthropic', 'deepseek', 'gemini', 'mistral', 'xai', 'together', 'venice']);
  s = P.setActiveProvider(s, 'groq');
  assert.equal(s.active, 'groq');
  assert.equal(P.setActiveProvider(s, 'xai').active, 'groq');
  assert.equal(P.removeProvider(s, 'local'), s);
  const r = P.removeProvider(s, 'groq');
  deepEqual(r.providers.map((p) => p.id), ['local']);
  assert.equal(r.active, 'local');
  s = P.updateProvider(s, 'groq', { apiKey: 'k', tested: true });
  assert.equal(P.providerEntry(s, 'groq').tested, true);
  assert.equal(P.updateProvider(s, 'groq', { apiKey: 'k2' }).providers[1].tested, false);
});

test('ready: a key provider needs key + tested + model; Local needs tested + model; hints say what is missing', () => {
  const s = settings('openrouter', [entry('local'), entry('openrouter')]);
  assert.ok(!P.aiReady(s));
  assert.equal(P.aiNotReadyHint(s), 'Enter the OpenRouter key in Settings → AI helper');
  const keyed = P.updateProvider(s, 'openrouter', { apiKey: 'k' });
  assert.match(P.aiNotReadyHint(keyed), /^Test the OpenRouter key/);
  const tested = P.updateProvider(keyed, 'openrouter', { tested: true });
  assert.match(P.aiNotReadyHint(tested), /^Pick a model for OpenRouter/);
  const done = P.updateProvider(tested, 'openrouter', { model: 'anthropic/claude-sonnet-4' });
  assert.ok(P.aiReady(done));
  assert.equal(P.aiStatusLine(done), 'Using OpenRouter · claude-sonnet-4');
  assert.equal(P.aiStatusLine(s), 'OpenRouter · not set up');
  assert.equal(P.aiSourceLabel(done), 'OpenRouter');
  const local = settings('local', [entry('local', { model: 'hf.co/bartowski/x-GGUF:Q6_K' })]);
  assert.ok(!P.aiReady(local));
  assert.match(P.aiNotReadyHint(local), /^Check the local server/);
  const localOk = P.updateProvider(local, 'local', { tested: true });
  assert.ok(P.aiReady(localOk));
  assert.equal(P.aiSourceLabel(localOk), 'x · Q6_K');
  assert.equal(P.aiStatusLine(localOk), 'Using Local · x · Q6_K');
  assert.match(P.aiNotReadyHint(P.updateProvider(localOk, 'local', { model: '' })), /^Pick a local model/);
  // An active id that is not in the list falls back to Local.
  assert.equal(P.activeEntry({ ...done, active: 'xai' }).id, 'local');
});

test('key state dots', () => {
  assert.equal(P.keyState(entry('openai')), 'none');
  assert.equal(P.keyState(entry('openai', { apiKey: 'k' })), 'pending');
  assert.equal(P.keyState(entry('openai', { apiKey: 'k', tested: true })), 'ok');
  assert.equal(P.keyState(entry('local')), 'pending');
  assert.equal(P.keyState(entry('local', { tested: true })), 'ok');
});

test('chat and vision models of the active provider, with one-off overrides', () => {
  const s = settings('mistral', [entry('local', { model: 'l', visionModel: 'lv' }), entry('mistral', { model: 'm', visionModel: '' })]);
  assert.equal(P.chatModelOf(s), 'm');
  assert.equal(P.visionModelOf(s), 'm');
  assert.equal(P.visionModelOf({ ...s, active: 'local' }), 'lv');
  assert.equal(P.chatModelOf(P.withChatModel(s, 'm2')), 'm2');
  assert.equal(P.visionModelOf(P.withVisionModel(s, 'pixtral')), 'pixtral');
  assert.equal(P.providerEntry(P.withVisionModel(s, 'pixtral'), 'local').visionModel, 'lv');
  assert.equal(P.withChatModel(s, ''), s);
});

test('shortModelName and resolveBaseUrl', () => {
  assert.equal(P.shortModelName('hf.co/bartowski/x-GGUF:Q6_K'), 'x · Q6_K');
  assert.equal(P.shortModelName('huihui_ai/qwen3-abliterated:8b'), 'qwen3-abliterated · 8b');
  assert.equal(P.shortModelName('models/gemini-2.5-pro'), 'gemini-2.5-pro');
  assert.equal(P.shortModelName('anthropic/claude-sonnet-4'), 'claude-sonnet-4');
  assert.equal(P.shortModelName('llama3:latest'), 'llama3');
  assert.equal(P.resolveBaseUrl(entry('openai', { baseUrl: 'https://proxy.example/v1/' })), 'https://proxy.example/v1');
  assert.equal(P.resolveBaseUrl(entry('openai', { baseUrl: '  ' })), 'https://api.openai.com/v1');
  assert.equal(P.resolveBaseUrl(entry('local', { baseUrl: 'http://box:11434/v1' })), 'http://box:11434');
});

test('parseModels: Venice text models, offline and image dropped, uncensored first', () => {
  const list = P.parseModels('venice', { data: [
    { id: 'zeta', type: 'text', model_spec: { name: 'Zeta', capabilities: { supportsVision: true }, pricing: { input: { usd: 0.5 } } } },
    { id: 'venice-uncensored-1-2', type: 'text', model_spec: { name: 'Venice Uncensored 1.2', traits: ['most_uncensored'] } },
    { id: 'gone', type: 'text', model_spec: { name: 'Gone', offline: true } },
    { id: 'img', type: 'image', model_spec: { name: 'Image' } },
    { id: 'alpha', type: 'text' },
    { type: 'text' },
  ] });
  deepEqual(list.map((m) => m.id), ['venice-uncensored-1-2', 'alpha', 'zeta']);
  assert.equal(list[2].vision, true);
  assert.equal(list[2].note, '$0.5/M');
  assert.equal(list[0].note, 'uncensored');
  assert.equal(P.aiModelLabel(list[2]), 'Zeta · vision · $0.5/M');
  assert.equal(P.parseModels('venice', null).length, 0);
});

test('parseModels: OpenRouter by modalities, OpenAI by name, Anthropic all, DeepSeek all', () => {
  const or = P.parseModels('openrouter', { data: [
    { id: 'anthropic/claude-sonnet-4', name: 'Anthropic: Claude Sonnet 4', architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] }, pricing: { prompt: '0.000003' } },
    { id: 'openai/dall-e', name: 'DALL-E', architecture: { input_modalities: ['text'], output_modalities: ['image'] } },
    { id: 'meta/llama-3-free', name: 'Llama 3 (free)', architecture: { modality: 'text->text' }, pricing: { prompt: '0' } },
  ] });
  deepEqual(or.map((m) => m.id), ['anthropic/claude-sonnet-4', 'meta/llama-3-free']);
  assert.equal(or[0].vision, true);
  assert.equal(or[0].note, '$3/M');
  assert.equal(or[1].vision, false);
  assert.equal(or[1].note, 'free');

  const oa = P.parseModels('openai', { data: ['gpt-4.1', 'gpt-4o-mini', 'o3-mini', 'o4-mini', 'gpt-5', 'whisper-1', 'gpt-4o-realtime-preview', 'text-embedding-3-small', 'dall-e-3', 'gpt-image-1', 'gpt-3.5-turbo-instruct', 'gpt-5-codex', 'chatgpt-4o-latest'].map((id) => ({ id, object: 'model' })) });
  deepEqual(oa.map((m) => m.id), ['chatgpt-4o-latest', 'gpt-4.1', 'gpt-4o-mini', 'gpt-5', 'o3-mini', 'o4-mini']);
  assert.equal(oa.find((m) => m.id === 'o3-mini').vision, false);
  assert.equal(oa.find((m) => m.id === 'o4-mini').vision, true);
  assert.equal(oa.find((m) => m.id === 'gpt-4.1').vision, true);

  const an = P.parseModels('anthropic', { data: [{ id: 'claude-sonnet-4-5', display_name: 'Claude Sonnet 4.5', type: 'model' }, { id: 'claude-opus-4-1', display_name: 'Claude Opus 4.1', type: 'model' }], has_more: false });
  deepEqual(an.map((m) => m.name), ['Claude Opus 4.1', 'Claude Sonnet 4.5']);
  assert.ok(an.every((m) => m.vision));

  const ds = P.parseModels('deepseek', { data: [{ id: 'deepseek-chat' }, { id: 'deepseek-reasoner' }] });
  deepEqual(ds.map((m) => m.id), ['deepseek-chat', 'deepseek-reasoner']);
  assert.ok(ds.every((m) => !m.vision));
});

test('parseModels: Gemini ids lose models/, Groq drops speech, Mistral by capabilities, xAI drops image, Together by type, Ollama tags', () => {
  const ge = P.parseModels('gemini', { data: [{ id: 'models/gemini-2.5-pro' }, { id: 'models/gemini-embedding-001' }, { id: 'models/imagen-4.0' }, { id: 'models/gemma-3-27b-it' }, { id: 'models/gemini-2.5-flash-preview-tts' }] });
  deepEqual(ge.map((m) => m.id), ['gemini-2.5-pro', 'gemma-3-27b-it']);
  assert.equal(ge[0].vision, true);

  const gr = P.parseModels('groq', { data: [{ id: 'llama-3.3-70b-versatile', active: true }, { id: 'whisper-large-v3', active: true }, { id: 'meta-llama/llama-4-scout-17b', active: true }, { id: 'llama-guard-4-12b', active: true }, { id: 'old-model', active: false }] });
  deepEqual(gr.map((m) => m.id), ['llama-3.3-70b-versatile', 'meta-llama/llama-4-scout-17b']);
  assert.equal(gr[1].vision, true);

  const mi = P.parseModels('mistral', { data: [{ id: 'mistral-small-latest', name: 'mistral-small-latest', capabilities: { completion_chat: true, vision: true } }, { id: 'mistral-embed', capabilities: { completion_chat: false } }, { id: 'codestral-latest', capabilities: { completion_chat: true } }] });
  deepEqual(mi.map((m) => m.id), ['codestral-latest', 'mistral-small-latest']);
  assert.equal(mi[1].vision, true);
  assert.equal(mi[0].vision, false);

  const x = P.parseModels('xai', { data: [{ id: 'grok-4-0709' }, { id: 'grok-2-image-1212' }, { id: 'grok-3-mini' }] });
  deepEqual(x.map((m) => m.id), ['grok-3-mini', 'grok-4-0709']);
  assert.equal(x[1].vision, true);

  const tg = P.parseModels('together', [{ id: 'meta-llama/Llama-4-Scout', type: 'chat', display_name: 'Llama 4 Scout' }, { id: 'black-forest-labs/FLUX.1', type: 'image' }, { id: 'Qwen/Qwen2.5-VL-72B', type: 'chat' }]);
  deepEqual(tg.map((m) => m.id), ['meta-llama/Llama-4-Scout', 'Qwen/Qwen2.5-VL-72B']);
  assert.equal(tg[0].name, 'Llama 4 Scout');
  assert.ok(tg.every((m) => m.vision));

  const lo = P.parseModels('local', { models: [{ name: 'qwen3:8b', size: 1 }, { name: 'hf.co/bartowski/x-GGUF:Q6_K' }] });
  deepEqual(lo.map((m) => m.name), ['qwen3 · 8b', 'x · Q6_K']);
  deepEqual(P.visionModels(tg).length, 2);
});

test('modelsRequest: the list URL and auth per adapter', () => {
  const oa = P.modelsRequest(entry('openai', { apiKey: 'sk-test' }));
  assert.equal(oa.url, 'https://api.openai.com/v1/models');
  assert.equal(oa.headers.Authorization, 'Bearer sk-test');
  const an = P.modelsRequest(entry('anthropic', { apiKey: 'sk-ant-test' }));
  assert.equal(an.url, 'https://api.anthropic.com/v1/models');
  assert.equal(an.headers['x-api-key'], 'sk-ant-test');
  assert.equal(an.headers['anthropic-version'], '2023-06-01');
  assert.equal(an.headers['anthropic-dangerous-direct-browser-access'], 'true');
  assert.equal(an.headers.Authorization, undefined);
  const ve = P.modelsRequest(entry('venice'));
  assert.equal(ve.url, 'https://api.venice.ai/api/v1/models?type=text');
  const lo = P.modelsRequest(entry('local', { baseUrl: 'https://llm.blueoceanswim.com/' }));
  assert.equal(lo.url, 'https://llm.blueoceanswim.com/api/tags');
  deepEqual(lo.headers, {});
  assert.equal(P.modelsRequest(entry('gemini')).url, 'https://generativelanguage.googleapis.com/v1beta/openai/models');
  assert.equal(P.modelsRequest(entry('groq')).url, 'https://api.groq.com/openai/v1/models');
});

const REQ = { model: 'm', messages: [{ role: 'system', content: 'be brief' }, { role: 'user', content: 'hi' }], temperature: 0.7, maxTokens: 100 };

test('chatRequest: the OpenAI shape, with each provider\'s quirks', () => {
  const plain = P.chatRequest(entry('groq', { apiKey: 'gsk_test' }), REQ);
  assert.equal(plain.url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(plain.headers.Authorization, 'Bearer gsk_test');
  assert.equal(plain.headers['Content-Type'], 'application/json');
  deepEqual(plain.body, { model: 'm', messages: REQ.messages, temperature: 0.7, max_tokens: 100 });

  const ve = P.chatRequest(entry('venice', { apiKey: 'vn-test' }), { ...REQ, noThinking: true });
  deepEqual(ve.body.venice_parameters, { enable_web_search: 'off', include_venice_system_prompt: false, disable_thinking: true, strip_thinking_response: true });
  deepEqual(P.chatRequest(entry('venice'), REQ).body.venice_parameters, { enable_web_search: 'off', include_venice_system_prompt: false });

  const lo = P.chatRequest(entry('local', { baseUrl: 'https://llm.blueoceanswim.com' }), REQ);
  assert.equal(lo.url, 'https://llm.blueoceanswim.com/v1/chat/completions');
  assert.equal(lo.body.reasoning_effort, 'none');
  assert.equal(lo.headers.Authorization, undefined);

  const o3 = P.chatRequest(entry('openai', { apiKey: 'sk-test' }), { ...REQ, model: 'o3-mini' });
  assert.equal(o3.body.max_completion_tokens, 100);
  assert.equal(o3.body.max_tokens, undefined);
  assert.equal(o3.body.temperature, undefined);
  const g5 = P.chatRequest(entry('openai', { apiKey: 'sk-test' }), { ...REQ, model: 'gpt-5-mini' });
  assert.equal(g5.body.max_completion_tokens, 100);
  const g41 = P.chatRequest(entry('openai', { apiKey: 'sk-test' }), { ...REQ, model: 'gpt-4.1' });
  assert.equal(g41.body.max_tokens, 100);
  assert.equal(g41.body.temperature, 0.7);

  const or = P.chatRequest(entry('openrouter', { apiKey: 'sk-or-test' }), { ...REQ, noThinking: true });
  assert.equal(or.headers['X-Title'], 'ImageLab');
  deepEqual(or.body.reasoning, { enabled: false });
  assert.equal(P.chatRequest(entry('openrouter'), REQ).body.reasoning, undefined);
});

test('chatRequest: the Anthropic Messages shape — system apart, images as base64 or url blocks', () => {
  const r = P.chatRequest(entry('anthropic', { apiKey: 'sk-ant-test' }), {
    ...REQ,
    messages: [
      { role: 'system', content: 'tag it' },
      { role: 'user', content: [{ type: 'text', text: 'Tag this.' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } }, { type: 'image_url', image_url: { url: 'https://x/y.jpg' } }] },
    ],
  });
  assert.equal(r.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(r.headers['x-api-key'], 'sk-ant-test');
  assert.equal(r.headers['anthropic-dangerous-direct-browser-access'], 'true');
  assert.equal(r.headers['anthropic-version'], '2023-06-01');
  deepEqual(r.body, {
    model: 'm', max_tokens: 100, temperature: 0.7, system: 'tag it',
    messages: [{ role: 'user', content: [
      { type: 'text', text: 'Tag this.' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } },
      { type: 'image', source: { type: 'url', url: 'https://x/y.jpg' } },
    ] }],
  });
  const plain = P.chatRequest(entry('anthropic'), { ...REQ, messages: [{ role: 'user', content: 'hi' }] });
  assert.equal(plain.body.system, undefined);
  deepEqual(plain.body.messages, [{ role: 'user', content: 'hi' }]);
  deepEqual(P.splitDataUrl('data:image/jpeg;base64,/9j/4AAQ'), { mediaType: 'image/jpeg', data: '/9j/4AAQ' });
  assert.equal(P.splitDataUrl('https://x/y.png'), null);
});

test('parseChatReply: text and errors per adapter', () => {
  deepEqual(P.parseChatReply('openai', { choices: [{ message: { content: ' hello ' } }] }), { text: 'hello', error: '' });
  deepEqual(P.parseChatReply('openai', { choices: [{ message: { content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] } }] }), { text: 'ab', error: '' });
  deepEqual(P.parseChatReply('openai', { error: { message: 'bad key' } }), { text: '', error: 'bad key' });
  deepEqual(P.parseChatReply('openai', { error: 'nope' }), { text: '', error: 'nope' });
  deepEqual(P.parseChatReply('ollama', { choices: [{ message: { content: 'x' } }] }), { text: 'x', error: '' });
  deepEqual(P.parseChatReply('anthropic', { content: [{ type: 'thinking', thinking: '…' }, { type: 'text', text: 'tags' }] }), { text: 'tags', error: '' });
  deepEqual(P.parseChatReply('anthropic', { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }), { text: '', error: 'invalid x-api-key' });
  deepEqual(P.parseChatReply('openai', null), { text: '', error: '' });
});
