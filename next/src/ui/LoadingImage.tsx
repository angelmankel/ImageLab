/**
 * An image that loads nicely (FIXLIST-2 item 5): a shimmer (or the blurred `thumb`, e.g. a tiny
 * CivitAI width) holds its place, the picture fades in when decoded, a broken one shows a quiet
 * icon instead of the browser's broken-image glyph. Lazy by default. Give it a size: `aspect`
 * (width ÷ height) or a width / height in `style`; the image fills the box with `fit`.
 *
 *   <LoadingImage src={url} thumb={tinyUrl} aspect={2 / 3} radius={12} alt="" />
 */
import { useEffect, useRef, useState, type CSSProperties, type ImgHTMLAttributes, type ReactNode } from 'react';
import { IconPhotoOff } from '@tabler/icons-react';
import { dur } from '~/theme/motion';

export interface LoadingImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'style' | 'src'> {
  src: string | null | undefined;
  /** A small version shown blurred while the full one loads. */
  thumb?: string | null;
  /** Width ÷ height of the box. */
  aspect?: number;
  fit?: CSSProperties['objectFit'];
  radius?: number | string;
  /** The box. */
  style?: CSSProperties;
  /** The <img>. */
  imgStyle?: CSSProperties;
  /** Shown instead of the default icon when the image fails. */
  fallback?: ReactNode;
  /** Children drawn over the image (badges, buttons). */
  children?: ReactNode;
}

export function LoadingImage({ src, thumb, aspect, fit = 'cover', radius, style, imgStyle, fallback, children, loading = 'lazy', decoding = 'async', alt = '', onLoad, onError, className, ...img }: LoadingImageProps) {
  const ref = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    const el = ref.current;
    // A cached image is complete before React attaches onLoad.
    setState(!src ? 'error' : el?.complete && el.naturalWidth > 0 ? 'ready' : 'loading');
  }, [src]);
  const ready = state === 'ready';
  // A sized box (aspect / height): the image fills it. Otherwise the image sizes the box itself.
  const fill = aspect != null || style?.height != null || style?.aspectRatio != null;
  return (
    <div className={className} style={{ position: 'relative', overflow: 'hidden', borderRadius: radius, aspectRatio: aspect ? String(aspect) : undefined, background: 'var(--il-bg-deep)', minHeight: !fill && !ready ? 80 : undefined, ...style }}>
      {!ready && state !== 'error' && (thumb
        ? <img src={thumb} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: fit, filter: 'blur(12px)', transform: 'scale(1.08)' }} />
        : <span aria-hidden className="il-skel" style={{ position: 'absolute', inset: 0, borderRadius: 0 }} />)}
      {state === 'error'
        ? <div aria-hidden style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--il-dim)' }}>{fallback ?? <IconPhotoOff size={20} stroke={1.8} />}</div>
        : src && (
          <img ref={ref} src={src} alt={alt} loading={loading} decoding={decoding} {...img}
            onLoad={(e) => { setState('ready'); onLoad?.(e); }}
            onError={(e) => { setState('error'); onError?.(e); }}
            style={{ position: fill ? 'absolute' : 'relative', inset: fill ? 0 : undefined, width: '100%', height: fill ? '100%' : 'auto', objectFit: fit, display: 'block', opacity: ready ? 1 : 0, transition: `opacity ${dur(0.22)} ease`, ...imgStyle }} />
        )}
      {children}
    </div>
  );
}
