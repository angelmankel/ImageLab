/**
 * Clips with a soundtrack (MiniMax H3) should be heard. A `<video>` whose name says so is
 * rendered unmuted; browsers refuse unmuted autoplay without a user gesture, so when `play()`
 * is rejected the element is muted and started again — the picture always moves.
 */
export { videoHasAudio } from './wanGraph';

export function playOrMute(el: HTMLVideoElement): void {
  if (el.muted) return;
  const p = el.play();
  if (p && typeof p.catch === 'function') {
    p.catch(() => {
      el.muted = true;
      void el.play().catch(() => { /* nothing more to try */ });
    });
  }
}
