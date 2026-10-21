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
- **Mobile has no overlays by design.** The phone workspace is tabs and full-screen pages, never
  drawers; its bars use flow layout, not absolute tracks — absolute tracks cannot see each other
  and stack on a narrow screen.

- **The UI is v1's (Mantine 8 + Tabler icons).** `modules/theme` + `stores/theme-store.ts` build the
  Mantine theme; every Tailwind colour token in `styles/index.css` reads a Mantine CSS var, so
  Tailwind and Mantine parts always match. Font is Inter, always.
- **One popover base.** `components/ui/popover.tsx` (Radix-shaped parts on Mantine Popover: portal,
  flip, shift). Never hand-roll a positioned dropdown — the nav rail is z-70 and ate every z-50 one.
  Layers: rail 70, modals 200, fullscreen viewer 250, popovers 300, confirm 400.
- **Parameter UI comes from `components/fields`** (v1 SliderField, SelectField, SeedField,
  DimensionsField, LoopbackField…). `ParamRow` and `ui/Field` wrap them.
  A slider can say what its two ends do: `ends={[low, high]}` on `SliderField`, `StrengthControl`,
  `ParamRow` and Loopback's rows renders `fields/RangeEnds` under the track ("← quicker · more detail →").
  Every advanced video and image slider has one; keep each side to a few words.
- **Phones get `workspace/MobileWorkspace`** for every mode: the mode switch and job tray on top,
  Create / Result / Gallery tabs, the run bar pinned at the bottom (Stop while it runs), the seed row
  above it. Create is a settings list (`components/SettingsPager`; the rows per mode are in
  `workspace/mobileCreate.tsx`): one row per section with its live summary, Simple / Advanced on top;
  a row slides its section in full screen with Back and previous / next. Swipe right on a page =
  back (`hooks/useSwipe`, thresholds in `lib/swipe.ts`, tested; a touch on a slider, text box,
  sortable or sideways scroller is never a swipe); the phone's back button works too (the open page
  holds one history entry). Swipe left on the list goes to Result. Every scroll container in there
  needs `touch-action: pan-y` of its own. The bottom bar (`layout/MobileNav`) has one **Create**
  entry for the workspace, which returns to the last mode.
- **It installs as a PWA** (`public/manifest.json`, `public/sw.js`). Install needs HTTPS — the
  Traefik domain, not the bare pod ip:port. The service worker fetches index.html network-first,
  so a push to the pod shows up on the next launch.

## The workspace

- **One workspace, three modes.** Image, Video and Workflow are modes of one layout, on desktop
  (`features/desktop`, see "Desktop layout") and phone (`features/workspace/MobileWorkspace`). The
  mode *is* `canvasStore.mainView` (`generate` / `video` / `studio`; `lib/workspace.ts`, pure +
  tested: `modeOfView`, `viewOfMode`, `isWorkspaceView`), so nothing saved migrated and
  `setMainView('video')` still means "go to Video". `useViewSwitching` keys every workspace view as
  one, so a mode switch never remounts the shell. `workspace/WorkspaceView` picks the shell by width.
- **Simple by default, Advanced on request.** One global switch (`workspace/workspaceStore.ts`,
  `imagelab.workspace.v1`, `detail`; seeded from Studio's old "advanced" once). Each section has a
  tier (`sectionTier` / `videoSectionTier` in `lib/workspace.ts`): Simple shows Prompts, Models,
  Composition, Input image (video: Mode & input, Prompt, Size & length) plus the Quick tweaks block
  (`workspace/QuickTweaks.tsx`: steps, CFG, images; video: Fast, length); Advanced shows every
  section. Nothing is removed by Simple, only folded away; a quick-search "show section" that lands
  on a hidden section switches to Advanced. Workflow mode's Simple is the pinned controls.
- **The building blocks** (`components/blocks`, one file each, used by both shells): `SectionCard`
  (folding card with icon, live summary, badge), `FieldRow`, `SliderRow` (one-line slider),
  `Segmented`, `ChipPicker` / `ChipButton`, `ResultsStrip` (thumbnails, current outlined),
  `HeroResult` (the big latest result, swipeable — see "Swiping results"; live preview and progress while
  busy; a tap opens fullscreen; children float over it), `RunBar` (big Generate that becomes Stop, progress along its bottom),
  `JobTray` (one pill per running job across modes), `ModeSwitch`, `DetailToggle`. Results from
  every mode share one shape, `ResultItem` (`workspace/results.ts`: `useImageResults` with the
  history entry attached, `useVideoResults`, `useWorkflowResults`). The image sections themselves
  are unchanged (`features/panel/sections.tsx`: body, icon, live summary/badge); the user still owns
  their order and hidden tabs (`lib/panelTabs.ts`, pure + tested; `panelTabsStore.ts`,
  `imagelab.panelTabs.v1`). `PanelToolbar` keeps the five preset slots (`paramPresets.ts`), which
  hold the workflow and prompt parts, never the input image. `usePanelScope` / `SeedRow` live in
  `workspace/imageScope.tsx`.
- **Images and video run at the same time.** Image jobs are the generate store's `jobs` (per
  server, persisted in IndexedDB) as before. Video and Workflow runs live in module-level stores
  made by `lib/comfyRunner.ts` (`video/videoRun.ts` → `useVideoRun` / `startVideoRun(host)`,
  `studio/studioRun.ts` → `useWorkflowRun` / `startWorkflowRun(host, info)`): a run keeps going,
  reporting and collecting results when its view unmounts; the store listens on the shared bus
  while a view is attached or a run is in flight. `useRunStore` (`studio/useStudioRun.ts`) is a
  view's handle with the old `StudioRun` shape. Each mode's shell shows only its own run; the job
  tray shows all of them.
