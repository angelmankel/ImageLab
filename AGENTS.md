# Agent instructions — ImageLab (the web front end)

**Read `CLAUDE.md` in this repo first**, then
`../ImageLabDocker/CLAUDE.md`, which holds the project rules (pods, money, pulling images before a
terminate) and is the entry point for all three repos.

## The short version

- React 18 + TypeScript + Vite + Tailwind 4, Zustand for state, PixiJS 8 for the canvas, and
  IndexedDB (`idb`) plus localStorage for anything saved. No backend of its own: the browser talks
  to ComfyUI, to ImageLabCore at `/imagelab/api/*`, and to CivitAI / Venice directly.
- `dist/` is **committed**. The pod image clones this repo at a pinned commit and bakes it in, so a
  change here means: `npm run build`, commit `dist/`, push, and bump the pin in
  `ImageLabDocker/Dockerfile` if new pods should have it.
- `npm run build` runs `tsc -b` first. Run `node --test tests/*.test.cjs` for the metadata and generation workspace regression tests.

## Do not break these

- **One websocket per ComfyUI host.** `lib/comfyBus.ts` owns it. A second socket silently deafens
  the first, because ComfyUI keeps one per client id.
- **Zustand selectors are compared by reference.** Returning a fresh array or object from a selector
  loops forever (React error #185). Use the frozen empties already defined.
- **Positional `widgets_values`.** A seed carries a `control_after_generate` slot after it — see the
  seed trap in `CLAUDE.md`. Reader and writer must agree.
- **The prompt panel is built for a trackpad.** No click-to-expand, no save-on-blur, no drag-only
  control. Keep every action a click target.

## Verifying

Do not drive Donny's mouse. Build, push to a running pod with `ImageLabDocker/scripts/push.sh`, then
check it offscreen with `ImageLabDocker/scripts/lab-check.mjs <url>`. The LAN ComfyUI boxes are
behind on ImageLabCore, so `/imagelab/api/*` only answers on a pod.
