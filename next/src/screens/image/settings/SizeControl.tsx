/**
 * The size (rule 5): aspect ratio first (tall buttons with shape icons), then the longest side
 * as chips with the computed W × H, and a switch "Set width and height myself" that reveals the
 * Width / Height rows. Reads and writes `workflow.width/height` in the main app's store; the
 * maths is in `size.ts`.
 */
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { Chip, Switch } from '~/ui';
import { T } from '~/theme/tokens';
import { AspectButton } from './AspectButton';
import { DimRow } from './DimRow';
import {
  ASPECTS, LONGEST_SIDES, SLIDER_STEP, aspectById, aspectOf, fmtSize, isPresetSize, longestChip, longestOf, megapixels, roundTo, scaleToLongest, sizeFor, type AspectId,
} from './size';

export function SizeControl() {
  const width = useStore((s) => s.workflow.width);
  const height = useStore((s) => s.workflow.height);
  const setWorkflow = useStore((s) => s.setWorkflow);
  const [manual, setManual] = useState(() => !isPresetSize(width, height));
  const aspect: AspectId = manual && !isPresetSize(width, height) ? 'custom' : aspectOf(width, height);
  const chip = longestChip(width, height);

  const pickAspect = (id: AspectId) => {
    if (id === 'custom') { setManual(true); return; }
    setManual(false);
    setWorkflow(sizeFor(aspectById(id)!, roundTo(longestOf(width, height), SLIDER_STEP)));
  };
  const pickLongest = (l: number) => {
    const a = aspectById(aspect);
    setWorkflow(a ? sizeFor(a, l) : scaleToLongest(width, height, l));
  };

  return (
    <>
      <div style={{ background: 'var(--il-card)', borderRadius: T.radius.xl, padding: '10px 12px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)', marginBottom: 10 }}>Aspect ratio</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6 }}>
          {ASPECTS.map((a) => <AspectButton key={a.id} id={a.id} w={a.w} h={a.h} on={aspect === a.id} onClick={() => pickAspect(a.id)} title={a.label} />)}
          <AspectButton id="custom" on={aspect === 'custom'} onClick={() => pickAspect('custom')} title="Any width and height" />
        </div>
      </div>

      <div style={{ background: 'var(--il-card)', borderRadius: T.radius.xl, padding: '10px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)' }}>Longest side</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--il-fg)', fontVariantNumeric: 'tabular-nums' }}>{fmtSize(width, height)}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {LONGEST_SIDES.map((l) => <Chip key={l} on={chip === l} onClick={() => pickLongest(l)}>{l}</Chip>)}
        </div>
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--il-line-strong)' }}>
          <Switch label="Set width and height myself" checked={manual} onChange={setManual} />
        </div>
        {manual && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginTop: 12 }}>
              <DimRow label="Width" value={width} onChange={(w) => setWorkflow({ width: w })} />
              <DimRow label="Height" value={height} onChange={(h) => setWorkflow({ height: h })} />
            </div>
            <div style={{ marginTop: 10, fontSize: 10, color: 'var(--il-muted)' }}>{megapixels(width, height)} MP · sliders step 64, boxes 8</div>
          </>
        )}
      </div>
    </>
  );
}
