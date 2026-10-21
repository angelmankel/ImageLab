/**
 * Everything CivitAI knows about the opened model (rule 13; rebuilt for fix list item 32): the
 * pictures (desktop: sticky — name, the big picture, one row of thumbnails a page at a time) · the
 * selected picture's prompt + parameters RIGHT under them · creator + Follow, licence chips, stats,
 * "Use in step" · version picker + files, trigger words · description, tags · Open on CivitAI /
 * Delete. No horizontal overflow anywhere: long words wrap, names ellipsize. One component for the desktop panel (`size='desktop'`, padded 12) and the phone page
 * (`size='phone'`, full-bleed gallery, padded 16).
 */
import { useEffect, useMemo, useState } from 'react';
import { Menu } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconArrowsMaximize, IconCheck, IconChevronDown, IconCopy, IconExternalLink, IconHeart, IconHeartFilled } from '@tabler/icons-react';
import type { CivitaiImage } from '@/lib/civitai';
import { Button } from '~/ui';
import { stripHtml } from '@/features/model-metadata/civitai';
import { useSteps } from '~/app/stepsStore';
import { baseModelShort, isEarlyAccess, typeLabel } from './civitaiQuery';
import { civitaiModelLink } from './civitaiApi';
import { useModels } from './modelsStore';
import { useModelDetail, useVersionImages } from './useModelDetail';
import { useInstalled } from './useInstalled';
import { useModelActions } from './useModelActions';
import { Avatar, GhostBtn, Label, Stats, Tag, type Size } from './bits';
import { DetailGallery } from './DetailGallery';
import { DetailVersions } from './DetailVersions';
import { DetailSample } from './DetailSample';
import { DetailMedia } from './DetailMedia';
import { openModelViewer } from './viewerBridge';
import { useVersionDownload } from './DownloadButton';

