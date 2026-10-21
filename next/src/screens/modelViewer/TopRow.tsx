/**
 * The viewer's top row (52px, its own row — rule 1): ✕ Close at the left, the model name with
 * its type · base badges in the centre, the NSFW eye (item 27: always show / cover), ★ favourite, Open on CivitAI ↗ and the "3 / 24" counter
 * at the right. On the phone the badges and the CivitAI link fold away; the counter stays.
 */
import { IconExternalLink, IconHeart, IconHeartFilled, IconX } from '@tabler/icons-react';
import type { CivitaiModel, CivitaiModelVersion } from '@/lib/civitai';
import { IconBtn } from '~/ui';
import { T } from '~/theme/tokens';
import { GhostBtn, Tag } from '~/screens/models/bits';
import { baseModelShort, typeLabel } from '~/screens/models/civitaiQuery';
import { civitaiModelLink } from '~/screens/models/civitaiApi';
import { useModels } from '~/screens/models/modelsStore';
import { NsfwToggle } from '~/screens/models/nsfwCover';

export function TopRow({ model, version, title, count, index, hasMore, phone, onClose }: {
  model: CivitaiModel | null; version: CivitaiModelVersion | undefined; title: string;
  count: number; index: number; hasMore: boolean; phone: boolean; onClose: () => void;
}) {
  const favourites = useModels((s) => s.favourites);
  const toggleFavourite = useModels((s) => s.toggleFavourite);
  const fav = !!model && favourites.includes(model.id);
  const counter = count > 0 ? `${index + 1} / ${count}${hasMore ? '+' : ''}` : '';

  return (
    <div style={{ height: T.size.toolbar, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', borderBottom: '1px solid var(--il-line)', background: 'var(--il-bg)', flex: 'none' }}>
      <IconBtn icon={<IconX size={18} stroke={2.2} />} label="Close" onClick={onClose} tooltip={false} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: phone ? 'flex-start' : 'center', gap: 8 }}>
        <span title={title} style={{ fontSize: phone ? 14 : 15, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
        {!phone && model && <Tag>{typeLabel(model.type)}</Tag>}
        {!phone && version?.baseModel && <Tag tone="ember">{baseModelShort(version.baseModel)}</Tag>}
      </div>
      <NsfwToggle variant="icon" />
      {model && (
        <IconBtn icon={fav ? <IconHeartFilled size={17} /> : <IconHeart size={17} stroke={2.2} />} label={fav ? 'Remove from favourites' : 'Add to favourites'} on={fav} onClick={() => toggleFavourite(model.id)} tooltip={false} />
      )}
      {!phone && model && <GhostBtn h={30} href={civitaiModelLink(model.id, version?.id)} label="Open on CivitAI">CivitAI<IconExternalLink size={13} stroke={2.2} /></GhostBtn>}
      {counter && <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--il-muted)', minWidth: 52, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{counter}</span>}
    </div>
  );
}
