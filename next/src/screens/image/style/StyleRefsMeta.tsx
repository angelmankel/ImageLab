/**
 * The output's style references in the viewer's Details (metadata): each reference's thumbnail,
 * type / face method, strength, and the adapter file it ran with (`use`, set at queue time).
 */
import { FACE_INFO, TYPE_INFO, methodOf, type StyleRef } from '@/lib/styleRefs';

const short = (f: string) => f.replace(/^.*[\\/]/, '').replace(/\.(safetensors|bin|pth?)$/i, '');

export function StyleRefsMeta({ refs }: { refs: readonly StyleRef[] | undefined }) {
  const on = (refs ?? []).filter((r) => r.on && r.images.length);
  if (!on.length) return null;
  return (
    <section style={{ background: 'var(--il-card)', borderRadius: 14, padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, minHeight: 26 }}><span className="il-eyebrow" style={{ flex: 1 }}>Style references</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {on.map((r) => {
          const m = methodOf(r);
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 3, flex: 'none' }}>
                {r.images.slice(0, 3).map((im) => <img key={im.key} src={im.thumb} alt={im.name} title={im.name} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', background: 'var(--il-elev)' }} />)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--il-fg)' }}>
                  {TYPE_INFO[r.type].title}{m && m !== 'faceid' ? ` · ${FACE_INFO[m].title}` : m ? ' · FaceID v2' : ''}
                  <span style={{ color: 'var(--il-ember-hi)', marginLeft: 6 }}>{(Math.round(r.weight * 100) / 100).toString()}</span>
                </div>
                {r.use?.model && <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--il-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.use.model}>{short(r.use.model)}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
