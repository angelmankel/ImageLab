/**
 * What is left of the Studio view: the workflow mode's host and focus mode. The view itself became
 * the Workflow mode of the one workspace (`features/desktop/DesktopWorkspace`,
 * `features/workspace/MobileWorkspace`); its parts live in `StudioPanels.tsx`.
 *
 * Focus mode is the workflow mode's promise: no node graph unless you ask for one. It hides the
 * per-server ComfyUI buttons from the rail, and it is always on for a phone.
 */
import { useMemo } from 'react';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { modeHostNow, useModeHost } from '@/features/workspace/modeHost';
import { useStudio } from './studioStore';

/** The host Studio talks to: the workflow mode's server (`features/workspace/modeHost.ts`). */
export function useStudioHost(): string | null {
  return useModeHost('workflow');
}

/** `useStudioHost` outside React. */
export function studioHostNow(): string | null {
  return modeHostNow('workflow');
}

/** Used by the rail and the ComfyUI layer to decide whether to offer ComfyUI at all. */
export function useFocusMode() {
  const focusMode = useStudio(s => s.focusMode);
  const isDesktop = useIsDesktop();
  // On a phone, focus mode is the point: a node graph on a 412px screen is not a thing anyone
  // wants, so ComfyUI stays hidden there regardless of the stored preference.
  return useMemo(() => (isDesktop ? focusMode : true), [focusMode, isDesktop]);
}
