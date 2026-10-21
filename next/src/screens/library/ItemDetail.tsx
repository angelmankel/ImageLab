/**
 * Library (rule 12): the selected item — the picture (tap = fullscreen), when · kind, the prompt,
 * the negative, the settings grid (Model · Size · Steps · CFG · Sampler · Seed) and the actions:
 * Use prompt · Reuse settings · Send to step · Add to collection · ★ · Download · Delete.
 * One component for the desktop panel and the phone sheet (`phone` = taller buttons).
 */
import { useState } from 'react';
import { Tooltip } from '@mantine/core';
import { IconDownload, IconStar, IconStarFilled, IconTrash } from '@tabler/icons-react';
import { useStore } from '@/lib/store';
import { settingsCells, whenLabel, type LibItem } from './libraryLogic';
import { applyPrompt, applySettings, confirmDelete, downloadItem, toggleFav, recallItem } from './libraryActions';
import { AddToCollectionMenu } from './AddToCollectionMenu';
import { SendToStepMenu } from './SendToStepMenu';
import { makePayload, nameFromUrl, useImageDrag } from '~/dnd';

export function ItemDetail({ item, phone, onOpen, onDeleted, pager, hidePicture }: {
  item: LibItem; phone?: boolean; onOpen: () => void; onDeleted?: () => void; pager?: string;
  /** The desktop History page shows the picture in its center column (list-2 item 18). */
  hidePicture?: boolean;
}) {
  const servers = useStore((s) => s.servers);
  const [more, setMore] = useState(false);
  const e = item.entry;
  const drag = useImageDrag(() => makePayload({ url: item.url, name: e?.filename ?? nameFromUrl(item.url), kind: item.kind, key: item.key, entryId: e?.id, source: 'collection' }));
  const cells = settingsCells(e);
  const server = e ? servers.find((s) => s.id === e.serverId)?.name : undefined;
  const h = phone ? 44 : 40;
  const r = phone ? 14 : 12;
  const btn = { height: h, borderRadius: r } as const;
  const longPrompt = (e?.positive?.length ?? 0) > 160;
  const noEntry = !e ? 'Videos carry no prompt or settings' : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {!hidePicture && <div
        onClick={onOpen}
        role="button"
        aria-label="Open fullscreen"
        style={{ width: '100%', aspectRatio: '1', borderRadius: phone ? 14 : 16, background: 'var(--il-bg-deep)', overflow: 'hidden', cursor: 'zoom-in', flex: 'none' }}
      >
        {item.kind === 'video'
          ? <video key={item.key} src={item.url} autoPlay muted loop playsInline style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
          : <img key={item.key} src={item.url} alt="" {...drag} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />}
      </div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, fontWeight: 700, color: 'var(--il-muted)', padding: '0 2px' }}>
        <span>{whenLabel(item.createdAt)}</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pager ? `${pager} · ` : ''}{item.kind === 'video' ? 'Video' : 'Image'}{server ? ` · ${server}` : ''}</span>
      </div>

      {e?.positive ? (
        <div style={{ padding: '0 2px' }}>
          <p className={more ? undefined : 'lib-clamp'} style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--il-fg2)', WebkitLineClamp: more ? undefined : 3, userSelect: 'text', overflowWrap: 'anywhere' }}>{e.positive}</p>
          {longPrompt && (
            <button type="button" onClick={() => setMore(!more)} style={{ border: 0, background: 'transparent', padding: 0, marginTop: 2, color: 'var(--il-ember)', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>{more ? 'Less' : 'More'}</button>
          )}
        </div>
      ) : e ? <p style={{ margin: 0, padding: '0 2px', fontSize: 12, color: 'var(--il-dim)' }}>No prompt</p> : null}

      {e?.negative && (
        <div style={{ padding: '0 2px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="il-eyebrow">Negative</span>
          <p className={more ? undefined : 'lib-clamp'} style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: 'var(--il-muted)', WebkitLineClamp: more ? undefined : 2, userSelect: 'text', overflowWrap: 'anywhere' }}>{e.negative}</p>
        </div>
      )}

      {cells.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
          {cells.map((c) => (
            <div key={c.label} title={c.value} style={{ background: 'var(--il-card)', borderRadius: 12, padding: '8px 10px', minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--il-muted)' }}>{c.label}</div>
              <div style={{ fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', userSelect: 'text' }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      <button type="button" className="lib-act primary" style={btn} disabled={!e} title={e ? 'Everything from this image back into the step: models, settings, seed, input image and prompt' : noEntry} onClick={() => recallItem(item)}>Recall everything</button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
        <button type="button" className="lib-act" style={btn} disabled={!e} title={noEntry} onClick={() => applyPrompt(item)}>Use prompt</button>
        <button type="button" className="lib-act strong" style={btn} disabled={!e} title={noEntry} onClick={() => applySettings(item)}>Reuse settings</button>
        <SendToStepMenu item={item} position={phone ? 'top' : 'bottom'}>
          <button type="button" className="lib-act" style={btn}>Send to step<span style={{ color: 'var(--il-muted)' }}>▾</span></button>
        </SendToStepMenu>
        <AddToCollectionMenu items={[item]} position={phone ? 'top' : 'bottom-end'}>
          <button type="button" className="lib-act" style={btn}>Add to collection<span style={{ color: 'var(--il-muted)' }}>▾</span></button>
        </AddToCollectionMenu>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <Tooltip label={item.liked ? 'Unstar' : 'Star'}>
          <button type="button" className="lib-act" aria-label="Favourite" aria-pressed={item.liked} onClick={() => toggleFav(item)}
            style={{ ...btn, flex: 1, color: item.liked ? 'var(--il-ember-hi)' : 'var(--il-fg2)' }}>
            {item.liked ? <IconStarFilled size={17} /> : <IconStar size={17} stroke={2.2} />}
          </button>
        </Tooltip>
        <Tooltip label="Download">
          <button type="button" className="lib-act" aria-label="Download" onClick={() => void downloadItem(item)} style={{ ...btn, flex: 1, color: 'var(--il-fg2)' }}>
            <IconDownload size={17} stroke={2.2} />
          </button>
        </Tooltip>
        <Tooltip label="Delete">
          <button type="button" className="lib-act" aria-label="Delete" onClick={() => confirmDelete([item], onDeleted)} style={{ ...btn, flex: 1, color: 'var(--il-err)' }}>
            <IconTrash size={17} stroke={2.2} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
