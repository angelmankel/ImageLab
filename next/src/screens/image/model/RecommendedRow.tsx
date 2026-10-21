/**
 * "Recommended settings" (fix list 2 items 32 + 33 + 29): what the model's sample pictures were
 * made with — steps · CFG · sampler · clip skip, and a LoRA's / embedding's usual strength — on
 * one line, with a one-tap Apply (`applyRecommended`, undoable; "Applied ✓" once the step
 * matches). Used by the model card and the model viewer's panel.
 */
import { IconCheck } from '@tabler/icons-react';
import { Button } from '~/ui';
import { useIsPhone } from '~/app/useIsPhone';
import { fmtNum, type Recommended } from './cardFacts';
import { applyRecommended, useRecommendedApplied, type WeightTarget } from './applyRecommended';

export function recommendedParts(rec: Recommended, withStrength: boolean): string[] {
  const out: string[] = [];
  if (rec.steps != null) out.push(`${rec.steps} steps`);
  if (rec.cfg != null) out.push(`CFG ${fmtNum(rec.cfg)}`);
  if (rec.sampler) out.push(rec.sampler);
  if (rec.clipSkip != null) out.push(`Clip skip ${rec.clipSkip}`);
  if (withStrength && rec.strength != null) out.push(`Strength ${fmtNum(rec.strength)}`);
  return out;
}

export function RecommendedRow({ rec, withStrength, weight, flat }: {
  rec: Recommended; withStrength: boolean; weight?: WeightTarget;
  /** No tinted box (the viewer panel's plain look). */
  flat?: boolean;
}) {
  const phone = useIsPhone();
  const applied = useRecommendedApplied(rec, weight);
  const parts = recommendedParts(rec, withStrength);
  if (!parts.length) return null;
  return (
    <div title={`From ${rec.from} sample picture${rec.from === 1 ? '' : 's'} on CivitAI`}
      style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, ...(flat ? {} : { background: 'var(--il-elev)', borderRadius: 12, padding: '8px 8px 8px 10px' }) }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="il-eyebrow">Recommended settings</div>
        <div style={{ fontSize: 12, fontWeight: 800, marginTop: 2, lineHeight: 1.35, overflowWrap: 'anywhere' }}>{parts.join(' · ')}</div>
      </div>
      <Button tone={applied ? 'ghost' : 'primary'} size={phone ? 'lg' : 'sm'} disabled={applied} onClick={() => applyRecommended(rec, withStrength ? weight : undefined)}
        tooltip={applied ? 'The step uses these' : 'Put these into the step'} style={{ flex: 'none' }}>
        {applied ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><IconCheck size={13} stroke={3} />Applied</span> : 'Apply'}
      </Button>
    </div>
  );
}
