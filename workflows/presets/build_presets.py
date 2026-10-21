#!/usr/bin/env python3
"""
Builds ImageLab's ready-made ComfyUI workflows (UI / editor format) from a live /object_info.

    python3 workflows/presets/build_presets.py <object_info.json> workflows/presets

Every node's widgets_values are written in the order /object_info declares (with the extra
control_after_generate slot after a seed, see CLAUDE.md "The seed trap"), every widget is also listed
in the node's `inputs` (as the current ComfyUI frontend saves it), so the app's readParams /
editorToApi and the ComfyUI editor read the same values. A widget value that is not in the server's
option list, an unknown input name or a link between mismatched types stops the build.

Naming rules that make a workflow read well in the app's Workflow step (next/src/screens/image/workflow):
- the prompt box is titled "Positive prompt", the negative one "Negative prompt";
- the FIRST LoadImage is the step's input picture (chained from the previous step); others are titled;
- shared numbers are Primitive nodes titled with what they are ("Seed", "Tile size", ...);
- groups and node titles say what each stage does; one Note explains the workflow.
Only the final picture is saved (SaveImage); no PreviewImage nodes.
"""
import json
import os
import sys

OI = json.load(open(sys.argv[1], encoding='utf-8'))
OUT = sys.argv[2]

WIDGET_TYPES = {'INT', 'FLOAT', 'STRING', 'BOOLEAN', 'COMBO'}
PALETTE = ['#3f789e', '#8A8', '#b06634', '#a1309b', '#88A', '#b58b2a', '#335', '#444']


def spec(class_type):
    d = OI[class_type]
    ins = []
    for grp in ('required', 'optional'):
        defs = d.get('input', {}).get(grp, {}) or {}
        order = (d.get('input_order') or {}).get(grp) or list(defs)
        for name in order:
            s = defs.get(name)
            if not isinstance(s, list):
                continue
            t0 = s[0]
            o = s[1] if len(s) > 1 and isinstance(s[1], dict) else {}
            if isinstance(t0, list):
                typ, opts = 'COMBO', t0
            elif t0 == 'COMBO':
                typ, opts = 'COMBO', o.get('options', [])
            else:
                typ, opts = str(t0), None
            widget = typ in WIDGET_TYPES and not o.get('forceInput')
            control = bool(o.get('control_after_generate')) or (typ == 'INT' and name in ('seed', 'noise_seed'))
            if 'default' in o:
                default = o['default']
            elif typ == 'COMBO':
                default = opts[0] if opts else ''
            else:
                default = {'STRING': '', 'BOOLEAN': False}.get(typ, 0)
            ins.append(dict(name=name, type=typ, widget=widget, opts=opts, default=default,
                            control=control, optional=grp == 'optional', o=o))
    outs = [(str(t) if not isinstance(t, list) else 'COMBO', n) for t, n in zip(d['output'], d.get('output_name') or d['output'])]
    return ins, outs, d.get('display_name') or class_type


class Node:
    def __init__(self, wf, nid, type_, title, group):
        self.wf, self.id, self.type, self.title, self.group = wf, nid, type_, title, group

    def __getitem__(self, slot):
        return (self, slot)


