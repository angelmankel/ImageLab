/**
 * Item 13: keys while Edit mode is on (desktop). Ctrl/⌘+Z undo and Ctrl/⌘+Shift+Z / Ctrl+Y redo
 * the EDIT session (above the app-wide undo, which stays for everything else); Enter applies an
 * open crop; Esc closes the open tool, then leaves Edit mode (asking when there are unsaved edits).
 * Text boxes keep their keys. E (on / off) is registered by the stage.
 */
import { useShortcut, ShortcutPriority } from '@/hooks/useShortcut';
import { exitEdit, redoEdit, undoEdit, useEdit } from './editStore';
import { cropEdit } from './editTools';

const P = ShortcutPriority.Panel + 20;

export function useEditKeys(enabled: boolean) {
  const on = () => enabled && useEdit.getState().on && !document.querySelector('[role="dialog"]');
  useShortcut('cmd+z', () => { if (!useEdit.getState().busy) undoEdit(); }, { priority: P, when: on });
  useShortcut(['cmd+shift+z', 'ctrl+y'], () => { if (!useEdit.getState().busy) redoEdit(); }, { priority: P, when: on });
  useShortcut('Enter', () => {
    const s = useEdit.getState();
    if (s.tool !== 'crop' || !s.crop) return false;
    void cropEdit(s.crop);
  }, { priority: P, when: on });
  useShortcut('Escape', () => {
    const s = useEdit.getState();
    if (s.askLeave) useEdit.setState({ askLeave: false });
    else if (s.tool) useEdit.setState({ tool: null, crop: null });
    else exitEdit();
  }, { priority: P, when: on });
}
