/** The Model tab of the Image step (rule 4): the universal list with all four kinds. */
import { ModelList } from './ModelList';

export function ModelTab() {
  return <ModelList kinds={['checkpoint', 'lora', 'embedding', 'controlnet']} />;
}
