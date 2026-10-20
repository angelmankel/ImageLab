/**
 * The Models screen (rule 13 + the models-picker brief): a full CivitAI browser.
 *   `ModelsModal`        — the one big picker every "Change ▾" / "+ Add" opens (and the rail can).
 *   `ModelsScreen`       — the route, same content full-bleed right of the rail.
 *   `ModelsPhoneScreen`  — the route on the phone: browse list + Filters sheet + a model opened full screen, one Back pill, no dock.
 * Logic from the main app (`@/`): the CivitAI key + IDB caches, the servers' hashes / file lists for
 * "installed", the download manager. Everything on screen is new, in this folder.
 */
import { DesktopBrowser, PhoneBrowser } from './ModelsBrowser';

export { ModelsModal } from './ModelsModal';
export type { ModelPick } from './pick';
export type { ModelKindKey } from './civitaiQuery';
export { openModelViewer, hasModelViewer, type ViewerTarget } from './viewerBridge';
export { useModels } from './modelsStore';

export function ModelsScreen() {
  return <DesktopBrowser />;
}

export function ModelsPhoneScreen() {
  return <PhoneBrowser />;
}
