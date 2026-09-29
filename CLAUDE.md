# ImageLab — the web front end

**Every change Donny asks for ships at once, without asking:** push it to the running pod, then
commit + push here, then move the pin in ImageLabDocker. Full rule: `../ImageLabDocker/CLAUDE.md`,
rule 6.

React + Vite. Built to `dist/`, which is **committed** because ImageLabDocker bakes it into the
pod image at a pinned commit.

**Changing it on a running pod needs no rebuild** — `scripts/push.sh <ip:port>` from
ImageLabDocker copies `dist/` onto the pod's volume. Build first:

```sh
npm run build
```

## Things that will bite you

- **One websocket per ComfyUI host.** `src/lib/comfyBus.ts` owns it and fans messages out. ComfyUI
  keeps exactly one socket per client id, so opening a second silently deafens the first. Never
  call `new WebSocket` against a pod directly.
- **`src/lib/comfyHost.ts` imports nothing.** It holds `clientId` and the URL builders precisely so
  `comfy.ts` and `comfyBus.ts` do not import each other — that cycle resolves to `undefined`
  depending on which module the bundler reaches first.
- **Zustand selectors are compared by reference.** `s.map[key] ?? []` builds a new array every
  render and loops forever (React error #185). Use a module-level frozen empty.
- **A flex child shrinks by default.** Panel sections are `shrink-0`; without it each card squashes
  the one below and clips its own contents.
- **`touch-none` on a full-width control kills scrolling.** The slider root is `touch-pan-y` and
  only the thumb is `touch-none`.
- **Mobile has no overlays by design.** The generate view's drawers are mutually exclusive and the
  top bar uses flow layout, not absolute tracks — absolute tracks cannot see each other and stack
  on a narrow screen.

- **The UI is v1's (Mantine 8 + Tabler icons).** `modules/theme` + `stores/theme-store.ts` build the
  Mantine theme; every Tailwind colour token in `styles/index.css` reads a Mantine CSS var, so
  Tailwind and Mantine parts always match. Font is Inter, always.
- **One popover base.** `components/ui/popover.tsx` (Radix-shaped parts on Mantine Popover: portal,
  flip, shift). Never hand-roll a positioned dropdown — the nav rail is z-70 and ate every z-50 one.
  Layers: rail 70, modals 200, fullscreen viewer 250, popovers 300, confirm 400.
- **Parameter UI comes from `components/fields`** (v1 SliderField, SelectField, SeedField,
  DimensionsField, LoopbackField…). `ParamRow` and `ui/Field` wrap them.
- **Phones get `layout/MobileShell`** for the Generate view: Parameters / Image / Gallery tabs and a
  floating Generate button that switches to Image only once a job is really queued.
- **It installs as a PWA** (`public/manifest.json`, `public/sw.js`). Install needs HTTPS — the
  Traefik domain, not the bare pod ip:port. The service worker fetches index.html network-first,
  so a push to the pod shows up on the next launch.

## The two views

- **Generate** uses one left workspace with tabs (Prompt, Models, Settings, Enhance, Input,
  Passes by default). Generation controls stay at the bottom with a live sampler progress bar,
  a seed field, Auto toggle, and a separate New seed action. Status follows tracked jobs, never
  a leftover status string. Completion must not depend on a mounted canvas controller.
- **The left panel is tabbed** (`features/panel`). The old accordion sections are the building
  blocks (`sections.tsx`: body, icon, live summary/badge); the user owns which tab holds which
  section, the order, names, icons and hidden tabs (`lib/panelTabs.ts`, pure + tested; store
  `panelTabsStore.ts`, `imagelab.panelTabs.v1`). Tabs mount on first visit and stay mounted, so
  scroll and open editors survive a switch. Alt+1…9 opens the Nth tab; the summary strip jumps to a
  section. The toolbar (`PanelToolbar`) keeps the five preset slots (`paramPresets.ts`), which hold
  the workflow and prompt parts, never the input image.
- **Desktop side panels are docked and resizable.** Widths live in `layout/panelLayout.ts`
  (persisted); `PanelResizeHandle` drags, folds past the minimum, and resets on double-click.
- **Sounds** (`lib/sounds.ts`): a blip on queue, a chime on the live completion path only — the
  reconcile path would chime for every job that finished while the page was away.
- **The font is Inter everywhere**, bundled via `@fontsource-variable/inter`. Themes still carry
  a `font` field for old saved themes, but it no longer applies.
- **Loopback** (v1's hires fix, `workflow.loopback`) expands into refine passes that run before
  the Passes list (`loopbackPasses` in `lib/pipeline.ts`).
- **Passes** (`lib/pipeline.ts`) run in the displayed order: refine, upscale, resize, or remove
  background. Each can be duplicated, moved, bypassed, or removed. Old finishing flags are read
  as steps until the list is edited; existing workflows keep their settings. Same-size refinement
  still samples. Inpainting skips refinement to preserve the masked stitch. Background removal
  uses the installed BiRefNet_toonout model; its optional widget defaults must be sent explicitly.
- **Prompt presets** reuse the existing snippet storage. Older snippets remain available;
  full presets carry positive and negative parts with their weights and on/off states. Insert
  appends; Replace on a single-kind preset preserves the other kind. Replacement and deletion
  offer Undo. Edits save as typed, and every operation has a click target for trackpad use.
- **Studio** (`features/studio`) drives *any* workflow saved in ComfyUI, read live from
  `/object_info` plus the saved graph. Its own store (`studioStore.ts`) is deliberately separate
  from the generate view's. Each workflow has **keywords** (its own tags) and shares a **prompt**
  with the other workflows unless it opts out; both are joined, keywords first, into the workflow's
  positive text box, which is auto-detected and can be re-pointed. History comes from the server's
  `/history`, so it survives a reload and shows other clients' runs too.

- **Model types and graph families** (`lib/modelProfiles.ts`, pure + tested). A *family* is how
  the graph is wired: `lib/graphs/index.ts` picks a builder per family. `graphs/core.ts` is the
  shared part (prompts, LoRAs, img2img, inpaint, Loopback, Passes); each family file only adds
  its loaders — `sd.ts` (`sd15`, `sdxl`: CheckpointLoaderSimple) and, through `diffusion.ts`
  (UNETLoader + own text encoder + VAELoader; no clip skip, no inpaint ControlNet), `anima.ts`,
  `flux.ts` (DualCLIPLoader clip_l + T5, FluxGuidance 3.5 as node "6"), `zimage.ts` and `qwen.ts`
  (CLIPLoader lumina2 / qwen_image + ModelSamplingAuraFlow). Flux and Z-Image rendered on the pod
  (lyhAnimeFlux + a Flux LoRA, moodyProMix); Qwen only checked against `/prompt`. An all-in-one
  checkpoint of these types (in checkpoints/, e.g. a Qwen AIO) loads through
  CheckpointLoaderSimple with its own text encoder and VAE: GenerateButton sets
  `workflow.baseFile` from the target server's lists at queue time. Wan video models are kept
  out of the Generate picker and quick search (`isWanName` / the 'Wan Video' bucket).
  Diffusion-model-only files (`UNETLoader`'s list) are folded into `server.models`, so they show
  in the checkpoint picker; the type picks the loader. A *profile* is a CivitAI base-model type
  (SD 1.5, SDXL, Pony, Illustrious, NoobAI, Anima / Anima Turbo, Flux / Flux Schnell, Z-Image
  Turbo, Qwen; the second of each pair by file name): its family, start
  values, quality tags and which LoRA/embedding types fit. `hooks/useModelProfileSync` (mounted
  in App) keeps `workflow.modelProfile` in step with the base checkpoint ('' = checked, no
  known type; undefined = never checked). Within the SDXL types a change moves only values still
  at the old type's default; across settings groups (SD 1.5 · SDXL types · Anima) the sampler
  settings, size and VAE are saved per group (`workflow.typeSettings`) and the other group's come
  back. An old workflow's first check is not a switch, except to Anima. SD 1.5 gets its own size
  presets (`SD15_DIMENSION_PRESETS`) and inpaints at 512² when the size is auto. Quality tags are pills (cog on the checkpoint tile, or the "Model
  type" row under the snippets), never text; they lead the prompt at generate time. Pony adds
  `BREAK` after them — `applyBreaks` (pipeline.ts) turns BREAK into separate CLIPTextEncodes
  joined by ConditioningConcat, since ComfyUI's encoder would read it as a word. Trigger words
  skip words the type's pills own. LoRA/embedding pickers show only fitting types until
  "Show all"; the VAE select shows only the family's VAEs until its switch is on.

- **Video** (`features/video`, rail button under Generate) — Wan 2.2 A14B text→video and
  image→video. Its own store (`videoStore.ts`, `imagelab.video.v1`); the graph is
  `lib/wanGraph.ts` (pure + tested): two experts (high noise for steps 0..switch, low noise after),
  each with its own LoRAs (`LoraLoaderModelOnly`) and `ModelSamplingSD3` shift, saved as MP4 via
  `SaveVideo` (`format: "mp4", codec: "h264"` works in API format) to `output/video/`. It runs
  through Studio's runner (`useComfyRun` in `studio/useStudioRun.ts`, which takes a graph source
  and a `keep` filter — Video keeps only video files) and Studio's `ResultView`, which plays video.
  The Wan models are not in models.txt yet: the page lists what the server lacks, and fills in
  installed stand-ins (`pickInstalledWanFiles`). **Fast mode** (default on) adds the mode's
  lightx2v 4-step LoRA to each expert, 4 steps, switch at 2, CFG 1: ~6x faster (A100, 832x480x33:
  18.6 s vs 117 s). Phones get `components/VideoFullscreen` (tap, drag to seek, rotate; never the
  Fullscreen API — Chrome's Android banner cannot be hidden). **Upscale** (off by default): an
  upscale model (fast SPAN 2xNomosUni first) then an exact even-sized `ImageScale`, or a plain
  resize, before the MP4. **Time estimate** (`lib/videoEstimate.ts`, tested): `useComfyRun` times
  each node from `executing` events (`onFinished`); `wanRunTiming` splits a run into sampling /
  upscale / finish / load; rates are medians of warm runs per server (`videoTimings.ts`,
  `imagelab.video.timings.v1`), cold runs (models changed) give the loading cost.

**The seed trap.** The ComfyUI editor gives any INT named `seed` / `noise_seed` a
`control_after_generate` slot even when `/object_info` does not declare one, and saves the extra
`"randomize"` in `widgets_values`. `lib/workflowGraph.ts` mirrors that rule. Break it and every
widget after a seed is read one slot off — it showed up as steps reading "randomize".

## Verifying

Do not drive Donny's mouse. Use the offscreen harness in ImageLabDocker:

```sh
node scripts/lab-check.mjs <url> [shot.png]
```

Changing the app on a running pod takes no image rebuild: `npm run build` here, then
`scripts/push.sh <ip:port>` from ImageLabDocker. That is also how a change gets tested for real —
the LAN boxes are behind on ImageLabCore, so `/imagelab/api/*` only answers on a pod.

**The project rules — pods, money, pulling images before a terminate — live in
`../ImageLabDocker/CLAUDE.md`.**
