/**
 * The left panel's tab layout, as plain data: which tabs exist, in what order, what each is
 * called, and which of the panel's sections it holds. Every function here returns a new layout
 * and never mutates, so the store can hand the result straight to React.
 *
 * Deliberately import-free (tests load this file on its own in a `vm`).
 */

/** The panel's building blocks — the old accordion sections. */
export type SectionId = 'prompts' | 'models' | 'parameters' | 'composition' | 'enhancement' | 'input' | 'passes';

export const SECTION_IDS: readonly SectionId[] = ['prompts', 'models', 'parameters', 'composition', 'enhancement', 'input', 'passes'];

export interface PanelTab {
  id: string;
  label: string;
  /** Key into the UI's icon map; unknown keys fall back to a generic icon. */
  icon: string;
  sections: SectionId[];
  hidden?: boolean;
  /** Made by the user: can be deleted. Built-in tabs can only be hidden. */
  custom?: boolean;
}

export const MAX_LABEL = 24;
export const MAX_TABS = 12;

const DEFAULTS: readonly PanelTab[] = [
  { id: 'prompt', label: 'Prompt', icon: 'prompt', sections: ['prompts'] },
  { id: 'models', label: 'Models', icon: 'models', sections: ['models'] },
  { id: 'settings', label: 'Settings', icon: 'settings', sections: ['parameters', 'composition'] },
  { id: 'enhance', label: 'Enhance', icon: 'enhance', sections: ['enhancement'] },
  { id: 'input', label: 'Input', icon: 'input', sections: ['input'] },
  { id: 'passes', label: 'Passes', icon: 'passes', sections: ['passes'] },
];

export function defaultTabs(): PanelTab[] {
  return DEFAULTS.map(t => ({ ...t, sections: [...t.sections] }));
}

/** The built-in tab a section starts in. */
export function defaultTabOf(section: SectionId): string {
  return DEFAULTS.find(t => t.sections.includes(section))!.id;
}

const isSection = (v: unknown): v is SectionId => typeof v === 'string' && (SECTION_IDS as readonly string[]).includes(v);

function cleanLabel(label: unknown, fallback: string): string {
  const text = typeof label === 'string' ? label.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL) : '';
  return text || fallback;
}

/**
 * Repairs whatever came out of storage into a layout the UI can trust: unknown or repeated
 * sections are dropped, a section that went missing returns to its built-in tab, a built-in tab
 * that went missing is added back at the end, and at least one tab with sections stays visible.
 */
export function normalizeTabs(raw: unknown): PanelTab[] {
  if (!Array.isArray(raw)) return defaultTabs();
  const seenTabs = new Set<string>();
  const seenSections = new Set<SectionId>();
  const tabs: PanelTab[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const t = item as Partial<PanelTab>;
    if (typeof t.id !== 'string' || !t.id || seenTabs.has(t.id)) continue;
    const builtIn = DEFAULTS.find(d => d.id === t.id);
    if (!builtIn && !t.custom) continue;
    seenTabs.add(t.id);
    const sections: SectionId[] = [];
    for (const s of Array.isArray(t.sections) ? t.sections : []) {
      if (isSection(s) && !seenSections.has(s)) { seenSections.add(s); sections.push(s); }
    }
    tabs.push({
      id: t.id,
      label: cleanLabel(t.label, builtIn?.label ?? 'Tab'),
      icon: typeof t.icon === 'string' && t.icon ? t.icon : builtIn?.icon ?? 'star',
      sections,
      ...(t.hidden ? { hidden: true } : {}),
      ...(builtIn ? {} : { custom: true }),
    });
    if (tabs.length >= MAX_TABS + DEFAULTS.length) break;
  }
  for (const d of DEFAULTS) {
    if (!seenTabs.has(d.id)) tabs.push({ ...d, sections: [] });
  }
  for (const s of SECTION_IDS) {
    if (seenSections.has(s)) continue;
    tabs.find(t => t.id === defaultTabOf(s))!.sections.push(s);
  }
  if (!tabs.some(t => !t.hidden && t.sections.length)) {
    const first = tabs.find(t => t.sections.length);
    if (first) delete first.hidden;
  }
  return tabs;
}

export function tabOfSection(tabs: readonly PanelTab[], section: SectionId): PanelTab | undefined {
  return tabs.find(t => t.sections.includes(section));
}

function move<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Drag-and-drop reorder: `fromId` takes `toId`'s place. */
export function moveTab(tabs: readonly PanelTab[], fromId: string, toId: string): PanelTab[] {
  const from = tabs.findIndex(t => t.id === fromId);
  const to = tabs.findIndex(t => t.id === toId);
  if (from < 0 || to < 0 || from === to) return [...tabs];
  return move(tabs, from, to);
}

export function moveTabBy(tabs: readonly PanelTab[], id: string, delta: number): PanelTab[] {
  const from = tabs.findIndex(t => t.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= tabs.length) return [...tabs];
  return move(tabs, from, to);
}

