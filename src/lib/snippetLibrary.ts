/**
 * The built-in snippet library. Tags are Danbooru-style where the anime SDXL families (Pony,
 * Illustrious, NoobAI) understand them, with short plain phrases that plain SDXL reads too.
 * Every snippet has a fixed id so later library versions can tell built-ins from the user's own.
 */
import type { Snippet, SnippetCategory } from './types';

/** Bump when the built-in library changes in a way saved libraries should be reset to. */
export const SNIPPET_LIBRARY_VERSION = 2;

export const LIBRARY_CATEGORIES: SnippetCategory[] = [
  { id: 'quality',     name: 'Quality',            icon: '⭐' },
  { id: 'style',       name: 'Style & medium',     icon: '🎨' },
  { id: 'lighting',    name: 'Lighting',           icon: '💡' },
  { id: 'color',       name: 'Color',              icon: '🌈' },
  { id: 'camera',      name: 'Camera & focus',     icon: '📷' },
  { id: 'framing',     name: 'Angle & framing',    icon: '🖼️' },
  { id: 'pose',        name: 'Pose',               icon: '🤸' },
  { id: 'expression',  name: 'Expression',         icon: '🙂' },
  { id: 'outfit',      name: 'Outfit',             icon: '👗' },
  { id: 'setting',     name: 'Setting',            icon: '🏞️' },
  { id: 'weather',     name: 'Weather & time',     icon: '🌦️' },
  { id: 'atmosphere',  name: 'Atmosphere & FX',    icon: '✨' },
  { id: 'detail',      name: 'Detail & texture',   icon: '🔍' },
  { id: 'neg-quality', name: 'Negative · Quality', icon: '🚫' },
  { id: 'neg-anatomy', name: 'Negative · Anatomy', icon: '🦴' },
  { id: 'neg-unwanted',name: 'Negative · Unwanted',icon: '⛔' },
  { id: 'pony',        name: 'Pony',               icon: '🐴' },
  { id: 'illustrious', name: 'Illustrious',        icon: '🌸' },
  { id: 'uncategorized', name: 'Uncategorized',    icon: '📁' },
];

type Row = [id: string, name: string, text: string];