- **Which server runs what** (`lib/serverRoles.ts`, pure + tested). A `Server` has an optional
  `role` (Settings → Servers → "Runs"); unset, a host whose path is `/video-comfy` is the video
  server. Video goes to a video-role server when one exists, images never go to a video-only
  server (the image round-robin filters them out), and with one server both modes share it as
  before. `workspace/modeHost.ts` (`useModeHost(mode)`) picks the host for Video and Workflow. A host
  may carry a path (`pod:8188/video-comfy`): `comfyHost.ts` just appends to it. The pod's second
  ComfyUI is found by `hooks/useVideoServerProbe` (reads `<origin>/pod/logs/instances.json`, then
  `/video-comfy/system_stats`; 502 while it starts) and added as "This pod · video".
- **Snippets are one tap.** `layers/SnippetChips.tsx`, under each prompt box inside `PromptFields`:
  a chip row (in the prompt first, then recently used — `workspaceStore.recentSnippetIds` — then the
  rest; `chipOrder`, tested), tap to add or take out. "Suggest" asks the AI helper
  (`brainstormSnippets` from the current prompt, with an optional hint) and shows the answers as
  chips; tapping one adds it to the prompt and the library, with Undo. "All…" is the old library
  window (`SnippetsModal`). Generation controls keep the live sampler progress, a seed field, Auto
  and New seed; status follows tracked jobs, never a leftover status string; completion must not
  depend on a mounted canvas controller.
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
- **Workflow mode (Studio, `features/studio`)** drives *any* workflow saved in ComfyUI, read live
  from `/object_info` plus the saved graph. Its own store (`studioStore.ts`) is deliberately
  separate from the generate view's; the panels (`StudioPanels.tsx`: `WorkflowPicker`,
  `PromptPanel`, `ParamList`) are what both shells render, and `ParamList` follows the workspace's
  Simple / Advanced (pinned controls only, or everything with a pin on each). Each workflow has **keywords** (its own tags) and shares a **prompt**
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

