/** One icon per reference type (Style tab). */
import { IconFaceId, IconLayoutGrid, IconPalette, IconSparkles, IconTarget } from '@tabler/icons-react';
import type { StyleRefType } from '@/lib/styleRefs';

export const TYPE_ICON: Record<StyleRefType, typeof IconPalette> = {
  style: IconPalette, composition: IconLayoutGrid, subject: IconTarget, face: IconFaceId, redux: IconSparkles,
};

export function TypeIcon({ type, size = 16 }: { type: StyleRefType; size?: number }) {
  const I = TYPE_ICON[type];
  return <I size={size} stroke={2.2} />;
}
