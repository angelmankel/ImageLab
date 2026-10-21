/**
 * The pages m-shell owns in the phone map (mobile pass): Home (the origin) and Settings, plus
 * stand-ins (`fallback: true`) for kinds other owners register — the create flow ('step') and the
 * places ('library', 'models', 'comfy') — so the phone keeps working until theirs land. A real
 * registration always replaces a stand-in.
 */
import { IconBoltFilled, IconDice5Filled, IconPhoto, IconPlus, IconSparkles } from '@tabler/icons-react';
import { useRoute } from '~/app/routeStore';
import { useSessions, displayName } from '~/app/sessionsStore';
import { HomeScreen } from '~/screens/home/HomeScreen';
import { PlacePills } from '~/screens/home/HomeTopBar';
import { Logo, Wordmark } from '~/screens/image/TopBar';
import { LibraryPhoneScreen } from '~/screens/library';
import { ModelsPhoneScreen } from '~/screens/models';
import { ComfyPhoneScreen } from '~/screens/comfy';
import { SettingsPhoneScreen } from '~/screens/settings';
import { PhoneStepScreen } from '~/screens/phone/PhoneStepScreen';
import { StepsStrip } from '~/screens/phone/StepsStrip';
import { useGenerate } from '~/screens/phone/imageBridge';
import { usePhone } from '~/screens/phone/phoneStore';
import { toggleSeedMode } from '~/screens/phone/phoneLogic';
import { useSteps } from '~/app/stepsStore';
import { usePhoneLandscape } from '~/app/useFormFactor';
import { usePhoneBand } from './band';
import { registerPhonePage, setScreenPath } from './pages';
import { haptic } from '../haptic';

/* ---------- Home: depth 0, the origin ---------- */

function HomePage() {
  const cur = useSessions((s) => s.sessions[s.currentId]);
  usePhoneBand({
    left: { label: 'New', icon: <IconPlus size={18} stroke={2.6} />, onClick: () => { useSessions.getState().create(); useRoute.getState().go('step'); } },
    right: cur ? { label: displayName(cur.name), icon: <IconSparkles size={17} stroke={2.4} />, onClick: () => useRoute.getState().go('step') } : null,
  });
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--il-bg)' }}>
      <div style={{ height: 52, flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', paddingTop: 'env(safe-area-inset-top, 0px)', boxSizing: 'content-box' }}>
        <Logo size={28} />
        <Wordmark size={16} />
      </div>
      <div className="il-scroll" style={{ flex: 'none', overflowX: 'auto', overflowY: 'hidden', touchAction: 'pan-x', padding: '0 12px 8px', scrollbarWidth: 'none' }}>
        <PlacePills phone />
      </div>
      <HomeScreen phone />
    </div>
  );
}

registerPhonePage('home', { Component: HomePage, title: () => 'Home', screen: 'home', header: false, pair: false });

/* ---------- Settings (m-shell) ---------- */

registerPhonePage('settings', { Component: () => <div style={{ position: 'absolute', inset: 0 }}><SettingsPhoneScreen /></div>, title: () => 'Settings', screen: 'settings', header: false });

/* ---------- stand-ins for the places (m-browse registers the real ones) ---------- */

const wrap = (C: () => JSX.Element | null) => () => <div style={{ position: 'absolute', inset: 0 }}><C /></div>;
registerPhonePage('library', { Component: wrap(LibraryPhoneScreen), title: () => 'History', screen: 'library', header: false, fallback: true });
registerPhonePage('models', { Component: wrap(ModelsPhoneScreen), title: () => 'Models', screen: 'models', header: false, fallback: true });
registerPhonePage('comfy', { Component: wrap(ComfyPhoneScreen), title: () => 'ComfyUI', screen: 'comfy', header: false, fallback: true });

/* ---------- stand-in for the create flow (m-create registers session / step / section) ---------- */

function LegacyStep() {
  const { generate, generateRandom } = useGenerate();
  const seedMode = usePhone((s) => s.seedMode);
  const page = usePhone((s) => s.page);
  const setPage = usePhone((s) => s.setPage);
  const setActive = useSteps((s) => s.setActive);
  const land = usePhoneLandscape(); // landscape: the step screen draws its own steps strip
  usePhoneBand({
    left: page === 'create'
      ? { label: 'Output', icon: <IconPhoto size={18} stroke={2.2} />, onClick: () => setPage('output') }
      : { label: 'Create', icon: <IconSparkles size={18} stroke={2.2} />, onClick: () => setPage('create') },
    right: {
      label: 'Generate', tone: 'primary', icon: seedMode === 'random' ? <IconDice5Filled size={18} /> : <IconBoltFilled size={18} />,
      onClick: () => (seedMode === 'random' ? generateRandom() : generate()),
      onHold: () => { haptic('hold'); usePhone.getState().setSeedMode(toggleSeedMode(usePhone.getState().seedMode)); },
    },
  });
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      {!land && (
        <div style={{ flex: 'none', padding: 'calc(6px + env(safe-area-inset-top, 0px)) 8px 6px', background: 'var(--il-bg-deep)' }}>
          <StepsStrip onJump={(id) => setActive(id)} />
        </div>
      )}
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}><PhoneStepScreen framed /></div>
    </div>
  );
}

registerPhonePage('step', { Component: LegacyStep, title: () => 'Create', screen: 'step', header: false, pair: false, fallback: true });
setScreenPath('step', () => [{ kind: 'home' }, { kind: 'step' }], { fallback: true });
