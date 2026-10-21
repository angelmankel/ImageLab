/**
 * The UI sound actions (FIXLIST-2 "New UI sounds" + "synth sounds"): which moments make a sound,
 * the THEME that voices them (Soft / Glass / Pop = synthesised live, synthThemes.ts; Pack = Donny's
 * sample pack, `soundPack.json`), per-action picks and the volume maths. Pure: no imports,
 * node-testable (tests/sounds.test.cjs).
 *
 * A pick's `sound` is one of:
 *   - `THEME_SOUND` ('@theme'): this action's sound in the chosen theme (the default);
 *   - `synth:<theme>/<action>`: one synth sound, whatever the theme (`synthId`);
 *   - `<folder>/<name>`: a pack sample, file `<SOUND_BASE>ui/<folder>/<name>.<ogg|mp3>`;
 *   - `null`: this action is silent.
 */

export type SoundAction =
  | 'hover' | 'click' | 'toggleOn' | 'toggleOff' | 'tab' | 'open' | 'close'
  | 'queued' | 'done' | 'allDone' | 'download' | 'success' | 'favorite' | 'copy'
  | 'delete' | 'undo' | 'redo' | 'notify' | 'warning' | 'error' | 'dropOk' | 'dropRejected';

export type SynthThemeId = 'soft' | 'glass' | 'pop';
export type SoundThemeId = SynthThemeId | 'pack';

export const SOUND_THEMES: readonly { id: SoundThemeId; label: string; hint: string }[] = [
  { id: 'soft', label: 'Soft', hint: 'Warm and rounded, almost dry.' },
  { id: 'glass', label: 'Glass', hint: 'Bright bells in a small room.' },
  { id: 'pop', label: 'Pop', hint: 'Round, bubbly and short.' },
  { id: 'pack', label: 'Pack', hint: 'The sample pack.' },
];
export const SYNTH_THEME_IDS: readonly SynthThemeId[] = ['soft', 'glass', 'pop'];
export const DEFAULT_THEME: SoundThemeId = 'soft';
export const THEME_SOUND = '@theme';

export function isThemeId(v: unknown): v is SoundThemeId {
  return SOUND_THEMES.some((t) => t.id === v);
}

export interface ActionDef {
  id: SoundAction;
  label: string;
  /** A short name for the mixer strip. */
  short: string;
  /** One short sentence for Settings. */
  hint: string;
  /** Default pick: the theme's sound, or null = silent. */
  sound: typeof THEME_SOUND | null;
  /** Default volume 0..1 (multiplied by the master volume). */
  volume: number;
  /** The Pack theme's sample for this action (null = silent there). */
  pack: string | null;
  /** The volume the pack era used as default (v1 → v2 migration). */
  packVolume: number;
  /** An interface sound (quieted by the theme's motion setting); the rest report something. */
  ui: boolean;
}

