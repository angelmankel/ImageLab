/**
 * Everything CivitAI knows about the opened model (rule 13), top to bottom as on the boards:
 * gallery · name, creator + Follow, licence chips · stats · version + files · trigger words ·
 * "Use in step" · description · tags · the selected sample's generation data · Open on CivitAI /
 * Delete. One component for the desktop panel (`size='desktop'`, padded 12) and the phone page
 * (`size='phone'`, full-bleed gallery, padded 16).
 */
import { useEffect, useMemo, useState } from 'react';
import { Menu } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconCheck, IconCopy, IconExternalLink, IconHeart, IconHeartFilled } from '@tabler/icons-react';
import { stripHtml } from '@/features/model-metadata/civitai';
import { useSteps } from '~/app/stepsStore';
import { baseModelShort, isEarlyAccess, typeLabel } from './civitaiQuery';
import { civitaiModelLink } from './civitaiApi';
import { useModels } from './modelsStore';
import { useModelDetail, useVersionImages } from './useModelDetail';
import { useInstalled } from './useInstalled';
import { useModelActions } from './useModelActions';
import { Avatar, EmberBtn, GhostBtn, Label, Stats, Tag, type Size } from './bits';
import { DetailGallery } from './DetailGallery';
import { DetailVersions } from './DetailVersions';
import { DetailSample } from './DetailSample';
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

  // Installed → into the step; not yet → start the download (the button says so).
  const useIn = (stepId?: string) => {
    if (!version) return;
    if (!installedFile) { void download(version, m.type); return; }
    if (stepId) setActive(stepId);
    actions.useInStep(version, m.type);
  };

  const header = !phone && (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <div style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 800, lineHeight: 1.2 }}>{m.name}</div>
      <button type="button" aria-label={fav ? 'Remove from favourites' : 'Add to favourites'} aria-pressed={fav} onClick={() => toggleFavourite(m.id)} style={{ width: 28, height: 28, border: 0, borderRadius: '50%', background: 'var(--il-elev)', color: fav ? 'var(--il-ember)' : 'var(--il-fg2)', display: 'grid', placeItems: 'center', flex: 'none', cursor: 'pointer' }}>
        {fav ? <IconHeartFilled size={15} /> : <IconHeart size={15} stroke={2.2} />}
      </button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: phone ? 0 : pad }}>
      <div style={{ padding: phone ? 0 : undefined }}>
        <DetailGallery images={gallery.items} index={imageIndex} onSelect={selectImage} mask={mask} size={size} hasMore={gallery.hasMore} onMore={() => void gallery.loadMore()} loading={gallery.loading || (loading && !model)} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: phone ? `0 ${pad}px` : 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {header}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avatar creator={m.creator} size={phone ? 24 : 22} />
            <button type="button" onClick={() => creator && setFilters({ username: creator })} title={creator ? `Models by ${creator}` : undefined} style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', padding: 0, textAlign: 'left', fontSize: phone ? 13 : 12, fontWeight: 700, color: 'var(--il-fg2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: creator ? 'pointer' : 'default' }}>{creator || 'unknown creator'}</button>
            {creator && <GhostBtn size={size} h={phone ? 44 : 24} onClick={() => toggleFollow(creator)} style={isFollowed ? { borderColor: 'var(--il-ember-line)', color: 'var(--il-ember-hi)' } : undefined}>{isFollowed ? 'Following' : 'Follow'}</GhostBtn>}
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
        </div>

        <Stats stats={m.stats} full gap={phone ? 12 : 10} />

        {version && <DetailVersions model={m} version={version} onVersion={selectVersion} installed={installed} size={size} />}

        {words.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Label>TRIGGER WORDS</Label>
              <button type="button" onClick={() => void actions.copy(words.join(', '), 'Trigger words copied')} style={{ border: 0, background: 'transparent', color: 'var(--il-ember)', fontSize: phone ? 12 : 11, fontWeight: 700, padding: 0, cursor: 'pointer' }}>Copy all</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: phone ? 6 : 4 }}>
              {words.map((w) => (
                <button key={w} type="button" onClick={() => void actions.copy(w, `“${w}” copied`)} title="Copy" style={{ height: phone ? 38 : 26, padding: phone ? '0 12px' : '0 9px', border: '1px solid var(--il-line-strong)', borderRadius: 999, background: 'transparent', color: 'var(--il-fg)', fontWeight: 700, fontSize: phone ? 12 : 11, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', maxWidth: '100%' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w}</span><IconCopy size={11} stroke={2.2} style={{ flex: 'none', opacity: .7 }} />
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6 }}>
          <EmberBtn size={size} h={phone ? 48 : 40} style={{ flex: 1, fontSize: phone ? 14 : 13, borderRadius: phone ? 14 : 12 }} onClick={() => useIn()} disabled={!version}>
            {installedFile ? `Use in ${actions.stepName}` : 'Download, then use'}
          </EmberBtn>
          <Menu position="top-end" withinPortal shadow="md" zIndex={300}>
            <Menu.Target>
              <button type="button" aria-label="Choose the step" style={{ width: phone ? 48 : 40, height: phone ? 48 : 40, border: 0, borderRadius: phone ? 14 : 12, background: 'var(--il-card-on)', color: 'var(--il-fg)', fontWeight: 800, fontSize: 13, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>▾</button>
            </Menu.Target>
            <Menu.Dropdown style={{ background: 'var(--il-card)', border: '1px solid var(--il-line-strong)', borderRadius: 12, padding: 4 }}>
              {steps.map((s, i) => <Menu.Item key={s.id} onClick={() => useIn(s.id)} style={{ borderRadius: 8, fontSize: 12, fontWeight: 700 }}>Use in step {i + 1} · {s.name}</Menu.Item>)}
            </Menu.Dropdown>
          </Menu>
        </div>
        {phone && inst.installed > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 14, background: 'var(--il-card)', color: 'var(--il-ok)', fontSize: 13, fontWeight: 800 }}>
            <IconCheck size={14} stroke={3} />Installed · {inst.installed} of {inst.total} version{inst.total === 1 ? '' : 's'}
          </div>
        )}

        {desc && (
          <div style={{ padding: '0 2px' }}>
            <p style={{ margin: 0, fontSize: phone ? 13 : 12, lineHeight: 1.5, color: 'var(--il-muted)', display: '-webkit-box', WebkitLineClamp: descOpen ? undefined : 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-line' }}>{desc}</p>
            <button type="button" onClick={() => setDescOpen((o) => !o)} style={{ border: 0, background: 'transparent', color: 'var(--il-ember)', fontSize: phone ? 12 : 11, fontWeight: 700, padding: 0, cursor: 'pointer' }}>{descOpen ? 'less' : 'more'}</button>
          </div>
        )}

        {tags.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {!phone && <Label>TAGS</Label>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: phone ? 6 : 4 }}>
              {shownTags.map((t) => (
                <button key={t} type="button" onClick={() => setFilters({ tag: t })} title={`Filter by #${t}`} style={{ height: phone ? 32 : 22, padding: phone ? '0 11px' : '0 9px', border: 0, borderRadius: 999, background: 'var(--il-card)', color: 'var(--il-fg2)', fontWeight: 700, fontSize: phone ? 11 : 10, cursor: 'pointer' }}>{t}</button>
              ))}
              {tags.length > shownTags.length && <button type="button" onClick={() => setAllTags(true)} style={{ height: phone ? 32 : 22, padding: '0 9px', border: 0, borderRadius: 999, background: 'transparent', color: 'var(--il-muted)', fontWeight: 700, fontSize: phone ? 11 : 10, cursor: 'pointer' }}>+{tags.length - shownTags.length}</button>}
            </div>
          </div>
        )}

        <DetailSample image={image} index={imageIndex} size={size} hasMeta={gallery.fromApi} onUsePrompt={() => image?.meta && actions.usePrompt(image.meta, image)} onUseSettings={() => image?.meta && actions.useSettings(image.meta, image)} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <GhostBtn size={size} h={phone ? 44 : 36} href={civitaiModelLink(m.id, version?.id)} style={{ flex: 1, borderRadius: phone ? 14 : 12, fontSize: phone ? 13 : 12 }}>Open on CivitAI<IconExternalLink size={13} stroke={2.2} /></GhostBtn>
          {installedFile && (
            <GhostBtn size={size} h={phone ? 44 : 36} tone="err" style={{ padding: '0 14px', fontSize: phone ? 13 : 12 }} onClick={() => modals.openConfirmModal({
              title: 'Delete from the server?',
              children: <span style={{ fontSize: 12 }}>{installedFile.name} will be removed from every online server.</span>,
              labels: { confirm: 'Delete', cancel: 'Keep' },
              confirmProps: { color: 'red' },
              onConfirm: () => void actions.deleteFile(installedFile.name, installed.hashKey(installedFile)),
            })}>Delete</GhostBtn>
          )}
        </div>
      </div>
    </div>
  );
}
