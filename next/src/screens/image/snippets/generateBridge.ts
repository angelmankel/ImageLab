/**
 * Item 47 (AI part, owned by writeit): "✦ Generate snippets" for a category. writeit ships
 * `writeIt/GenerateSnippets.tsx` with `openGenerateSnippets(categoryId)`; a glob that matches
 * nothing is an empty object, so this builds either way and the button shows once it lands.
 */
const mods = import.meta.glob('../writeIt/GenerateSnippets.tsx', { eager: true }) as Record<string, { openGenerateSnippets?: (categoryId: string) => void }>;

/** The "Generate snippets" action for a category, or null while the helper is not there. */
export function generateSnippetsFor(categoryId: string): (() => void) | null {
  const open = Object.values(mods)[0]?.openGenerateSnippets;
  return open ? () => open(categoryId) : null;
}
