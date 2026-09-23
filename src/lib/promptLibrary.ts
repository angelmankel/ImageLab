/**
 * Built-in whole-prompt presets to experiment from. Each is the scene only; the quality tags a
 * model family wants (Pony scores, Illustrious quality tags) are added in front by `presetPrompt`,
 * so one preset works on every checkpoint.
 */

export type ModelFamily = 'plain' | 'pony' | 'illustrious';

export type PromptPreset = {
  id: string;
  name: string;
  category: string;
  positive: string;
  /** Scene-specific things to avoid, added after the family's base negative. */
  negative?: string;
  /** One line on what to try with it. */
  tip?: string;
};

export type NegativePreset = { id: string; name: string; text: string; tip?: string };

export const FAMILY_LABELS: Record<ModelFamily, string> = { plain: 'Plain SDXL', pony: 'Pony', illustrious: 'Illustrious' };

const FAMILY_POSITIVE: Record<ModelFamily, string> = {
  plain: 'masterpiece, best quality, highly detailed',
  pony: 'score_9, score_8_up, score_7_up',
  illustrious: 'masterpiece, best quality, amazing quality, very aesthetic, absurdres',
};

const FAMILY_NEGATIVE: Record<ModelFamily, string> = {
  plain: 'worst quality, low quality, blurry, bad anatomy, bad hands, watermark, text',
  pony: 'score_6, score_5, score_4, bad anatomy, bad hands, watermark, text',
  illustrious: 'worst quality, low quality, lowres, bad anatomy, bad hands, jpeg artifacts, signature, watermark',
};

/** Guess the family from a checkpoint file name; plain SDXL when nothing matches. */
export function familyForCheckpoint(name: string | undefined): ModelFamily {
  const n = (name ?? '').toLowerCase();
  if (/pony|pdxl|autismmix/.test(n)) return 'pony';
  if (/illustrious|noob|wai|citron|hassaku/.test(n)) return 'illustrious';
  return 'plain';
}

/** The ready-to-use text for a preset on a family: quality tags first, then the scene. */
export function presetPrompt(preset: PromptPreset, family: ModelFamily): { positive: string; negative: string } {
  return {
    positive: `${FAMILY_POSITIVE[family]}, ${preset.positive}`,
    negative: preset.negative ? `${FAMILY_NEGATIVE[family]}, ${preset.negative}` : FAMILY_NEGATIVE[family],
  };
}

export function negativeForFamily(family: ModelFamily): string {
  return FAMILY_NEGATIVE[family];
}

export const PRESET_CATEGORIES = [
  'Portraits', 'Characters', 'Fantasy', 'Sci-fi', 'Landscapes', 'Cozy', 'Dark', 'Action', 'Creatures',
  'Still life', 'Places', 'Surreal', 'Photo',
];

