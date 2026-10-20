/**
 * What the Image step queues on top of the shared saved workflow (fix list 15): the base picture
 * alone — no Passes, no legacy finishing flags, and no Loopback (that is the Refine step now).
 * Merged at queue time only, never saved, so the classic UI keeps its own Loopback setting.
 */
import { NO_PASSES } from '@/features/generate/GenerateButton';
import type { WorkflowState } from '@/lib/types';

export const IMAGE_STEP_ONLY: Partial<WorkflowState> = Object.freeze({ ...NO_PASSES, loopback: undefined });
