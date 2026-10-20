/** The Model tab of the Image step (rule 4): the universal list with the Image step's four kinds. */
import { ModelList } from './ModelList';
import { IMAGE_KINDS } from './kindSpecs';

export function ModelTab() {
  return <ModelList kinds={IMAGE_KINDS} />;
}