export const PROMPT_PRESETS: PromptPreset[] = [
  // — Portraits
  { id: 'rain-window', name: 'Rainy window', category: 'Portraits',
    positive: '1girl, upper body, looking out a rainy window, raindrops on glass, soft reflections, melancholic, muted blue palette, depth of field',
    tip: 'Swap the mood: try "smile, warm lamp light" for a cosy version.' },
  { id: 'golden-portrait', name: 'Golden hour portrait', category: 'Portraits',
    positive: '1girl, close-up, windswept hair, golden hour, backlighting, lens flare, warm tones, bokeh, gentle smile, looking at viewer' },
  { id: 'neon-portrait', name: 'Neon portrait', category: 'Portraits',
    positive: '1boy, close-up, face lit by neon signs, magenta and cyan light, rain, wet hair, serious expression, night, cinematic',
    tip: 'Change the two neon colours to shift the whole mood.' },
  { id: 'flower-crown', name: 'Flower crown', category: 'Portraits',
    positive: '1girl, portrait, flower crown, freckles, soft natural light, meadow background, pastel colors, calm expression, looking at viewer' },
  { id: 'old-sailor', name: 'Old sailor', category: 'Portraits',
    positive: 'old man, sailor, weathered face, white beard, knit cap, pipe, harbor at dusk, dramatic side lighting, detailed skin, oil painting' },
  { id: 'split-light', name: 'Split light', category: 'Portraits',
    positive: '1girl, close-up, split lighting, half face in shadow, dark background, intense stare, sharp focus, dramatic, low key' },

  // — Characters
  { id: 'knight', name: 'Knight', category: 'Characters',
    positive: '1girl, knight, silver plate armor, red cape, holding sword, standing, castle courtyard, banners, determined expression, cowboy shot' },
  { id: 'witch', name: 'Forest witch', category: 'Characters',
    positive: '1girl, witch, wide-brimmed hat, dark robes, holding glowing staff, forest at night, fireflies, mysterious smile, full body' },
  { id: 'hacker', name: 'Hacker', category: 'Characters',
    positive: '1boy, hacker, hoodie, headphones, sitting in dark room, many monitors, green code reflection on face, cables, night' },
  { id: 'samurai', name: 'Samurai', category: 'Characters',
    positive: '1boy, samurai, katana, hakama, standing in bamboo forest, falling leaves, wind, calm expression, cowboy shot, dramatic light' },
  { id: 'idol', name: 'Idol on stage', category: 'Characters',
    positive: '1girl, idol, frilly stage outfit, holding microphone, singing, stage lights, confetti, crowd glowsticks, dynamic angle, smile' },
  { id: 'mechanic', name: 'Mechanic', category: 'Characters',
    positive: '1girl, mechanic, overalls tied at waist, tank top, grease on face, holding wrench, garage, motorcycle, confident grin' },
  { id: 'librarian', name: 'Librarian mage', category: 'Characters',
    positive: '1girl, glasses, long braid, reading a floating book, magic library, glowing runes, floating books, warm candlelight' },

  // — Fantasy
  { id: 'dragon-cliff', name: 'Dragon on cliff', category: 'Fantasy',
    positive: 'huge dragon perched on a cliff, wings spread, storm clouds, lightning, tiny knight in foreground, epic scale, wide shot' },
  { id: 'elf-city', name: 'Elf city', category: 'Fantasy',
    positive: 'elven city built into giant trees, rope bridges, glowing lanterns, waterfalls, mist, golden light, no humans, scenery, wide shot' },
  { id: 'potion-shop', name: 'Potion shop', category: 'Fantasy',
    positive: 'cozy potion shop interior, shelves of glowing bottles, hanging herbs, cauldron, cat on counter, warm light, detailed background, no humans' },
  { id: 'fairy', name: 'Tiny fairy', category: 'Fantasy',
    positive: '1girl, fairy, tiny, translucent wings, sitting on a mushroom, dew drops, forest floor, macro, bokeh, soft morning light' },
  { id: 'sky-island', name: 'Sky islands', category: 'Fantasy',
    positive: 'floating islands, waterfalls falling into clouds, airship, sunrise, vast sky, birds, scenery, no humans, epic' },

  // — Sci-fi
  { id: 'cyber-street', name: 'Cyberpunk street', category: 'Sci-fi',
    positive: 'cyberpunk city street at night, neon signs, holograms, rain, crowded, steam from vents, reflections, 1girl walking with umbrella, from behind' },
  { id: 'mech-hangar', name: 'Mech hangar', category: 'Sci-fi',
    positive: 'giant mecha in a hangar, maintenance scaffolding, sparks from welding, workers, industrial lights, scale, from below' },
  { id: 'astronaut', name: 'Lone astronaut', category: 'Sci-fi',
    positive: 'astronaut standing on alien planet, two moons, strange crystal plants, purple sky, wide shot, small figure, sense of wonder' },
  { id: 'android', name: 'Android', category: 'Sci-fi',
    positive: '1girl, android, visible mechanical joints, white panels, glowing blue eyes, lab, cables, clean lighting, expressionless, upper body' },
  { id: 'space-window', name: 'Space station window', category: 'Sci-fi',
    positive: '1girl, sitting by a large window in a space station, earth below, stars, reflection on glass, holding coffee cup, calm, cinematic' },

  // — Landscapes
  { id: 'lake-mountains', name: 'Mountain lake', category: 'Landscapes',
    positive: 'mountain lake at sunrise, mirror reflection, pine trees, mist over water, snowy peaks, scenery, no humans, wide shot' },
  { id: 'rice-fields', name: 'Countryside summer', category: 'Landscapes',
    positive: 'japanese countryside, rice fields, summer, cumulus clouds, power lines, small shrine, cicadas, blue sky, scenery, anime background' },
  { id: 'desert-ruins', name: 'Desert ruins', category: 'Landscapes',
    positive: 'vast desert, ancient ruins half buried in sand, sandstorm in the distance, heat haze, lone traveler with cloak, wide shot' },
  { id: 'aurora', name: 'Aurora', category: 'Landscapes',
    positive: 'aurora borealis over snowy forest, starry sky, frozen lake, small cabin with warm window, night, scenery, no humans' },
  { id: 'coast-storm', name: 'Stormy coast', category: 'Landscapes',
    positive: 'lighthouse on rocky coast, huge waves crashing, storm clouds, lightning, dramatic light, spray, scenery, no humans' },

  // — Cozy
  { id: 'rainy-cafe', name: 'Rainy café', category: 'Cozy',
    positive: '1girl, sitting in a cafe by the window, rain outside, holding warm cup, steam, oversized sweater, warm lights, plants, peaceful' },
  { id: 'kotatsu', name: 'Winter kotatsu', category: 'Cozy',
    positive: '1girl, under kotatsu, mandarin oranges, cat sleeping, snow falling outside window, warm room, sleepy, relaxed' },
  { id: 'bedroom-night', name: 'Late night room', category: 'Cozy',
    positive: '1girl, messy bedroom at night, sitting on bed with laptop, fairy lights, posters, headphones, city lights through window, lo-fi' },
  { id: 'bakery', name: 'Morning bakery', category: 'Cozy',
    positive: 'small bakery at dawn, fresh bread on shelves, flour in the air, warm light through window, baker, cozy, detailed background' },

  // — Dark
  { id: 'haunted-hall', name: 'Haunted hallway', category: 'Dark',
    positive: 'long dark hallway, flickering light, old wallpaper peeling, a figure at the far end, fog, horror, ominous, from behind' },
  { id: 'vampire', name: 'Vampire noble', category: 'Dark',
    positive: '1boy, vampire, pale skin, red eyes, gothic coat, candelabra, dark castle, moonlight through stained glass, elegant, menacing' },
  { id: 'plague-doctor', name: 'Plague doctor', category: 'Dark',
    positive: 'plague doctor, beak mask, long coat, lantern, foggy medieval street at night, cobblestones, eerie, low key lighting' },
  { id: 'dark-forest', name: 'Whispering woods', category: 'Dark',
    positive: 'dark twisted forest, glowing eyes in the shadows, 1girl holding lantern, fog, red cloak, fear, night, dutch angle' },

  // — Action
  { id: 'sword-clash', name: 'Sword clash', category: 'Action',
    positive: '2boys, sword fight, blades clashing, sparks, dynamic pose, motion blur, dust, dramatic angle, rain, intense' },
  { id: 'magic-blast', name: 'Magic blast', category: 'Action',
    positive: '1girl, casting spell, huge magic circle, energy blast, flowing hair, glowing eyes, debris flying, from below, dynamic' },
  { id: 'rooftop-chase', name: 'Rooftop run', category: 'Action',
    positive: '1girl, running across rooftops, jumping gap, city at sunset, jacket flowing, motion blur, wide shot, dynamic angle' },
  { id: 'gunslinger', name: 'Gunslinger', category: 'Action',
    positive: '1girl, cowboy hat, duster coat, revolver drawn, dusty western town, high noon, dramatic shadows, tumbleweed, cowboy shot' },

  // — Creatures
  { id: 'fox-spirit', name: 'Fox spirit', category: 'Creatures',
    positive: 'nine-tailed fox spirit, glowing blue flames, shrine at night, cherry blossoms, mystical, no humans, detailed fur' },
  { id: 'cat-king', name: 'Cat king', category: 'Creatures',
    positive: 'fluffy cat wearing a tiny crown and royal cape, sitting on a throne, regal, dramatic lighting, oil painting, no humans' },
  { id: 'forest-golem', name: 'Moss golem', category: 'Creatures',
    positive: 'giant moss-covered stone golem sleeping in the forest, flowers growing on it, deer nearby, light rays, peaceful, no humans' },
  { id: 'sea-serpent', name: 'Sea serpent', category: 'Creatures',
    positive: 'massive sea serpent rising from stormy ocean, small sailing ship, huge waves, lightning, epic scale, dramatic' },

  // — Still life
  { id: 'ramen', name: 'Ramen bowl', category: 'Still life',
    positive: 'bowl of ramen, soft-boiled egg, chashu, steam rising, wooden table, warm light, food focus, detailed, no humans' },
  { id: 'desk', name: 'Artist desk', category: 'Still life',
    positive: 'artist desk, sketchbooks, pencils, coffee cup, plants, window light, scattered paper, cozy clutter, no humans, from above' },
  { id: 'terrarium', name: 'Terrarium world', category: 'Still life',
    positive: 'glass terrarium with a tiny forest and a tiny cabin inside, moss, miniature, macro, soft light, bokeh, no humans' },

  // — Places
  { id: 'train-station', name: 'Rural station', category: 'Places',
    positive: 'empty rural train station, summer evening, sunset, vending machine glowing, overgrown platform, power lines, anime background, no humans' },
  { id: 'arcade', name: 'Retro arcade', category: 'Places',
    positive: 'retro arcade at night, rows of glowing cabinets, neon, carpet pattern, 1girl playing, from behind, vibrant colors' },
  { id: 'greenhouse', name: 'Greenhouse', category: 'Places',
    positive: 'victorian greenhouse, glass roof, lush tropical plants, sunlight, iron frames, butterflies, 1girl watering plants, peaceful' },
  { id: 'underwater-city', name: 'Sunken city', category: 'Places',
    positive: 'sunken ancient city underwater, light rays from the surface, fish schools, coral on pillars, bubbles, blue, no humans, wide shot' },

  // — Surreal
  { id: 'whale-sky', name: 'Sky whale', category: 'Surreal',
    positive: 'giant whale swimming through the clouds above a small town, sunset, surreal, dreamy, 1girl on a rooftop looking up, wide shot' },
  { id: 'door-field', name: 'Door in a field', category: 'Surreal',
    positive: 'a lone door standing in an empty field, open, bright galaxy visible through it, grass, dusk, surreal, minimal, no humans' },
  { id: 'melting-clock', name: 'Melting world', category: 'Surreal',
    positive: 'melting clocks, endless staircase, floating islands, impossible architecture, dreamlike, pastel sky, surreal, no humans' },
  { id: 'reflection', name: 'Other self', category: 'Surreal',
    positive: '1girl, standing on still water, reflection is a different person, mirror world, sunset sky, minimal, surreal, symmetrical' },

  // — Photo (best on realistic checkpoints)
  { id: 'street-photo', name: 'Street photo', category: 'Photo',
    positive: 'street photography, woman walking in tokyo crosswalk, candid, 35mm, film grain, overcast light, motion blur of crowd, photo, realistic',
    negative: 'anime, cartoon, drawing, illustration', tip: 'Pony: this pairs with the Pony Realism starter snippet.' },
  { id: 'studio-portrait', name: 'Studio portrait', category: 'Photo',
    positive: 'studio portrait of a man, 85mm, softbox lighting, grey backdrop, detailed skin, sharp eyes, photo, realistic',
    negative: 'anime, cartoon, drawing, illustration, plastic skin' },
  { id: 'fashion', name: 'Fashion editorial', category: 'Photo',
    positive: 'fashion editorial, woman in a red coat, windy city bridge, dramatic sky, high fashion pose, photo, realistic, cinematic color grade',
    negative: 'anime, cartoon, drawing, illustration' },
  { id: 'food-photo', name: 'Food photo', category: 'Photo',
    positive: 'food photography, stack of pancakes with berries and syrup, morning light, shallow depth of field, rustic table, photo, realistic',
    negative: 'anime, cartoon, drawing, illustration' },
];

