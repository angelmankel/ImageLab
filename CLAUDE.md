# ImageLab — the web front end

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

## The two views

- **Generate** uses one left workspace with collapsible Prompts, Models, Base image, Input image,
  and Passes sections. Generation controls stay at the bottom with a live sampler progress bar,
  a seed field, Auto toggle, and a separate New seed action. Status follows tracked jobs, never
  a leftover status string. Completion must not depend on a mounted canvas controller.
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
