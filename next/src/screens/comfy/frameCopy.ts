/**
 * FIXLIST-2 #50: a plain copy of the embedded ComfyUI's workflow state, made with the FRAME's own
 * JSON so the objects belong to its realm (its code checks plain objects / arrays of its own
 * window). `activeState` comes from ComfyUI's Vue store and can be a reactive Proxy, which
 * structuredClone refuses ("DataCloneError … could not be cloned"); JSON reads through proxies,
 * and a workflow is JSON on disk anyway (subgraphs, groups, links all survive). Vue's raw target
 * (`__v_raw`) is unwrapped first so no proxy getters run; a graph JSON cannot copy (a cycle) is
 * handed over as the raw object, which is what ComfyUI's own sidebar does. Pure + tested.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function plainCopy(state: unknown, json: Pick<JSON, 'parse'> = JSON): unknown {
  if (!state || typeof state !== 'object') return null;
  let raw: any = state;
  for (let i = 0; i < 8 && raw && typeof raw === 'object' && raw.__v_raw; i++) raw = raw.__v_raw;
  try { return json.parse(JSON.stringify(raw)); } catch { return raw; }
}