- **Video mode** (`features/video`) — Wan 2.2 A14B text→video and image→video. Its own store (`videoStore.ts`, `imagelab.video.v1`); the graph is
  `lib/wanGraph.ts` (pure + tested): two experts (high noise for steps 0..switch, low noise after),
  each with its own LoRAs (`LoraLoaderModelOnly`) and `ModelSamplingSD3` shift, saved as MP4 via
  `SaveVideo` (`format: "mp4", codec: "h264"` works in API format) to `output/video/`. It runs
  through the video run store (`video/videoRun.ts`, a `lib/comfyRunner.ts` store with a `keep`
  filter — only video files) and shows in the workspace's `HeroResult`, which plays video.
  **Sections:** nine (`video/sections.tsx`; order, live summaries and missing files per section
  in `lib/videoSections.ts`, tested): Mode & input · Prompt · Models · LoRAs · Size & length ·
  Speed & sampling · Guidance & speedups · Upscale · Finish & encode; Simple shows the first, second and fifth. Seed, Generate and the
  estimate stay pinned at the bottom on both shells. The Wan models are not in models.txt yet: the page lists what the server lacks, and fills in
  installed stand-ins (`pickInstalledWanFiles`). **Fast mode** (default on) adds the mode's
  lightx2v 4-step LoRA to each expert, 4 steps, switch at 2, CFG 1: ~6x faster (A100, 832x480x33:
  18.6 s vs 117 s). Phones get `components/VideoFullscreen` (tap, drag to seek, rotate; never the
  Fullscreen API — Chrome's Android banner cannot be hidden). **Upscale** (off by default): an
  upscale model (fast SPAN 2xNomosUni first) then an exact even-sized `ImageScale`, or a plain
  resize, before the MP4. **Time estimate** (`lib/videoEstimate.ts`, tested): the run store times
  each node from `executing` events (`onFinished`); `wanRunTiming` splits a run into sampling /
  upscale / finish / load; rates are medians of warm runs per server (`videoTimings.ts`,
  `imagelab.video.timings.v1`), cold runs (models changed) give the loading cost. **Send to video**
  (`video/sendToVideo.ts`: result actions, history tiles, fullscreen viewer, Collections) fetches the
  image, uploads it to the video mode's server (`modeHostNow('video')`) and sets it as the i2v start
  frame, then switches to Video; a portrait image flips a
  landscape size. Both image drop zones (img2img and Studio/Video's `ImageInput`) pick from past
  generations (`InputImageBrowserModal`) and take dropped history thumbnails.
- **Wan LoRA pairs (10-20).** `VideoLora.nameLow` = the low-noise file of a two-file Wan 2.2 LoRA: `name` loads on the high expert at `strength`, `nameLow` on the low one at `strengthLow ?? strength`, `expert` is moot for a pair; absent = the old single-file path, byte for byte (tested). The next UI's video LoRA card shows both slots; a CivitAI pick whose version ships both files fills the pair and downloads the non-primary half by URL (`startUrlDownload`).
- **Video parameters and add-ons (10-18).** Every knob past the basics is optional in `VideoSettings`
  and off by default; `loadVideoSettings` (wanGraph.ts, tested) fills the defaults for an old saved
  `imagelab.video.v1`, and `tests/wan-graph.test.cjs` proves such a save still builds the very same
  graph. Nodes were read from ComfyUI v0.34.5 and KJNodes at the pinned commit, not guessed; **none
  of the new steps has run on a pod yet.** Advanced tier: per-expert CFG (`cfgLow`) and shift
  (`shiftLow`), `weightDtype`, the LoRA's own low-expert strength, the **Fast recipe** (`fastRecipe`:
  steps, switch, CFG, lightx2v strength per expert, and the **motion pass** — `motionSteps` first
  steps on the high expert *without* the speed LoRA at `motionCfg`, node `11p` chained off loader `1`
  as `1p…`; the community's fix for lightx2v's slow-motion look), the speed-LoRA files, an **end
  image** (`WanFirstLastFrameToVideo`, same outputs as `WanImageToVideo`), **Guidance & speedups**
  (`CFGZeroStar`, KJNodes `WanVideoNAG` fed the negative node 8 — the negative prompt at CFG 1 —,
  `EasyCache`, core `TorchCompileModel`, `WanContextWindowsManual` for long T2V clips; chained after
  the shift as `1t 1c 1n 1e 1w`), **Finish & encode** (KJNodes `ColorMatchV2` back to the start frame
  as `13m`; core RIFE / FILM `FrameInterpolationModelLoader` + `FrameInterpolate` as `17m` / `17` after
  the upscale, fps multiplied; `SaveVideo` container / codec / CRF through the dynamic-combo dotted keys
  `format.codec`, `format.codec.encoding`, `format.codec.encoding.crf` — the default stays the plain
  `format: mp4, codec: h264` pair that ran on the pod). `ServerInfo.interpolationModels` lists
  `models/frame_interpolation`. Both tiers: **presets** (`lib/videoPresets.ts` + `video/videoPresets.ts`,
  `imagelab.video.presets.v1`: the recipe without prompt, pictures or seed) and **sweeps**
  (`lib/videoSweep.ts` + `video/videoSweep.ts`: "vary one setting across N runs", seed held unless it is
  the axis; the sweep store watches `useVideoRun` and starts the next item when a run ends; every
  result is labelled by url in `imagelab.video.labels.v1`). `startVideoRun(host, override)` takes a
  settings override for that. The desktop hero shows the label and a **Compare A/B** modal
  (`video/CompareVideos.tsx`, two clips played together). The estimate's `RunShape.outFrames` counts
  interpolated frames in the finish stage; node groups are `WAN_NODE_GROUPS`.

- **MiniMax H3 (10-19)** is the Video mode's second *engine* (`VideoSettings.engine: 'wan' | 'h3'`,
  a segmented switch at the top of Mode & input; every older save is `wan` and builds the same graph).
  Its settings are `VideoSettings.h3` (`H3Settings` in `wanGraph.ts`: task t2v / i2v (first + optional
  last frame, the shared `startImage` / `endImage`) / ref (up to 9 `refImages`), the fl2va / ref2va
  checkpoints, Qwen3-VL text encoder, video + audio VAE, own LoRAs, 32-multiple size, 17k+5 frames at
  a fixed 24 fps, steps / CFG / sampler / video + audio shift, `audio` on/off, the lightx2v turbo
  LoRAs with their own step counts, KJNodes low-VRAM patches). The graph is `lib/h3Graph.ts`
  (`buildH3Graph`, `buildVideoGraph` picks by engine; tested in `tests/h3-graph.test.cjs`): one
  `UNETLoader` → turbo LoRA → LoRAs → `MiniMaxH3SigmaShift` → patches; `CLIPLoader type: minimax`;
  `MiniMaxH3ImageToVideo` (t2v / fl2v) or `MiniMaxH3ReferenceToVideo` (autogrow keys
  `ref_images.ref_image_N`) give positive + the joint AV latent; `KSampler` at CFG 1 with a
  `ConditioningZeroOut` negative (what the templates' `BasicGuider` does), `VAEDecode` (video half)
  + `VAEDecodeAudio` (`13a`), `CreateVideo` at 24 fps with the audio, `SaveVideo` as
  `video/ImageLab_H3_<TASK>`. Node ids match the Wan graph, so the estimate, upscale, interpolation,
  colour match and encode are shared. **A file named `ImageLab_H3*` has a soundtrack**: the hero,
  the fullscreen viewer and the phone player render it unmuted (`lib/videoAudio.ts`, falling back
  to muted when the browser refuses unmuted autoplay). Sweeps have their own H3 axes
  (`sweepAxesFor`), presets drop `refImages`. Pickers keep H3 files out of the image views
  (`isVideoModelName`). Checked only against `/object_info` and `/prompt` validation on the pod
  (ComfyUI 0.34.5 has the nodes); **no H3 clip has been rendered from here yet** — Donny tests.
- **AI helpers** (`lib/ai.ts`, ONE entry point: `aiChat` + the prompt writers and vision
  helpers; `aiReady` / `aiNotReadyHint` / `withChatModel` / `visionModelOf`, never test a key
  directly) call the **active provider** of `settings.ai` (`lib/aiProviders.ts`, pure + tested:
  the supported catalogue — Local/Ollama, OpenRouter, OpenAI, Anthropic, DeepSeek, Gemini, Groq,
  Mistral, xAI, Together, Venice —, `migrateVeniceSettings` (the old `imagelab.venice.v1` becomes
  a Local entry + a Venice entry once, `loadAiSettings` in storage.ts), per-adapter
  `chatRequest` / `modelsRequest` / `parseModels` / `parseChatReply`). One active provider, no
  fallback; each entry has its own key, model, vision model, base URL and a `tested` flag that a
  changed key or URL resets. Local is always in the list and cannot be removed. Model lists come
  from each provider's own endpoint, filtered to chat models (`features/ai/aiModelsStore.ts`,
  shared by every picker). Ollama runs on winold (192.168.0.83:11434, RTX A4500) and is reached
  over HTTPS at `llm.blueoceanswim.com` through Traefik — the page is HTTPS, so the plain-http
  address is mixed content. Local calls send `reasoning_effort: "none"` (Ollama's think-off).
  A pod runs its own Ollama too (ImageLabDocker `start.sh`, nginx `/llm/`, same origin so its
  basic auth carries over): the Local page's "Where it runs" switches its URL between Home PC
  and This pod (`podLlmUrl()` in `lib/storage.ts`). The model manager (`features/ai`: list, pull
  with progress, delete, unload, Hugging Face GGUF browser) uses `lib/localLlm.ts`; the pure
  parts are `lib/llmModels.ts` (tested). The classic Settings → AI tab reads the same store
  (active provider, model, prompt style, the local manager); keys are entered and tested in the
  next UI's Settings → AI helper (`next/src/screens/settings/ai/*`).

- **Style references (the next UI's Style tab, 10-20).** `WorkflowState.styleRefs` (`lib/styleRefs.ts`, pure + tested in
  `next/tests/styleGraph.test.cjs` / `styleTab.test.cjs`): Style · Composition · Subject (IP-Adapter), Face (FaceID Plus v2 /
  Portrait, InstantID, PuLID) and Flux Redux. Family: SD 1.5 and the SDXL types get IP-Adapter + Face (InstantID / PuLID SDXL
  only), Flux gets Redux, other types none. `fetchServerInfo` reads `ServerInfo.style` (`styleSupportOf`: the feature node
  classes + IPAdapterModelLoader / CLIPVisionLoader / StyleModelLoader / InstantIDModelLoader / PulidModelLoader combos) from
  the same `/object_info`; `/models/insightface` is NOT a registered folder (the packs read models/insightface directly), so
  Face is never gated on it. `missingResources` adds each active reference's missing nodes / files, so routing never sends a
  reference to a server that cannot run it. At queue time `GenerateButton` resolves each reference's files for the target
  (`resolveStyleRefs` → `ref.use`: adapter, CLIP vision, FaceID LoRA, InstantID ControlNet) and `queuePrompt` uploads its
  pictures (IndexedDB `imagelab-style-refs`, key = content hash; `lib/styleRefImages.ts`); the workflow keeps only the key +
  a 160 px thumbnail (fingerprint, history metadata). The graph stage is `graphs/style.ts`, called by `core.ts` after the
  LoRAs and before the sampler (ids `sr<i>…`); InstantID / Redux change the prompt conditioning, so `finish` re-points every
  `["6",0]` / `["7",0]` outside the stage at the stage's end (sampler, Loopback / refine passes, inpaint ControlNet). No active,
  uploaded, resolved reference = the very same graph, byte for byte (`next/tests/fixtures/style-baseline.json`, captured
  before the stage existed). Defaults come from the packs' own example workflows (`methodDefaults` / `newStyleRef`, see the
  comment there); stacked references are scaled (`stackFactor`); InstantID wants CFG ≤ 5 (adding it lowers CFG to 4.5, one
  undo, and the card says so). Checked on winold (ComfyUI 0.35.0 + ComfyUI_IPAdapter_plus, ComfyUI_InstantID,
  PuLID_ComfyUI; Juggernaut XL, 1024², 30 steps): every type renders clean. **The pod does not have these nodes / models yet.**