/** Rows per category; weight 1 and positive unless the category is a negative one. */
const ROWS: Record<string, Row[]> = {
  quality: [
    ['q-general', 'General quality', 'masterpiece, best quality, highly detailed'],
    ['q-sharp', 'Sharp & crisp', 'sharp focus, crisp details, high resolution'],
    ['q-aesthetic', 'Aesthetic', 'very aesthetic, beautiful composition, visually striking'],
    ['q-photo', 'Photo quality', 'professional photography, RAW photo, high dynamic range, 8k'],
    ['q-illustration', 'Illustration quality', 'detailed illustration, clean lineart, polished shading'],
  ],
  style: [
    ['s-anime', 'Anime', 'anime coloring, cel shading, clean lineart'],
    ['s-anime-painterly', 'Painterly anime', 'anime screencap, soft painterly shading, detailed background'],
    ['s-photoreal', 'Photorealistic', 'photorealistic, realistic skin texture, natural lighting'],
    ['s-film-photo', 'Film photo', 'analog film photo, 35mm, film grain, faded colors'],
    ['s-oil', 'Oil painting', 'oil painting, visible brush strokes, impasto, traditional media'],
    ['s-watercolor', 'Watercolor', 'watercolor, soft washes, bleeding edges, paper texture'],
    ['s-ink', 'Ink sketch', 'ink sketch, cross-hatching, monochrome, traditional media'],
    ['s-concept', 'Concept art', 'concept art, digital painting, matte painting'],
    ['s-3d', '3D render', '3d render, octane render, subsurface scattering, soft global illumination'],
    ['s-pixel', 'Pixel art', 'pixel art, 16-bit, limited palette, crisp pixels'],
    ['s-comic', 'Comic', 'comic book style, bold outlines, halftone shading'],
    ['s-flat', 'Flat vector', 'flat color, vector art, minimal shading, clean shapes'],
    ['s-retro-anime', '90s anime', '1990s anime style, retro anime, vhs look, muted colors'],
    ['s-chibi', 'Chibi', 'chibi, super deformed, cute, big head'],
  ],
  lighting: [
    ['l-cinematic', 'Cinematic', 'cinematic lighting, dramatic shadows, volumetric light'],
    ['l-golden', 'Golden hour', 'golden hour, warm sunlight, long shadows, lens flare'],
    ['l-soft-studio', 'Soft studio', 'soft studio lighting, softbox, even light, clean background'],
    ['l-rim', 'Rim light', 'rim lighting, backlighting, glowing outline'],
    ['l-neon', 'Neon', 'neon lights, cyan and magenta glow, reflections on wet surfaces'],
    ['l-moon', 'Moonlight', 'moonlight, cool blue tones, soft night light'],
    ['l-candle', 'Candlelight', 'candlelight, warm flickering glow, deep shadows'],
    ['l-god-rays', 'Light rays', 'god rays, light shafts through the window, dust in the air'],
    ['l-dappled', 'Dappled sunlight', 'dappled sunlight, leaf shadows, sunlight through trees'],
    ['l-low-key', 'Low key', 'low key lighting, chiaroscuro, single light source, dark background'],
    ['l-high-key', 'High key', 'high key lighting, bright, airy, minimal shadows'],
    ['l-split', 'Split light', 'split lighting, half of the face in shadow, dramatic portrait'],
  ],
  color: [
    ['c-vibrant', 'Vibrant', 'vibrant colors, high saturation, bold contrast'],
    ['c-pastel', 'Pastel', 'pastel colors, soft hues, gentle palette'],
    ['c-muted', 'Muted', 'muted colors, desaturated, earthy tones'],
    ['c-mono', 'Monochrome', 'monochrome, black and white, high contrast'],
    ['c-teal-orange', 'Teal & orange', 'teal and orange color grading, cinematic palette'],
    ['c-warm', 'Warm palette', 'warm color palette, amber, gold, soft red'],
    ['c-cool', 'Cool palette', 'cool color palette, blue, teal, silver'],
    ['c-limited', 'Limited palette', 'limited palette, two-tone, restrained colors'],
    ['c-sepia', 'Sepia', 'sepia tone, vintage, aged photo'],
  ],
  camera: [
    ['cam-portrait', '85mm portrait', '85mm lens, shallow depth of field, bokeh background'],
    ['cam-wide', 'Wide angle', 'wide angle lens, 24mm, expansive view, deep focus'],
    ['cam-macro', 'Macro', 'macro photography, extreme close-up, fine detail'],
    ['cam-telephoto', 'Telephoto', 'telephoto lens, compressed background, distant subject'],
    ['cam-fisheye', 'Fisheye', 'fisheye lens, distorted perspective'],
    ['cam-dof', 'Depth of field', 'depth of field, blurry background, blurry foreground'],
    ['cam-motion', 'Motion blur', 'motion blur, sense of speed, dynamic'],
    ['cam-grain', 'Film grain', 'film grain, slight vignette, chromatic aberration'],
    ['cam-polaroid', 'Polaroid', 'polaroid photo, instant film, soft colors, white border'],
  ],
  framing: [
    ['f-closeup', 'Close-up', 'close-up, portrait, face focus'],
    ['f-upper', 'Upper body', 'upper body'],
    ['f-cowboy', 'Cowboy shot', 'cowboy shot, thighs up'],
    ['f-full', 'Full body', 'full body, standing, feet visible'],
    ['f-wide', 'Wide shot', 'wide shot, very small figure, vast scenery'],
    ['f-below', 'From below', 'from below, low angle, looking up, heroic'],
    ['f-above', 'From above', 'from above, high angle, looking down'],
    ['f-side', 'From side', 'from side, profile'],
    ['f-behind', 'From behind', 'from behind, back view, looking back'],
    ['f-dutch', 'Dutch angle', 'dutch angle, tilted frame, dynamic composition'],
    ['f-pov', 'POV', 'pov, first-person view, reaching toward viewer'],
    ['f-centered', 'Symmetry', 'symmetrical composition, centered subject'],
    ['f-thirds', 'Rule of thirds', 'rule of thirds, off-center subject, negative space'],
  ],
  pose: [
    ['p-standing', 'Standing', 'standing, contrapposto, hand on hip'],
    ['p-sitting', 'Sitting', 'sitting, crossed legs, relaxed'],
    ['p-lying', 'Lying down', 'lying down, on back, arms above head'],
    ['p-walking', 'Walking', 'walking, mid-stride, looking ahead'],
    ['p-running', 'Running', 'running, dynamic pose, hair flowing'],
    ['p-fighting', 'Fighting stance', 'fighting stance, holding weapon, dynamic pose, action'],
    ['p-jumping', 'Jumping', 'jumping, midair, dynamic angle'],
    ['p-leaning', 'Leaning', 'leaning against wall, arms crossed'],
    ['p-kneeling', 'Kneeling', 'kneeling, hands on lap'],
    ['p-looking', 'Looking at viewer', 'looking at viewer, facing viewer'],
    ['p-peace', 'Peace sign', 'peace sign, v, smiling, playful'],
    ['p-reaching', 'Reaching out', 'reaching out, outstretched hand, toward viewer'],
  ],
  expression: [
    ['e-smile', 'Smile', 'smile, happy, bright eyes'],
    ['e-grin', 'Grin', 'grin, teeth, confident'],
    ['e-serious', 'Serious', 'serious, determined expression, focused eyes'],
    ['e-smirk', 'Smirk', 'smirk, half-closed eyes, confident'],
    ['e-blush', 'Blush', 'blush, embarrassed, looking away'],
    ['e-sad', 'Sad', 'sad, teary eyes, frown'],
    ['e-angry', 'Angry', 'angry, furrowed brow, clenched teeth'],
    ['e-surprised', 'Surprised', 'surprised, wide eyes, open mouth'],
    ['e-sleepy', 'Sleepy', 'sleepy, half-closed eyes, yawning'],
    ['e-calm', 'Calm', 'calm, gentle smile, closed eyes, peaceful'],
  ],
  outfit: [
    ['o-casual', 'Casual', 'hoodie, jeans, sneakers, casual clothes'],
    ['o-school', 'School uniform', 'school uniform, serafuku, pleated skirt'],
    ['o-suit', 'Suit', 'black suit, white shirt, necktie, formal'],
    ['o-dress', 'Evening dress', 'elegant evening dress, jewelry, bare shoulders'],
    ['o-kimono', 'Kimono', 'kimono, floral pattern, obi, hair ornament'],
    ['o-armor', 'Knight armor', 'plate armor, cape, ornate engravings'],
    ['o-mage', 'Mage robes', 'wizard robes, hood, magical staff, runes'],
    ['o-techwear', 'Techwear', 'techwear, black jacket, straps, cyberpunk'],
    ['o-sweater', 'Cozy sweater', 'oversized sweater, sleeves past wrists, cozy'],
    ['o-swim', 'Swimwear', 'swimsuit, beach, summer'],
    ['o-maid', 'Maid', 'maid outfit, apron, headdress, frills'],
    ['o-military', 'Military', 'military uniform, epaulettes, peaked cap'],
  ],
  setting: [
    ['set-city-night', 'City at night', 'city street at night, neon signs, rain-soaked pavement'],
    ['set-forest', 'Forest', 'dense forest, moss, ferns, tall trees'],
    ['set-beach', 'Beach', 'beach, ocean waves, sand, clear sky'],
    ['set-mountains', 'Mountains', 'mountain range, snowy peaks, valley'],
    ['set-cafe', 'Cafe', 'cozy cafe interior, wooden tables, warm lamps, plants'],
    ['set-bedroom', 'Bedroom', 'bedroom, messy bed, posters, window light'],
    ['set-classroom', 'Classroom', 'classroom, desks, chalkboard, afternoon light'],
    ['set-library', 'Library', 'old library, tall bookshelves, ladders, dust'],
    ['set-castle', 'Castle', 'fantasy castle, stone walls, banners, courtyard'],
    ['set-ruins', 'Ruins', 'ancient ruins, overgrown with vines, broken pillars'],
    ['set-space', 'Space station', 'space station interior, windows to space, sleek panels'],
    ['set-rooftop', 'Rooftop', 'rooftop, city skyline, water tower, sunset'],
    ['set-shrine', 'Shrine', 'shinto shrine, torii gate, stone lanterns'],
    ['set-studio', 'Plain backdrop', 'simple background, studio backdrop, gradient background'],
  ],
  weather: [
    ['w-rain', 'Rain', 'rain, wet, puddles, reflections'],
    ['w-snow', 'Snow', 'snow, snowfall, cold breath, winter'],
    ['w-sunset', 'Sunset', 'sunset, orange sky, silhouettes'],
    ['w-night-sky', 'Starry night', 'night sky, stars, milky way'],
    ['w-fog', 'Fog', 'fog, mist, low visibility, soft silhouettes'],
    ['w-storm', 'Storm', 'storm, dark clouds, lightning, wind'],
    ['w-sakura', 'Cherry blossoms', 'cherry blossoms, falling petals, spring'],
    ['w-autumn', 'Autumn', 'autumn, falling leaves, orange foliage'],
    ['w-blue-hour', 'Blue hour', 'blue hour, twilight, city lights turning on'],
    ['w-summer', 'Summer day', 'summer, bright sunlight, blue sky, cumulus clouds'],
  ],
  atmosphere: [
    ['a-particles', 'Floating particles', 'floating particles, sparkles, dust motes'],
    ['a-magic', 'Magic glow', 'magic, glowing runes, arcane energy, light particles'],
    ['a-fire', 'Fire & embers', 'fire, embers, sparks, heat haze'],
    ['a-bokeh', 'Bokeh lights', 'bokeh, fairy lights, soft out-of-focus lights'],
    ['a-bubbles', 'Bubbles', 'bubbles, underwater light, caustics'],
    ['a-smoke', 'Smoke', 'smoke, haze, wisps'],
    ['a-dreamy', 'Dreamy', 'dreamy, ethereal, soft glow, bloom'],
    ['a-dark', 'Dark & moody', 'dark, moody, ominous atmosphere'],
    ['a-cozy', 'Cozy', 'cozy, warm, comfortable, peaceful'],
    ['a-epic', 'Epic', 'epic scale, grand, awe-inspiring'],
    ['a-glitch', 'Glitch', 'glitch effect, chromatic aberration, digital noise'],
  ],
  detail: [
    ['d-skin', 'Skin detail', 'detailed skin, pores, natural skin texture'],
    ['d-eyes', 'Detailed eyes', 'detailed eyes, reflections in eyes, sparkling eyes'],
    ['d-hair', 'Detailed hair', 'detailed hair, individual strands, shiny hair'],
    ['d-fabric', 'Fabric detail', 'detailed fabric, folds, stitching, texture'],
    ['d-metal', 'Metal detail', 'polished metal, scratches, reflections'],
    ['d-intricate', 'Intricate', 'intricate details, ornate, filigree'],
    ['d-background', 'Detailed background', 'detailed background, scenery, depth'],
  ],
  'neg-quality': [
    ['nq-general', 'Low quality', 'worst quality, low quality, lowres, blurry, jpeg artifacts'],
    ['nq-anime', 'Bad anime', 'bad quality, sketch, messy lineart, flat shading, unfinished'],
    ['nq-photo', 'Bad photo', 'overexposed, underexposed, noisy, out of focus, oversaturated'],
    ['nq-render', 'CG look', '3d, cgi, render, plastic, doll, uncanny'],
    ['nq-drawn', 'Drawn look', 'drawing, painting, illustration, anime, cartoon, sketch'],
  ],
  'neg-anatomy': [
    ['na-general', 'Bad anatomy', 'bad anatomy, bad proportions, deformed, disfigured'],
    ['na-hands', 'Bad hands', 'bad hands, extra fingers, missing fingers, fused fingers, extra digits'],
    ['na-limbs', 'Extra limbs', 'extra arms, extra legs, missing limbs, floating limbs, disconnected limbs'],
    ['na-face', 'Bad face', 'bad face, asymmetrical eyes, cross-eyed, distorted face'],
    ['na-body', 'Bad body', 'long neck, long torso, twisted body, malformed'],
  ],
  'neg-unwanted': [
    ['nu-text', 'Text & watermark', 'text, watermark, signature, logo, artist name, username'],
    ['nu-frame', 'Borders & frames', 'border, frame, letterbox, cropped'],
    ['nu-people', 'Extra people', 'multiple people, crowd, extra person'],
    ['nu-censor', 'Censor marks', 'censored, mosaic, bar censor'],
    ['nu-bg', 'Busy background', 'cluttered background, busy background, distracting details'],
    ['nu-dupe', 'Duplicates', 'duplicate, clone, tiling, repeated pattern'],
  ],
};

