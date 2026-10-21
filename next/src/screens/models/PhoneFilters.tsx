/**
 * Phone 2 of the Models-Phone board: the Filters sheet — the shared phone `BottomSheet`
 * (`~/phone`, mobile pass: from the bottom in portrait, from the right in landscape, pull to
 * close) with every filter (`FilterFields`), "Clear all" in the head row and "Show N models"
 * pinned at the bottom.
 */
import { T } from '~/theme/tokens';
import { BottomSheet } from '~/phone';
import type { CivitaiModel } from '@/lib/civitai';
import { useModels } from './modelsStore';
import { FilterFields } from './FilterFields';
import { EmberBtn } from './bits';

export function PhoneFilters({ count, pool }: { count: number; pool: CivitaiModel[] }) {
  const kind = useModels((s) => s.kind);
  const open = useModels((s) => s.sheetOpen);
  const setOpen = useModels((s) => s.setSheetOpen);
  const f = useModels((s) => s.filters);
  const set = useModels((s) => s.setFilters);
  const clearAll = useModels((s) => s.clearAll);
  const loading = useModels((s) => s.loading);

  return (
    <BottomSheet opened={open} onClose={() => setOpen(false)} title="Filters" size="full" zIndex={T.z.modal + 10} bodyPadding="0 16px 8px"
      headRight={<button type="button" onClick={clearAll} style={{ height: 40, border: 0, background: 'transparent', color: 'var(--il-ember)', fontSize: 12, fontWeight: 700, padding: '0 6px', cursor: 'pointer' }}>Clear all</button>}
      footer={(
        <EmberBtn size="phone" h={48} style={{ width: '100%', fontSize: 14, borderRadius: 14 }} onClick={() => setOpen(false)}>
          {loading ? 'Searching…' : `Show ${count} models`}
        </EmberBtn>
      )}>
      <FilterFields f={f} set={set} size="phone" lockedKind={kind} pool={pool} />
    </BottomSheet>
  );
}
