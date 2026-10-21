/**
 * The "✦ Write it" button's status (fix list 2, "ADDED after close"): a spinner while the open
 * session's prompt studio is writing in the background, then a numbered badge with how many new
 * options wait unseen. Opening the studio clears it. Only this session's runs count.
 */
import { useSessions } from '~/app/sessionsStore';
import { Spinner } from '~/ui';
import { useStudioBadge } from './studioRuns';

export function WriteItBadge() {
  const sessionId = useSessions((s) => s.currentId) || 'app';
  const { running, fresh } = useStudioBadge(sessionId);
  if (running) return <Spinner size={12} style={{ marginLeft: 2 }} />;
  if (!fresh) return null;
  return (
    <span aria-label={`${fresh} new prompt option${fresh === 1 ? '' : 's'}`}
      style={{ marginLeft: 2, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: 'var(--il-ember)', color: 'var(--il-on-accent, var(--il-bg))', fontSize: 10, fontWeight: 800, display: 'inline-grid', placeItems: 'center', fontVariantNumeric: 'tabular-nums', boxSizing: 'border-box' }}>
      {fresh}
    </span>
  );
}
