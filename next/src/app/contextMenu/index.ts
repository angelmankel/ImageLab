/**
 * The app's right-click menu (FIXLIST 45). Import from here:
 *   import { registerMenu, menuProps, openMenu, type MenuEntry } from '~/app/contextMenu';
 * See ./registry.ts for the how-to. `ContextMenuHost` is mounted once in App.
 */
export { registerMenu, menuProps, openMenu, closeMenu, menuEntries, useContextMenu } from './registry';
export type { MenuEntry, MenuContext, MenuIcon, MenuRow } from './registry';
export { ContextMenuHost } from './ContextMenuHost';
