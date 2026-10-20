/**
 * Phone 2 of the Models-Phone board: the Filters sheet. A bottom drawer (glass, 24px top radius,
 * handle) with every filter (`FilterFields`), "Clear all" on top and "Show N models" pinned at the
 * bottom. The body scrolls on its own with `touch-action: pan-y`.
 */
import { Drawer } from '@mantine/core';
import { T } from '~/theme/tokens';
import { useModels } from './modelsStore';
import { FilterFields } from './FilterFields';
import { EmberBtn } from './bits';

export function PhoneFilters({ count }: { count: number }) {
  const open = useModels((s) => s.sheetOpen);
  const setOpen = useModels((s) => s.setSheetOpen);
  const f = useModels((s) => s.filters);
  const set = useModels((s) => s.setFilters);
  const clearAll = useModels((s) => s.clearAll);
  const loading = useModels((s) => s.loading);

  return (
    <Drawer
      opened={open}
      onClose={() => setOpen(false)}
      position="bottom"
      size="92%"
      withCloseButton={false}
      zIndex={T.z.sheet}
      overlayProps={{ backgroundOpacity: 0.6, blur: 0 }}
      styles={{
        content: { background: 'rgba(28,28,33,.94)', backdropFilter: T.blur, WebkitBackdropFilter: T.blur, borderRadius: '24px 24px 0 0', borderTop: '1px solid rgba(255,255,255,.08)', boxShadow: '0 -10px 30px rgba(0,0,0,.35)', display: 'flex', flexDirection: 'column' },
        body: { padding: 0, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%' },
      }}
    >
      <div aria-hidden style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--il-dim)', margin: '8px auto 0', flex: 'none' }} />
      <div style={{ height: 44, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
        <span style={{ fontSize: 16, fontWeight: 800 }}>Filters</span>
        <button type="button" onClick={clearAll} style={{ border: 0, background: 'transparent', color: 'var(--il-ember)', fontSize: 12, fontWeight: 700, padding: 0, cursor: 'pointer' }}>Clear all</button>
      </div>
      <div className="il-scroll" style={{ flex: 1, minHeight: 0, padding: '0 16px 8px', touchAction: 'pan-y' }}>
        <FilterFields f={f} set={set} size="phone" />
      </div>
      <div style={{ flex: 'none', padding: `8px 16px calc(12px + var(--il-safe-bottom))` }}>
        <EmberBtn size="phone" h={48} style={{ width: '100%', fontSize: 14, borderRadius: 14 }} onClick={() => setOpen(false)}>
          {loading ? 'Searching…' : `Show ${count} models`}
        </EmberBtn>
      </div>
    </Drawer>
  );
}
