/** Detail (rule 5): steps and CFG as slider rows with tap presets. */
import { useStore } from '@/lib/store';
import { SliderRow } from '~/ui';
import { T } from '~/theme/tokens';

const fmtCfg = (v: number) => String(Number(v.toFixed(1)));

export function DetailCard() {
  const steps = useStore((s) => s.workflow.steps);
  const cfg = useStore((s) => s.workflow.cfg);
  const setWorkflow = useStore((s) => s.setWorkflow);
  return (
    <div style={{ background: 'var(--il-card)', borderRadius: T.radius.xl, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: 'var(--il-muted)' }}>
        <span>Detail</span><span>{steps} steps · CFG {fmtCfg(cfg)}</span>
      </div>
      <SliderRow id="steps" label="Steps" value={steps} min={1} max={60} step={1} presets={[20, 25, 30, 40]} onChange={(v) => setWorkflow({ steps: v })} />
      <SliderRow id="cfg" label="CFG" value={cfg} min={1} max={15} step={0.5} presets={[3, 5, 7, 9]} format={fmtCfg} onChange={(v) => setWorkflow({ cfg: v })} />
    </div>
  );
}
