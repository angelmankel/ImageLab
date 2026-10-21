/**
 * Item 37: one written prompt option in the studio. The text, one-tap tweaks ("More cinematic",
 * "Shorter"…) plus your own tweak, and the actions: Use this (sets the prompt, closes), Again
 * (rewrite this one), Copy, Back (the version before the last tweak / rewrite).
 */
import { useState } from 'react';
import { IconArrowBackUp, IconCopy, IconRefresh, IconSend } from '@tabler/icons-react';
import { useIsPhone } from '~/app/useIsPhone';
import { Button, Chip, SkeletonText, Spinner } from '~/ui';
import { TWEAKS } from './studioLogic';

export interface StudioOption { key: string; versions: string[]; busy: boolean; error?: string }

export function OptionCard({ n, opt, onUse, onAgain, onTweak, onBack }: {
  n: number; opt: StudioOption;
  onUse: (text: string) => void; onAgain: () => void; onTweak: (instruction: string) => void; onBack: () => void;
}) {
  const phone = useIsPhone();
  const [own, setOwn] = useState('');
  const text = opt.versions[opt.versions.length - 1] ?? '';
  const size = phone ? 'lg' : 'sm';
  const sendOwn = () => { if (own.trim()) { onTweak(own.trim()); setOwn(''); } };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 14, background: 'var(--il-card)', border: '1px solid var(--il-line-soft)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.6px', color: 'var(--il-ember-hi)' }}>OPTION {n}</span>
        {opt.versions.length > 1 && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--il-dim)' }}>· version {opt.versions.length}</span>}
        {opt.busy && <Spinner size={12} />}
        <div style={{ flex: 1 }} />
        {!phone && text && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--il-dim)' }}>{text.split(',').filter((x) => x.trim()).length} phrases</span>}
      </div>

      {text ? (
        <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--il-fg)', opacity: opt.busy ? 0.45 : 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--il-font-prompt, inherit)' }}>{text}</div>
      ) : opt.busy ? (
        <SkeletonText lines={3} size={12} />
      ) : null}
      {opt.error && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--il-err)' }}>{opt.error}</div>}

      {text && (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TWEAKS.map((t) => <Chip key={t.id} small={!phone} tall={phone} disabled={opt.busy} onClick={() => onTweak(t.ask)}>{t.label}</Chip>)}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, height: phone ? 44 : 32, borderRadius: 10, background: 'var(--il-bg-deep)', padding: '0 4px 0 10px' }}>
            <input value={own} onChange={(e) => setOwn(e.target.value)} placeholder="Your own tweak: add a red umbrella…" aria-label={`Tweak option ${n}`} disabled={opt.busy}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendOwn(); } }}
              style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', color: 'var(--il-fg)', fontSize: 12, fontWeight: 600, outline: 'none', fontFamily: 'inherit' }} />
            {own.trim() && <Button tone="ghost" size={phone ? 'md' : 'sm'} icon={<IconSend size={14} />} tooltip="Tweak" onClick={sendOwn} disabled={opt.busy} />}
          </label>
        </>
      )}

      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button tone="primary" size={size} disabled={!text || opt.busy} onClick={() => onUse(text)}>Use this</Button>
        <Button tone="card" size={size} icon={<IconRefresh size={14} stroke={2.4} />} disabled={opt.busy} onClick={onAgain} tooltip="Write this option again">Again</Button>
        <div style={{ flex: 1 }} />
        {opt.versions.length > 1 && <Button tone="ghost" size={size} icon={<IconArrowBackUp size={15} />} disabled={opt.busy} onClick={onBack} tooltip="Previous version" />}
        {text && <Button tone="ghost" size={size} icon={<IconCopy size={14} />} onClick={() => { void navigator.clipboard?.writeText(text); }} tooltip="Copy" />}
      </div>
    </div>
  );
}
