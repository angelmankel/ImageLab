/**
 * Item 35: the live layout factors the Themes settings drive (applyTheme.ts writes them), read by
 * `T.radius` / `T.gap` / `T.pad` (tokens.ts) on every access. No imports, so tokens stays pure.
 */
export const LIVE = { corners: 1, density: 1 };
