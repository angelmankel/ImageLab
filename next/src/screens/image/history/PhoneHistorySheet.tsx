/**
 * Mobile pass (m-browse; mockup agent-handoffs/fixlist2-mockups/mobile-m-browse.html §2): the
 * session's history panel on the phone — the desktop's right panel (This step / All, Images ·
 * Videos · ★, ⋯ Clear history / Reset session, the Collections row with show / rename / delete /
 * new, paste into a shown collection) in the shared `BottomSheet` (`~/phone`: from the bottom in
 * portrait, from the right in landscape, pull to close). It was missing on the phone: the Output
 * page had only its results strip and a jump to the History page.
 *
 *   openPhoneHistory()   // e.g. the Output strip's "History ›" end tile
 *
 * A tap on a picture shows it (the sheet closes, the Output page shows it); a tap on the shown one
 * opens it full screen; a hold opens the Send-to sheet (collections, steps, inputs). Mounted once
 * in App on the phone.
 */
import { create } from 'zustand';
import { BottomSheet, haptic } from '~/phone';
import { useRoute } from '~/app/routeStore';
import { HistoryPanel } from '../HistoryPanel';

interface HistorySheetState { open: boolean }
const useHistorySheet = create<HistorySheetState>(() => ({ open: false }));

export function openPhoneHistory(): void { haptic(); useHistorySheet.setState({ open: true }); }
export function closePhoneHistory(): void { useHistorySheet.setState({ open: false }); }

export function PhoneHistorySheet() {
  const open = useHistorySheet((s) => s.open);
  const go = useRoute((s) => s.go);
  return (
    <BottomSheet opened={open} onClose={closePhoneHistory} title="History" size="full" bodyPadding={0} aria-label="History"
      headRight={(
        <button type="button" onClick={() => { closePhoneHistory(); go('library'); }}
          style={{ height: 40, padding: '0 10px', border: 0, background: 'transparent', color: 'var(--il-ember)', fontSize: 12, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          All history ›
        </button>
      )}>
      <HistoryPanel phone onPicked={closePhoneHistory} />
    </BottomSheet>
  );
}
