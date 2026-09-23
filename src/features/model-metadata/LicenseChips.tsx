import { Badge, Group } from '@mantine/core';
import { IconCheck, IconX } from '@tabler/icons-react';
import type { CivitaiModel } from './civitai';
import { Section } from './Section';

/** Civitai license flags rendered as allowed/denied chips. */
export function LicenseChips({ model }: { model: CivitaiModel }) {
  const commercialUse = model.allowCommercialUse ?? [];
  const perms: { label: string; allowed: boolean }[] = [
    {
      label: 'Commercial use',
      allowed: commercialUse.length > 0 && !commercialUse.includes('None'),
    },
    { label: 'No credit required', allowed: model.allowNoCredit },
    { label: 'Derivatives OK', allowed: model.allowDerivatives },
    { label: 'Different license OK', allowed: model.allowDifferentLicense },
  ];
  return (
    <Section label="License">
      <Group gap={6}>
        {perms.map((p) => (
          <Badge
            key={p.label}
            size="sm"
            variant="light"
            color={p.allowed ? 'green' : 'red'}
            tt="none"
            leftSection={p.allowed ? <IconCheck size={12} /> : <IconX size={12} />}
          >
            {p.label}
          </Badge>
        ))}
      </Group>
    </Section>
  );
}
