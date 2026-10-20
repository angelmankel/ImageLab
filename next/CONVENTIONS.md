# ImageLab `next/` — how the pieces fit (read before writing code)

The next UI. A separate Vite app, served at `https://comfyui-ygo.blueoceanswim.com/imagelab/next/`.
Spec = `../../agent-handoffs/next-ui-brief-2026-10-19.md` (15 hard rules) + the mockup boards in
`../../agent-handoffs/next-ui-mockups/*.dc.html` (row A · Ember + Library/Models/Comfy boards; ignore B, C).
The boards are plain HTML with inline styles: their colours, sizes, radii and layout ARE the spec.

## Layout
```
next/
  src/main.tsx              providers (Mantine Ember theme, modals, notifications)
  src/theme/tokens.ts       T: every colour/size/radius/gap/z. Never invent a colour.
  src/theme/mantineTheme.ts Mantine wears Ember; main-app Tailwind tokens map onto it
  src/styles/next.css       imports the MAIN app's sheet (needed by reused viewer), then Ember globals,
                            CSS vars --il-*, .il-scroll, .il-glass, .il-eyebrow
  src/app/routeStore.ts     hash router: screen = step | library | models | comfy | settings; go(), back()
  src/app/stepsStore.ts     the chain of steps (rule 2): steps[], activeId, addStep, removeStep, updateStep
  src/app/useIsPhone.ts     ONE breakpoint (<768px = phone)
  src/app/actions.ts        cross-screen actions (usePromptFrom, reuseSettingsFrom, sendToStep, applyGenerationData)
  src/app/queue.ts          useQueue(): rows / running / queued / cancel (rule 15)
  src/ui/                   shared primitives: Chip, Pill, Count, Dot, IconBtn, Sep, Tabs, Panel, SliderRow, Switch, Card, Eyebrow, Row, GlassBar, BackPill
  src/screens/image/        DesktopShell, TopBar, Rail, the step screen (StepPanel + tabs, Stage, Toolbar, HistoryPanel)
  src/screens/phone/        PhoneShell: dock, swipe between steps, Create + Output pages
  src/screens/library/      LibraryScreen + LibraryPhoneScreen
  src/screens/models/       ModelsScreen + ModelsPhoneScreen
  src/screens/comfy/        ComfyScreen + ComfyPhoneScreen
  src/screens/settings/     SettingsScreen + SettingsPhoneScreen
  tests/*.test.cjs          node --test; pure logic only
```
Aliases: `@/…` = the MAIN app's `../src` (logic reuse). `~/…` = this app's `src`.
No node_modules here: everything resolves from `../node_modules` (one React 18, one Mantine 8, one zustand).
Do not add dependencies without asking the orchestrator. Icons: `@tabler/icons-react`.

## Ownership (one owner per folder; touch only yours)
| Agent | Owns | Exports others rely on |
|---|---|---|
| shell-image (Fable) | `screens/image/*`, `app/actions.ts`, `app/queue.ts`, `app/stepsStore.ts` | `DesktopShell`, `TopBar`/`Logo`, `Rail`, `ImageScreen`; step tabs `PromptTab`, `InputTab`; `StepPanel` + `Stage` + `Toolbar` + `HistoryPanel` reusable by the phone |
| model-settings (Fable) | `screens/image/model/*`, `screens/image/settings/*` | `ModelTab`, `SettingsTab`, `ModelList` (the universal list component), `SizeControl` |
| phone (Opus) | `screens/phone/*` | `PhoneShell` |
| library (Opus) | `screens/library/*` | `LibraryScreen`, `LibraryPhoneScreen` |
| models (Fable) | `screens/models/*` | `ModelsScreen`, `ModelsPhoneScreen` |
| comfy (Opus) | `screens/comfy/*`, `screens/settings/*` | `ComfyScreen`, `ComfyPhoneScreen`, `SettingsScreen`, `SettingsPhoneScreen`, `workflowStore` |
Shared `ui/*` and `theme/*`: add a primitive only if two screens need it; keep the existing APIs stable (add props, don't rename).
If you need something from another owner's folder, import its exported name and, if it does not exist yet, write against the name listed above and tell the orchestrator in your report.

## Look (from the boards)
Font Manrope, 13px base, weights 700/800 for labels. Page #141416, panels #1A1A1E, cards #222228,
pills #1C1C21, hairlines #26262C, ember #F0863A (+ #FFB36B hover), ok green #3DD68C.
Radii: pills 999, cards 14, panels 16, chips 999. Tight: panel padding 10, card padding 10, gaps 6–8.
Nothing ever overlaps the picture. No Simple/Advanced. No preset slots. No mode tabs.

## Logic reuse (import from `@/`, never copy)
- Generation store: `@/lib/store` (`useStore`: workflow, layers, servers, serverInfo, jobs, history, cancelJob, setWorkflow, add/update/remove Checkpoint/Lora/Embedding, pushHistory…).
- Queue/run: `@/lib/comfy.ts`, `@/lib/comfyBus.ts` (ONE websocket per host — never `new WebSocket`), `@/lib/comfyRunner.ts`, `@/features/generate/*` (how the old app submits an image job — find `queuePrompt`/`generate`).
- Video + workflow runs: `@/features/video/videoRun.ts`, `@/features/studio/studioRun.ts`, `@/features/workspace/modeHost.ts`.
- CivitAI: `@/lib/civitai.ts`, `@/lib/civitaiCache.ts`, `@/features/browser/*`, `@/features/models/*`.
- Prompt library: `@/lib/promptLibrary.ts`, `@/lib/promptMine.ts`, `@/features/next/CivitaiLibrary.tsx`, `MinePrompts.tsx`, `@/lib/venice.ts` (LLM "Write it").
- Snippets: `@/lib/snippetLibrary.ts`, `@/lib/chips.ts`. Fullscreen: `@/components/FullscreenImage`, `@/components/VideoFullscreen`, `@/hooks/usePager`, `@/lib/pager.ts`, `@/hooks/useSwipe`.
- History/collections: `@/features/history/*`, `@/features/collections/*`, `@/lib/favorites.ts`, `@/lib/jobsDb.ts`.
- Server info/roles: `@/lib/serverRoles.ts`, `@/hooks/useVideoServerProbe.ts`, `@/hooks/useComfyConnection.ts`, `@/lib/routing.ts`.
Zustand selectors are compared by reference: never return a fresh array/object from a selector (React error #185); use a module-level frozen empty.

## Working rules
- Do NOT `git add`/`commit`/`push`, do NOT push to the pod. The orchestrator integrates, ships, commits.
- Verify with `cd ImageLab/next && npm run typecheck && npm run test && npm run build`. Type errors in files you do not own belong to someone else mid-edit: ignore them, report them, do not fix them.
- No screenshots, no browser tests. Donny tests on the pod.
- Phone: every scroll container needs `touch-action: pan-y`; sliders: track `touch-action: pan-y`, thumb `touch-none`. Nothing overlays the picture. Use `GlassBar` / `BackPill`.
- Write small files, one component each, a short header comment saying what it is and which rule it serves.
- Finish with a report: what you built (files), what is wired to real logic vs stubbed, anything another owner must do, and known gaps.
