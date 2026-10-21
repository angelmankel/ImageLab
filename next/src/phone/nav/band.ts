/**
 * The bottom band's two sides (mobile pass, m-shell): each page says what its band shows.
 *
 *   usePhoneBand({
 *     left:  { label: 'Image', icon: <IconDots/>, onClick: openStepMenu },     // secondary
 *     right: { label: 'Generate', icon: <IconBolt/>, tone: 'primary', onClick: generate, onHold: toggleSeed },
 *   });
 *
 * Left omitted = "‹ <parent>" (out one level); `null` = empty. Right omitted = empty. `node`
 * replaces the default pill with your own element (keep it ≤ 48 px tall). Only the top page's band
 * shows (landscape: the main pane's). Call it in the page component (any depth inside it).
 */
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { create } from 'zustand';
import type { NavPage } from './navLogic';

export interface BandAction {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  /** A hold (500 ms) on the action. */
  onHold?: () => void;
  tone?: 'primary' | 'default' | 'ghost';
  disabled?: boolean;
  /** A small count / mark on the pill. */
  badge?: string | number | null;
  /** Your own element instead of the pill. */
  node?: ReactNode;
}

export interface BandSpec { left?: BandAction | null; right?: BandAction | null }

interface BandStore { bands: Record<string, BandSpec> }
export const useBandStore = create<BandStore>(() => ({ bands: {} }));

/** The page a component is rendered in (set by the nav host). */
export const PageCtx = createContext<{ page: NavPage; index: number } | null>(null);
export function usePhonePage(): { page: NavPage; index: number } | null { return useContext(PageCtx); }

export function usePhoneBand(spec: BandSpec): void {
  const ctx = useContext(PageCtx);
  const key = ctx?.page.key;
  useEffect(() => {
    if (!key) return;
    useBandStore.setState((s) => ({ bands: { ...s.bands, [key]: spec } }));
  });
  useEffect(() => () => {
    if (!key) return;
    useBandStore.setState((s) => {
      const { [key]: _gone, ...rest } = s.bands;
      return { bands: rest };
    });
  }, [key]);
}

/**
 * The room a band side has (set by the band): `vertical` in landscape (a 72 px wide column slot),
 * `room` = the side's width in CSS px in portrait (≈ 138 at 360 wide, 153 at 390). A `node` on the
 * band reads it to fit: drop its label when it does not fit, stack when vertical. Every tap target
 * stays ≥ 44 px.
 */
export const BandLayoutCtx = createContext<{ vertical: boolean; room: number }>({ vertical: false, room: 150 });
export function useBandLayout(): { vertical: boolean; room: number } { return useContext(BandLayoutCtx); }