**The seed trap.** The ComfyUI editor gives any INT named `seed` / `noise_seed` a
`control_after_generate` slot even when `/object_info` does not declare one, and saves the extra
`"randomize"` in `widgets_values`. `lib/workflowGraph.ts` mirrors that rule. Break it and every
widget after a seed is read one slot off — it showed up as steps reading "randomize".

## Swiping results (the gesture model)

**Touch slides, desktop cuts.** A change of result that is not a drag (arrow keys, wheel, a click on
the strip, the controller) slides only when the last input was a touch (`lib/inputModality.ts`);
after a mouse, wheel or key it is instant, and the strip jumps instead of smooth-scrolling. A drag
(finger or mouse) always settles with the spring.

- **One pager everywhere.** The hero (`components/blocks/HeroResult`), the fullscreen viewer
  (`components/FullscreenImage`) and, through them, the strip and the gallery all page with
  `hooks/usePager`: a track of three slides (previous · current · next, `SLIDE_GAP` 24 px apart)
  that the finger moves 1:1, a spring that settles it, and a *ghost* — on an index change the
  outgoing item is drawn on the side it leaves by, the track jumps so it has not moved yet, and the
  new one springs in. So every change — a release, a tapped thumbnail, ←/→, the wheel, a new result
  landing, a controller — is the same slide, never a cut. The hook writes the track's `transform`
  itself (`will-change` only while moving); React state changes only on commit.
