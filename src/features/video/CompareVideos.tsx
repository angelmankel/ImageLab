/**
 * A/B: two videos side by side, played together, each picked from the results strip. Made for
 * sweeps — the label under each pane says what made it ("CFG 3.5") — but any two results work.
 * Desktop only: two clips do not fit a phone.
 */
import { useEffect, useRef, useState } from 'react';
import { Button, Group, Modal, Text } from '@mantine/core';
import { IconPlayerPause, IconPlayerPlay, IconRefresh } from '@tabler/icons-react';
import { ResultsStrip } from '@/components/blocks/ResultsStrip';
import type { ResultItem } from '@/lib/workspace';
import { useVideoSweep } from './videoSweep';

function Pane({ items, pick, onPick, videoRef, title }: {
  items: readonly ResultItem[]; pick: string | null; onPick: (key: string) => void; videoRef: React.RefObject<HTMLVideoElement>; title: string;
}) {
  const item = items.find((i) => i.key === pick) ?? null;
  const label = useVideoSweep((s) => (item ? s.labels[item.url] : undefined));
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-border-default bg-bg-base">
        {item ? <video ref={videoRef} key={item.url} src={item.url} muted loop playsInline className="h-full w-full object-contain" /> : <Text size="xs" c="dimmed">Pick a video below</Text>}
      </div>
      <Text size="xs" fw={600} truncate title={item?.filename}>{title}{label ? ` · ${label}` : ''}{item ? ` · ${item.filename}` : ''}</Text>
      <ResultsStrip items={items} currentKey={pick} onPick={onPick} size={48} />
    </div>
  );
}

export function CompareVideos({ items, opened, onClose, initialA, initialB }: {
  items: readonly ResultItem[]; opened: boolean; onClose: () => void; initialA: string | null; initialB: string | null;
}) {
  const [a, setA] = useState<string | null>(initialA);
  const [b, setB] = useState<string | null>(initialB);
  const [playing, setPlaying] = useState(true);
  const refA = useRef<HTMLVideoElement>(null!);
  const refB = useRef<HTMLVideoElement>(null!);
  useEffect(() => { if (opened) { setA(initialA ?? items[1]?.key ?? null); setB(initialB ?? items[0]?.key ?? null); setPlaying(true); } }, [opened]); // eslint-disable-line react-hooks/exhaustive-deps

  const both = (f: (v: HTMLVideoElement) => void) => { for (const r of [refA, refB]) if (r.current) f(r.current); };
  const restart = () => both((v) => { v.currentTime = 0; void v.play(); });
  useEffect(() => { if (opened) both((v) => { if (playing) void v.play(); else v.pause(); }); }, [playing, a, b, opened]);

  return (
    <Modal opened={opened} onClose={onClose} size="90%" title="Compare" zIndex={200} centered>
      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <Pane items={items} pick={a} onPick={setA} videoRef={refA} title="A" />
          <Pane items={items} pick={b} onPick={setB} videoRef={refB} title="B" />
        </div>
        <Group gap="xs">
          <Button size="xs" variant="light" leftSection={playing ? <IconPlayerPause size={14} /> : <IconPlayerPlay size={14} />} onClick={() => setPlaying((p) => !p)}>{playing ? 'Pause both' : 'Play both'}</Button>
          <Button size="xs" variant="subtle" color="gray" leftSection={<IconRefresh size={14} />} onClick={restart}>Restart together</Button>
          <Text size="xs" c="dimmed">Tap a thumbnail under a pane to swap that side.</Text>
        </Group>
      </div>
    </Modal>
  );
}