const T = THEME_SOUND;
/** Settings order: interface first, then jobs, then edits, then problems. */
export const SOUND_ACTIONS: readonly ActionDef[] = [
  { id: 'hover', label: 'Hover', short: 'Hover', hint: 'The mouse reaches a button.', sound: null, volume: 0.5, pack: null, packVolume: 0.3, ui: true },
  { id: 'click', label: 'Click', short: 'Click', hint: 'A button is pressed.', sound: T, volume: 0.7, pack: 'buttons_sci_fi/sci_fi_button_click_in_01', packVolume: 0.55, ui: true },
  { id: 'toggleOn', label: 'Toggle on', short: 'On', hint: 'A switch or checkbox turns on.', sound: T, volume: 0.7, pack: 'basic/checkbox_tick_01', packVolume: 0.65, ui: true },
  { id: 'toggleOff', label: 'Toggle off', short: 'Off', hint: 'A switch or checkbox turns off.', sound: T, volume: 0.7, pack: 'basic/checkbox_tick_02', packVolume: 0.65, ui: true },
  { id: 'tab', label: 'Tab switch', short: 'Tab', hint: 'Another tab is picked.', sound: T, volume: 0.7, pack: 'basic/navigation_02', packVolume: 0.6, ui: true },
  { id: 'open', label: 'Open window', short: 'Open', hint: 'A window or panel opens.', sound: T, volume: 0.7, pack: 'basic/menu_open_fast_02', packVolume: 0.55, ui: true },
  { id: 'close', label: 'Close window', short: 'Close', hint: 'A window or panel closes.', sound: T, volume: 0.7, pack: 'basic/menu_close_03', packVolume: 0.55, ui: true },
  { id: 'queued', label: 'Job queued', short: 'Queued', hint: 'A job is sent to the server.', sound: T, volume: 0.7, pack: 'basic/selection_03', packVolume: 0.7, ui: false },
  { id: 'done', label: 'Job done', short: 'Done', hint: 'A picture or clip lands.', sound: T, volume: 0.7, pack: 'positive/item_acquired_01', packVolume: 0.8, ui: false },
  { id: 'allDone', label: 'All done', short: 'All done', hint: 'The last of several jobs lands.', sound: T, volume: 0.7, pack: 'positive/achievement_unlocked_01', packVolume: 0.8, ui: false },
  { id: 'download', label: 'Download done', short: 'Download', hint: 'A model download finishes.', sound: T, volume: 0.7, pack: 'positive/door_unlocked_05', packVolume: 0.75, ui: false },
  { id: 'success', label: 'Success', short: 'Success', hint: 'Something saved or applied.', sound: T, volume: 0.7, pack: 'positive/objective_reached_01', packVolume: 0.65, ui: false },
  { id: 'favorite', label: 'Favourite', short: 'Fav', hint: 'Something is starred.', sound: T, volume: 0.7, pack: 'inventory/item_equip_01', packVolume: 0.65, ui: false },
  { id: 'copy', label: 'Copy', short: 'Copy', hint: 'Something is copied.', sound: T, volume: 0.7, pack: 'inventory/item_pick_up_05', packVolume: 0.6, ui: false },
  { id: 'delete', label: 'Delete', short: 'Delete', hint: 'Something is deleted or removed.', sound: T, volume: 0.7, pack: 'negative/action_failed_05', packVolume: 0.45, ui: false },
  { id: 'undo', label: 'Undo', short: 'Undo', hint: 'An action is undone.', sound: T, volume: 0.7, pack: 'basic/navigation_03', packVolume: 0.6, ui: false },
  { id: 'redo', label: 'Redo', short: 'Redo', hint: 'An action is redone.', sound: T, volume: 0.7, pack: 'basic/navigation_05', packVolume: 0.6, ui: false },
  { id: 'notify', label: 'Status note', short: 'Note', hint: 'A note shows in the footer.', sound: null, volume: 0.6, pack: null, packVolume: 0.5, ui: false },
  { id: 'warning', label: 'Warning', short: 'Warn', hint: 'Something needs a look.', sound: T, volume: 0.7, pack: 'negative/warning_pop_up_01', packVolume: 0.7, ui: false },
  { id: 'error', label: 'Error', short: 'Error', hint: 'Something failed.', sound: T, volume: 0.7, pack: 'negative/error_message_01', packVolume: 0.75, ui: false },
  { id: 'dropOk', label: 'Drop accepted', short: 'Drop', hint: 'A drop lands on a drop zone.', sound: T, volume: 0.7, pack: 'inventory/item_drop_01', packVolume: 0.65, ui: false },
  { id: 'dropRejected', label: 'Drop refused', short: 'Refused', hint: 'A drop lands where it cannot go.', sound: T, volume: 0.7, pack: 'basic/button_click_rejection_01', packVolume: 0.65, ui: false },
];

export const ACTION_IDS: readonly SoundAction[] = SOUND_ACTIONS.map((a) => a.id);

export function actionDef(id: SoundAction): ActionDef | undefined {
  return SOUND_ACTIONS.find((a) => a.id === id);
}

/** What the user chose for one action. */
export interface ActionPick { sound: string | null; volume: number }
export type ActionPicks = Record<SoundAction, ActionPick>;

export const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** Every action at its default. */
export function defaultPicks(): ActionPicks {
  const out = {} as ActionPicks;
  for (const a of SOUND_ACTIONS) out[a.id] = { sound: a.sound, volume: a.volume };
  return out;
}

/** `synth:<theme>/<action>`: one synth sound, whatever the theme. */
export function synthId(theme: SynthThemeId, action: SoundAction): string {
  return `synth:${theme}/${action}`;
}

export function parseSynthId(id: string | null | undefined): { theme: SynthThemeId; action: SoundAction } | null {
  const m = /^synth:([a-z]+)\/([A-Za-z]+)$/.exec(id ?? '');
  if (!m || !(SYNTH_THEME_IDS as readonly string[]).includes(m[1]) || !(ACTION_IDS as readonly string[]).includes(m[2])) return null;
  return { theme: m[1] as SynthThemeId, action: m[2] as SoundAction };
}

/** What a pick plays now: a synth patch, a pack sample, or nothing. */
export type ResolvedSound = { kind: 'synth'; theme: SynthThemeId; action: SoundAction } | { kind: 'pack'; id: string } | null;

