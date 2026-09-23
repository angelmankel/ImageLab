import { useState, useEffect } from 'react';
import { useBrowserStore, type BrowserFilters, BROWSING_LEVEL_BITS } from './store';
import { Chip as MChip, Group as MGroup, Paper, SegmentedControl, Select, Stack, Text, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import type { CivitaiSearchType, CivitaiSearchSort, CivitaiSearchPeriod } from '@/lib/civitai';
import { Switch } from '@/components/ui/Switch';

const TYPE_OPTIONS: { id: CivitaiSearchType; label: string }[] = [
  { id: 'Checkpoint',       label: 'Checkpoint' },
  { id: 'LORA',             label: 'LoRA' },
  { id: 'TextualInversion', label: 'Embedding' },
  { id: 'VAE',              label: 'VAE' },
  { id: 'Controlnet',       label: 'ControlNet' },
  { id: 'Upscaler',         label: 'Upscaler' },
];

// CivitAI's `baseModels` filter takes label strings exactly — we mirror their
// values (with spaces / casing) so the API accepts them. The first cluster
// here covers ~90% of what an SDXL-focused user will hit; the secondary
// cluster covers the rest.
const BASE_MODELS: string[] = [
  'SD 1.5', 'SD 2.1', 'SDXL 1.0', 'Pony', 'Illustrious',
  'NoobAI', 'Flux.1 D', 'Flux.1 S', 'SD 3', 'SD 3.5',
];

const SORT_OPTIONS: CivitaiSearchSort[] = [
  'Highest Rated', 'Most Downloaded', 'Most Liked', 'Newest',
];

const PERIOD_OPTIONS: CivitaiSearchPeriod[] = ['AllTime', 'Year', 'Month', 'Week', 'Day'];

/** CivitAI's rating ladder, in the order users expect to see them. */
const RATING_OPTIONS: { label: string; bit: number }[] = [
  { label: 'G',     bit: BROWSING_LEVEL_BITS.G },
  { label: 'PG',    bit: BROWSING_LEVEL_BITS.PG },
  { label: 'PG-13', bit: BROWSING_LEVEL_BITS.PG13 },
  { label: 'R',     bit: BROWSING_LEVEL_BITS.R },
  { label: 'X',     bit: BROWSING_LEVEL_BITS.X },
  { label: 'XXX',   bit: BROWSING_LEVEL_BITS.XXX },
];

/** Left filter rail. All chip toggles route through the store's `setFilters`
 *  which kicks a refresh; the search box debounces 350ms so each keystroke
 *  doesn't fire a request. */
export function BrowserFiltersRail({ filters }: { filters: BrowserFilters }) {
  const setFilters = useBrowserStore((s) => s.setFilters);

  // Local mirror for the search input so typing is instant; commit on debounce.
  const [searchDraft, setSearchDraft] = useState(filters.query);
  useEffect(() => { setSearchDraft(filters.query); }, [filters.query]);
  useEffect(() => {
    if (searchDraft === filters.query) return;
    const t = setTimeout(() => setFilters({ query: searchDraft.trim() }), 350);
    return () => clearTimeout(t);
  }, [searchDraft, filters.query, setFilters]);

  const toggleType = (id: CivitaiSearchType) => {
    const has = filters.types.includes(id);
    setFilters({ types: has ? filters.types.filter((t) => t !== id) : [...filters.types, id] });
  };
  const toggleBase = (b: string) => {
    const has = filters.baseModels.includes(b);
    setFilters({ baseModels: has ? filters.baseModels.filter((x) => x !== b) : [...filters.baseModels, b] });
  };
  const toggleRating = (bit: number) => {
    const next = (filters.browsingLevels & bit) ? filters.browsingLevels & ~bit : filters.browsingLevels | bit;
    setFilters({ browsingLevels: next });
  };

  return (
    <aside className="flex w-[220px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-border-subtle bg-bg-panel/60 px-3 py-4">
      <Group label="Catalog">
        <SegmentedControl
          size="xs"
          fullWidth
          value={filters.catalog}
          onChange={(v) => setFilters({ catalog: v as BrowserFilters['catalog'] })}
          data={[
            { value: 'civitai', label: 'Civitai' },
            { value: 'red', label: <span title="civitai.red — full adult catalog">Civitai Red</span> },
          ]}
        />
      </Group>

      <Group label="Search">
        <TextInput
          size="xs"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.currentTarget.value)}
          placeholder="Name, tag, creator…"
          spellCheck={false}
          leftSection={<IconSearch size={14} />}
        />
      </Group>

      <Group label="Type">
        <ChipRow>
          {TYPE_OPTIONS.map((t) => (
            <Chip key={t.id} active={filters.types.includes(t.id)} onClick={() => toggleType(t.id)}>
              {t.label}
            </Chip>
          ))}
        </ChipRow>
      </Group>

      <Group label="Base model">
        <ChipRow>
          {BASE_MODELS.map((b) => (
            <Chip key={b} active={filters.baseModels.includes(b)} onClick={() => toggleBase(b)}>
              {b}
            </Chip>
          ))}
        </ChipRow>
      </Group>

      <Group label="Rating">
        <ChipRow>
          {RATING_OPTIONS.map((r) => (
            <Chip key={r.bit} active={(filters.browsingLevels & r.bit) !== 0} onClick={() => toggleRating(r.bit)}>
              {r.label}
            </Chip>
          ))}
        </ChipRow>
      </Group>

      <Group label="Sort">
        <Select
          size="xs"
          aria-label="Sort"
          value={filters.sort}
          onChange={(v) => { if (v) setFilters({ sort: v as CivitaiSearchSort }); }}
          data={SORT_OPTIONS}
          allowDeselect={false}
          comboboxProps={{ withinPortal: true, shadow: 'md' }}
        />
      </Group>

      <Group label="Period">
        <Select
          size="xs"
          aria-label="Period"
          value={filters.period}
          onChange={(v) => { if (v) setFilters({ period: v as CivitaiSearchPeriod }); }}
          data={PERIOD_OPTIONS}
          allowDeselect={false}
          comboboxProps={{ withinPortal: true, shadow: 'md' }}
        />
      </Group>

      {/* On the Red catalog NSFW is implied — the store forces nsfw=true on
          the request so per-model preview galleries return their adult
          samples. Hiding the toggle keeps the UI honest. */}
      {filters.catalog !== 'red' && (
        <Paper withBorder radius="sm" px="xs" py={8}>
          <MGroup gap="xs" wrap="nowrap">
            <Switch
              size="sm"
              checked={filters.showNsfw}
              onCheckedChange={(on) => setFilters({ showNsfw: on })}
              ariaLabel="Show NSFW results"
            />
            <Text size="xs">Show NSFW</Text>
          </MGroup>
        </Paper>
      )}
    </aside>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack gap={6}>
      <Text size="xs" fw={600} c="dimmed">{label}</Text>
      {children}
    </Stack>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <MGroup gap={6}>{children}</MGroup>;
}

/** A filter toggle: v1's Mantine Chip (outline, check icon when on). */
function Chip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <MChip size="xs" variant="outline" checked={active} onChange={onClick}>
      {children}
    </MChip>
  );
}
