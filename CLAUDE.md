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

## Verifying

Do not drive Donny's mouse. Use the offscreen harness in ImageLabDocker:

```sh
node scripts/lab-check.mjs <url> [shot.png]
```

**The project rules — pods, money, pulling images before a terminate — live in
`../ImageLabDocker/CLAUDE.md`.**
