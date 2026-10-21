/**
 * Fix list 2 #19: every session wears its own colour (the tab's thumbnail ring, Home tiles), picked
 * from one pleasant set and stored on the session (`Session.color`). A new session takes the first
 * colour no open tab uses; a session from before colours existed gets one from its id. Pure
 * (tests/sessionColor.test.cjs).
 */

export interface SessionColor { id: string; name: string; hex: string }

export const SESSION_COLORS: readonly SessionColor[] = Object.freeze([
  { id: 'ember', name: 'Ember', hex: '#F0863A' },
  { id: 'sky', name: 'Sky', hex: '#5AA9F0' },
  { id: 'mint', name: 'Mint', hex: '#3DD6A0' },
  { id: 'violet', name: 'Violet', hex: '#A98BF5' },
  { id: 'rose', name: 'Rose', hex: '#F07A9A' },
  { id: 'gold', name: 'Gold', hex: '#E8C25A' },
  { id: 'teal', name: 'Teal', hex: '#4FC6D0' },
  { id: 'lime', name: 'Lime', hex: '#9BD65A' },
]);

const byId = (id: string | undefined) => SESSION_COLORS.find((c) => c.id === id);

/** A stable colour from an id (for sessions saved before colours existed). */
function hashed(id: string): SessionColor {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return SESSION_COLORS[Math.abs(h) % SESSION_COLORS.length];
}

/** The session's colour id: its stored one, else one from its id. */
export function colorIdOf(s: { id: string; color?: string }): string {
  return byId(s.color)?.id ?? hashed(s.id).id;
}

/** The session's colour as hex. */
export function colorOf(s: { id: string; color?: string }): string {
  return byId(s.color)?.hex ?? hashed(s.id).hex;
}

/** The first colour not in `used` (colour ids); when all are used, the least used, first in order. */
export function pickColor(used: readonly string[]): string {
  const counts = SESSION_COLORS.map((c) => used.filter((u) => u === c.id).length);
  const min = Math.min(...counts);
  return SESSION_COLORS[counts.indexOf(min)].id;
}
