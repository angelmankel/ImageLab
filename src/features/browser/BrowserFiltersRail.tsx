import { useState, useEffect, type ReactNode } from 'react';
import { useBrowserStore, type BrowserFilters, BROWSING_LEVEL_BITS, changedFilterCount } from './store';
import {
  Autocomplete, Button, Chip as MChip, Group as MGroup, SegmentedControl, Select, Stack, Switch, Text, TextInput, UnstyledButton,
} from '@mantine/core';
import { IconChevronDown, IconChevronUp, IconRefresh, IconSearch, IconUser, IconTag } from '@tabler/icons-react';
import {
  CIVITAI_COMMERCIAL_USE, CIVITAI_FILE_FORMATS, CIVITAI_MODEL_TYPES, CIVITAI_SORTS,
  type CivitaiSearchType, type CivitaiSearchSort, type CivitaiSearchPeriod,
} from '@/lib/civitai';
import { loadCivitaiSettings } from '@/lib/storage';
import { useStore } from '@/lib/store';

const TYPE_LABELS: Partial<Record<CivitaiSearchType, string>> = {
  LORA: 'LoRA', LoCon: 'LyCORIS', TextualInversion: 'Embedding', Controlnet: 'ControlNet',
  AestheticGradient: 'Aesthetic Gradient', MotionModule: 'Motion', TextEncoder: 'Text Encoder',
  CLIPVision: 'CLIP Vision', ComfyWorkflows: 'Comfy Workflows', VisionLanguage: 'Vision-Language',
};
export function typeLabel(t: string): string {
  return TYPE_LABELS[t as CivitaiSearchType] ?? t;
}

/** Shown without opening "More types". */
const MAIN_TYPES: CivitaiSearchType[] = ['Checkpoint', 'LORA', 'LoCon', 'DoRA', 'TextualInversion', 'VAE', 'Upscaler', 'Controlnet'];

// CivitAI's `baseModels` filter takes label strings exactly. The first row is what an SDXL-family
// user reaches for; the rest follow CivitAI's own catalog (sampled 2026-09, most used first).
const MAIN_BASE_MODELS = ['Illustrious', 'Pony', 'NoobAI', 'SDXL 1.0', 'SD 1.5', 'Anima', 'Flux.1 D', 'Krea 2', 'ZImageTurbo'];
const MORE_BASE_MODELS = [
  'Flux.1 S', 'Flux.1 Krea', 'Flux.2 D', 'Flux.2 Klein 9B', 'Flux.2 Klein 4B', 'Qwen', 'Chroma', 'HiDream',
  'ZImageBase', 'SD 3.5', 'SD 3', 'SD 2.1', 'SDXL Lightning', 'SDXL Turbo', 'Illustrious 1.0', 'Wan Video 2.2 T2V-A14B',
  'Wan Video 2.2 I2V-A14B', 'Wan Video 14B t2v', 'Hunyuan Video', 'LTXV 2.3', 'MiniMax H3', 'Other',
];

const PERIOD_OPTIONS: CivitaiSearchPeriod[] = ['Day', 'Week', 'Month', 'Year', 'AllTime'];

const RATING_OPTIONS: { label: string; bit: number }[] = [
  { label: 'G', bit: BROWSING_LEVEL_BITS.G },
  { label: 'PG', bit: BROWSING_LEVEL_BITS.PG },
  { label: 'PG-13', bit: BROWSING_LEVEL_BITS.PG13 },
  { label: 'R', bit: BROWSING_LEVEL_BITS.R },
  { label: 'X', bit: BROWSING_LEVEL_BITS.X },
  { label: 'XXX', bit: BROWSING_LEVEL_BITS.XXX },
];

const COMMERCIAL_LABELS: Record<string, string> = {
  None: 'Any use listed', Image: 'Sell images', RentCivit: 'Run on CivitAI', Rent: 'Run on other services',
  Sell: 'Sell the model', SellMerge: 'Sell merges',
};

