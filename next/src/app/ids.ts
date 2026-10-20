/**
 * Session ids (item 20: "nanoid in the background"). `nanoid` is only a transitive package in
 * ../node_modules, so this is the same recipe in 12 lines: 21 URL-safe chars from
 * `crypto.getRandomValues`, falling back to Math.random where crypto is missing (old WebViews).
 */
const ALPHABET = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';

export function nanoid(size = 21): string {
  let out = '';
  const bytes = new Uint8Array(size);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < size; i++) bytes[i] = Math.floor(Math.random() * 256);
  for (let i = 0; i < size; i++) out += ALPHABET[bytes[i] & 63];
  return out;
}
