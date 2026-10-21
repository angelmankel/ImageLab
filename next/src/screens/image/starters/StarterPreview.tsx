/**
 * Starters on the phone (mobile pass; mockup agent-handoffs/fixlist2-mockups/mobile-m-browse.html §4):
 * a tap shows the starter before using it — on desktop its prompt shows on hover, a touch has no
 * hover. The shared `BottomSheet` (`~/phone`): from the bottom in portrait, from the right in
 * landscape (the masonry stays visible beside it); pull to close. The picture, the whole prompt
 * (selectable), As input image · Copy · CivitAI ↗ (· Remove from Mine), and "Use this prompt"
 * pinned at the bottom, in thumb reach.
 */
import { IconCopy, IconExternalLink, IconPhotoUp, IconTrash } from '@tabler/icons-react';
import { civitaiThumbUrl } from '@/lib/civitai';
import { useMine } from '@/features/next/mineStore';
import { say } from '~/app/notify';
import { Button, LoadingImage } from '~/ui';
import { BottomSheet } from '~/phone';
import { T } from '~/theme/tokens';
import { civitaiSmallUrl } from '~/lib/civitaiSize';
import { setAsInput } from './applyStarter';
import type { StarterItem } from './StartersModal';

export function StarterPreview({ item, onClose, onUse }: { item: StarterItem | null; onClose: () => void; onUse: (it: StarterItem) => void }) {
  const img = item?.img;
  return (
    <BottomSheet opened={!!item} onClose={onClose} title={item?.name ?? 'Starter'} zIndex={T.z.modal + 10}
      footer={item && <Button tone="primary" size="lg" onClick={() => onUse(item)} style={{ width: '100%', height: 52, fontSize: 15 }}>Use this prompt</Button>}>
      {item && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {img && (
            <div style={{ borderRadius: 14, overflow: 'hidden', background: 'var(--il-bg-deep)', maxHeight: 420, display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: '100%', maxWidth: Math.round(420 * (img.width || 1) / (img.height || 1)) }}>
                <LoadingImage src={civitaiSmallUrl(img.url, 900)} thumb={civitaiSmallUrl(img.url, 32)} aspect={(img.width || 1) / (img.height || 1)} />
              </div>
            </div>
          )}
          <div>
            <div className="il-eyebrow" style={{ marginBottom: 4 }}>Prompt</div>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--il-fg2)', userSelect: 'text', overflowWrap: 'anywhere' }}>{item.prompt}</p>
            {item.use.negative && (
              <>
                <div className="il-eyebrow" style={{ margin: '10px 0 4px' }}>Negative</div>
                <p style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: 'var(--il-muted)', userSelect: 'text', overflowWrap: 'anywhere' }}>{item.use.negative}</p>
              </>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
            {img && <Button tone="card" size="lg" icon={<IconPhotoUp size={15} stroke={2.2} />} onClick={() => { void setAsInput(civitaiThumbUrl(img.url, 1280), `civitai-${item.key}.png`); onClose(); }}>Input</Button>}
            <Button tone="card" size="lg" icon={<IconCopy size={15} stroke={2.2} />} onClick={() => { void navigator.clipboard?.writeText(item.prompt).then(() => say('Copied')); }}>Copy</Button>
            {img && <Button tone="card" size="lg" icon={<IconExternalLink size={15} stroke={2.2} />} onClick={() => window.open(img.link, '_blank', 'noopener')}>CivitAI</Button>}
            {item.mineId && <Button tone="card" size="lg" icon={<IconTrash size={15} stroke={2.2} />} onClick={() => { useMine.getState().remove(item.mineId!); onClose(); }}>Remove</Button>}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
