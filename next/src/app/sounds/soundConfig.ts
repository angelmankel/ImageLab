/**
 * Where the UI sound files live (FIXLIST-2 "New UI sounds"): the ONE value to change if they move.
 * Default = `sounds/` next to index.html (next/public/sounds → dist/sounds, served at
 * /imagelab/next/sounds/…, relative so the winold /cloud/ mount works too). Files are
 * `<SOUND_BASE>ui/<folder>/<name>.ogg` (+ `.mp3` for browsers without Ogg Opus), made by
 * next/scripts/convert-sounds.cjs; they are fetched on first use, never bundled.
 */
export const SOUND_BASE: string = `${import.meta.env.BASE_URL}sounds/`;
