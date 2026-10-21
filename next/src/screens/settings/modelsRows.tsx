/**
 * Settings → Models & CivitAI: the CivitAI API key the model browser and metadata lookups send
 * (separate from the pod's CIVITAI_TOKEN, which only downloads) and which image a model's
 * preview starts on. Logic = `@/lib/store` civitai settings + `modelPreviewSource`, option list
 * from `@/lib/storage`.
 */
import { SecretInput } from './SecretInput';
import { useStore } from '@/lib/store';
import { PREVIEW_SOURCES } from '@/lib/storage';
import { Chip, Row } from '~/ui';
import type { SettingDef } from './categories';
import { ctlStyle, inputStyles } from './inputs';
import { NsfwToggle } from '~/screens/models/nsfwCover';

function NsfwCtl() { return <NsfwToggle variant="row" />; }

function CivitaiKeyCtl() {
  const apiKey = useStore((s) => s.civitai.apiKey);
  const setCivitai = useStore((s) => s.setCivitai);
  return (
    <SecretInput value={apiKey} onChange={(e) => setCivitai({ apiKey: e.currentTarget.value })} placeholder="CivitAI API key" aria-label="CivitAI API key"
      size="sm" styles={inputStyles} style={ctlStyle} />
  );
}

function PreviewCtl() {
  const source = useStore((s) => s.modelPreviewSource);
  const setSource = useStore((s) => s.setModelPreviewSource);
  const current = PREVIEW_SOURCES.find((p) => p.value === source);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Row wrap>
        {PREVIEW_SOURCES.map((p) => <Chip key={p.value} small on={p.value === source} onClick={() => setSource(p.value)}>{p.label}</Chip>)}
      </Row>
      {current && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--il-muted)' }}>{current.description}</span>}
    </div>
  );
}

export const MODELS_ROWS: readonly SettingDef[] = [
  {
    id: 'models.civitaiKey', category: 'models', label: 'CivitAI API key',
    hint: 'Unlocks the full catalog and your CivitAI favourites.',
    links: [{ text: 'civitai.com', href: 'https://civitai.com/user/account' }, { text: 'civitai.red', href: 'https://civitai.red/user/account' }],
    keywords: ['token', 'secret', 'credentials', 'catalog', 'browser', 'red', 'nsfw', 'favourites', 'password'], Control: CivitaiKeyCtl,
  },
  {
    id: 'models.preview', category: 'models', label: 'Model preview starts on', wide: true,
    hint: "The picture a model shows first.",
    keywords: ['first', 'popular', 'random', 'history', 'slideshow', 'hover', 'thumbnail', 'tile', 'picture'], Control: PreviewCtl,
  },
  {
    id: 'models.nsfw', category: 'models', label: 'Always show NSFW images',
    hint: 'Off covers NSFW pictures until tapped.',
    keywords: ['nsfw', 'adult', 'mature', 'blur', 'cover', 'hide', 'explicit', 'rating'], Control: NsfwCtl,
  },
];
