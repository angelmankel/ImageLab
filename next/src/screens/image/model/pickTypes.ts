/**
 * The shape the models agent's `ModelsModal` (in `~/screens/models`) hands back on a pick, as
 * agreed in agent-handoffs/handoff-2026-10-19-models-picker.md. Kept here so the list component
 * compiles before that modal exists (see `ModelsModalBridge.tsx`).
 */
export interface ModelPickFile { name: string; sizeKB?: number; downloadUrl: string; format?: string; fp?: string; hashes?: Record<string, string | undefined> }

export interface ModelPick {
  /** True when a server already has the file; then `file` is the name the server lists it under. */
  installed: boolean;
  file: string | null;
  model: { id: number; name: string; type: string; baseModel?: string; tags: string[]; nsfw?: boolean };
  version: { id: number; name: string; trainedWords: string[]; baseModel?: string; file?: ModelPickFile };
  thumb?: string;
}

export type PickKind = 'checkpoint' | 'lora' | 'embedding' | 'controlnet' | 'vae' | 'upscale';

export interface ModelsModalProps {
  opened: boolean;
  onClose: () => void;
  kind?: PickKind;
  onPick?: (pick: ModelPick) => void;
  title?: string;
}
