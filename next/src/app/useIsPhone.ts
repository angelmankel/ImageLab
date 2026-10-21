/**
 * Phone shell or not. Kept for the many old callers; the rule now lives in `formFactorLogic.ts`
 * (touch screen with a short side < 600 = phone in BOTH orientations, or any window < 768 wide).
 * New code: `useFormFactor()` for orientation too.
 */
export { useIsPhoneFF as useIsPhone, useFormFactor, usePhoneLandscape, getFormFactor } from './useFormFactor';
