# ImageLab

The web front end. A browser UI for driving ComfyUI: prompt layers, a parameter panel, an infinite
canvas compositor, model browsing, and history.

It is served **from the pod**, same origin as ComfyUI, which is what lets its fetches and its
websocket carry the basic auth the browser already holds and avoids CORS entirely.

## Build

```sh
npm install
npm run build          # -> dist/
```

`dist/` is committed. ImageLabDocker's Dockerfile clones this repo at a pinned commit and bakes
`dist/` into the image, so a build here plus a commit is what a new pod ships with.

## Changing it on a running pod

No image rebuild. From ImageLabDocker:

```sh
scripts/push.sh <ip:port>
```

That copies `dist/` onto the pod's volume, where nginx and the pod app serve it. Near instant.

## What it talks to

| | |
|---|---|
| ComfyUI | `/prompt`, `/history`, `/object_info`, `/view`, `/upload/image`, `/ws` |
| ImageLabCore | `/imagelab/api/hashes`, `/imagelab/api/downloads`, `/imagelab/api/favorites`, `/imagelab/api/version` |

Both live on the same origin behind one nginx with basic auth.

## Layout

```
src/features/      one directory per feature; layout/ owns the app shell
src/lib/           store, comfy client, websocket bus, storage, graph conversion
src/components/ui/ the primitives — Slider, Select, Switch, Field, IconButton
```

`src/lib/comfyBus.ts` is the one websocket per host, shared by every consumer — ComfyUI keeps only
one socket per client id, so a second connection silently displaces the first.
