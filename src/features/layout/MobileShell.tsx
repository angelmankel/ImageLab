/**
 * The phone layout for the Generate view, as v1's MobileApp: one full-screen tab at a time —
 * Parameters, Image, Gallery — chosen from tabs at the top (like every view's own tabs; the bottom
 * bar is the app-wide `MobileNav`), a status row, and a floating Generate button that is there on
 * every tab. Starting a run never needs a panel opened or closed: tap Generate
 * from Parameters, and the app switches to Image so the live preview is on screen. The button
 * becomes a Stop button with a progress ring while a job runs.
 *
 * Tabs mount on first visit and stay mounted, so switching keeps scroll position and state.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActionIcon, Box, Group, RingProgress, Tooltip } from '@mantine/core';
import {
  IconPlayerPlay, IconPlayerStop, IconPlus,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useStore } from '@/lib/store';
import { onApp } from '@/lib/appEvents';
import { StrippedCanvas } from '@/features/canvas/StrippedCanvas';
import { RightPanel } from '@/features/canvasLayers';
import { fireFromStore } from '@/features/generate/GenerateButton';
import { GenerateNavActions } from '@/features/generate/GenerateNavActions';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LeftPanel } from './LeftPanel';
import { ViewTabs } from './MobileNav';
import { JobStatusCluster } from './JobStatusCluster';

type MobileTab = 'parameters' | 'image' | 'gallery';
const TAB_KEY = 'imagelab.mobileTab.v1';

export function MobileShell() {
  const [activeTab, setActiveTabRaw] = useState<MobileTab>(() => {
    try { const t = localStorage.getItem(TAB_KEY); return t === 'image' || t === 'gallery' ? t : 'parameters'; } catch { return 'parameters'; }
  });
  const setActiveTab = (t: MobileTab) => { setActiveTabRaw(t); try { localStorage.setItem(TAB_KEY, t); } catch { /* ignore */ } };
  // The quick search can send the phone to a tab (e.g. Parameters, to show a panel section).
  useEffect(() => onApp('mobile-tab', (t) => setActiveTab(t)), []); // eslint-disable-line react-hooks/exhaustive-deps
  // Gallery always mounts: it owns the fullscreen viewer the Image tab opens.
  const [mounted, setMounted] = useState<Set<MobileTab>>(() => new Set([activeTab, 'gallery']));
  useEffect(() => {
    setMounted((prev) => (prev.has(activeTab) ? prev : new Set([...prev, activeTab])));
  }, [activeTab]);

  // A finished image lands while you are elsewhere: badge the Image tab until you look.
  const historyLen = useStore((s) => s.history.length);
  const seenLen = useRef(historyLen);
  const [unseen, setUnseen] = useState(0);
  useEffect(() => {
    if (activeTab === 'image') { seenLen.current = historyLen; setUnseen(0); }
    else setUnseen(Math.max(0, historyLen - seenLen.current));
  }, [historyLen, activeTab]);

  const panel = (tab: MobileTab, node: ReactNode) => mounted.has(tab) && (
    <Box style={{ position: 'absolute', inset: 0, display: activeTab === tab ? 'flex' : 'none', flexDirection: 'column' }}>
      {node}
    </Box>
  );

  return (
    <Box
      style={{
        display: 'flex', flexDirection: 'column', background: 'var(--mantine-color-dark-8)',
        position: 'absolute', inset: 0, overscrollBehavior: 'none', touchAction: 'manipulation',
      }}
    >
      <Box style={{ paddingTop: 'env(safe-area-inset-top)', flexShrink: 0 }}>
        <ViewTabs<MobileTab>
          value={activeTab}
          onChange={setActiveTab}
          tabs={[
            { value: 'parameters', label: 'Parameters' },
            { value: 'image', label: 'Image', badge: unseen },
            { value: 'gallery', label: 'Gallery' },
          ]}
        />
        {/* Status, server, queue and downloads keep a row of their own. */}
        <Box px="xs" py={6} className="scroll-x-thin" style={{ borderBottom: '1px solid var(--mantine-color-dark-5)' }}><JobStatusCluster /></Box>
      </Box>

      <Box style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {panel('parameters', (
          // The panel's own Generate footer is hidden here; the floating button replaces it.
          <Box style={{ flex: 1, minHeight: 0 }}>
            <LeftPanel hideGenerate />
          </Box>
        ))}
        {panel('image', (
          <>
            <Group justify="flex-end" gap={4} px="xs" py={6} wrap="nowrap" className="scroll-x-thin" style={{ borderBottom: '1px solid var(--mantine-color-dark-5)', flexShrink: 0 }}>
              <GenerateNavActions />
            </Group>
            <Box style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              <ErrorBoundary label="Image"><StrippedCanvas navOffset={0} leftInset={0} rightInset={0} /></ErrorBoundary>
            </Box>
          </>
        ))}
        {panel('gallery', <Box style={{ flex: 1, minHeight: 0 }}><RightPanel /></Box>)}
      </Box>

      <MobileGenerateFab onStarted={() => setActiveTab('image')} />

    </Box>
  );
}

