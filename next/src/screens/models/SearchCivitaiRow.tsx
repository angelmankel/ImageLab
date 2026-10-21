/**
 * A Downloaded search with no hit (fix list 2, added item): one tap searches CivitAI for the same
 * words instead (the source switches; the search stays).
 */
import { IconSearch } from '@tabler/icons-react';
import { Button } from '~/ui';
import { useModels } from './modelsStore';

export function SearchCivitaiRow({ size = 'desktop' }: { size?: 'desktop' | 'phone' }) {
  const source = useModels((s) => s.source);
  const q = useModels((s) => s.filters.query.trim());
  const setSource = useModels((s) => s.setSource);
  if (source !== 'installed' || !q) return null;
  return (
    <Button tone="card" size={size === 'phone' ? 'lg' : 'sm'} icon={<IconSearch size={14} stroke={2.4} />} onClick={() => setSource('civitai')}>
      Search CivitAI for “{q}”
    </Button>
  );
}
