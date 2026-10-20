/** A one-line grey note inside a step tab ("This workflow has no model slot"). */
export function Hint({ children }: { children: React.ReactNode }) {
  return <div style={{ background: 'var(--il-card)', borderRadius: 14, padding: '12px 14px', fontSize: 12, fontWeight: 600, color: 'var(--il-muted)', textAlign: 'center' }}>{children}</div>;
}
