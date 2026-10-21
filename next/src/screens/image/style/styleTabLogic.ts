/**
 * The Style tab's pure rules (tested in tests/styleTab.test.cjs): per server, which reference
 * types run and what is missing; per type tile, whether it can be added and why not.
 * The graph-level rules (families, nodes, model picks) are `@/lib/styleRefs`.
 */
import { STYLE_TYPES, TYPE_INFO, typeFits, typeState, type StyleFamily, type StyleRefType, type StyleSupport } from '@/lib/styleRefs';

export interface ServerLike { id: string; name: string; enabled?: boolean }
export interface InfoLike { style?: StyleSupport; loras?: string[]; controlnets?: string[] }

export interface ServerRow {
  id: string;
  name: string;
  online: boolean;
  /** Types (fitting the family) this server runs. */
  ready: StyleRefType[];
  /** Fitting type → what this server lacks for it. */
  missing: Partial<Record<StyleRefType, string[]>>;
  /** Everything it lacks, once each (for the one-line "missing" list). */
  lacks: string[];
}

/** The types a family can use, in tile order. */
export function fittingTypes(fam: StyleFamily | null): StyleRefType[] {
  return STYLE_TYPES.filter((t) => typeFits(t, fam));
}

export function serverRows(servers: readonly ServerLike[], infos: Record<string, InfoLike | undefined>, fam: StyleFamily | null): ServerRow[] {
  const types = fittingTypes(fam);
  return servers.filter((s) => s.enabled !== false).map((s) => {
    const info = infos[s.id];
    if (!info) return { id: s.id, name: s.name, online: false, ready: [], missing: {}, lacks: [] };
    const ready: StyleRefType[] = [];
    const missing: Partial<Record<StyleRefType, string[]>> = {};
    const lacks: string[] = [];
    for (const t of types) {
      const st = typeState(t, fam, info.style, { loras: info.loras, controlnets: info.controlnets });
      if (!st.missing.length) ready.push(t);
      else {
        missing[t] = st.missing;
        for (const m of st.missing) if (!lacks.includes(m)) lacks.push(m);
      }
    }
    return { id: s.id, name: s.name, online: true, ready, missing, lacks };
  });
}

export interface TileState {
  type: StyleRefType;
  title: string;
  line: string;
  /** It can be added: some online server runs it. */
  ok: boolean;
  /** Why not / where not ("Needs IP-Adapter nodes on winold", "Not on Pod"). */
  note: string | null;
}

/** "IP-Adapter nodes (ComfyUI_IPAdapter_plus)" → "IP-Adapter nodes" (the tile's short form). */
const short = (m: string) => m.replace(/\s*\(.*\)$/, '');

export function tileStates(rows: readonly ServerRow[], fam: StyleFamily | null): TileState[] {
  const online = rows.filter((r) => r.online);
  return fittingTypes(fam).map((type) => {
    const { title, line } = TYPE_INFO[type];
    const runs = online.filter((r) => r.ready.includes(type));
    if (!online.length) return { type, title, line, ok: false, note: 'No server online' };
    if (runs.length === online.length) return { type, title, line, ok: true, note: null };
    if (runs.length) {
      const not = online.filter((r) => !r.ready.includes(type)).map((r) => r.name);
      return { type, title, line, ok: true, note: `Not on ${not.join(', ')}` };
    }
    const first = online[0];
    const need = (first.missing[type] ?? [])[0];
    return { type, title, line, ok: false, note: need ? `Needs ${short(need)} on ${online.length > 1 ? 'any server' : first.name}` : 'Not available' };
  });
}

/** One word for the strip's header: every online server runs every fitting type, some do, or none. */
export function readiness(rows: readonly ServerRow[], fam: StyleFamily | null): 'ready' | 'partial' | 'none' | 'offline' {
  const online = rows.filter((r) => r.online);
  if (!online.length) return 'offline';
  const n = fittingTypes(fam).length;
  if (online.every((r) => r.ready.length === n)) return 'ready';
  return online.some((r) => r.ready.length > 0) ? 'partial' : 'none';
}