export function Detail({ modelId, size }: { modelId: number; size: Size }) {
  const phone = size === 'phone';
  const { model, loading, error, retry } = useModelDetail(modelId);
  const listItem = useModels((s) => s.items.find((m) => m.id === modelId));
  const m = model ?? listItem ?? null;
  const mask = useModels((s) => s.filters.nsfwMask);
  const selectedVersionId = useModels((s) => s.selectedVersionId);
  const selectVersion = useModels((s) => s.selectVersion);
  const imageIndex = useModels((s) => s.selectedImage);
  const selectImage = useModels((s) => s.selectImage);
  const setFilters = useModels((s) => s.setFilters);
  const favourites = useModels((s) => s.favourites);
  const toggleFavourite = useModels((s) => s.toggleFavourite);
  const followed = useModels((s) => s.followed);
  const toggleFollow = useModels((s) => s.toggleFollow);
  const installed = useInstalled();
  const actions = useModelActions();
  const { download } = useVersionDownload();
  const steps = useSteps((s) => s.steps);
  const setActive = useSteps((s) => s.setActive);
  const [descOpen, setDescOpen] = useState(false);
  const [allTags, setAllTags] = useState(false);

  const version = useMemo(() => m?.modelVersions.find((v) => v.id === selectedVersionId) ?? m?.modelVersions[0], [m, selectedVersionId]);
  useEffect(() => { if (m && !m.modelVersions.some((v) => v.id === selectedVersionId) && m.modelVersions[0]) selectVersion(m.modelVersions[0].id); }, [m, selectedVersionId, selectVersion]);

  const gallery = useVersionImages(version?.id ?? null, mask, version?.images);
  const image = gallery.items[Math.min(imageIndex, Math.max(0, gallery.items.length - 1))];

  if (!m) {
    return (
      <div style={{ padding: 16, color: 'var(--il-muted)', fontSize: 12, fontWeight: 700, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
        {loading ? 'Loading…' : error ?? 'Nothing here'}
        {error && <GhostBtn onClick={retry} h={32}>Try again</GhostBtn>}
      </div>
    );
  }

  const pad = phone ? 16 : 12;
  const fav = favourites.includes(m.id);
  const creator = m.creator?.username ?? '';
  const isFollowed = !!creator && followed.includes(creator);
  const inst = installed.model(m);
  const installedFile = version?.files.find((f) => installed.file(f));
  const desc = stripHtml(m.description).trim();
  const tags = m.tags ?? [];
  const shownTags = allTags ? tags : tags.slice(0, phone ? 6 : 5);
  const words = version?.trainedWords ?? [];
  const commercial = m.allowCommercialUse ?? [];
  const early = isEarlyAccess(m);

  // A picker open → hand the pick over (downloading first when needed). Else: installed → into the
  // step; not yet → start the download (the button says so).
  const useIn = (stepId?: string) => {
    if (!version) return;
    if (actions.picking) { actions.pick(m, version); return; }
    if (!installedFile) { void download(version, m.type); return; }
    if (stepId) setActive(stepId);
    actions.useInStep(version, m.type);
  };
  const useLabel = actions.picking ? (installedFile ? 'Use this version' : 'Add & download') : installedFile ? `Use in ${actions.stepName}` : 'Download, then use';

  const viewImage = (img: CivitaiImage) => void openModelViewer({ modelId: m.id, versionId: version?.id ?? null, imageIndex: Math.max(0, gallery.items.indexOf(img)), start: version ? { ...img, versionId: version.id } : img });
  const section: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, padding: phone ? `12px ${pad}px` : `12px ${pad}px`, minWidth: 0 };
  const rule: React.CSSProperties = { borderTop: '1px solid var(--il-line-soft)' };

  const sample = (
    <DetailSample image={image} index={Math.min(imageIndex, Math.max(0, gallery.items.length - 1))} total={gallery.items.length} more={gallery.hasMore} size={size} hasMeta={gallery.fromApi}
      onUsePrompt={() => image?.meta && actions.usePrompt(image.meta, image)} onUseSettings={() => image?.meta && actions.useSettings(image.meta, image)} />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {/* The pictures: sticky on desktop, so they stay in view while the info scrolls (item 32). */}
      {phone ? (
        <DetailGallery images={gallery.items} index={imageIndex} onSelect={selectImage} mask={mask} size={size} hasMore={gallery.hasMore} onMore={() => void gallery.loadMore()} loading={gallery.loading || (loading && !model)} />
      ) : (
        <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--il-panel)', padding: `${pad}px ${pad}px 8px`, borderBottom: '1px solid var(--il-line-soft)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <div style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 800, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={m.name}>{m.name}</div>
            <Button size="sm" tone="elev" icon={<IconArrowsMaximize size={13} stroke={2.4} />} onClick={() => image && viewImage(image)} disabled={!image} tooltip="Open in viewer">View</Button>
            <Button size="sm" tone="elev" on={fav} icon={fav ? <IconHeartFilled size={14} /> : <IconHeart size={14} stroke={2.2} />} onClick={() => toggleFavourite(m.id)} tooltip={fav ? 'Remove from favourites' : 'Add to favourites'} />
          </div>
          <DetailMedia images={gallery.items} index={imageIndex} onSelect={selectImage} onView={viewImage} mask={mask} hasMore={gallery.hasMore} onMore={() => void gallery.loadMore()} loading={gallery.loading || (loading && !model)} />
        </div>
      )}

      {/* The selected picture's prompt + parameters, right under it. */}
      <div style={section}>{sample}</div>

      <div style={{ ...section, ...rule }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Avatar creator={m.creator} size={phone ? 24 : 22} />
          <button type="button" onClick={() => creator && setFilters({ username: creator })} title={creator ? `Models by ${creator}` : undefined} style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', padding: 0, textAlign: 'left', fontSize: phone ? 13 : 12, fontWeight: 700, color: 'var(--il-fg2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: creator ? 'pointer' : 'default' }}>{creator || 'unknown creator'}</button>
          {creator && <Button size={phone ? 'lg' : 'sm'} tone="outline" on={isFollowed} onClick={() => toggleFollow(creator)}>{isFollowed ? 'Following' : 'Follow'}</Button>}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          <Tag size={size}>{typeLabel(m.type)}</Tag>
          {version?.baseModel && <Tag size={size}>{baseModelShort(version.baseModel)}</Tag>}
          {early && <Tag size={size} tone="emberLine" outlined>Early access</Tag>}
          {commercial.includes('Image') && <Tag size={size} tone="muted" outlined>Commercial<IconCheck size={10} stroke={3.5} color="var(--il-ok)" /></Tag>}
          {(commercial.includes('Rent') || commercial.includes('RentCivit')) && <Tag size={size} tone="muted" outlined>Rent<IconCheck size={10} stroke={3.5} color="var(--il-ok)" /></Tag>}
          {commercial.includes('Sell') && <Tag size={size} tone="muted" outlined>Sell<IconCheck size={10} stroke={3.5} color="var(--il-ok)" /></Tag>}
          <Tag size={size} tone="muted" outlined>{m.allowNoCredit ? 'No credit needed' : 'Credit required'}</Tag>
          {m.allowDerivatives === false && <Tag size={size} tone="muted" outlined>No derivatives</Tag>}
          {m.poi && <Tag size={size} tone="muted" outlined>Real person</Tag>}
          {m.nsfw && <Tag size={size} tone="muted" outlined>NSFW</Tag>}
        </div>
        <Stats stats={m.stats} full gap={phone ? 12 : 10} />
        <div style={{ display: 'flex', gap: 6 }}>
          <Button tone="primary" size="lg" h={phone ? 48 : 42} style={{ flex: 1, fontSize: phone ? 14 : 13 }} onClick={() => useIn()} disabled={!version}>{useLabel}</Button>
          {!actions.picking && <Menu position="top-end" withinPortal shadow="md" zIndex={300}>
            <Menu.Target>
              <Button tone="card" h={phone ? 48 : 42} icon={<IconChevronDown size={15} stroke={2.6} />} aria-label="Choose the step" tooltip="Use in another step" />
            </Menu.Target>
            <Menu.Dropdown style={{ background: 'var(--il-card)', border: '1px solid var(--il-line-strong)', borderRadius: 12, padding: 4 }}>
              {steps.map((s, i) => <Menu.Item key={s.id} onClick={() => useIn(s.id)} style={{ borderRadius: 8, fontSize: 12, fontWeight: 700 }}>Use in step {i + 1} · {s.name}</Menu.Item>)}
            </Menu.Dropdown>
          </Menu>}
        </div>
        {phone && inst.installed > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 14, background: 'var(--il-card)', color: 'var(--il-ok)', fontSize: 13, fontWeight: 800 }}>
            <IconCheck size={14} stroke={3} />Installed · {inst.installed} of {inst.total} version{inst.total === 1 ? '' : 's'}
          </div>
        )}
      </div>

      <div style={{ ...section, ...rule }}>
        {version && <DetailVersions model={m} version={version} onVersion={selectVersion} installed={installed} size={size} />}
        {words.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Label>TRIGGER WORDS</Label>
              <Button size="sm" tone="ghost" icon={<IconCopy size={12} stroke={2.2} />} onClick={() => void actions.copy(words.join(', '), 'Trigger words copied')}>Copy all</Button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: phone ? 6 : 4, minWidth: 0 }}>
              {words.map((w) => (
                <button key={w} type="button" className="il-btn" onClick={() => void actions.copy(w, `“${w}” copied`)} title={`Copy “${w}”`} style={{ height: phone ? 38 : 26, padding: phone ? '0 12px' : '0 9px', border: '1px solid var(--il-line-strong)', borderRadius: 999, background: 'transparent', color: 'var(--il-fg)', fontWeight: 700, fontSize: phone ? 12 : 11, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', maxWidth: '100%', minWidth: 0 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w}</span><IconCopy size={11} stroke={2.2} style={{ flex: 'none', opacity: .7 }} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {(desc || tags.length > 0) && (
        <div style={{ ...section, ...rule }}>
          {desc && (
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: phone ? 13 : 12, lineHeight: 1.5, color: 'var(--il-muted)', display: '-webkit-box', WebkitLineClamp: descOpen ? undefined : 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-line', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{desc}</p>
              <button type="button" onClick={() => setDescOpen((o) => !o)} style={{ border: 0, background: 'transparent', color: 'var(--il-ember)', fontSize: phone ? 12 : 11, fontWeight: 700, padding: '4px 0', cursor: 'pointer' }}>{descOpen ? 'less' : 'more'}</button>
            </div>
          )}
          {tags.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {!phone && <Label>TAGS</Label>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: phone ? 6 : 4 }}>
                {shownTags.map((t) => (
                  <button key={t} type="button" className="il-btn" onClick={() => setFilters({ tag: t })} title={`Filter by #${t}`} style={{ height: phone ? 32 : 22, padding: phone ? '0 11px' : '0 9px', border: 0, borderRadius: 999, background: 'var(--il-card)', color: 'var(--il-fg2)', fontWeight: 700, fontSize: phone ? 11 : 10, cursor: 'pointer', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t}</button>
                ))}
                {tags.length > shownTags.length && <button type="button" onClick={() => setAllTags(true)} style={{ height: phone ? 32 : 22, padding: '0 9px', border: 0, borderRadius: 999, background: 'transparent', color: 'var(--il-muted)', fontWeight: 700, fontSize: phone ? 11 : 10, cursor: 'pointer' }}>+{tags.length - shownTags.length}</button>}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ ...section, ...rule, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <GhostBtn size={size} h={phone ? 44 : 36} href={civitaiModelLink(m.id, version?.id)} style={{ flex: 1, borderRadius: phone ? 14 : 12, fontSize: phone ? 13 : 12 }}>Open on CivitAI<IconExternalLink size={13} stroke={2.2} /></GhostBtn>
        {installedFile && (
          <Button tone="danger" h={phone ? 44 : 36} onClick={() => modals.openConfirmModal({
            title: 'Delete from the server?',
            children: <span style={{ fontSize: 12 }}>{installedFile.name} will be removed from every online server.</span>,
            labels: { confirm: 'Delete', cancel: 'Keep' },
            confirmProps: { color: 'red' },
            onConfirm: () => void actions.deleteFile(installedFile.name, installed.hashKey(installedFile)),
          })}>Delete</Button>
        )}
      </div>
    </div>
  );
}
