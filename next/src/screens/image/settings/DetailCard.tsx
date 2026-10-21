/** Detail (rule 5): steps and CFG as slider rows with tap presets. */
import { useStore } from '@/lib/store';
import { Collapse, SliderRow } from '~/ui';
import { T } from '~/theme/tokens';
import { useUndoableSetWorkflow } from '~/app/undoableWorkflow';
import { useImageDefaults } from '~/app/paramDefaults';

const fmtCfg = (v: number) => String(Number(v.toFixed(1)));

export function DetailCard() {
  const steps = useStore((s) => s.workflow.steps);
  const cfg = useStore((s) => s.workflow.cfg);
  const setWorkflow = useUndoableSetWorkflow();
  const d = useImageDefaults();
  return (
    <div style={{ background: 'var(--il-card)', borderRadius: T.radius.xl, padding: '10px 12px' }}>
      {/* Item 7: the shared fold header; the summary stays at the right. */}
      <Collapse id="params.detail" label="Detail" gap={8} bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        right={<span style={{ fontSize: 11, fontWeight: 700, color: 'var(--il-muted)', flex: 'none' }}>{steps} steps · CFG {fmtCfg(cfg)}</span>}>
      <SliderRow id="steps" label="Steps" value={steps} min={1} max={60} step={1} presets={[20, 25, 30, 40]} defaultValue={d.steps} onChange={(v) => setWorkflow({ steps: v })} />
      <SliderRow id="cfg" label="CFG" value={cfg} min={1} max={15} step={0.5} presets={[3, 5, 7, 9]} format={fmtCfg} defaultValue={d.cfg} onChange={(v) => setWorkflow({ cfg: v })} />
      </Collapse>
    </div>
  );
}
