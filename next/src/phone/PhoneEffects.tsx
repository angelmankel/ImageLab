/**
 * Phone-wide effects (mobile pass, m-shell), mounted once by PhoneShell: the on-screen keyboard
 * watch (`--il-kb`, the focused field kept above the keyboard). Renders nothing.
 */
import { useEffect } from 'react';
import { startKeyboardWatch } from './keyboard';

export function PhoneEffects() {
  useEffect(() => startKeyboardWatch(), []);
  return null;
}