export function resolveSound(action: SoundAction, sound: string | null | undefined, theme: SoundThemeId): ResolvedSound {
  if (!sound) return null;
  if (sound === THEME_SOUND) {
    if (theme === 'pack') { const id = actionDef(action)?.pack; return id ? { kind: 'pack', id } : null; }
    return { kind: 'synth', theme, action };
  }
  const syn = parseSynthId(sound);
  if (syn) return { kind: 'synth', ...syn };
  if (sound.startsWith('synth:') || sound.startsWith('@')) return null;
  return { kind: 'pack', id: sound };
}

/** A pick's sound id is usable: the theme, a known synth id, or (with `known`) a pack id in the manifest. */
function validSound(v: string, known?: ReadonlySet<string>): boolean {
  if (v === THEME_SOUND) return true;
  if (v.startsWith('synth:')) return !!parseSynthId(v);
  if (v.startsWith('@')) return false;
  return !known || known.has(v);
}

/**
 * A saved (maybe old, partial or hand-edited) picks object → a full, valid one: unknown actions
 * dropped, missing ones at their default, volumes clamped, a sound id that is not a string or
 * not valid (pack ids checked against `known` when given) back to the default.
 */
export function mergePicks(saved: unknown, known?: ReadonlySet<string>): ActionPicks {
  const out = defaultPicks();
  if (!saved || typeof saved !== 'object') return out;
  const s = saved as Record<string, unknown>;
  for (const a of SOUND_ACTIONS) {
    const p = s[a.id] as Partial<ActionPick> | undefined;
    if (!p || typeof p !== 'object') continue;
    if (p.sound === null) out[a.id].sound = null;
    else if (typeof p.sound === 'string' && validSound(p.sound, known)) out[a.id].sound = p.sound;
    if (typeof p.volume === 'number') out[a.id].volume = clamp01(p.volume);
  }
  return out;
}

/**
 * Picks saved by the pack era (store version < 2): an action still on the pack's default sample
 * now follows the theme (and, at the old default volume, takes the new one); a sample picked by
 * hand stays.
 */
export function migratePicksV1(saved: unknown): unknown {
  if (!saved || typeof saved !== 'object') return saved;
  const s = saved as Record<string, unknown>;
  const out: Record<string, unknown> = { ...s };
  for (const a of SOUND_ACTIONS) {
    const p = s[a.id] as Partial<ActionPick> | undefined;
    if (!p || typeof p !== 'object') continue;
    const atDefault = p.sound === a.pack;
    const q: Partial<ActionPick> = { ...p };
    if (atDefault) q.sound = a.sound;
    if (atDefault && typeof p.volume === 'number' && Math.abs(p.volume - a.packVolume) < 0.005) q.volume = a.volume;
    out[a.id] = q;
  }
  return out;
}

/** True when the action is at its default sound and volume. */
export function isDefaultPick(id: SoundAction, p: ActionPick): boolean {
  const d = actionDef(id);
  return !!d && d.sound === p.sound && Math.abs(d.volume - p.volume) < 0.005;
}

export type Motion = 'full' | 'subtle' | 'off';

export const MAX_GAIN = 2;

/**
 * The gain one play gets, 0 = do not play: (master × action volume)^1.5 × 2.5, capped at 2.
 * The power curve makes the sliders feel even; the pack files sit at -16 dB RMS with ≥ 6 dB of
 * peak headroom and the synth sounds are scaled to their category's loudness with their peaks
 * under -1 dBFS at 2× (tests/synth.test.cjs), so 2× never clips.
 * Muted, no sound picked, or an interface sound quieted by the motion setting = 0:
 * motion "off" (or the OS reduced-motion setting) silences the interface sounds, "subtle" only
 * the hover; job, edit and problem sounds always play.
 */
export function playGain(opts: {
  master: number; volume: number; muted: boolean; sound: string | null;
  action?: SoundAction; motion?: Motion; reducedMotion?: boolean; followMotion?: boolean;
}): number {
  if (opts.muted || !opts.sound) return 0;
  if (opts.action && opts.followMotion !== false) {
    const def = actionDef(opts.action);
    const motion: Motion = opts.reducedMotion && opts.motion !== 'off' ? 'off' : (opts.motion ?? 'full');
    if (def?.ui && motion === 'off') return 0;
    if (opts.action === 'hover' && motion === 'subtle') return 0;
  }
  const g = clamp01(opts.master) * clamp01(opts.volume);
  return Math.min(MAX_GAIN, g ** 1.5 * 2.5);
}

