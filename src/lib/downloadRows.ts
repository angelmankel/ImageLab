/**
 * Which servers share one disk, for the downloads panel.
 *
 * A pod runs two ComfyUIs behind one nginx (`pod:8188` and `pod:8188/video-comfy`), and both
 * answer `/imagelab/api/downloads` from the same download manager on the same models folder. Asked
 * one by one, every download came back once per server. So a download is polled, started and shown
 * once per *origin* (host without its path), through the first server that has that origin.
 */

type HostOnly = { host: string };

/** `pod:8188/video-comfy` → `pod:8188`; a host with no path is its own origin. */
export function hostOrigin(host: string): string {
  const slash = host.indexOf('/');
  return (slash === -1 ? host : host.slice(0, slash)).toLowerCase();
}

/** The first server of every origin, in the given order. */
export function onePerOrigin<S extends HostOnly>(servers: S[]): S[] {
  const seen = new Set<string>();
  return servers.filter((s) => {
    const origin = hostOrigin(s.host);
    if (seen.has(origin)) return false;
    seen.add(origin);
    return true;
  });
}
