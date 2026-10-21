/**
 * The model viewer's info panel (desktop: 420px at the right, scrolls; phone: under the strip),
 * re-organised for fix list 2 item 29 — a clear hierarchy instead of equal-weight boxes:
 *
 *   1. what you use: name · type · creator, base / installed chips, the version picker, ONE
 *      primary action (Use in step / Download)                                   PanelHead
 *   2. trigger words (tap to copy) and Recommended settings with Apply           SectionWords / RecommendedRow
 *   3. a short About (3 lines, more)                                             SectionDescription
 *   4. this picture: prompt, key facts, Use prompt / Use settings                SectionSample
 *   5. folded, one quiet line each: Details · Files & hashes · On this server ·
 *      Creator & licence · Tags                                                  PanelFolds
 *
 * A loading line while the full payload is on its way; never a blank page. A file CivitAI does
 * not know shows its local facts open. `scrollRef` keeps the scroll per model (`useKeepScroll`).
 */
import { useMemo, type CSSProperties } from 'react';
import { GhostBtn } from '~/screens/models/bits';
import { recommendFrom, hasRecommended } from '~/screens/image/model/cardFacts';
import { RecommendedRow } from '~/screens/image/model/RecommendedRow';
import type { ViewerData } from './useViewerModel';
import { PanelHead } from './PanelHead';
import { SectionDescription, SectionWords } from './SectionWords';
import { SectionSample } from './SectionSample';
import { FoldCreator, FoldDetails, FoldFiles, FoldLocal, FoldTags } from './PanelFolds';
import { Line, Section } from './metaBits';

export function MetaColumn({ data, onVersion, phone, onClose, onOpen, style, scrollRef }: {
  data: ViewerData; onVersion: (id: number) => void; phone: boolean; onClose: () => void;
  /** Full screen on the shown picture (item 31). */
  onOpen?: () => void;
  style?: CSSProperties; scrollRef?: (el: HTMLElement | null) => void;
}) {
  const { model, version, full, loading, error, retry, gallery, index, local } = data;
  const image = gallery.items[index];
  const line = (text: string, tone: 'muted' | 'err' = 'muted') => <div style={{ fontSize: 11, fontWeight: 700, color: tone === 'err' ? 'var(--il-err)' : 'var(--il-muted)', padding: '2px 0' }}>{text}</div>;
  const isCheckpoint = model?.type === 'Checkpoint';
  const rec = useMemo(() => recommendFrom(gallery.items.map((i) => i.meta), isCheckpoint ? null : version?.id), [gallery.items, version?.id, isCheckpoint]);

  return (
    <div ref={scrollRef} className="il-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: phone ? '12px 12px 96px' : 14, touchAction: 'pan-y', ...style }}>
      {!model && !local && line(loading ? 'Loading the model…' : error ?? 'Nothing here')}
      {!model && local && (
        <Section title="On this server">
          <Line label="File" value={local.name} copy={local.name} />
          {local.key && <Line label="Path" value={local.key} copy={local.key} mono />}
          {local.hash && <Line label="SHA256" value={local.hash.slice(0, 10).toUpperCase()} copy={local.hash} mono title={local.hash} />}
          <Line label="Servers" value={local.servers.length ? local.servers.join(', ') : 'none online lists it'} />
          {line(local.state === 'found' ? (loading ? 'Loading the model…' : error ?? 'Could not load the model')
            : local.state === 'not-on-civitai' ? 'Not on CivitAI'
            : local.state === 'unhashed' ? 'Not hashed yet — the ImageLab node has not seen this file'
            : local.state === 'error' ? 'CivitAI lookup failed' : 'Looking up on CivitAI…')}
        </Section>
      )}
      {error && model && !full && line(error, 'err')}
      {error && <GhostBtn h={28} onClick={retry} style={{ alignSelf: 'flex-start' }}>Try again</GhostBtn>}
      {model && (
        <>
          <PanelHead model={model} version={version} onVersion={onVersion} phone={phone} onClose={onClose} />
          {!full && !error && line('Loading the full model…')}
          <SectionWords version={version} />
          {hasRecommended(rec) && <RecommendedRow rec={rec} withStrength={!isCheckpoint} flat />}
          <SectionDescription model={model} />
          <SectionSample image={image} index={index} fromApi={gallery.fromApi} onOpen={onOpen} />
          <div>
            {version && <FoldDetails model={model} version={version} />}
            {version && full && <FoldFiles version={version} />}
            {local && <FoldLocal local={local} modelType={model.type} />}
            <FoldCreator model={model} full={full} />
            <FoldTags model={model} />
          </div>
        </>
      )}
    </div>
  );
}