/** `<folder>/<name>` → the file path under SOUND_BASE. */
export function soundPath(id: string, ext: 'ogg' | 'mp3' = 'ogg'): string {
  return `ui/${id}.${ext}`;
}

/** Joins the base (with or without a trailing slash) and a path. */
export function soundUrl(base: string, id: string, ext: 'ogg' | 'mp3' = 'ogg'): string {
  return `${base.replace(/\/+$/, '')}/${soundPath(id, ext)}`;
}

/** The old kinds (`@/lib/sounds`, before the pack) → an action; `toggle` picks by direction. */
export function actionOfKind(kind: string, on?: boolean): SoundAction | null {
  if (kind === 'toggle') return on === false ? 'toggleOff' : 'toggleOn';
  return (ACTION_IDS as readonly string[]).includes(kind) ? (kind as SoundAction) : null;
}

// ---- the picker ------------------------------------------------------------------------------

export interface PackSound { id: string; folder: string; label: string; duration: number; path: string }
export interface PackFolder { id: string; label: string }

/** Lower-case, accents and separators folded, for the picker's search. */
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[_\-/]+/g, ' ');

/** The picker's groups: every folder (in pack order) with its sounds matching every word of the query. */
export function groupSounds(sounds: readonly PackSound[], folders: readonly PackFolder[], query: string): Array<{ folder: PackFolder; sounds: PackSound[] }> {
  const words = norm(query).split(/\s+/).filter(Boolean);
  const out: Array<{ folder: PackFolder; sounds: PackSound[] }> = [];
  for (const f of folders) {
    const fl = norm(f.label);
    const hits = sounds.filter((s) => {
      if (s.folder !== f.id) return false;
      if (!words.length) return true;
      const hay = `${norm(s.label)} ${norm(s.id)} ${fl}`;
      return words.every((w) => hay.includes(w));
    });
    if (hits.length) out.push({ folder: f, sounds: hits });
  }
  return out;
}

// ---- which action a press is ------------------------------------------------------------------

/**
 * The action a press on a control plays (UiEffects' delegation), null = none (the action plays
 * from its own code, or a plain label). `data-sound="<action>|none"` on the control wins; then
 * its name (aria-label / title / text): Undo / Redo stay quiet here (undo() sounds itself),
 * Favourite / Star = favourite (un-starring = toggle off); then a switch / checkbox / pressed
 * button = toggle on / off by the state it flips to; then Delete / Remove = delete, Copy = copy;
 * a tab; a bare label = none; else a click.
 */
export function pressAction(c: { dataSound?: string | null; label?: string | null; role?: string | null; toggleTo?: boolean; tag?: string }): SoundAction | null {
  if (c.dataSound) {
    if (c.dataSound === 'none') return null;
    if ((ACTION_IDS as readonly string[]).includes(c.dataSound)) return c.dataSound as SoundAction;
  }
  const label = (c.label ?? '').trim().toLowerCase();
  if (/^(undo|redo)\b/.test(label)) return null;
  if (/^(un)?(favou?rite|star)\b|\b(add to|remove from) favou?rites\b/.test(label)) {
    return c.toggleTo === false || /^un|^remove from/.test(label) ? 'toggleOff' : 'favorite';
  }
  if (c.toggleTo !== undefined) return c.toggleTo ? 'toggleOn' : 'toggleOff';
  if (/^(delete|remove|trash)\b/.test(label)) return 'delete';
  if (/^copy\b/.test(label)) return 'copy';
  if (c.role === 'tab') return 'tab';
  if (c.tag === 'LABEL') return null;
  return 'click';
}

/**
 * A sound's name without the manifest: "Theme", "Glass · Job done", "None", or a pack id's name
 * (same rule as convert-sounds.cjs: "basic/checkbox_tick_01" → "Checkbox tick 1").
 */
export function labelOfId(id: string | null): string {
  if (!id) return 'None';
  if (id === THEME_SOUND) return 'Theme';
  const syn = parseSynthId(id);
  if (syn) return `${SOUND_THEMES.find((t) => t.id === syn.theme)?.label} · ${actionDef(syn.action)?.label}`;
  const name = id.slice(id.lastIndexOf('/') + 1).replace(/_/g, ' ').replace(/\b0+(\d)/g, '$1').replace(/\bsci fi\b/gi, 'sci-fi');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Mixer value box: "70" ↔ 0.7; anything unreadable = null. */
export function parsePercent(text: string): number | null {
  const t = String(text).replace(/[%\s]/g, '').replace(',', '.');
  const n = t ? Number(t) : NaN;
  return Number.isFinite(n) ? clamp01(Math.round(n) / 100) : null;
}
