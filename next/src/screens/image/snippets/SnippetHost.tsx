/**
 * Item 42: the snippet modals, mounted once where prompt cards live (Prompt tab, Workflow prompt
 * tab): the quick add / edit modal and the Manage window, both driven by `useTileEdit`.
 */
import { ManageSnippets } from './ManageSnippets';
import { SnippetEditor } from './SnippetEditor';
import './snippetMenus';

export function SnippetHost() {
  return <><ManageSnippets /><SnippetEditor /></>;
}