/**
 * v1's floating buttons. Play queues a run (and brings up the Image tab); "+" bumps the seed by
 * one and queues, for quick variations. While a job runs, the big button is Stop inside a
 * progress ring.
 */
function MobileGenerateFab({ onStarted }: { onStarted: () => void }) {
  const running = useStore((s) => s.jobs.find((j) => j.status === 'running') ?? s.jobs.find((j) => j.status === 'queued'));
  const submitting = useStore((s) => s.isSubmitting);
  const cancelJob = useStore((s) => s.cancelJob);
  const progress = running?.progress ? Math.round((running.progress.value / Math.max(1, running.progress.max)) * 100) : running ? 3 : 0;

  // Only jump to the Image tab once a job is really queued. If the run is refused (a model missing
  // on every server, say) the reason would otherwise sit on the Parameters tab, out of sight.
  const run = async () => {
    const before = useStore.getState().jobs.length;
    await fireFromStore();
    const st = useStore.getState();
    if (st.jobs.length > before) onStarted();
    else if (st.status.kind === 'error') notifications.show({ title: 'Could not generate', message: st.status.text, color: 'red', autoClose: 8000 });
  };
  const generate = () => run();
  const plusOne = async () => {
    const st = useStore.getState();
    // Auto seed would reroll the +1 away, so it sits out this one run and is put back after.
    const auto = st.workflow.randomizeSeed;
    st.setWorkflow({ seed: (st.workflow.seed + 1) % 0x100000000, randomizeSeed: false });
    try { await run(); } finally { if (auto) useStore.getState().setWorkflow({ randomizeSeed: true }); }
  };

  const fab = 56;
  const ring = 4;
  return (
    <Box style={{ position: 'absolute', bottom: 14, right: 16, zIndex: 100, display: 'flex', alignItems: 'center', gap: 12 }}>
      {!running && (
        <Tooltip label="Seed + 1 and generate">
          <ActionIcon size={fab} radius="xl" variant="filled" onClick={() => { void plusOne(); }} disabled={submitting} aria-label="Next seed and generate"
            style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)', outline: '1.5px solid rgba(255, 255, 255, 0.25)' }}>
            <IconPlus size={24} />
          </ActionIcon>
        </Tooltip>
      )}
      {running ? (
        <RingProgress
          size={fab + ring * 2}
          thickness={ring}
          sections={[{ value: progress, color: 'var(--mantine-primary-color-filled)' }]}
          rootColor="dark.6"
          style={{ filter: 'drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3))' }}
          label={
            <ActionIcon size={fab} radius="xl" variant="filled" color="red" onClick={() => cancelJob(running.id)} aria-label="Stop generation"
              style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)' }}>
              <IconPlayerStop size={24} />
            </ActionIcon>
          }
        />
      ) : (
        <ActionIcon size={fab} radius="xl" variant="filled" onClick={() => { void generate(); }} loading={submitting} aria-label="Generate"
          style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)' }}>
          <IconPlayerPlay size={24} />
        </ActionIcon>
      )}
    </Box>
  );
}
