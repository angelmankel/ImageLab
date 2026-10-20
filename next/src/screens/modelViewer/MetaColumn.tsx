/**
 * The metadata column (desktop: 420px at the right, scrolls; phone: the sections under the
 * strip): the titled sections in the brief's order — header · stats · version · trigger words ·
 * description · tags · this sample · actions — with a loading line while the full payload is on
 * its way, and the local-file section for `{ file }` targets. Never a blank page. `scrollRef`
 * (desktop, where it is the scroller) keeps its position per model (`useKeepScroll`).
 */
import type { CSSProperties } from 'react';
import { GhostBtn } from '~/screens/models/bits';
import type { ViewerData } from './useViewerModel';
import { SectionHeader } from './SectionHeader';
import { SectionVersion } from './SectionVersion';
import { SectionDescription, SectionTags, SectionWords } from './SectionWords';
import { SectionSample } from './SectionSample';
import { SectionActions } from './SectionActions';
import { SectionLocalFile } from './SectionLocalFile';

export function MetaColumn({ data, onVersion, phone, onClose, style, scrollRef }: { data: ViewerData; onVersion: (id: number) => void; phone: boolean; onClose: () => void; style?: CSSProperties; scrollRef?: (el: HTMLElement | null) => void }) {
  const { model, version, full, loading, error, retry, gallery, index, local } = data;
  const image = gallery.items[index];
  const line = (text: string, tone: 'muted' | 'err' = 'muted') => <div style={{ fontSize: 11, fontWeight: 700, color: tone === 'err' ? 'var(--il-err)' : 'var(--il-muted)', padding: '2px 0' }}>{text}</div>;

  return (
    <div ref={scrollRef} className="il-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: phone ? '12px 12px 96px' : 12, touchAction: 'pan-y', ...style }}>
      {local && <SectionLocalFile local={local} modelType={model?.type} />}
      {!model && !local && line(loading ? 'Loading the model…' : error ?? 'Nothing here')}
      {!model && local && local.state === 'found' && line(loading ? 'Loading the model…' : error ?? 'Could not load the model')}
      {error && model && !full && line(error, 'err')}
      {error && <GhostBtn h={28} onClick={retry} style={{ alignSelf: 'flex-start' }}>Try again</GhostBtn>}
      {model && (
        <>
          {!full && !error && line('Loading the full model…')}
          <SectionHeader model={model} full={full} />
          {version && <SectionVersion model={model} version={version} onVersion={onVersion} full={full} />}
          <SectionWords version={version} />
          <SectionDescription model={model} />
          <SectionTags model={model} />
          <SectionSample image={image} index={index} fromApi={gallery.fromApi} />
          <SectionActions model={model} version={version} phone={phone} onClose={onClose} />
        </>
      )}
    </div>
  );
}
