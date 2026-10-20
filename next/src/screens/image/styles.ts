/** The Style thumbs (rule 6): a few whole-look snippets. Pure data, tested for shape. */
export const STYLE_TAG = 'Style';

export interface StyleDef { id: string; label: string; text: string; thumb: string }

export const STYLES: StyleDef[] = [
  { id: 'none', label: 'None', text: '', thumb: 'var(--il-card)' },
  { id: 'realistic', label: 'Realistic', text: 'photorealistic, raw photo, natural skin texture, 85mm lens, shallow depth of field, film grain', thumb: 'linear-gradient(135deg,#5A4A3E,#2A2420)' },
  { id: 'anime', label: 'Anime', text: 'anime style, clean lineart, cel shading, vibrant colors, detailed eyes', thumb: 'linear-gradient(135deg,#4C405A,#241F2C)' },
  { id: 'painterly', label: 'Painterly', text: 'oil painting, visible brush strokes, impasto, rich texture, dramatic chiaroscuro', thumb: 'linear-gradient(135deg,#3E5050,#1F2A2A)' },
  { id: 'cinematic', label: 'Cinematic', text: 'cinematic still, anamorphic, teal and orange grade, volumetric light, 2.39:1 framing', thumb: 'linear-gradient(135deg,#3F4F5E,#1E262D)' },
];
