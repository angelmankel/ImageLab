/**
 * The base checkpoint's model type, opened from the cog on its tile: which type it runs as (found
 * from CivitAI, or picked by hand) and that type's quality tags as toggle pills. The tags are
 * fixed text — only their on/off is the user's. They join the prompt at generate time, in front.
 */
import { useMediaQuery } from '@mantine/hooks';
import { Badge, Chip, Group, Modal, Stack, Text } from '@mantine/core';
import { useStore } from '@/lib/store';
import { Select } from '@/components/ui/Select';
import { useModelProfile } from '@/hooks/useModelProfileSync';
import { PROFILE_IDS, profileTagOn, withProfileTag, type ModelProfile, type ProfileTag } from '@/lib/modelProfiles';
import { modelLabel } from './modelInfo';

const AUTO = '__auto__';
const FAMILY_LABELS = { sd15: 'Stable Diffusion 1.5', sdxl: 'SDXL' } as const;

export function ModelProfileModal({ opened, onClose, fileName }: { opened: boolean; onClose: () => void; fileName: string }) {
  const narrow = useMediaQuery('(max-width: 48em)') ?? false;
  const workflow = useStore((s) => s.workflow);
  const setWorkflow = useStore((s) => s.setWorkflow);
  const { profile, detected } = useModelProfile();
  const override = workflow.modelProfileOverrides?.[fileName];

  const setOverride = (v: string) => {
    const next = { ...workflow.modelProfileOverrides };
    if (v === AUTO) delete next[fileName];
    else next[fileName] = v;
    setWorkflow({ modelProfileOverrides: next });
  };
  const detectedLabel = detected === undefined ? 'checking…' : detected ?? 'unknown';

  return (
    <Modal opened={opened} onClose={onClose} centered fullScreen={narrow} size="md"
      title={<Text fw={600}>Model type · {modelLabel(fileName)}</Text>}>
      <Stack gap="md">
        <Stack gap={4}>
          <Text size="sm" fw={500}>Model type</Text>
          <Select
            value={override ?? AUTO}
            ariaLabel="Model type"
            onValueChange={setOverride}
            options={[{ value: AUTO, label: `Auto (${detectedLabel})` }, ...PROFILE_IDS.map((id) => ({ value: id, label: id }))]}
          />
          <Text size="xs" c="dimmed">
            {profile
              ? `Runs the ${FAMILY_LABELS[profile.family]} graph. New picks of this type start at ${profile.defaults.width}×${profile.defaults.height}.`
              : 'No known type: runs the SDXL graph with no quality tags and no LoRA filter.'}
          </Text>
        </Stack>
        {profile && tagGroups(profile).map((g) => <TagPills key={g.title} profile={profile} title={g.title} list={g.list} />)}
        {profile?.separator && (
          <Text size="xs" c="dimmed">{profile.separator} is added after the quality tags when any is on, so your prompt starts a fresh chunk.</Text>
        )}
        {profile && profile.tags.length === 0 && <Text size="sm" c="dimmed">This type adds no quality tags.</Text>}
      </Stack>
    </Modal>
  );
}

/** Pills under a heading each: the tag's own group, else positive / negative quality tags. */
function tagGroups(profile: ModelProfile): { title: string; list: ProfileTag[] }[] {
  const out: { title: string; list: ProfileTag[] }[] = [];
  for (const t of profile.tags) {
    const title = t.kind === 'negative' ? 'Negative quality tags' : t.group ? `${t.group} tags` : 'Quality tags';
    const g = out.find((x) => x.title === title);
    if (g) g.list.push(t); else out.push({ title, list: [t] });
  }
  return out;
}

function TagPills({ profile, title, list }: { profile: ModelProfile; title: string; list: ProfileTag[] }) {
  const workflow = useStore((s) => s.workflow);
  const setWorkflow = useStore((s) => s.setWorkflow);
  const kind = list[0].kind;
  const on = list.filter((t) => profileTagOn(workflow, profile, t)).length;
  return (
    <Stack gap={6}>
      <Group justify="space-between">
        <Text size="sm" fw={500}>{title}</Text>
        <Badge size="sm" variant="light" color={kind === 'positive' ? 'teal' : 'red'}>{on}/{list.length} on</Badge>
      </Group>
      <Group gap={6}>
        {list.map((t) => (
          <Chip key={t.id} size="sm" variant="light" color={kind === 'positive' ? 'teal' : 'red'}
            checked={profileTagOn(workflow, profile, t)}
            onChange={(checked) => setWorkflow(withProfileTag(useStore.getState().workflow, profile, t, checked))}>
            {t.text}
          </Chip>
        ))}
      </Group>
    </Stack>
  );
}
