/**
 * "Hashing models 140 / 146" (ImageLabCore 825f446): one quiet line in the Models browser while
 * any server's node is still hashing its files — until then those files show "Hashing…", not their
 * CivitAI metadata. Nothing on older nodes or once every file is hashed.
 */
import { Spinner } from '~/ui';
import { useHashProgress } from '~/screens/image/model/useHashState';

export function HashProgressLine({ style }: { style?: React.CSSProperties }) {
  const p = useHashProgress();
  if (!p || p.pending <= 0) return null;
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, color: 'var(--il-muted)', padding: '4px 2px', ...style }}>
      <Spinner size={13} />
      <span>Hashing models {p.hashed} / {p.total}</span>
      <span style={{ color: 'var(--il-dim)', fontWeight: 600 }}>· new files show their details once hashed</span>
    </div>
  );
}