const patchTab = (tabs: readonly PanelTab[], id: string, patch: (t: PanelTab) => PanelTab) =>
  tabs.map(t => t.id === id ? patch(t) : t);

export function renameTab(tabs: readonly PanelTab[], id: string, label: string): PanelTab[] {
  const fallback = DEFAULTS.find(d => d.id === id)?.label ?? 'Tab';
  return patchTab(tabs, id, t => ({ ...t, label: cleanLabel(label, fallback) }));
}

export function setTabIcon(tabs: readonly PanelTab[], id: string, icon: string): PanelTab[] {
  return patchTab(tabs, id, t => ({ ...t, icon }));
}

/** Hiding the last visible tab that has anything in it is refused: the panel would be empty. */
export function setTabHidden(tabs: readonly PanelTab[], id: string, hidden: boolean): PanelTab[] {
  const next = patchTab(tabs, id, t => {
    const { hidden: _drop, ...rest } = t;
    return hidden ? { ...rest, hidden: true } : rest;
  });
  return next.some(t => !t.hidden && t.sections.length) ? next : [...tabs];
}

/** Moves a section to the end of another tab (or to `index` in it). */
export function moveSection(tabs: readonly PanelTab[], section: SectionId, toTabId: string, index?: number): PanelTab[] {
  if (!tabs.some(t => t.id === toTabId)) return [...tabs];
  return tabs.map(t => {
    const sections = t.sections.filter(s => s !== section);
    if (t.id !== toTabId) return sections.length === t.sections.length ? t : { ...t, sections };
    const at = index == null ? sections.length : Math.max(0, Math.min(sections.length, index));
    sections.splice(at, 0, section);
    return { ...t, sections };
  });
}

/** Moves a section up or down inside its own tab. */
export function moveSectionBy(tabs: readonly PanelTab[], section: SectionId, delta: number): PanelTab[] {
  return tabs.map(t => {
    const from = t.sections.indexOf(section);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= t.sections.length) return t;
    return { ...t, sections: move(t.sections, from, to) };
  });
}

export function addTab(tabs: readonly PanelTab[], id: string, label = 'Favorites', icon = 'star'): PanelTab[] {
  if (tabs.some(t => t.id === id) || tabs.filter(t => t.custom).length >= MAX_TABS) return [...tabs];
  return [...tabs, { id, label: cleanLabel(label, 'Tab'), icon, sections: [], custom: true }];
}

/** Deletes a custom tab. Its sections go back to their built-in tabs, which are shown again. */
export function removeTab(tabs: readonly PanelTab[], id: string): PanelTab[] {
  const gone = tabs.find(t => t.id === id);
  if (!gone?.custom) return [...tabs];
  return tabs.filter(t => t.id !== id).map(t => {
    const back = gone.sections.filter(s => defaultTabOf(s) === t.id);
    if (!back.length) return t;
    const { hidden: _drop, ...rest } = t;
    return { ...rest, sections: [...t.sections, ...back] };
  });
}

/**
 * The tabs on the bar: visible ones holding at least one section available right now (a canvas
 * layer has no Composition or Input). A hidden tab still shows while it is the active one, so a
 * jump to one of its sections never lands on nothing.
 */
export function barTabs(tabs: readonly PanelTab[], available: readonly SectionId[], activeId?: string | null): PanelTab[] {
  return tabs.filter(t => (!t.hidden || t.id === activeId) && t.sections.some(s => available.includes(s)));
}

/** The tab to show: the remembered one if it is on the bar, else the first on the bar. */
export function resolveActive(bar: readonly PanelTab[], activeId: string | null | undefined): string | null {
  if (activeId && bar.some(t => t.id === activeId)) return activeId;
  return bar[0]?.id ?? null;
}

/** Old accordion ids (`imagelab.panelSections.v1`) and whether each started folded. */
const OLD_SECTIONS: readonly [string, SectionId, boolean][] = [
  ['workspace-prompts', 'prompts', false],
  ['models', 'models', true],
  ['workspace-base', 'parameters', false],
  ['workspace-composition', 'composition', false],
  ['inputimage', 'input', true],
  ['workspace-enhancement', 'enhancement', true],
  ['workspace-passes', 'passes', false],
];

/**
 * First visit after the switch from accordions: open the tab holding the topmost section that
 * was open before, so the panel opens where the person left it.
 */
export function activeFromOldSections(collapsed: unknown, tabs: readonly PanelTab[]): string {
  const map = collapsed && typeof collapsed === 'object' ? collapsed as Record<string, unknown> : {};
  for (const [oldId, section, folded] of OLD_SECTIONS) {
    const isFolded = typeof map[oldId] === 'boolean' ? map[oldId] as boolean : folded;
    if (!isFolded) {
      const tab = tabOfSection(tabs, section);
      if (tab && !tab.hidden) return tab.id;
    }
  }
  return tabs.find(t => !t.hidden && t.sections.length)?.id ?? DEFAULTS[0].id;
}