const NEGATIVE = new Set(['neg-quality', 'neg-anatomy', 'neg-unwanted']);

/** Pony Diffusion V6 XL tags; `score_8_up` etc. are the real tag names, a quirk of its training. */
function ponySnippets(): Snippet[] {
  const c = 'pony';
  const score = 'score_9, score_8_up, score_7_up, score_6_up, score_5_up, score_4_up';
  const lowScores = 'score_6, score_5, score_4';
  return [
    { id: 'pony-score', name: 'Pony score (full)', tag: 'Q', text: score, weight: 1.0, kind: 'positive', categoryId: c },
    { id: 'pony-score-short', name: 'Pony score (short)', tag: 'Q', text: 'score_9, score_8_up, score_7_up', weight: 1.0, kind: 'positive', categoryId: c },
    { id: 'pony-source-anime', name: 'Source · Anime', tag: 'Src', text: 'source_anime', weight: 1.0, kind: 'positive', categoryId: c },
    { id: 'pony-source-cartoon', name: 'Source · Cartoon', tag: 'Src', text: 'source_cartoon', weight: 1.0, kind: 'positive', categoryId: c },
    { id: 'pony-source-furry', name: 'Source · Furry', tag: 'Src', text: 'source_furry', weight: 1.0, kind: 'positive', categoryId: c },
    { id: 'pony-source-pony', name: 'Source · Pony', tag: 'Src', text: 'source_pony', weight: 1.0, kind: 'positive', categoryId: c },
    { id: 'pony-rating-safe', name: 'Rating · Safe', tag: 'Rate', text: 'rating_safe', weight: 1.0, kind: 'positive', categoryId: c },
    { id: 'pony-rating-questionable', name: 'Rating · Questionable', tag: 'Rate', text: 'rating_questionable', weight: 1.0, kind: 'positive', categoryId: c },
    { id: 'pony-rating-explicit', name: 'Rating · Explicit', tag: 'Rate', text: 'rating_explicit', weight: 1.0, kind: 'positive', categoryId: c },
    { id: 'pony-neg-scores', name: 'Pony low scores', tag: 'Bad', text: lowScores, weight: 1.0, kind: 'negative', categoryId: c },
    { id: 'pony-neg-drawn', name: 'Pony no drawn styles', tag: 'Style', text: 'source_anime, source_cartoon, source_furry, source_pony', weight: 1.0, kind: 'negative', categoryId: c },
    { id: 'pony-starter', name: 'Pony starter', tag: 'Pony', text: score, weight: 1.0, kind: 'positive', categoryId: c, layers: [
      { kind: 'positive', tag: 'Q', text: score, weight: 1.0, on: true },
      { kind: 'negative', tag: 'Bad', text: lowScores, weight: 1.0, on: true },
    ]},
    { id: 'pony-realism-starter', name: 'Pony Realism starter', tag: 'Pony', text: score, weight: 1.0, kind: 'positive', categoryId: c, layers: [
      { kind: 'positive', tag: 'Q', text: 'score_9, score_8_up, score_7_up, photo, realistic', weight: 1.0, on: true },
      { kind: 'negative', tag: 'Bad', text: `${lowScores}, source_anime, source_cartoon, source_furry, source_pony`, weight: 1.0, on: true },
    ]},
  ];
}

