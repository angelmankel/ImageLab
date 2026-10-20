/**
 * Settings → Themes, the pane (item 35; mockup agent-handoffs/fixlist-mockups/35-themes.html).
 * Desktop: the rows (registry, so search finds them) beside a sticky live preview. Phone: a slim
 * sticky colour band on top, then the rows. Everything applies to the whole app as you change it.
 */
import { useIsPhone } from '~/app/useIsPhone';
import { groupedRows, rowsOf } from '../registry';
import { RowGroup, SettingRow } from '../SettingRow';
import { PreviewStrip, ThemePreview } from './ThemePreview';

function Rows() {
  return (
    <>
      {groupedRows(rowsOf('themes')).map((g, gi) => (
        <RowGroup key={g.title ?? `_${gi}`} title={g.title}>
          {g.rows.map((r, i) => <SettingRow key={r.id} def={r} first={i === 0} />)}
        </RowGroup>
      ))}
    </>
  );
}

export function ThemesPane() {
  const phone = useIsPhone();
  if (phone) return <><PreviewStrip /><Rows /></>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: 28, alignItems: 'start' }}>
      <div style={{ minWidth: 0 }}><Rows /></div>
      <div style={{ position: 'sticky', top: 0 }}><ThemePreview /></div>
    </div>
  );
}
