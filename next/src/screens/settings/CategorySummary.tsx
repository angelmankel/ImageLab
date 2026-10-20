/**
 * The one-line reading under each category on the phone's list ("2 servers · 1 online",
 * "Using Local · qwen3 · Illustrious tags"). One small component per category (each reads its own store);
 * the words come from settingsLogic.
 */
import { useStore } from '@/lib/store';
import { PREVIEW_SOURCES } from '@/lib/storage';
import { useSoundStore } from '@/lib/sounds';
import { useNext } from '@/features/next/nextStore';
import { aiStatusLine } from '@/lib/aiProviders';
import type { CategoryId } from './categories';
import { aiSummary, appearanceSummary, modelsSummary, serversSummary, soundsSummary } from './settingsLogic';
import { useServersUp } from './useServersUp';

function Servers() {
  const servers = useStore((s) => s.servers);
  const up = useServersUp(servers);
  const online = servers.filter((s) => s.enabled !== false && up[s.id]).length;
  return <>{serversSummary(servers.length, online)}</>;
}

function Ai() {
  const ai = useStore((s) => s.ai);
  return <>{aiSummary(aiStatusLine(ai), ai.promptStyle)}</>;
}

function Models() {
  const hasKey = useStore((s) => !!s.civitai.apiKey);
  const source = useStore((s) => s.modelPreviewSource);
  return <>{modelsSummary(hasKey, PREVIEW_SOURCES.find((p) => p.value === source)?.label ?? source)}</>;
}

function Appearance() {
  const tile = useStore((s) => s.collectionsTileSize);
  return <>{appearanceSummary(tile)}</>;
}

function Sounds() {
  const volume = useSoundStore((s) => s.volume);
  const muted = useSoundStore((s) => s.muted);
  return <>{muted ? 'Muted' : soundsSummary(volume)}</>;
}

function About() {
  const classic = useNext((s) => s.classic);
  return <>{classic ? 'Classic UI on its old workspace' : 'Classic UI, this app'}</>;
}

const SUMMARY: Record<CategoryId, () => JSX.Element> = { servers: Servers, ai: Ai, models: Models, appearance: Appearance, sounds: Sounds, about: About };

export function CategorySummary({ id }: { id: CategoryId }) {
  const S = SUMMARY[id];
  return <S />;
}