/** Illustrious XL reads Danbooru tags: quality first, `absurdres` and the year tag may trail. */
function illustriousSnippets(): Snippet[] {
  const c = 'illustrious';
  const quality = 'masterpiece, best quality, amazing quality, very aesthetic, absurdres, newest';
  const bad = 'lowres, worst quality, low quality, bad quality, bad anatomy, bad hands, bad proportions, jpeg artifacts, signature, watermark, artist name, patreon username, twitter username';
  return [
    { id: 'ill-quality', name: 'Illustrious quality', tag: 'Q', text: quality, weight: 1.0, kind: 'positive', categoryId: c },
    { id: 'ill-quality-short', name: 'Illustrious quality (short)', tag: 'Q', text: 'masterpiece, best quality, very aesthetic', weight: 1.0, kind: 'positive', categoryId: c },
    { id: 'ill-year-newest', name: 'Year · Newest', tag: 'Year', text: 'newest', weight: 1.0, kind: 'positive', categoryId: c },
    { id: 'ill-year-recent', name: 'Year · Recent', tag: 'Year', text: 'recent', weight: 1.0, kind: 'positive', categoryId: c },
    { id: 'ill-rating-general', name: 'Rating · General', tag: 'Rate', text: 'general', weight: 1.0, kind: 'positive', categoryId: c },
    { id: 'ill-rating-sensitive', name: 'Rating · Sensitive', tag: 'Rate', text: 'sensitive', weight: 1.0, kind: 'positive', categoryId: c },
    { id: 'ill-rating-questionable', name: 'Rating · Questionable', tag: 'Rate', text: 'questionable', weight: 1.0, kind: 'positive', categoryId: c },
    { id: 'ill-rating-explicit', name: 'Rating · Explicit', tag: 'Rate', text: 'explicit', weight: 1.0, kind: 'positive', categoryId: c },
    { id: 'ill-neg-quality', name: 'Illustrious bad quality', tag: 'Bad', text: bad, weight: 1.0, kind: 'negative', categoryId: c },
    { id: 'ill-starter', name: 'Illustrious starter', tag: 'Ill', text: quality, weight: 1.0, kind: 'positive', categoryId: c, layers: [
      { kind: 'positive', tag: 'Q', text: quality, weight: 1.0, on: true },
      { kind: 'negative', tag: 'Bad', text: bad, weight: 1.0, on: true },
    ]},
  ];
}

export function librarySnippets(): Snippet[] {
  const rows = Object.entries(ROWS).flatMap(([categoryId, list]) => list.map(([id, name, text]): Snippet => ({
    id: `lib-${id}`, name, tag: '', text, weight: 1, kind: NEGATIVE.has(categoryId) ? 'negative' : 'positive', categoryId,
  })));
  return [...rows, ...ponySnippets(), ...illustriousSnippets()];
}

