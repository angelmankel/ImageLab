/** Library (rule 12): All · Images · Videos · ★ on the shared `ui/Tabs`. */
import { Tabs } from '~/ui';
import { useLibrary } from './libraryStore';
import type { Kind } from './libraryLogic';

const ITEMS: Array<{ key: Kind; label: string; title?: string }> = [
  { key: 'all', label: 'All' },
  { key: 'image', label: 'Images' },
  { key: 'video', label: 'Videos' },
  { key: 'fav', label: '★', title: 'Favourites only' },
];

export function KindTabs({ fill }: { fill?: boolean }) {
  const kind = useLibrary((s) => s.kind);
  const setKind = useLibrary((s) => s.setKind);
  return <Tabs items={ITEMS} value={kind} onChange={setKind} fill={!!fill} />;
}