export const NEGATIVE_PRESETS: NegativePreset[] = [
  { id: 'n-plain', name: 'Plain SDXL', text: FAMILY_NEGATIVE.plain },
  { id: 'n-pony', name: 'Pony', text: FAMILY_NEGATIVE.pony },
  { id: 'n-pony-real', name: 'Pony Realism', text: `${FAMILY_NEGATIVE.pony}, source_anime, source_cartoon, source_furry, source_pony, 3d, cgi` },
  { id: 'n-ill', name: 'Illustrious', text: FAMILY_NEGATIVE.illustrious },
  { id: 'n-anatomy', name: 'Anatomy fix', text: 'bad anatomy, bad proportions, bad hands, extra fingers, missing fingers, extra arms, extra legs, fused fingers, long neck, deformed',
    tip: 'Add to the end of any negative when bodies come out wrong.' },
  { id: 'n-clean', name: 'Clean image', text: 'text, watermark, signature, logo, username, border, frame, jpeg artifacts, blurry' },
  { id: 'n-photo', name: 'Photo realism', text: 'anime, cartoon, drawing, illustration, painting, 3d render, cgi, plastic skin, doll, oversaturated' },
  { id: 'n-solo', name: 'Just one person', text: 'multiple people, 2girls, 2boys, crowd, extra person, clone' },
  { id: 'n-minimal', name: 'Minimal', text: 'worst quality, low quality', tip: 'Pony and Illustrious often do best with very little negative.' },
];
