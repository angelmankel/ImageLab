/**
 * screens/image/settings — the Settings tab (rule 5). Owner: model-settings agent.
 *   SettingsTab   the Image step's tab body
 *   SizeControl   aspect ratio + longest side + manual W/H, reusable by the Upscale step
 *   size.ts       the pure maths (tests/size.test.cjs)
 */
export { SettingsTab } from './SettingsTab';
export { SizeControl } from './SizeControl';
export { DetailCard } from './DetailCard';
export { SamplingRows } from './SamplingRows';
export { AspectButton } from './AspectButton';
export * from './size';
