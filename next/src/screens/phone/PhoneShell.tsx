/**
 * The phone shell (rule 11; mobile pass, Donny 10-21): the phone map — stacked cards for depth,
 * sideways swipes between siblings, the bottom band with the circle HUD (`~/phone/nav`). Each
 * owner registers its page kinds (`registerPhonePage`); this file mounts the frame and the
 * root effects (connection, jobs, keyboard) that run on every screen.
 */
import { AppEffects } from './imageBridge';
import { PhoneEffects } from '~/phone/PhoneEffects';
import { NavHost } from '~/phone/nav/NavHost';
import '~/phone/nav/shellPages';
import './tree/createPages';
import '~/screens/browseKit/browsePages'; // History / picture, Models / model, ComfyUI (m-browse)

export function PhoneShell() {
  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden', background: 'var(--il-bg)', overscrollBehavior: 'none' }}>
      <AppEffects />
      <PhoneEffects />
      <NavHost />
    </div>
  );
}
