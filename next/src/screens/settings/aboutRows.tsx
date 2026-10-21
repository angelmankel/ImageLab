/**
 * Settings → About: the way back to the classic UI (the old app at /imagelab/, one folder up),
 * the classic UI's own "Classic workspace" switch (`@/features/next/nextStore`, the same
 * localStorage, so it flips what /imagelab/ shows), and where this app and its settings live.
 */
import { Switch as MSwitch } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import { useNext } from '@/features/next/nextStore';
import type { SettingDef } from './categories';

export function ClassicLink({ short }: { short?: boolean }) {
  return (
    <a href="../" style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 11px', borderRadius: 999,
      background: 'var(--il-card)', border: '1px solid var(--il-line-soft)', color: 'var(--il-fg2)',
      fontSize: 12, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
    }}>
      {short ? 'Classic UI' : 'Open the classic UI'}<IconExternalLink size={13} />
    </a>
  );
}

function ClassicWorkspaceCtl() {
  const classic = useNext((s) => s.classic);
  const setClassic = useNext((s) => s.setClassic);
  return <MSwitch className="il-switch" checked={classic} onChange={(e) => setClassic(e.currentTarget.checked)} color="ember" size="sm" aria-label="Classic workspace in the classic UI" />;
}

function BuildCtl() {
  const where = typeof location === 'undefined' ? '' : `${location.host}${location.pathname}`;
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)', fontFamily: 'ui-monospace, Menlo, monospace', wordBreak: 'break-all', textAlign: 'right' }}>
      {import.meta.env.MODE}{where ? ` · ${where}` : ''}
    </span>
  );
}

export const ABOUT_ROWS: readonly SettingDef[] = [
  {
    id: 'about.classic', category: 'about', label: 'Classic UI', compact: true,
    hint: 'The old app at /imagelab/, one folder up. Same servers, same history.',
    keywords: ['old', 'previous', 'switch', 'link', 'open', 'workspace', 'legacy'], Control: () => <ClassicLink />,
  },
  {
    id: 'about.classicWorkspace', category: 'about', label: 'Classic workspace in the classic UI', compact: true,
    hint: 'What /imagelab/ shows: the old three-column workspace instead of its new step shell. Does not change this app.',
    keywords: ['old', 'shell', 'desktop', 'mobile', 'fallback', 'legacy', 'next'], Control: ClassicWorkspaceCtl,
  },
  {
    id: 'about.build', category: 'about', label: 'This app',
    hint: 'ImageLab next. Settings and keys stay in this browser (localStorage); nothing here is sent to the pod.',
    keywords: ['version', 'build', 'storage', 'browser', 'local', 'privacy', 'where', 'served'], Control: BuildCtl,
  },
];
