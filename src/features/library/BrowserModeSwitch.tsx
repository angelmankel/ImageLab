import { SegmentedControl } from '@mantine/core';
import { useLibraryStore, type BrowserMode } from './store';

/** Header switch in the model browser: CivitAI browsing vs the device-local "My models" list. */
export function BrowserModeSwitch({ size = 'xs' }: { size?: 'xs' | 'sm' }) {
  const mode = useLibraryStore((s) => s.browserMode);
  const setMode = useLibraryStore((s) => s.setBrowserMode);
  const count = useLibraryStore((s) => s.entries.length);
  return (
    <SegmentedControl
      size={size}
      className="shrink-0"
      value={mode}
      onChange={(v) => setMode(v as BrowserMode)}
      aria-label="Model browser mode"
      data={[
        { value: 'browse', label: 'Browse' },
        { value: 'library', label: count ? `My models · ${count}` : 'My models' },
      ]}
    />
  );
}
