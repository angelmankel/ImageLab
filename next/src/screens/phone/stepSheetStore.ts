/**
 * Which step's sheet is open on the phone (mobile pass, m-create): a tap on a steps-strip badge
 * (↻ out of date / ! can't run) opens the step sheet. A store, not component state, so the sheet
 * stays open across a rotation (portrait ⇄ landscape remount the strip).
 */
import { create } from 'zustand';

export const useStepSheet = create<{ stepId: string | null }>(() => ({ stepId: null }));
export const openStepSheet = (stepId: string) => useStepSheet.setState({ stepId });
export const closeStepSheet = () => useStepSheet.setState({ stepId: null });