class WF:
    def __init__(self, name, note):
        self.name, self.note = name, note
        self.nodes = []      # (Node, editor dict)
        self.links = []
        self.group_order = []
        self.next_id = 1

    def add(self, type_, title=None, group='Main', w=None, mode=0, **conns):
        w = dict(w or {})
        ins, outs, display = spec(type_)
        n = Node(self, self.next_id, type_, title, group)
        self.next_id += 1
        if group not in self.group_order:
            self.group_order.append(group)
        names = {i['name'] for i in ins}
        for k in list(w) + list(conns):
            if k not in names:
                raise SystemExit(f'{self.name}: {type_} has no input "{k}" (has {sorted(names)})')
        inputs, wv = [], []
        for i in ins:
            entry = {'name': i['name'], 'type': i['type'], 'link': None}
            if i['widget']:
                entry['widget'] = {'name': i['name']}
                v = w.get(i['name'], i['default'])
                if i['type'] == 'COMBO' and i['opts'] is not None and v not in i['opts']:
                    raise SystemExit(f'{self.name}: {type_}.{i["name"]} = {v!r} is not an option on the server')
                if i['type'] in ('INT', 'FLOAT') and isinstance(v, (int, float)):
                    lo, hi = i['o'].get('min'), i['o'].get('max')
                    if (lo is not None and v < lo) or (hi is not None and v > hi):
                        raise SystemExit(f'{self.name}: {type_}.{i["name"]} = {v} outside {lo}..{hi}')
                wv.append(v)
                if i['control']:
                    wv.append('fixed' if type_.startswith('Primitive') and 'seed' not in (title or '').lower() else 'randomize')
            elif i['optional'] and i['name'] not in conns:
                # Unconnected optional sockets are still listed (the editor does), with no link.
                pass
            inputs.append(entry)
        ed = {
            'id': n.id, 'type': type_, 'pos': [0, 0], 'size': [340, 100], 'flags': {}, 'order': 0, 'mode': mode,
            'inputs': inputs,
            'outputs': [{'name': nm, 'type': t, 'links': [], 'slot_index': k} for k, (t, nm) in enumerate(outs)],
            'properties': {'Node name for S&R': type_},
            'widgets_values': wv,
        }
        if title:
            ed['title'] = title
        self.nodes.append((n, ed))
        for name, src in conns.items():
            self.link(src, n, name)
        return n

    def ed(self, node):
        return next(e for n, e in self.nodes if n is node)

    def link(self, src, dst, name):
        snode, slot = src
        se, de = self.ed(snode), self.ed(dst)
        out = se['outputs'][slot]
        k = next(j for j, i in enumerate(de['inputs']) if i['name'] == name)
        inp = de['inputs'][k]
        if inp['type'] == 'COMFY_MATCHTYPE_V3':       # a switch takes the type of what is plugged in
            inp['type'] = out['type']
            for o in de['outputs']:
                if o['type'] == 'COMFY_MATCHTYPE_V3':
                    o['type'] = out['type']
        ok = out['type'] == inp['type'] or '*' in (out['type'], inp['type']) or \
            set(inp['type'].split(',')) & {out['type']}
        if not ok:
            raise SystemExit(f'{self.name}: {snode.type}[{slot}] {out["type"]} -> {dst.type}.{name} {inp["type"]}')
        lid = len(self.links) + 1
        self.links.append([lid, snode.id, slot, dst.id, k, out['type']])
        out['links'].append(lid)
        inp['link'] = lid

    # ── layout ────────────────────────────────────────────────────────────
    def build(self):
        eds = [e for _, e in self.nodes]
        # topological order
        deps = {e['id']: {l[1] for l in self.links if l[3] == e['id']} for e in eds}
        order, done = [], set()
        while len(order) < len(eds):
            for e in eds:
                if e['id'] not in done and deps[e['id']] <= done:
                    order.append(e['id']); done.add(e['id']); break
            else:
                raise SystemExit(f'{self.name}: graph has a cycle')
        for k, nid in enumerate(order):
            next(e for e in eds if e['id'] == nid)['order'] = k + 1

        def height(e):
            sockets = sum(1 for i in e['inputs'] if 'widget' not in i)
            widgets = [i for i in e['inputs'] if 'widget' in i]
            multi = sum(1 for i in widgets if self._multiline(e['type'], i['name']))
            return 36 + 22 * max(sockets, len(e['outputs'])) + 26 * len(widgets) + 110 * multi

        groups = []
        x = 460
        note_h = 60 + 18 * (self.note.count('\n') + 1 + len(self.note) // 52)
        for gi, g in enumerate(self.group_order):
            members = [e for n, e in self.nodes if n.group == g]
            y = 60
            for e in members:
                h = height(e)
                e['pos'] = [x + 20, y + 50]
                e['size'] = [340, h]
                y += h + 40
            groups.append({'title': g, 'bounding': [x, 60, 380, y - 60 + 40], 'color': PALETTE[gi % len(PALETTE)],
                           'font_size': 22, 'flags': {}})
            x += 420
        nid = self.next_id
        note = {'id': nid, 'type': 'Note', 'pos': [20, 80], 'size': [400, max(260, note_h)], 'flags': {},
                'order': 0, 'mode': 0, 'inputs': [], 'outputs': [], 'title': 'About this workflow',
                'properties': {}, 'widgets_values': [self.note], 'color': '#432', 'bgcolor': '#653'}
        return {
            'last_node_id': nid, 'last_link_id': len(self.links),
            'nodes': [note] + eds, 'links': self.links, 'groups': groups,
            'config': {}, 'extra': {'ds': {'scale': 0.7, 'offset': [0, 0]}, 'imagelab': {'preset': True}},
            'version': 0.4,
        }

    @staticmethod
    def _multiline(type_, name):
        s = OI[type_]['input']
        for g in ('required', 'optional'):
            v = (s.get(g) or {}).get(name)
            if isinstance(v, list) and len(v) > 1 and isinstance(v[1], dict) and v[1].get('multiline'):
                return True
        return False


# ═══ Families ═════════════════════════════════════════════════════════════

NEG_REAL = 'lowres, blurry, bad anatomy, bad hands, extra fingers, deformed, watermark, text, signature, worst quality, low quality, jpeg artifacts'
POS_DEMO = 'a cozy wooden cabin in a snowy forest at dusk, warm light in the windows, soft falling snow, highly detailed'

SD15 = dict(key='SD 1.5', slug='sd15', ckpt='realisticVisionV60B1_v51VAE_94298.safetensors', w=512, h=768, mp=0.4,
            steps=25, cfg=6.0, sampler='dpmpp_2m', sched='karras', neg=NEG_REAL, skip=None, tile=768, flux=False,
            what='SD 1.5 checkpoints (realistic or anime). Default: Realistic Vision 6.')
SDXL = dict(key='SDXL', slug='sdxl', ckpt='juggernautXL_ragnarokBy.safetensors', w=1024, h=1024, mp=1.0,
            steps=30, cfg=5.0, sampler='dpmpp_2m_sde', sched='karras', neg=NEG_REAL, skip=None, tile=1024, flux=False,
            what='SDXL checkpoints; Illustrious and Pony models work too (use their prompt style). Default: Juggernaut XL.')
ILLU = dict(SDXL, key='Illustrious', slug='illustrious', ckpt='novaAnimeXL_ilV80.safetensors', w=832, h=1216,
            steps=28, cfg=5.5, sampler='euler_ancestral', sched='normal', skip=-2,
            neg='lowres, worst quality, bad quality, bad anatomy, bad hands, extra digits, jpeg artifacts, signature, watermark, text',
            tags='masterpiece, best quality, amazing quality, very aesthetic, absurdres',
            what='Illustrious / NoobAI anime checkpoints (not the v-pred ones). Default: Nova Anime XL.')
PONY = dict(SDXL, key='Pony', slug='pony', ckpt='ponyDiffusionV6XL_v6StartWithThisOne.safetensors', w=832, h=1216,
            steps=25, cfg=7.0, sampler='euler_ancestral', sched='normal', skip=-2,
            neg='score_4, score_5, score_6, lowres, bad anatomy, bad hands, jpeg artifacts, signature, watermark, text',
            tags='score_9, score_8_up, score_7_up, score_6_up',
            what='Pony Diffusion V6 based checkpoints. Default: Pony Diffusion V6 XL.')
FLUX = dict(key='Flux', slug='flux', ckpt='flux1-schnell-fp8.safetensors', w=1024, h=1024, mp=1.0,
            steps=4, cfg=1.0, sampler='euler', sched='simple', neg=None, skip=None, tile=1024, flux=True,
            what='Flux.1 schnell all-in-one checkpoints (flux1-schnell-fp8, DreamPhoto). 4 steps, CFG 1, no negative prompt.')


def model(wf, fam, group='Model', title='Checkpoint', ckpt=None):
    ck = wf.add('CheckpointLoaderSimple', title, group, {'ckpt_name': ckpt or fam['ckpt']})
    clip = ck[1]
    if fam.get('skip'):
        clip = wf.add('CLIPSetLastLayer', 'Clip skip', group, {'stop_at_clip_layer': fam['skip']}, clip=ck[1])[0]
    return ck[0], clip, ck[2]


def prompts(wf, fam, clip, pos=POS_DEMO, group='Prompt', tags=True):
    """Positive (+ quality tags for Illustrious / Pony) and negative; Flux gets a zeroed negative."""
    if fam.get('tags') and tags:
        q = wf.add('PrimitiveStringMultiline', 'Quality tags', group, {'value': fam['tags']})
        p = wf.add('PrimitiveStringMultiline', 'Positive prompt', group, {'value': pos})
        j = wf.add('StringConcatenate', 'Tags + prompt', group, {'delimiter': ', '}, string_a=q[0], string_b=p[0])
        positive = wf.add('CLIPTextEncode', 'Encode prompt', group, clip=clip, text=j[0])[0]
    else:
        positive = wf.add('CLIPTextEncode', 'Positive prompt', group, {'text': pos}, clip=clip)[0]
    if fam['flux']:
        negative = wf.add('ConditioningZeroOut', 'No negative (Flux)', group, conditioning=positive)[0]
    else:
        negative = wf.add('CLIPTextEncode', 'Negative prompt', group, {'text': fam['neg']}, clip=clip)[0]
    return positive, negative


def empty(wf, fam, group='Size', w=None, h=None, batch=1, **conns):
    cls = 'EmptySD3LatentImage' if fam['flux'] else 'EmptyLatentImage'
    return wf.add(cls, 'Size', group, {'width': w or fam['w'], 'height': h or fam['h'], 'batch_size': batch}, **conns)[0]


def sample(wf, fam, m, pos, neg, latent, denoise=1.0, title='Sampler', group='Sampling', steps=None, cfg=None, sampler=None, sched=None, **conns):
    return wf.add('KSampler', title, group, {
        'seed': 0, 'steps': steps or fam['steps'], 'cfg': cfg if cfg is not None else fam['cfg'],
        'sampler_name': sampler or fam['sampler'], 'scheduler': sched or fam['sched'], 'denoise': denoise,
    }, model=m, positive=pos, negative=neg, latent_image=latent, **conns)[0]


def decode_save(wf, latent, vae, slug, group='Output', tiled=False):
    if tiled:
        img = wf.add('VAEDecodeTiled', 'Decode', group, {'tile_size': 1024, 'overlap': 64}, samples=latent, vae=vae)[0]
    else:
        img = wf.add('VAEDecode', 'Decode', group, samples=latent, vae=vae)[0]
    wf.add('SaveImage', 'Save', group, {'filename_prefix': f'presets/{slug}'}, images=img)
    return img


def save(wf, img, slug, group='Output', title='Save'):
    wf.add('SaveImage', title, group, {'filename_prefix': f'presets/{slug}'}, images=img)


def load(wf, title, group='Input', image='example.png'):
    return wf.add('LoadImage', title, group, {'image': image})


def working_size(wf, img, mp, group='Input', title='Working size'):
    return wf.add('ImageScaleToTotalPixels', title, group, {'upscale_method': 'lanczos', 'megapixels': mp, 'resolution_steps': 64}, image=img)[0]


def soft_mask(wf, mask, group, grow=8, blur=8):
    g = wf.add('GrowMask', 'Grow mask', group, {'expand': grow, 'tapered_corners': True}, mask=mask)[0]
    i = wf.add('MaskToImage', 'Mask to image', group, mask=g)[0]
    b = wf.add('ImageBlur', 'Soften mask edge', group, {'blur_radius': blur, 'sigma': 4.0}, image=i)[0]
    return wf.add('ImageToMask', 'Image to mask', group, {'channel': 'red'}, image=b)[0]


def detailer(wf, fam, img, m, clip, vae, pos, neg, part='face', denoise=0.4, group='Face fix', title=None, sam=None):
    """Impact Pack FaceDetailer: finds faces (or hands) with a YOLO detector + SAM, redraws each crop, pastes it back."""
    det = wf.add('UltralyticsDetectorProvider', 'Face detector' if part == 'face' else 'Hand detector', group,
                 {'model_name': 'bbox/face_yolov8m.pt' if part == 'face' else 'bbox/hand_yolov8s.pt'})
    sam = sam or wf.add('SAMLoader', 'SAM', group, {'model_name': 'sam_vit_b_01ec64.pth', 'device_mode': 'AUTO'})[0]
    xl = fam['key'] != 'SD 1.5'
    return wf.add('FaceDetailer', title or ('Fix faces' if part == 'face' else 'Fix hands'), group, {
        'guide_size': 1024 if xl else 512, 'guide_size_for': True, 'max_size': 1024 if xl else 768, 'seed': 0,
        'steps': 20, 'cfg': fam['cfg'], 'sampler_name': fam['sampler'], 'scheduler': fam['sched'], 'denoise': denoise,
        'feather': 5, 'noise_mask': True, 'force_inpaint': True, 'bbox_threshold': 0.5, 'bbox_dilation': 10,
        'bbox_crop_factor': 3.0 if part == 'face' else 2.0, 'sam_detection_hint': 'center-1', 'sam_dilation': 0,
        'sam_threshold': 0.93, 'sam_bbox_expansion': 0, 'sam_mask_hint_threshold': 0.7, 'sam_mask_hint_use_negative': 'False',
        'drop_size': 10, 'wildcard': '', 'cycle': 1, 'inpaint_model': False, 'noise_mask_feather': 20,
        'tiled_encode': False, 'tiled_decode': False,
    }, image=img, model=m, clip=clip, vae=vae, positive=pos, negative=neg, bbox_detector=det[0], sam_model_opt=sam)[0]


def decode_fix_save(wf, fam, latent, m, clip, vae, pos, neg, slug, denoise=0.4):
    img = wf.add('VAEDecode', 'Decode', 'Output', samples=latent, vae=vae)[0]
    fixed = detailer(wf, fam, img, m, clip, vae, pos, neg, denoise=denoise)
    save(wf, fixed, slug)


def common_note(fam, body):
    return body.strip() + f"\n\nModel: {fam['what']}\nDefaults: {fam['steps']} steps, CFG {fam['cfg']}, {fam['sampler']} / {fam['sched']}."


WORKFLOWS = {}


def register(name):
    def deco(fn):
        WORKFLOWS[name] = fn
        return fn
    return deco


# ═══ Basics, per family ═══════════════════════════════════════════════════

def txt2img(fam):
    wf = WF(f"{fam['key']} · txt2img", common_note(fam, f"""
Text to image. Write the prompt, pick the size, Generate.
Size: {fam['w']}×{fam['h']} is the model's native size; keep about the same pixel count for other shapes."""))
    m, clip, vae = model(wf, fam)
    pos, neg = prompts(wf, fam, clip)
    lat = empty(wf, fam)
    out = sample(wf, fam, m, pos, neg, lat)
    decode_save(wf, out, vae, f"{fam['slug']}-txt2img")
    return wf


def img2img(fam):
    d = 0.6 if not fam['flux'] else 0.7
    wf = WF(f"{fam['key']} · img2img", common_note(fam, f"""
Image to image: redraws the input picture following the prompt.
Denoise = how much changes: 0.3 keeps the picture and fixes details, 0.6 (default {d}) restyles it, 0.85+ keeps only the rough layout.
The input is resized to about {fam['mp']} megapixels first (Working size)."""))
    img = load(wf, 'Input image')
    px = working_size(wf, img[0], fam['mp'])
    m, clip, vae = model(wf, fam)
    pos, neg = prompts(wf, fam, clip)
    lat = wf.add('VAEEncode', 'Encode', 'Input', pixels=px, vae=vae)[0]
    out = sample(wf, fam, m, pos, neg, lat, denoise=d, steps=fam['steps'] if not fam['flux'] else 6)
    decode_save(wf, out, vae, f"{fam['slug']}-img2img")
    return wf


def hires(fam):
    d2 = 0.4 if fam['flux'] else 0.45
    wf = WF(f"{fam['key']} · hires fix", common_note(fam, f"""
Two passes: makes the picture at the native size, enlarges it ×1.5 and redraws it at denoise {d2} for sharp detail.
Hires scale: 1.5 is safe, 2 needs more VRAM and time. Hires denoise: 0.3 = sharper only, 0.55 = more new detail."""))
    m, clip, vae = model(wf, fam)
    pos, neg = prompts(wf, fam, clip)
    lat = empty(wf, fam)
    first = sample(wf, fam, m, pos, neg, lat, title='First pass')
    img = wf.add('VAEDecode', 'Decode first pass', 'Hires', samples=first, vae=vae)[0]
    big = wf.add('ImageScaleBy', 'Hires scale', 'Hires', {'upscale_method': 'lanczos', 'scale_by': 1.5}, image=img)[0]
    lat2 = wf.add('VAEEncode', 'Encode', 'Hires', pixels=big, vae=vae)[0]
    out = sample(wf, fam, m, pos, neg, lat2, denoise=d2, title='Hires pass', group='Hires')
    decode_save(wf, out, vae, f"{fam['slug']}-hires")
    return wf


def inpaint(fam):
    wf = WF(f"{fam['key']} · inpaint", common_note(fam, """
Repaints part of a picture. The input picture's TRANSPARENT area is what gets repainted:
erase it in ImageLab's editor (transparent PNG), or in ComfyUI right-click the image → Open in MaskEditor.
The prompt describes what should appear there. The rest of the picture stays pixel-exact.
Grow / soften: the mask is grown 8 px and blurred so the new part blends in."""))
    img = load(wf, 'Picture (transparent = repaint)')
    m, clip, vae = model(wf, fam)
    m = wf.add('DifferentialDiffusion', 'Soft blending', 'Model', {'strength': 1.0}, model=m)[0]
    pos, neg = prompts(wf, fam, clip)
    mask = soft_mask(wf, img[1], 'Mask')
    ic = wf.add('InpaintModelConditioning', 'Inpaint conditioning', 'Mask', {'noise_mask': True},
                positive=pos, negative=neg, vae=vae, pixels=img[0], mask=mask)
    out = sample(wf, fam, m, ic[0], ic[1], ic[2], denoise=1.0)
    dec = wf.add('VAEDecode', 'Decode', 'Output', samples=out, vae=vae)[0]
    comp = wf.add('ImageCompositeMasked', 'Paste into original', 'Output', {'x': 0, 'y': 0, 'resize_source': False},
                  destination=img[0], source=dec, mask=mask)[0]
    save(wf, comp, f"{fam['slug']}-inpaint")
    return wf


def outpaint(fam):
    pad = 128 if fam['key'] == 'SD 1.5' else 256
    wf = WF(f"{fam['key']} · outpaint", common_note(fam, f"""
Extends the picture past its edges. Set how many pixels to add on each side (Extend canvas: left / top / right / bottom; default {pad} left and right).
The prompt describes the whole scene. The original part is kept pixel-exact; the seam is feathered.
Big inputs are resized to about {fam['mp']} megapixels first."""))
    img = load(wf, 'Input image')
    px = working_size(wf, img[0], fam['mp'])
    padded = wf.add('ImagePadForOutpaint', 'Extend canvas', 'Extend', {'left': pad, 'top': 0, 'right': pad, 'bottom': 0, 'feathering': 48}, image=px)
    m, clip, vae = model(wf, fam)
    m = wf.add('DifferentialDiffusion', 'Soft blending', 'Model', {'strength': 1.0}, model=m)[0]
    pos, neg = prompts(wf, fam, clip)
    ic = wf.add('InpaintModelConditioning', 'Inpaint conditioning', 'Extend', {'noise_mask': True},
                positive=pos, negative=neg, vae=vae, pixels=padded[0], mask=padded[1])
    out = sample(wf, fam, m, ic[0], ic[1], ic[2], denoise=1.0)
    dec = wf.add('VAEDecode', 'Decode', 'Output', samples=out, vae=vae)[0]
    comp = wf.add('ImageCompositeMasked', 'Paste original back', 'Output', {'x': 0, 'y': 0, 'resize_source': False},
                  destination=padded[0], source=dec, mask=padded[1])[0]
    save(wf, comp, f"{fam['slug']}-outpaint")
    return wf


def tiled_upscale(fam, name=None, upscaler='4x-UltraSharp.pth', tile_cn=False, denoise=0.3, mp=4.0, slug=None, note=''):
    tile = fam['tile']
    wf = WF(name or f"{fam['key']} · upscale (tiled)", common_note(fam, f"""
Big detailed upscale. The picture is enlarged with {upscaler.rsplit('.', 1)[0]}, resized to Output size (megapixels: 4 ≈ 2048×2048, 8 ≈ 2900×2900),
cut into {tile}px tiles that are each redrawn at denoise {denoise}{' guided by the SDXL tile ControlNet' if tile_cn else ''}, and stitched back.
Denoise: 0.2 = just sharper, {denoise} = new fine detail, higher may change faces or add things.
The prompt should describe the picture in general terms (style, quality); it applies to every tile.
Tile overlap hides the seams (128 is safe).{note}"""))
    img = load(wf, 'Input image')
    um = wf.add('UpscaleModelLoader', 'Upscaler', 'Upscale', {'model_name': upscaler})[0]
    up = wf.add('ImageUpscaleWithModel', 'Upscale ×4', 'Upscale', upscale_model=um, image=img[0])[0]
    out_px = wf.add('ImageScaleToTotalPixels', 'Output size', 'Upscale', {'upscale_method': 'lanczos', 'megapixels': mp, 'resolution_steps': 64}, image=up)[0]
    size = wf.add('GetImageSize', 'Output size (read)', 'Upscale', image=out_px)
    ts = wf.add('PrimitiveInt', 'Tile size', 'Tiles', {'value': tile})[0]
    ov = wf.add('PrimitiveInt', 'Tile overlap', 'Tiles', {'value': 128})[0]
    tiles = wf.add('SplitImageToTileList', 'Cut into tiles', 'Tiles', image=out_px, tile_width=ts, tile_height=ts, overlap=ov)[0]
    m, clip, vae = model(wf, fam)
    pos, neg = prompts(wf, fam, clip, pos='high quality, highly detailed, sharp focus, intricate details')
    if tile_cn:
        cn = wf.add('ControlNetLoader', 'Tile ControlNet', 'Tiles', {'control_net_name': 'SDXL\\controlnet-tile-sdxl-1.0\\diffusion_pytorch_model.safetensors'})[0]
        a = wf.add('ControlNetApplyAdvanced', 'Keep each tile', 'Tiles', {'strength': 0.6, 'start_percent': 0.0, 'end_percent': 0.9},
                   positive=pos, negative=neg, control_net=cn, image=tiles, vae=vae)
        pos, neg = a[0], a[1]
    lat = wf.add('VAEEncode', 'Encode tiles', 'Tiles', pixels=tiles, vae=vae)[0]
    out = sample(wf, fam, m, pos, neg, lat, denoise=denoise, title='Redraw tiles',
                 steps=(fam['steps'] if fam['flux'] else 20))
    dec = wf.add('VAEDecode', 'Decode tiles', 'Output', samples=out, vae=vae)[0]
    merged = wf.add('ImageMergeTileList', 'Stitch tiles', 'Output', image_list=dec, final_width=size[0], final_height=size[1], overlap=ov)[0]
    save(wf, merged, slug or f"{fam['slug']}-upscale")
    return wf


CN_FILES = {
    ('SD 1.5', 'canny'): 't2iadapter_canny_sd14v1.pth',
    ('SD 1.5', 'depth'): 't2iadapter_depth_sd14v1.pth',
    ('SD 1.5', 'pose'): 't2iadapter_openpose_sd14v1.pth',
    ('SDXL', 'canny'): 't2i-adapter-canny-sdxl-1.0.safetensors',
    ('SDXL', 'depth'): 't2i-adapter-depth-midas-sdxl-1.0.safetensors',
    ('SDXL', 'pose'): 'SDXL\\OpenPoseXL2.safetensors',
}


def controlnet(fam, kind):
    res = 1024 if fam['key'] != 'SD 1.5' else 512
    titles = {
        'canny': ('ControlNet canny', 'Picture to trace', 'The outlines (Canny edges) of the input picture guide the new picture: same shapes and layout, new content and style.\nEdge thresholds: lower = more edges. The Edges preview shows what the ControlNet sees.'),
        'depth': ('ControlNet depth', 'Photo (or a depth map)', 'The 3D layout of a normal photo guides the new picture: Depth Anything V2 makes a depth map (white = near, black = far), shown as the Depth map preview.\nAlready have a depth map? Turn "Make depth map from photo" off and the input is used as it is.'),
        'pose': ('ControlNet pose (copy a pose)', 'Photo with a person (or a pose skeleton)', 'Copies the pose of the person in a normal photo: DWPose finds body, hands and face (shown as the Detected pose preview), and the new picture takes that pose.\nAlready have an OpenPose skeleton (coloured stick figure on black)? Turn "Find pose in photo" off and the input is used as it is.'),
        'sketch': ('sketch to picture', 'Sketch', 'Turns a line drawing into a finished picture: pencil, pen, a drawing app, or a phone photo of paper.\nThe Lineart preprocessor turns the sketch into clean lines (the Line art preview) for the canny adapter.\nStrength: 0.5 = loose interpretation, 0.9 = follows every line.'),
    }
    label, slot, body = titles[kind]
    fname = CN_FILES[(fam['key'], 'canny' if kind == 'sketch' else kind)]
    strength = {'canny': 0.8, 'depth': 0.9, 'pose': 1.0, 'sketch': 0.75}[kind]
    end = {'canny': 0.8, 'depth': 0.8, 'pose': 1.0, 'sketch': 0.8}[kind]
    first_run = '' if kind == 'canny' else '\nThe first run downloads the detector model (comfyui_controlnet_aux), so it takes a minute longer.'
    wf = WF(f"{fam['key']} · {label}", common_note(fam, f"""
{body}
The output takes the input's shape at about {fam['mp']} megapixels (Output size).
ControlNet strength {strength}; End = when it lets go (0.8 leaves the last steps free for detail).
Model file: {fname}.{first_run}"""))
    img = load(wf, slot)
    px = working_size(wf, img[0], fam['mp'], title='Output size')
    if kind == 'canny':
        hint = wf.add('Canny', 'Find edges', 'Control', {'low_threshold': 0.4, 'high_threshold': 0.8}, image=px)[0]
        preview = 'Edges'
    elif kind == 'sketch':
        hint = wf.add('LineArtPreprocessor', 'Clean lines', 'Control', {'coarse': 'disable', 'resolution': res}, image=px)[0]
        preview = 'Line art'
    elif kind == 'pose':
        det = wf.add('DWPreprocessor', 'Pose finder', 'Control', {'detect_hand': 'enable', 'detect_body': 'enable', 'detect_face': 'enable',
                                                                 'resolution': res, 'bbox_detector': 'yolox_l.onnx',
                                                                 'pose_estimator': 'dw-ll_ucoco_384_bs5.torchscript.pt',
                                                                 'scale_stick_for_xinsr_cn': 'disable'}, image=px)[0]
        hint = wf.add('ComfySwitchNode', 'Find pose in photo', 'Control', {'switch': True}, on_true=det, on_false=px)[0]
        preview = 'Detected pose'
    else:
        det = wf.add('DepthAnythingV2Preprocessor', 'Depth finder', 'Control', {'ckpt_name': 'depth_anything_v2_vitl.pth', 'resolution': res}, image=px)[0]
        hint = wf.add('ComfySwitchNode', 'Make depth map from photo', 'Control', {'switch': True}, on_true=det, on_false=px)[0]
        preview = 'Depth map'
    wf.add('PreviewImage', preview, 'Control', images=hint)
    size = wf.add('GetImageSize', 'Read size', 'Control', image=px)
    m, clip, vae = model(wf, fam)
    pos, neg = prompts(wf, fam, clip)
    cn = wf.add('ControlNetLoader', 'ControlNet model', 'Control', {'control_net_name': fname})[0]
    a = wf.add('ControlNetApplyAdvanced', 'Apply ControlNet', 'Control', {'strength': strength, 'start_percent': 0.0, 'end_percent': end},
               positive=pos, negative=neg, control_net=cn, image=hint, vae=vae)
    lat = empty(wf, fam, width=size[0], height=size[1])
    out = sample(wf, fam, m, a[0], a[1], lat)
    decode_save(wf, out, vae, f"{fam['slug']}-{kind}")
    return wf

for fam in (SD15, SDXL, FLUX):
    register(f"{fam['key']} · txt2img")(lambda fam=fam: txt2img(fam))
    register(f"{fam['key']} · img2img")(lambda fam=fam: img2img(fam))
    register(f"{fam['key']} · hires fix")(lambda fam=fam: hires(fam))
    register(f"{fam['key']} · inpaint")(lambda fam=fam: inpaint(fam))
    register(f"{fam['key']} · outpaint")(lambda fam=fam: outpaint(fam))
register('Illustrious · txt2img')(lambda: txt2img(ILLU))
register('Pony · txt2img')(lambda: txt2img(PONY))
register('SD 1.5 · upscale (tiled)')(lambda: tiled_upscale(SD15, denoise=0.3, mp=2.0))
register('SDXL · big detailed upscale (tiled)')(lambda: tiled_upscale(SDXL, name='SDXL · big detailed upscale (tiled)', tile_cn=True, denoise=0.45, mp=4.0))
register('Illustrious · anime upscale (tiled)')(lambda: tiled_upscale(
    ILLU, name='Illustrious · anime upscale (tiled)', upscaler='4x-AnimeSharp.pth', tile_cn=True, denoise=0.35, mp=4.0,
    slug='illustrious-anime-upscale', note='\nFor anime / illustration pictures: 4x-AnimeSharp keeps line art clean.'))
register('Flux · upscale (tiled)')(lambda: tiled_upscale(FLUX, denoise=0.3, mp=4.0))
for fam in (SD15, SDXL):
    for kind in ('canny', 'depth', 'pose'):
        label = 'ControlNet pose (copy a pose)' if kind == 'pose' else f'ControlNet {kind}'
        register(f"{fam['key']} · {label}")(lambda fam=fam, kind=kind: controlnet(fam, kind))
register('SDXL · sketch to picture')(lambda: controlnet(SDXL, 'sketch'))


# ═══ Tools (no diffusion) ═════════════════════════════════════════════════

@register('Tools · upscale 4x')
def tool_upscale():
    wf = WF('Tools · upscale 4x', """
Fast 4× upscale with an upscale model only (no redraw, no prompt): sharp, faithful, a few seconds.
Upscaler: 4x-UltraSharp (photos, renders); 4xUltrasharp_v10 is an older version; for anime use "Tools · upscale 4x anime".
Final scale: 1 = full 4×, 0.5 = 2× of the original.
For new fine detail use "SDXL · big detailed upscale (tiled)".""")
    img = load(wf, 'Input image')
    um = wf.add('UpscaleModelLoader', 'Upscaler', 'Upscale', {'model_name': '4x-UltraSharp.pth'})[0]
    up = wf.add('ImageUpscaleWithModel', 'Upscale ×4', 'Upscale', upscale_model=um, image=img[0])[0]
    fin = wf.add('ImageScaleBy', 'Final scale', 'Upscale', {'upscale_method': 'lanczos', 'scale_by': 1.0}, image=up)[0]
    save(wf, fin, 'tools-upscale4x')
    return wf


@register('Tools · upscale 4x anime')
def tool_upscale_anime():
    wf = WF('Tools · upscale 4x anime', """
Fast 4× upscale for anime / illustration / line art with 4x-AnimeSharp (no redraw, no prompt).
Final scale: 1 = full 4×, 0.5 = 2× of the original.
For redrawn detail use "Illustrious · anime upscale (tiled)".""")
    img = load(wf, 'Input image')
    um = wf.add('UpscaleModelLoader', 'Upscaler', 'Upscale', {'model_name': '4x-AnimeSharp.pth'})[0]
    up = wf.add('ImageUpscaleWithModel', 'Upscale ×4', 'Upscale', upscale_model=um, image=img[0])[0]
    fin = wf.add('ImageScaleBy', 'Final scale', 'Upscale', {'upscale_method': 'lanczos', 'scale_by': 1.0}, image=up)[0]
    save(wf, fin, 'tools-upscale4x-anime')
    return wf


@register('Tools · remove background')
def tool_rembg():
    wf = WF('Tools · remove background', """
Cuts out the subject with BiRefNet and saves a transparent PNG.
Edge: Shrink edge = pixels taken off the cut-out's border (1–2 removes a halo of old background; 0 keeps everything).
Cut-off: mask values below it become fully transparent (0.5 = crisp edge; lower keeps soft hair edges).
To put the subject on a new generated background use "SDXL · product shot".""")
    img = load(wf, 'Input image')
    bm = wf.add('LoadBackgroundRemovalModel', 'Background remover', 'Cut out', {'bg_removal_name': 'birefnet.safetensors'})[0]
    mask = wf.add('RemoveBackground', 'Find subject', 'Cut out', bg_removal_model=bm, image=img[0])[0]
    th = wf.add('ThresholdMask', 'Cut-off', 'Clean edge', {'value': 0.5}, mask=mask)[0]
    gr = wf.add('GrowMask', 'Shrink edge', 'Clean edge', {'expand': -1, 'tapered_corners': True}, mask=th)[0]
    inv = wf.add('InvertMask', 'Background mask', 'Clean edge', mask=gr)[0]
    rgba = wf.add('JoinImageWithAlpha', 'Make transparent', 'Output', image=img[0], alpha=inv)[0]
    save(wf, rgba, 'tools-nobg')
    return wf


# ═══ Advanced ═════════════════════════════════════════════════════════════

@register('SDXL · face from photo (InstantID)')
def face_instantid():
    fam = SDXL
    wf = WF('SDXL · face from photo (InstantID)', common_note(dict(fam, cfg=4.5, sampler='ddpm', sched='karras'), """
Puts the face from a photo into a new picture (InstantID). The input picture is a clear photo of ONE face (front or 3/4 view).
The prompt describes everything else: clothes, place, style ("comic art", "oil painting", "photo").
Face weight: 0.8 default; lower (0.6) = more freedom for style, higher = closer likeness.
InstantID wants a low CFG (4–5). Avoid exactly 1024×1024 (adds a watermark-like pattern): default 896×1152.
Face fix: the faces are found and redrawn sharper at the end (Impact Pack FaceDetailer; Fix faces denoise 0.3: lower keeps the face closer, 0 / bypass to skip)."""))
    face = load(wf, 'Face photo')
    m, clip, vae = model(wf, fam)
    pos, neg = prompts(wf, fam, clip, pos='portrait photo of a person in a leather jacket on a rainy city street at night, neon reflections, cinematic')
    iid = wf.add('InstantIDModelLoader', 'InstantID model', 'Face', {'instantid_file': 'ip-adapter.bin'})[0]
    fa = wf.add('InstantIDFaceAnalysis', 'Face finder', 'Face', {'provider': 'CUDA'})[0]
    cn = wf.add('ControlNetLoader', 'InstantID ControlNet', 'Face', {'control_net_name': 'instantid\\diffusion_pytorch_model.safetensors'})[0]
    a = wf.add('ApplyInstantID', 'Face weight', 'Face', {'weight': 0.8, 'start_at': 0.0, 'end_at': 1.0},
               instantid=iid, insightface=fa, control_net=cn, image=face[0], model=m, positive=pos, negative=neg)
    lat = empty(wf, fam, w=896, h=1152)
    out = sample(wf, fam, a[0], a[1], a[2], lat, cfg=4.5, sampler='ddpm', sched='karras')
    decode_fix_save(wf, fam, out, m, clip, vae, pos, neg, 'sdxl-face-instantid', denoise=0.3)
    return wf


@register('SDXL · face from photo (PuLID)')
def face_pulid():
    fam = SDXL
    wf = WF('SDXL · face from photo (PuLID)', common_note(dict(fam, cfg=6.0, sampler='dpmpp_2m', sched='sgm_uniform'), """
Puts the face from a photo into a new picture (PuLID). Lighter touch than InstantID: the pose and style follow the prompt freely.
The input picture is a clear photo of ONE face. Method: fidelity = closest likeness, style = more stylised, neutral = in between.
Weight 0.8–1.0. Works with most SDXL checkpoints; lightning / turbo ones need fewer steps.
Face fix: the faces are found and redrawn sharper at the end (Impact Pack FaceDetailer; Fix faces denoise 0.35: lower keeps the face closer, 0 / bypass to skip)."""))
    face = load(wf, 'Face photo')
    m, clip, vae = model(wf, fam)
    pos, neg = prompts(wf, fam, clip, pos='closeup portrait of a person as a cyberpunk hacker, purple hair, hoodie, neon light, highly detailed')
    pm = wf.add('PulidModelLoader', 'PuLID model', 'Face', {'pulid_file': 'ip-adapter_pulid_sdxl_fp16.safetensors'})[0]
    ev = wf.add('PulidEvaClipLoader', 'EVA CLIP', 'Face')[0]
    fa = wf.add('PulidInsightFaceLoader', 'Face finder', 'Face', {'provider': 'CUDA'})[0]
    a = wf.add('ApplyPulid', 'Face', 'Face', {'method': 'fidelity', 'weight': 0.9, 'start_at': 0.0, 'end_at': 1.0},
               model=m, pulid=pm, eva_clip=ev, face_analysis=fa, image=face[0])[0]
    lat = empty(wf, fam, w=896, h=1152)
    out = sample(wf, fam, a, pos, neg, lat, cfg=6.0, sampler='dpmpp_2m', sched='sgm_uniform')
    decode_fix_save(wf, fam, out, a, clip, vae, pos, neg, 'sdxl-face-pulid', denoise=0.35)
    return wf


@register('SD 1.5 · face from photo (FaceID)')
def face_faceid15():
    fam = SD15
    wf = WF('SD 1.5 · face from photo (FaceID)', common_note(dict(fam, cfg=6.5, sampler='ddpm', sched='karras', steps=30), """
Puts the face from a photo into a new picture with IP-Adapter FaceID Plus v2 (SD 1.5).
The input picture is a clear photo of ONE face. Weight = overall face strength; FaceID v2 weight = likeness (1–2).
LoRA strength (0.6) is the FaceID LoRA the loader adds automatically.
Face fix: the faces are found and redrawn sharper at the end (Impact Pack FaceDetailer; Fix faces denoise 0.35: lower keeps the face closer, 0 / bypass to skip)."""))
    face = load(wf, 'Face photo')
    m, clip, vae = model(wf, fam)
    pos, neg = prompts(wf, fam, clip, pos='closeup photo of a person wearing a black dress on the seaside, sunset, diffuse light, high quality, detailed')
    ul = wf.add('IPAdapterUnifiedLoaderFaceID', 'FaceID loader', 'Face', {'preset': 'FACEID PLUS V2', 'lora_strength': 0.6, 'provider': 'CUDA'}, model=m)
    a = wf.add('IPAdapterFaceID', 'Face', 'Face', {'weight': 1.0, 'weight_faceidv2': 1.5, 'weight_type': 'linear', 'combine_embeds': 'concat',
                                                   'start_at': 0.0, 'end_at': 1.0, 'embeds_scaling': 'V only'},
               model=ul[0], ipadapter=ul[1], image=face[0])[0]
    lat = empty(wf, fam)
    out = sample(wf, fam, a, pos, neg, lat, cfg=6.5, sampler='ddpm', sched='karras', steps=30)
    decode_fix_save(wf, fam, out, a, clip, vae, pos, neg, 'sd15-face-faceid', denoise=0.35)
    return wf


@register('SDXL · character sheet')
def character_sheet():
    fam = SDXL
    wf = WF('SDXL · character sheet', common_note(fam, """
One character, several poses on one wide sheet (front, side, back, action).
The input picture is your character (any pose); IP-Adapter Plus copies their look (Character weight 0.6: higher = closer copy, but the poses get stiffer).
Describe the character in the prompt too (hair, clothes, colours): the sheet layout words are in the prompt already.
Small faces on a sheet are soft, so every face is redrawn sharp at the end (Fix faces, denoise 0.4).
For anime characters switch the checkpoint to an Illustrious model."""))
    ref = load(wf, 'Character picture')
    m, clip, vae = model(wf, fam)
    ul = wf.add('IPAdapterUnifiedLoader', 'IP-Adapter loader', 'Character', {'preset': 'PLUS (high strength)'}, model=m)
    a = wf.add('IPAdapterAdvanced', 'Character weight', 'Character', {'weight': 0.6, 'weight_type': 'linear', 'combine_embeds': 'concat',
                                                                      'start_at': 0.0, 'end_at': 0.85, 'embeds_scaling': 'V only'},
               model=ul[0], ipadapter=ul[1], image=ref[0])[0]
    pos, neg = prompts(wf, fam, clip, pos='character sheet, character turnaround, the same character shown in several poses: front view, side view, back view, and an action pose, full body, consistent outfit, plain white background, concept art, highly detailed')
    lat = empty(wf, fam, w=1536, h=1024)
    out = sample(wf, fam, a, pos, neg, lat)
    decode_fix_save(wf, fam, out, a, clip, vae, pos, neg, 'sdxl-character-sheet', denoise=0.4)
    return wf


@register('SDXL · photo to painting')
def photo_to_painting():
    fam = SDXL
    wf = WF('SDXL · photo to painting', common_note(fam, """
Turns a photo into a painting / drawing while keeping its layout (img2img + the photo's line art as a guide, shown as the Line art preview).
Painting style: replace the text with one of these (or your own):
  oil: oil painting, thick visible brush strokes, impasto, rich colors, canvas texture, fine art
  anime: anime screencap, cel shading, clean line art, vibrant colors, studio anime style
  comic: comic book art, bold ink outlines, halftone shading, flat colors, graphic novel
  watercolor: watercolor painting, soft washes, paper texture, loose brushwork
The prompt (optional) says what is in the photo. Denoise 0.7: lower keeps more of the photo, higher paints more freely.
For anime, an Illustrious checkpoint gives a cleaner anime look."""))
    img = load(wf, 'Photo')
    px = working_size(wf, img[0], fam['mp'])
    m, clip, vae = model(wf, fam)
    st = wf.add('PrimitiveStringMultiline', 'Painting style', 'Prompt', {'value': 'oil painting, thick visible brush strokes, impasto, rich colors, canvas texture, fine art'})
    p = wf.add('PrimitiveStringMultiline', 'Positive prompt', 'Prompt', {'value': ''})
    j = wf.add('StringConcatenate', 'Style + prompt', 'Prompt', {'delimiter': ', '}, string_a=st[0], string_b=p[0])
    pos = wf.add('CLIPTextEncode', 'Encode prompt', 'Prompt', clip=clip, text=j[0])[0]
    neg = wf.add('CLIPTextEncode', 'Negative prompt', 'Prompt', {'text': 'photo, photograph, realistic, ' + NEG_REAL}, clip=clip)[0]
    edges = wf.add('LineArtPreprocessor', 'Photo outlines', 'Keep layout', {'coarse': 'disable', 'resolution': 1024}, image=px)[0]
    wf.add('PreviewImage', 'Line art', 'Keep layout', images=edges)
    cn = wf.add('ControlNetLoader', 'ControlNet model', 'Keep layout', {'control_net_name': CN_FILES[('SDXL', 'canny')]})[0]
    a = wf.add('ControlNetApplyAdvanced', 'Keep layout', 'Keep layout', {'strength': 0.55, 'start_percent': 0.0, 'end_percent': 0.7},
               positive=pos, negative=neg, control_net=cn, image=edges, vae=vae)
    lat = wf.add('VAEEncode', 'Encode', 'Input', pixels=px, vae=vae)[0]
    out = sample(wf, fam, m, a[0], a[1], lat, denoise=0.7)
    decode_save(wf, out, vae, 'sdxl-photo-to-painting')
    return wf


@register('SDXL · style from a picture')
def style_transfer():
    fam = SDXL
    wf = WF('SDXL · style from a picture', common_note(fam, """
Repaints your picture in the style of another picture (IP-Adapter "style transfer": colours, brushwork, medium, not the content).
Input image = the picture to repaint. Style picture = the look to copy (a painting, an illustration, a texture...).
Style weight 1.0 (up to 1.5 for a stronger look). Denoise 0.75: lower keeps more of the original.
The layout is kept with the picture's line art (Lineart preprocessor, shown as the Line art preview). Prompt: what is in the picture (optional)."""))
    img = load(wf, 'Input image')
    sty = load(wf, 'Style picture', group='Style')
    px = working_size(wf, img[0], fam['mp'])
    m, clip, vae = model(wf, fam)
    ul = wf.add('IPAdapterUnifiedLoader', 'IP-Adapter loader', 'Style', {'preset': 'PLUS (high strength)'}, model=m)
    a = wf.add('IPAdapterAdvanced', 'Style weight', 'Style', {'weight': 1.0, 'weight_type': 'style transfer', 'combine_embeds': 'concat',
                                                              'start_at': 0.0, 'end_at': 1.0, 'embeds_scaling': 'V only'},
               model=ul[0], ipadapter=ul[1], image=sty[0])[0]
    pos, neg = prompts(wf, fam, clip, pos='')
    edges = wf.add('LineArtPreprocessor', 'Outlines', 'Keep layout', {'coarse': 'disable', 'resolution': 1024}, image=px)[0]
    wf.add('PreviewImage', 'Line art', 'Keep layout', images=edges)
    cn = wf.add('ControlNetLoader', 'ControlNet model', 'Keep layout', {'control_net_name': CN_FILES[('SDXL', 'canny')]})[0]
    c = wf.add('ControlNetApplyAdvanced', 'Keep layout', 'Keep layout', {'strength': 0.5, 'start_percent': 0.0, 'end_percent': 0.7},
               positive=pos, negative=neg, control_net=cn, image=edges, vae=vae)
    lat = wf.add('VAEEncode', 'Encode', 'Input', pixels=px, vae=vae)[0]
    out = sample(wf, fam, a, c[0], c[1], lat, denoise=0.75)
    decode_save(wf, out, vae, 'sdxl-style-transfer')
    return wf


@register('SDXL · mix 2 pictures (IP-Adapter)')
def mix_ipadapter():
    fam = SDXL
    wf = WF('SDXL · mix 2 pictures (IP-Adapter)', common_note(fam, """
Blends two pictures into a new one (IP-Adapter Plus): subjects, colours and mood of both.
Picture A is the step's input; Picture B is the second slot. Weight A / Weight B (0.6 each) set how much each counts.
The prompt can steer the mix ("a creature that is half cat, half owl", "in a forest") or stay short."""))
    a_img = load(wf, 'Picture A')
    b_img = load(wf, 'Picture B')
    m, clip, vae = model(wf, fam)
    ul = wf.add('IPAdapterUnifiedLoader', 'IP-Adapter loader', 'Mix', {'preset': 'PLUS (high strength)'}, model=m)
    common = {'weight_type': 'linear', 'combine_embeds': 'concat', 'start_at': 0.0, 'end_at': 1.0, 'embeds_scaling': 'V only'}
    a = wf.add('IPAdapterAdvanced', 'Weight A', 'Mix', dict(common, weight=0.6), model=ul[0], ipadapter=ul[1], image=a_img[0])[0]
    b = wf.add('IPAdapterAdvanced', 'Weight B', 'Mix', dict(common, weight=0.6), model=a, ipadapter=ul[1], image=b_img[0])[0]
    pos, neg = prompts(wf, fam, clip, pos='high quality, detailed')
    lat = empty(wf, fam)
    out = sample(wf, fam, b, pos, neg, lat)
    decode_save(wf, out, vae, 'sdxl-mix')
    return wf


@register('Flux · Redux variations')
def redux_variations():
    fam = FLUX
    wf = WF('Flux · Redux variations', common_note(fam, """
New variations of a picture with Flux Redux: same subject, style and mood, new composition. No prompt needed.
Redux strength 1.0 = close variations; with the "attn_bias" type, 0.3–0.6 lets the prompt steer more.
Batch 2–4 for several variations at once. Needs the Redux model (flux1-redux-dev) and the SigCLIP vision model."""))
    img = load(wf, 'Input image')
    m, clip, vae = model(wf, fam)
    pos = wf.add('CLIPTextEncode', 'Positive prompt', 'Prompt', {'text': ''}, clip=clip)[0]
    cv = wf.add('CLIPVisionLoader', 'Vision model', 'Redux', {'clip_name': 'sigclip_vision_patch14_384.safetensors'})[0]
    sm = wf.add('StyleModelLoader', 'Redux model', 'Redux', {'style_model_name': 'flux1-redux-dev.safetensors'})[0]
    enc = wf.add('CLIPVisionEncode', 'Read picture', 'Redux', {'crop': 'center'}, clip_vision=cv, image=img[0])[0]
    r = wf.add('StyleModelApply', 'Redux strength', 'Redux', {'strength': 1.0, 'strength_type': 'multiply'},
               conditioning=pos, style_model=sm, clip_vision_output=enc)[0]
    neg = wf.add('ConditioningZeroOut', 'No negative (Flux)', 'Prompt', conditioning=pos)[0]
    lat = empty(wf, fam, batch=2)
    out = sample(wf, fam, m, r, neg, lat)
    decode_save(wf, out, vae, 'flux-redux')
    return wf


@register('Flux · mix 2 pictures (Redux)')
def redux_mix():
    fam = FLUX
    wf = WF('Flux · mix 2 pictures (Redux)', common_note(fam, """
Blends two pictures with Flux Redux: both are read and their looks combined into one new picture.
Picture A is the step's input; Picture B is the second slot. Strength A / Strength B: lower one to let the other dominate.
A short prompt can steer the mix (optional)."""))
    a_img = load(wf, 'Picture A')
    b_img = load(wf, 'Picture B')
    m, clip, vae = model(wf, fam)
    pos = wf.add('CLIPTextEncode', 'Positive prompt', 'Prompt', {'text': ''}, clip=clip)[0]
    cv = wf.add('CLIPVisionLoader', 'Vision model', 'Redux', {'clip_name': 'sigclip_vision_patch14_384.safetensors'})[0]
    sm = wf.add('StyleModelLoader', 'Redux model', 'Redux', {'style_model_name': 'flux1-redux-dev.safetensors'})[0]
    ea = wf.add('CLIPVisionEncode', 'Read picture A', 'Redux', {'crop': 'center'}, clip_vision=cv, image=a_img[0])[0]
    eb = wf.add('CLIPVisionEncode', 'Read picture B', 'Redux', {'crop': 'center'}, clip_vision=cv, image=b_img[0])[0]
    ra = wf.add('StyleModelApply', 'Strength A', 'Redux', {'strength': 1.0, 'strength_type': 'multiply'}, conditioning=pos, style_model=sm, clip_vision_output=ea)[0]
    rb = wf.add('StyleModelApply', 'Strength B', 'Redux', {'strength': 1.0, 'strength_type': 'multiply'}, conditioning=ra, style_model=sm, clip_vision_output=eb)[0]
    neg = wf.add('ConditioningZeroOut', 'No negative (Flux)', 'Prompt', conditioning=pos)[0]
    lat = empty(wf, fam)
    out = sample(wf, fam, m, rb, neg, lat)
    decode_save(wf, out, vae, 'flux-redux-mix')
    return wf


@register('SDXL · product shot')
def product_shot():
    fam = SDXL
    wf = WF('SDXL · product shot', common_note(fam, """
Puts a product (or any subject) on a new generated background. BiRefNet cuts the subject out, SDXL paints a new background around it,
and the original subject is pasted back pixel-exact.
Prompt = the new scene: "on a white marble countertop, soft morning light, shallow depth of field, product photography".
Edge: Shrink edge protects the subject's border (2 px). The input is resized to about 1 megapixel."""))
    img = load(wf, 'Product photo')
    px = working_size(wf, img[0], 1.0)
    bm = wf.add('LoadBackgroundRemovalModel', 'Background remover', 'Cut out', {'bg_removal_name': 'birefnet.safetensors'})[0]
    fg = wf.add('RemoveBackground', 'Find product', 'Cut out', bg_removal_model=bm, image=px)[0]
    fg = wf.add('GrowMask', 'Shrink edge', 'Cut out', {'expand': -2, 'tapered_corners': True}, mask=fg)[0]
    bg = wf.add('InvertMask', 'Background area', 'Cut out', mask=fg)[0]
    m, clip, vae = model(wf, fam)
    m = wf.add('DifferentialDiffusion', 'Soft blending', 'Model', {'strength': 1.0}, model=m)[0]
    pos, neg = prompts(wf, fam, clip, pos='on a white marble countertop, soft morning light from a window, shallow depth of field, professional product photography')
    ic = wf.add('InpaintModelConditioning', 'Paint background', 'New background', {'noise_mask': True},
                positive=pos, negative=neg, vae=vae, pixels=px, mask=bg)
    out = sample(wf, fam, m, ic[0], ic[1], ic[2], denoise=1.0)
    dec = wf.add('VAEDecode', 'Decode', 'Output', samples=out, vae=vae)[0]
    comp = wf.add('ImageCompositeMasked', 'Paste product back', 'Output', {'x': 0, 'y': 0, 'resize_source': False},
                  destination=dec, source=px, mask=fg)[0]
    save(wf, comp, 'sdxl-product-shot')
    return wf


@register('SDXL · model compare')
def model_compare():
    fam = SDXL
    ckpts = ['juggernautXL_ragnarokBy.safetensors', 'copaxTimeless_xivSDXL.safetensors',
             'protovisionXLHighFidelity3D_releaseV660Bakedvae.safetensors', 'novaAnimeXL_ilV80.safetensors']
    wf = WF('SDXL · model compare', common_note(fam, """
The same prompt, seed and settings on four checkpoints, saved side by side (A B C D, left to right) as one sheet.
Pick the four models in the Model tab (Model A–D). Any SDXL-family models (SDXL, Illustrious, Pony) can be compared;
lightning / turbo / DMD models need their own few-step settings, so leave them out.
Seed, steps and CFG are shared (one value for all four)."""))
    pos_t = wf.add('PrimitiveStringMultiline', 'Positive prompt', 'Prompt', {'value': POS_DEMO})[0]
    neg_t = wf.add('PrimitiveStringMultiline', 'Negative prompt', 'Prompt', {'value': fam['neg']})[0]
    seed = wf.add('PrimitiveInt', 'Seed', 'Shared settings', {'value': 0})[0]
    cfg = wf.add('PrimitiveFloat', 'CFG', 'Shared settings', {'value': 5.0})[0]
    lat = empty(wf, fam, group='Shared settings')
    imgs = []
    for k, ck in enumerate(ckpts):
        L = 'ABCD'[k]
        g = f'Model {L}'
        m, clip, vae = model(wf, fam, group=g, title=f'Model {L}', ckpt=ck)
        p = wf.add('CLIPTextEncode', f'Prompt {L}', g, clip=clip, text=pos_t)[0]
        n = wf.add('CLIPTextEncode', f'Negative {L}', g, clip=clip, text=neg_t)[0]
        o = wf.add('KSampler', f'Sampler {L}', g, {'seed': 0, 'steps': fam['steps'], 'cfg': 5.0, 'sampler_name': fam['sampler'],
                                                   'scheduler': fam['sched'], 'denoise': 1.0},
            model=m, positive=p, negative=n, latent_image=lat, seed=seed, cfg=cfg)[0]
        imgs.append(wf.add('VAEDecode', f'Decode {L}', g, samples=o, vae=vae)[0])
    row = imgs[0]
    for k, im in enumerate(imgs[1:]):
        row = wf.add('ImageStitch', f'Sheet {k + 1}', 'Output', {'direction': 'right', 'match_image_size': True, 'spacing_width': 16, 'spacing_color': 'white'},
                     image1=row, image2=im)[0]
    save(wf, row, 'sdxl-model-compare')
    return wf


@register('SDXL · variations grid')
def variations_grid():
    fam = SDXL
    wf = WF('SDXL · variations grid', common_note(fam, """
Four variations of one prompt (four seeds in one batch), saved one by one AND as a 2×2 grid sheet to compare.
Keep the seed fixed to re-make the same four; roll it for four new ones. Change the batch in the sampler size only together with the grid (it takes the first four)."""))
    m, clip, vae = model(wf, fam)
    pos, neg = prompts(wf, fam, clip)
    lat = empty(wf, fam, batch=4)
    out = sample(wf, fam, m, pos, neg, lat)
    imgs = wf.add('VAEDecode', 'Decode', 'Output', samples=out, vae=vae)[0]
    save(wf, imgs, 'sdxl-variations', title='Save each')
    picks = [wf.add('ImageFromBatch', f'Variation {k + 1}', 'Grid', {'batch_index': k, 'length': 1}, image=imgs)[0] for k in range(4)]
    st = {'match_image_size': True, 'spacing_width': 16, 'spacing_color': 'white'}
    top = wf.add('ImageStitch', 'Top row', 'Grid', dict(st, direction='right'), image1=picks[0], image2=picks[1])[0]
    bot = wf.add('ImageStitch', 'Bottom row', 'Grid', dict(st, direction='right'), image1=picks[2], image2=picks[3])[0]
    grid = wf.add('ImageStitch', 'Grid', 'Grid', dict(st, direction='down'), image1=top, image2=bot)[0]
    save(wf, grid, 'sdxl-variations-grid', group='Grid', title='Save grid')
    return wf


@register('SDXL · settings grid (CFG)')
def settings_grid():
    fam = SDXL
    cfgs = [3.0, 5.0, 7.0, 9.0]
    wf = WF('SDXL · settings grid (CFG)', common_note(fam, """
The same prompt and seed at four CFG values (3, 5, 7, 9 left to right), saved as one sheet: see how strongly the model follows the prompt.
Change the four CFGs (or steps / sampler of each column) in the Sampling settings; the seed is shared."""))
    m, clip, vae = model(wf, fam)
    pos, neg = prompts(wf, fam, clip)
    seed = wf.add('PrimitiveInt', 'Seed', 'Sampling', {'value': 0})[0]
    lat = empty(wf, fam)
    imgs = []
    for k, c in enumerate(cfgs):
        o = wf.add('KSampler', f'Column {k + 1}', f'Sampling', {'seed': 0, 'steps': fam['steps'], 'cfg': c, 'sampler_name': fam['sampler'],
                                                                 'scheduler': fam['sched'], 'denoise': 1.0},
                   model=m, positive=pos, negative=neg, latent_image=lat, seed=seed)[0]
        imgs.append(wf.add('VAEDecode', f'Decode {k + 1}', 'Output', samples=o, vae=vae)[0])
    row = imgs[0]
    for k, im in enumerate(imgs[1:]):
        row = wf.add('ImageStitch', f'Sheet {k + 1}', 'Output', {'direction': 'right', 'match_image_size': True, 'spacing_width': 16, 'spacing_color': 'white'},
                     image1=row, image2=im)[0]
    save(wf, row, 'sdxl-settings-grid')
    return wf


def fix_faces_hands(fam):
    wf = WF(f"{fam['key']} · fix faces and hands", common_note(dict(fam, steps=20), """
Finds every face and hand in the input picture and redraws each one sharper and cleaner (Impact Pack FaceDetailer:
YOLO face / hand detectors + SAM masks), then pastes them back. The rest of the picture is untouched.
Prompt: describe the person ("young woman with freckles, smiling"); it applies to each face / hand.
Fix faces denoise 0.4 (0.25 = subtle, 0.5 = new face). Fix hands denoise 0.45; hands are hard, try a few seeds.
Detection: Bbox threshold 0.5 (lower finds smaller / partial faces); Bbox crop factor = how much around the face is redrawn.
Use the same checkpoint family as the picture (this one: """ + fam['key'] + """). Leave Wildcard empty."""))
    img = load(wf, 'Input image')
    m, clip, vae = model(wf, fam)
    pos, neg = prompts(wf, fam, clip, pos='detailed face, sharp eyes, natural skin texture, detailed hands, correct fingers')
    sam = wf.add('SAMLoader', 'SAM', 'Fix faces', {'model_name': 'sam_vit_b_01ec64.pth', 'device_mode': 'AUTO'})[0]
    face = detailer(wf, fam, img[0], m, clip, vae, pos, neg, part='face', denoise=0.4, group='Fix faces', sam=sam)
    hand = detailer(wf, fam, face, m, clip, vae, pos, neg, part='hand', denoise=0.45, group='Fix hands', sam=sam)
    save(wf, hand, f"{fam['slug']}-fix-faces-hands")
    return wf


register('SDXL · fix faces and hands')(lambda: fix_faces_hands(SDXL))
register('SD 1.5 · fix faces and hands')(lambda: fix_faces_hands(SD15))


def main():
    os.makedirs(OUT, exist_ok=True)
    only = set(sys.argv[3:])
    for name, fn in WORKFLOWS.items():
        if only and name not in only:
            continue
        wf = fn()
        assert wf.name == name, (wf.name, name)
        path = os.path.join(OUT, f'{name}.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(wf.build(), f, ensure_ascii=False, indent=1)
        print(f'{name}: {len(wf.nodes)} nodes, {len(wf.links)} links')


if __name__ == '__main__':
    main()
