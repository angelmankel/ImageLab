/** Simple / Advanced: how much of a mode is on screen. One switch for the whole workspace. */
import { IconAdjustmentsHorizontal, IconSparkles } from '@tabler/icons-react';
import { useWorkspace } from '@/features/workspace/workspaceStore';
import type { Detail } from '@/lib/workspace';
import { Segmented } from './Segmented';

export function DetailToggle({ size = 'xs', fullWidth = false }: { size?: 'xs' | 'sm' | 'md'; fullWidth?: boolean }) {
  const detail = useWorkspace(s => s.detail);
  const setDetail = useWorkspace(s => s.setDetail);
  return (
    <Segmented<Detail>
      ariaLabel="Simple or advanced"
      size={size}
      fullWidth={fullWidth}
      value={detail}
      onChange={setDetail}
      options={[
        { value: 'simple', label: 'Simple', icon: <IconSparkles size={14} stroke={1.7} /> },
        { value: 'advanced', label: 'Advanced', icon: <IconAdjustmentsHorizontal size={14} stroke={1.7} /> },
      ]}
    />
  );
}
