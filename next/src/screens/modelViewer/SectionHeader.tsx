/**
 * Section 1 — Header: the creator (avatar, username, Follow) and the licence / permission chips
 * (commercial, rent, sell, credit, derivatives, real person, NSFW, early access): the same facts
 * the Models detail shows, laid out as one wrapping chip row. Section 2 — Stats — sits right
 * under it: downloads · likes · dislikes · comments · rating (`Stats` from bits, plus dislikes).
 */
import { IconCheck, IconThumbDown, IconX } from '@tabler/icons-react';
import type { CivitaiModel } from '@/lib/civitai';
import { Avatar, GhostBtn, Stats, Tag } from '~/screens/models/bits';
import { fmtCount, isEarlyAccess } from '~/screens/models/civitaiQuery';
import { useModels } from '~/screens/models/modelsStore';
import { licenceChips } from './modelViewerLogic';
import { Section } from './metaBits';

export function SectionHeader({ model, full }: { model: CivitaiModel; full: boolean }) {
  const followed = useModels((s) => s.followed);
  const toggleFollow = useModels((s) => s.toggleFollow);
  const creator = model.creator?.username ?? '';
  const isFollowed = !!creator && followed.includes(creator);
  const chips = licenceChips(model, isEarlyAccess(model));

  return (
    <>
      <Section title="Creator">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar creator={model.creator} size={24} />
          <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: 'var(--il-fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{creator || (full ? 'unknown creator' : '…')}</span>
          {creator && <GhostBtn h={26} onClick={() => toggleFollow(creator)} style={isFollowed ? { borderColor: 'var(--il-ember-line)', color: 'var(--il-ember-hi)' } : undefined}>{isFollowed ? 'Following' : 'Follow'}</GhostBtn>}
        </div>
        {full && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {chips.map((c) => (
              <Tag key={c.label} tone={c.tone === 'ember' ? 'emberLine' : 'muted'} outlined>
                {c.label}
                {c.ok === true && <IconCheck size={10} stroke={3.5} color="var(--il-ok)" />}
                {c.ok === false && <IconX size={10} stroke={3} color="var(--il-dim)" />}
              </Tag>
            ))}
          </div>
        )}
      </Section>
      <Section title="Stats">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Stats stats={model.stats} full gap={10} />
          {model.stats?.thumbsDownCount != null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: 'var(--il-muted)' }}><IconThumbDown size={12} stroke={2.2} />{fmtCount(model.stats.thumbsDownCount)}</span>
          )}
        </div>
      </Section>
    </>
  );
}