- **The numbers** are `lib/pager.ts` (pure, tested in `tests/pager.test.cjs`): axis locks after
  10 px (`lockAxis`, symmetric; `lib/swipe.ts` keeps the one-way `swipeAxis` for the settings
  pager); a release pages past 30 % of the width or on a flick ≥ 0.5 px/ms that moved ≥ 20 px
  (`pageOnRelease`); the first and last item rubber-band (`rubberBand`, iOS curve, c = 0.55);
  the settle is a unit spring k = 320, c = 32 (just under critical, ~300 ms, a hint of overshoot
  only when thrown; `spring` is closed-form, sampled per frame). Pull-down closes past 20 % of the
  height or a flick ≥ 0.6 px/ms after 30 px (`closeCommits`); the picture scales to 0.65 and the
  backdrop fades with `closeProgress`. Double-tap: 300 ms / 30 px, zoom 2.5×. A wheel steps once
  per gesture (`createWheelStepper`: 60 units, then quiet for 160 ms — trackpad inertia never
  pages twice). `prefers-reduced-motion` turns every slide, open and close into a 120 ms fade.
- **The viewer** (`usePanZoom` + the pager): at 1× one finger pages sideways or pulls down to
  close (the image follows, shrinks, the backdrop fades; let go early and it springs back); pinch
  or double-tap zooms, and zoomed a drag pans and a flick throws; a second finger cancels a page
  drag. Open and close are a shared-element transition (`components/viewerTransition.ts`, maths in
  `lib/flip.ts`, tested): the picture grows out of the largest visible element marked
  `data-viewer-origin="<key>"` — the hero's image, a strip thumbnail, a gallery tile — and shrinks
  back into whatever shows it then; nothing visible → a fade. The chrome fades in after. A tap
  closes only after the double-tap window.
- **Preloading.** The neighbours are real `<img>`s in the track (already decoded when they slide
  in); `hooks/usePreload` decodes ±2 more off screen. Thumbnails and the hero share the viewer's
  URLs, so the browser cache is the placeholder.
- **The strip** keeps the current thumbnail centred (`centredScrollLeft`, smooth) and, while the
  hero is dragged, follows the finger through its `follow(fraction)` handle (`ResultsStripHandle`).