/** A text filter that commits 350ms after typing stops, so each key press is not a request. */
function useDebounced(value: string, commit: (v: string) => void) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => {
    if (draft === value) return;
    const t = setTimeout(() => commit(draft.trim()), 350);
    return () => clearTimeout(t);
  }, [draft, value, commit]);
  return [draft, setDraft] as const;
}

/** The search box. On a phone it sits in the header instead of the rail. */
export function BrowserSearchInput({ size = 'xs' }: { size?: 'xs' | 'sm' }) {
  const query = useBrowserStore((s) => s.filters.query);
  const setFilters = useBrowserStore((s) => s.setFilters);
  const [draft, setDraft] = useDebounced(query, (q) => setFilters({ query: q }));
  return (
    <TextInput
      size={size}
      value={draft}
      onChange={(e) => setDraft(e.currentTarget.value)}
      placeholder="Name, tag, creator…"
      spellCheck={false}
      leftSection={<IconSearch size={14} />}
      aria-label="Search models"
    />
  );
}

/** Tag box with suggestions from CivitAI's tag list. */
function TagInput({ size }: { size: 'xs' | 'sm' }) {
  const tag = useBrowserStore((s) => s.filters.tag);
  const setFilters = useBrowserStore((s) => s.setFilters);
  const [draft, setDraft] = useDebounced(tag, (t) => setFilters({ tag: t }));
  const [options, setOptions] = useState<string[]>([]);
  useEffect(() => {
    const q = draft.trim();
    if (q.length < 2) { setOptions([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`https://civitai.com/api/v1/tags?limit=12&query=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => setOptions(((j?.items ?? []) as { name: string }[]).map((i) => i.name)))
        .catch(() => { /* suggestions are optional */ });
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [draft]);
  return (
    <Autocomplete
      size={size}
      value={draft}
      onChange={setDraft}
      onOptionSubmit={(v) => setFilters({ tag: v })}
      data={options}
      placeholder="e.g. anime, character, style"
      leftSection={<IconTag size={14} />}
      aria-label="Tag"
      comboboxProps={{ withinPortal: true, zIndex: 400 }}
      filter={({ options: o }) => o}
    />
  );
}

function CreatorInput({ size }: { size: 'xs' | 'sm' }) {
  const username = useBrowserStore((s) => s.filters.username);
  const setFilters = useBrowserStore((s) => s.setFilters);
  const [draft, setDraft] = useDebounced(username, (u) => setFilters({ username: u }));
  return (
    <TextInput size={size} value={draft} onChange={(e) => setDraft(e.currentTarget.value)} placeholder="Exact username"
      spellCheck={false} autoCapitalize="off" leftSection={<IconUser size={14} />} aria-label="Creator" />
  );
}

/** How many filters are on, for the phone's Filters button. */
export function activeFilterCount(f: BrowserFilters): number {
  return changedFilterCount(f);
}

/**
 * The filter rail: every filter the CivitAI /models endpoint takes, plus two it lacks that are
 * applied here (hide Early Access, installed on your servers). `sheet` renders the same controls
 * for the phone's bottom sheet: no rail frame, bigger controls, and no search box (the phone
 * header has it).
 */
export function BrowserFiltersRail({ filters, sheet, footer }: { filters: BrowserFilters; sheet?: boolean; footer?: ReactNode }) {
  const setFilters = useBrowserStore((s) => s.setFilters);
  const resetFilters = useBrowserStore((s) => s.resetFilters);
  const hasHashes = useStore((s) => s.modelHashes.length > 0);
  const hasKey = !!loadCivitaiSettings().apiKey.trim();
  const [moreTypes, setMoreTypes] = useState(false);
  const [moreBases, setMoreBases] = useState(false);
  const size = sheet ? 'sm' : 'xs';
  const changed = changedFilterCount(filters);

  const toggleIn = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const toggleRating = (bit: number) => {
    const next = (filters.browsingLevels & bit) ? filters.browsingLevels & ~bit : filters.browsingLevels | bit;
    setFilters({ browsingLevels: next });
  };
  const showCheckpointType = filters.types.length === 0 || filters.types.includes('Checkpoint');
  const types = moreTypes ? [...CIVITAI_MODEL_TYPES] : MAIN_TYPES;
  const bases = moreBases ? [...MAIN_BASE_MODELS, ...MORE_BASE_MODELS] : MAIN_BASE_MODELS;
  // Picked values stay visible even when their "More" list is folded.
  const shownTypes = [...types, ...filters.types.filter((t) => !types.includes(t))];
  const shownBases = [...bases, ...filters.baseModels.filter((b) => !bases.includes(b))];

  return (
    <aside className={sheet ? 'flex flex-col gap-5' : 'flex w-[248px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-border-subtle bg-bg-panel/60 px-3 py-4'}>
      <MGroup justify="space-between" wrap="nowrap">
        <SegmentedControl
          size={size}
          style={{ flex: 1 }}
          value={filters.catalog}
          onChange={(v) => setFilters({ catalog: v as BrowserFilters['catalog'] })}
          data={[
            { value: 'civitai', label: 'Civitai' },
            { value: 'red', label: <span title="civitai.red — full adult catalog">Civitai Red</span> },
          ]}
        />
      </MGroup>
      {changed > 0 && (
        <Button size="compact-sm" variant="subtle" color="gray" leftSection={<IconRefresh size={14} />} onClick={resetFilters}>
          Reset {changed} filter{changed === 1 ? '' : 's'}
        </Button>
      )}

      {!sheet && <Section label="Search"><BrowserSearchInput /></Section>}
      <Section label="Creator"><CreatorInput size={size} /></Section>
      <Section label="Tag"><TagInput size={size} /></Section>

      <Section label="Sort">
        <Select size={size} aria-label="Sort" value={filters.sort} allowDeselect={false}
          onChange={(v) => { if (v) setFilters({ sort: v as CivitaiSearchSort }); }}
          data={[...CIVITAI_SORTS]} comboboxProps={{ withinPortal: true, shadow: 'md', zIndex: 400 }} />
        <SegmentedControl size="xs" fullWidth value={filters.period} aria-label="Period"
          onChange={(v) => setFilters({ period: v as CivitaiSearchPeriod })}
          data={PERIOD_OPTIONS.map((p) => ({ value: p, label: p === 'AllTime' ? 'All' : p }))} />
      </Section>

      <Section label="Type" more={{ open: moreTypes, toggle: () => setMoreTypes((o) => !o), label: 'types' }}>
        <ChipRow>
          {shownTypes.map((t) => (
            <Chip big={sheet} key={t} active={filters.types.includes(t)} onClick={() => setFilters({ types: toggleIn(filters.types, t) })}>
              {TYPE_LABELS[t] ?? t}
            </Chip>
          ))}
        </ChipRow>
      </Section>

      {showCheckpointType && (
        <Section label="Checkpoint kind">
          <SegmentedControl size="xs" fullWidth value={filters.checkpointType || 'any'} aria-label="Checkpoint kind"
            onChange={(v) => setFilters({ checkpointType: v === 'any' ? '' : v as 'Trained' | 'Merge' })}
            data={[{ value: 'any', label: 'Any' }, { value: 'Trained', label: 'Trained' }, { value: 'Merge', label: 'Merge' }]} />
        </Section>
      )}

      <Section label="Base model" more={{ open: moreBases, toggle: () => setMoreBases((o) => !o), label: 'base models' }}>
        <ChipRow>
          {shownBases.map((b) => (
            <Chip big={sheet} key={b} active={filters.baseModels.includes(b)} onClick={() => setFilters({ baseModels: toggleIn(filters.baseModels, b) })}>
              {b}
            </Chip>
          ))}
        </ChipRow>
      </Section>

      <Section label="Rating">
        <ChipRow>
          {RATING_OPTIONS.map((r) => (
            <Chip big={sheet} key={r.bit} active={(filters.browsingLevels & r.bit) !== 0} onClick={() => toggleRating(r.bit)}>
              {r.label}
            </Chip>
          ))}
        </ChipRow>
      </Section>

      <Section label="Early access">
        <SegmentedControl size="xs" fullWidth value={filters.earlyAccess} aria-label="Early access"
          onChange={(v) => setFilters({ earlyAccess: v as BrowserFilters['earlyAccess'] })}
          data={[{ value: 'any', label: 'Any' }, { value: 'only', label: 'Only' }, { value: 'hide', label: 'Hide' }]} />
        <Text size="xs" c="dimmed">Early Access models cost Buzz to download until their free date.</Text>
      </Section>

      {hasHashes && (
        <Section label="On your servers">
          <SegmentedControl size="xs" fullWidth value={filters.installed} aria-label="Installed"
            onChange={(v) => setFilters({ installed: v as BrowserFilters['installed'] })}
            data={[{ value: 'any', label: 'Any' }, { value: 'only', label: 'Installed' }, { value: 'hide', label: 'Not installed' }]} />
        </Section>
      )}

      <Section label="File format">
        <ChipRow>
          {CIVITAI_FILE_FORMATS.map((f) => (
            <Chip big={sheet} key={f} active={filters.fileFormats.includes(f)} onClick={() => setFilters({ fileFormats: toggleIn(filters.fileFormats, f) })}>
              {f}
            </Chip>
          ))}
        </ChipRow>
      </Section>

      <Section label="License allows">
        <Select size={size} aria-label="License allows" value={filters.commercialUse || null} clearable placeholder="Anything"
          onChange={(v) => setFilters({ commercialUse: v ?? '' })}
          data={CIVITAI_COMMERCIAL_USE.map((c) => ({ value: c, label: COMMERCIAL_LABELS[c] ?? c }))}
          comboboxProps={{ withinPortal: true, shadow: 'md', zIndex: 400 }} />
      </Section>

      <Section label="More">
        <Stack gap={8}>
          <Toggle label="Generates on CivitAI" checked={filters.supportsGeneration} onChange={(v) => setFilters({ supportsGeneration: v })} />
          <Toggle label="Primary file only" checked={filters.primaryFileOnly} onChange={(v) => setFilters({ primaryFileOnly: v })} />
          {/* On the Red catalog NSFW is implied — the store forces nsfw=true on the request. */}
          {filters.catalog !== 'red' && (
            <Toggle label="Show NSFW" checked={filters.showNsfw} onChange={(v) => setFilters({ showNsfw: v })} />
          )}
          {hasKey ? (
            <>
              <Toggle label="My favorites" checked={filters.favorites} onChange={(v) => setFilters({ favorites: v })} />
              <Toggle label="My hidden models" checked={filters.hidden} onChange={(v) => setFilters({ hidden: v })} />
            </>
          ) : (
            <Text size="xs" c="dimmed">Add a CivitAI API key in Settings to filter by your favorites.</Text>
          )}
        </Stack>
      </Section>
      {footer}
    </aside>
  );
}

function Section({ label, children, more }: {
  label: string; children: ReactNode; more?: { open: boolean; toggle: () => void; label: string };
}) {
  return (
    <Stack gap={6}>
      <MGroup justify="space-between" wrap="nowrap">
        <Text size="xs" fw={600} c="dimmed">{label}</Text>
        {more && (
          <UnstyledButton onClick={more.toggle} className="flex items-center gap-1 text-[11px] text-[var(--mantine-color-dimmed)] hover:text-[var(--mantine-color-text)]">
            {more.open ? 'Fewer' : `More ${more.label}`}
            {more.open ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
          </UnstyledButton>
        )}
      </MGroup>
      {children}
    </Stack>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <Switch size="sm" label={label} checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} />;
}

function ChipRow({ children }: { children: ReactNode }) {
  return <MGroup gap={6}>{children}</MGroup>;
}

/** A filter toggle: v1's Mantine Chip (outline, check icon when on). */
function Chip({
  active, onClick, children, big,
}: { active: boolean; onClick: () => void; children: ReactNode; big?: boolean }) {
  return (
    <MChip size={big ? 'md' : 'xs'} variant="outline" checked={active} onChange={onClick}>
      {children}
    </MChip>
  );
}