- **For code that wants the same animation** — the controller (`features/gamepad/padViewer`) —
  the open viewer registers `{ step(dir), close() }` with `registerViewer` / `activeViewer()`
  (`viewerTransition.ts`); the touch video player registers too and closes on Escape. Outside the
  viewer, changing the selection (`selectHistoryEntry`, a run pane's pick) is enough: the hero
  slides to it. `openViewer()` / `closeViewer()` are untouched; the viewer animates around them.
- **Do not fight the browser.** The hero is `touch-action: pan-y` (vertical scroll stays the
  browser's; a `pointercancel` snaps the track back), the viewer `touch-action: none`; nothing
  starts on a button, a text box, a slider or `data-no-swipe`; a mouse on a `<video>` is for its
  controls. Android's edge-back gesture is the system's and is never intercepted.

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

**Send to another mode** (`workspace/sendTo.tsx`): every result has buttons for the other two
modes: Image (input image, img2img), Video (start frame), Workflow (the open workflow's first
LoadImage input, uploaded to the Workflow server). A video result sends its last frame
(`lastFrame`, a detached <video> drawn to a canvas), so a clip can be continued in Video.

## The new workspace (next/)

Donny's spec (10-19): "go in and out of each step, each step with its own full interface; the
image / video / canvas always centred, full height, no padding on desktop; full width keeping its
aspect on mobile; prompts easier with the LLM; one prompt library; the original fullscreen viewer
from anywhere; tap, not type". `src/features/next/` is that shell; `workspace/WorkspaceView`
mounts it unless Settings → Workspace → **Classic workspace** is on (`next/nextStore.ts`,
`imagelab.next.v1`), which falls back to the old `DesktopWorkspace` / `MobileWorkspace`.

- **Steps** are the modes (`mainView` generate / video / studio, `lib/workspace.ts`), so
  `setMainView('video')` and "Send to video" land in the Video step. The steps switch sits in the
  bar that floats over the stage (desktop, `next/StageBar.tsx`) or above it (phone), with the
  status cluster, the job tray, fullscreen, the filmstrip toggle and the two column toggles.
- **The stage** (`next/Stage.tsx`) is `HeroResult` **bare** (no frame, `absolute inset-0`,
  `hideProgress`) in a column that is the window's full height on desktop; the bar, the filmstrip
  (`ResultsStrip`, toggle in the bar / `nextStore.filmstrip`), the result actions
  (`GenerateNavActions` / `SendToButtons`) and the progress band all float over it with
  `data-no-swipe`, so nothing takes height from the picture. Phone: `aspect-ratio` of what it
  shows (`hooks/useMediaAspect` reads the result or preview frame; falls back to the workflow
  size), full width, in one scroll with the step's controls; the run bar is pinned under them.
  Fullscreen is always there: image → `openViewer()` and the stage renders the history
  `FullscreenViewer` itself (`HistoryPanel viewer={false}` in the right column, so there is one
  viewer); video / workflow → `FullscreenImage`, with `liveUrl` when only a preview is showing.
  Keys: ←/→ older / newer (Panel+10), Space (video / workflow here; the image viewer's Space is
  `useGlobalShortcuts`), Ctrl/⌘+Enter in the step's run bar (`next/RunBars.tsx`; the classic
  `GenerateButton` is not mounted, so nothing is double-bound).
- **The step panel** (left column, docked / resizable as before; phone: under the stage) is, top
  to bottom: the run bar (`RunBar` → Stop, seed row, `GenerationProgress`), the **prompt hub**,
  then **settings as chips**.
- **Prompt hub** (`next/PromptHub.tsx`, one component for `kind: 'image' | 'video'`): tabs
  Write · Library · Mine (`nextStore.hubTab`). Write = the image `PromptBox` (exported from
  `layers/PromptFields`, `hub` prop drops its presets / CivitAI / save icons) with `SnippetChips`,
  the negative and the parts folded; video = its own motion-prompt box bound to `videoStore`. AI
  pens: "Write it" (`PromptGeneratorButton variant="button"`, video target for video), "Improve"
  (`expandPromptFragment` 'improve' / `generateVideoPrompt` from the prompt), "From the picture" /
  "From the frame" (`promptFromImage` / `videoPromptFromImage` in `lib/venice.ts`, the vision
  model on the input image or the start frame via `studio/ImageInput.inputViewUrl`), "Save to
  Mine". Library = `next/CivitaiLibrary.tsx`: the installed models' CivitAI galleries inline
  (data in `layers/civitaiPrompts.ts`, shared with the old modal); tap = use the prompt (image:
  positive + negative + steps / CFG / seed when present; video: rewritten as a motion prompt),
  "As input" = img2img input / start frame. Mine = `next/MinePrompts.tsx` on `next/mineStore.ts`
  (`imagelab.prompts.mine.v1`, rules in `lib/promptMine.ts`, tested): saved whole prompts per
  kind, "Make a set" (`generatePromptSet` → `parsePromptSet`), the built-in starters
  (`lib/promptLibrary`) underneath. Replacing always offers Undo (`applyWithUndo` /
  `applyToVideo`).
- **Chips** (`next/ChipPopover.tsx`, values in `lib/chips.ts`, tested): a chip reads `Name
  value`, filled when it differs from its default (the fresh workflow merged with the model
  type's start values), `!` when the server lacks the file. Tap = `components/ui/popover` beside
  it on desktop (preset values to tap, then the real field — `components/fields`, `ModelFields`,
  `InputImageSection`, `LoopbackField`, `PipelinePanel`), a full-screen window on a phone. The
  Image rows (`next/ImageChips.tsx`): Model · Size · Quality · Input · Passes, a search box on
  top (`filterChips`); the preset slots (`PanelToolbar`) sit under them. **Chip editors open
  modals** (model pickers, the image browser), so their popover is `zIndex 190`
  (`POPOVER_UNDER_MODALS_Z`, under modals' 200) and the popover base ignores a close that comes
  with a click inside another overlay (`closeCameFromNestedClick` in `ui/popover.tsx`: a Select's
  option list, a modal) — without it Mantine's click-outside would unmount the modal with the
  popover.
- **Video step** (`next/VideoStep.tsx`, chips in `next/VideoChips.tsx`, readings in
  `lib/videoChips.ts`, tested): the prompt hub with the motion prompt, then rows Mode (engine,
  task, start / end frame, reference pictures) · Models · LoRAs · Size & length · Speed (Fast or
  Turbo) · Sampling · Guidance (Wan's patches, H3's VRAM patches) · Upscale · Finish; the rows
  follow the engine (`visibleVideoChips`). Every editor is a piece exported one by one from
  `features/video/sections.tsx` (`FastBlock`, `WanStepsFields`, `NagBlock`, `EncodeBlock`…); the
  classic sections are compositions of the same pieces. Under the chips: the recipe presets, the
  sweep (folded, open while one runs) and the reset row.
- **Workflow step** (`next/WorkflowStep.tsx`): the open workflow as a chip (its editor is the
  picker, Refresh, Focus mode, Open ComfyUI), the prompt hub in `kind: 'workflow'` (Write = the
  studio `PromptPanel` — keywords, the shared prompt, "Sent to" — with "Write it" through the
  generator's `text` target and Improve; Library and Mine are the image ones, writing the shared
  prompt with Undo), then every widget as a chip: Pinned first, then one row per node, each
  editor the classic `ParamField` / `ImageInput` with the pin inside; `formatParamValue`
  (`lib/chips.ts`) reads the value. No Simple / Advanced anywhere in the new shell; the quick
  search's "show section" filters the Image chips to that row, and its phone tab events switch
  the step / gallery pane.

## Desktop layout

- **One workspace** (`features/desktop/DesktopWorkspace.tsx`, mounted by `workspace/WorkspaceView`
  for `mainView` generate / video / studio) replaces the three desktop views. The mode *is*
  `mainView` (`lib/workspace.ts`), so `setMainView('video')` and "Send to video" still work. The
  rail (`layout/Sidebar.tsx`) shows one **Create** entry for all three; the mode switch sits in the
  workspace's top bar beside Simple / Advanced (`workspaceStore.detail`), the status cluster
  (connection · server · queue · downloads) and the job tray (one pill per running job in any mode,
  so a video and an image render side by side).
- **Three columns.** Left: the mode's sections as folding `SectionCard`s in one scroll
  (`desktop/SettingsColumn.tsx`), with Generate and the seed row pinned above them
  (`WorkspaceFooter.tsx`; image keeps `GenerateButton`, video and workflow use `RunBar` on their
  run stores). Simple shows the simple tier (`sectionTier` / `videoSectionTier`) plus Quick
  tweaks and a "N more settings → Advanced" row; Advanced shows every card. Image cards follow the
  user's tab order and hidden tabs (`panelTabsStore`; "Order and hide sections" opens
  `CustomizeTabsModal`), so the phone and the desktop agree. Centre: `HeroResult` (latest result,
  live preview and progress while busy, the old top-nav image actions floating over it) with a
  `ResultsStrip` under it (Ctrl+wheel over the strip resizes the thumbnails). Right: `HistoryPanel`
  in image mode, `desktop/ResultsGrid` (the run store's server history) in video and workflow.
  The side columns are the canvas view's docked panels: widths in `layout/panelLayout.ts`,
  `PanelResizeHandle` drags / folds / resets; open state, fold state per mode, strip size and grid
  columns live in `desktop/desktopLayoutStore.ts` (`imagelab.desktopLayout.v1`; the old
  `imagelab.video.folded.v1` seeds video's folds). Pure parts: `lib/desktopLayout.ts`, tested.
- **The canvas view** keeps its own chrome (`AppSidePanels`, `CanvasTopNav`, layers), but its left
  panel is the same card column in layer scope (`layout/LeftPanel.tsx`).
- **Keyboard on desktop:** Ctrl/⌘+K quick search · Ctrl/⌘+Enter generate in the current mode (works
  inside text boxes) · Alt+1…9 open and scroll to the Nth settings card · ←/→ previous / next
  result (older / newer) · Space fullscreen on / off · Esc closes · Delete removes the shown image
  (image mode) · F browser fullscreen · Tab cycles the image job's server · canvas-only: tool letters,
  `[` `]` grid step. The fullscreen viewer keeps ←/→, S slideshow, Esc.
- `features/panel/PanelTabs.tsx` and `SummaryStrip.tsx` are no longer used on desktop; the tab data
  (`lib/panelTabs.ts`) still drives card order.

## Controllers

- **One layer for the whole app** (`features/gamepad/GamepadLayer.tsx`, mounted once in App): idle
  until a pad connects (`hooks/useGamepad` starts its rAF poll on `gamepadconnected`). Every pad is
  read at once and merged, so whichever is pressed works and a button held on two pads fires once.
  The pure part — pad kinds, index maps, printed labels, the focus arithmetic — is `lib/gamepad.ts`,
  tested. Minus (Back / View) opens the button card (`PadHelp.tsx`), labelled as printed on the pad
  in hand; a "Controller connected" note says so once per connection.
- **The map** (Switch labels; on an Xbox pad the bottom button is A, so the *same press* is the one
  printed A on every pad):

  | Button | Does |
  | --- | --- |
  | A | press the highlighted control; nothing highlighted: Generate |
  | B | back: close the open overlay (Escape), leave a phone settings page (`data-pad-back`), hide the highlight; nothing left: Stop the mode's run |
  | + | Generate, or Stop while the mode runs; works inside a text box too |
  | d-pad / left stick | move the highlight; ◀ ▶ change the highlighted control (slider, number, segmented choice, switch); held, it repeats |
  | ZL / ZR | held with ◀ ▶: ten steps; a tap: phone Create · Result · Gallery tab, desktop older / newer result |
  | L / R | previous / next mode (wraps) |
  | X | new seed (Workflow: every seed) |
  | Y | favourite the shown image (Image mode, also in the viewer) |
  | LS press | open the shown result full screen; again to close |
  | RS press / tilt | Simple / Advanced / scroll |
  | − | the button card |

  In a fullscreen viewer ◀ ▶, L / R and ZL / ZR are the arrow keys (previous / next), B or LS
  closes. **Results and viewers are reached only through `features/gamepad/padViewer.ts`** (the
  viewers are not edited for the pad: found as a full-screen `data-no-swipe` overlay, stepped with
  the arrow keys they already handle, closed through the store or Escape; the phone's touch video
  player has no Escape, so B does not close it yet). Video and Workflow shells register their
  result pick with `usePadResults` (desktop `ResultsArea`, phone `MobileWorkspace`). A text box with
  focus keeps the controller out except + and B (which leaves the box).
- **The highlight** is a ring over a control, found by role and tag (`features/gamepad/padDom.ts`):
  buttons, links, inputs, sliders, switches, tabs, options; a radio group (Mantine
  `SegmentedControl`) is one stop; the − / + inside a number box are skipped (the box steps).
  Hidden, `inert`, `aria-hidden`, transparent and clipped-off controls are skipped. Up / down / left
  / right pick the nearest control ahead that lines up (`pickInDirection`), so it stays in its
  column on desktop. Inside an open overlay (`[role=dialog]`, a Mantine dropdown, a viewer, `data-pad-layer`)
  it stays inside it and goes back to the opener when it closes. ◀ ▶ reach controls the way keys
  do — the arrow key Mantine's Slider / NumberInput already handle, contained so ←/→ never also
  step results — or a click; nothing is focused except a text box on A, so the phone keyboard
  never opens by itself. Scrolling into view only moves real scrollers. The ring shows after a pad
  press and hides on a touch, click, wheel or key; its first press only shows where it is.
  `data-pad-start` marks where it first lands (the settings column, the phone's panes).
- **How Switch pads report** (read from Chromium's `device/gamepad` and Android's key layouts, not
  tried on hardware). The standard mapping is positional (0 = bottom), so on a Pro Controller 0 is
  B and 1 is A. Desktop Chrome drives Nintendo pads itself over HID (`nintendo_controller.cc`; on
  Linux it needs hidraw access, and evdev copies are dropped): `mapping: "standard"`, id `Pro
  Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)`, 16 Home, 17 Capture; a lone Joy-Con is
  turned sideways by Chrome (SL / SR → L / R); an L and an R become one `Joy-Con L+R` pad. Chrome on
  Android has no Nintendo mapping: `mapping: ""` with the standard indices, id just the name
  (`Pro Controller`, `Joy-Con (R)`). The Pro Controller's `Vendor_057e_Product_2009.kl` is
  positional; Joy-Cons fall back to `Generic.kl`, which swaps top and left and drops the left
  Joy-Con's arrow buttons, and each stays its own upright pad — so a lone one on Android is turned
  sideways here, and a pair is read as one upright pad. Sideways, the right-hand button confirms, as
  on a Switch.
