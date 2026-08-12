"""
Compose poster-bg.png: cover-fit illustration into 1500x2400, clean watermark,
add bottom white-fade, then bake static text (title, subtitle, panel + labels,
footer slogan, domain, QR hint) into the image using STHeiti Chinese fonts.

The runtime canvas (750x1200) draws a cover-fit version of this image (scale 0.5,
exact 2:3 fit, no crop) and overlays only dynamic content. All coords here are
in canvas space (750x1200); we multiply by S=2 to land in 1500x2400 image space.
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

ROOT = '/Users/work/code/Star-Rewards'
ILLUST_PATH = os.path.join(ROOT, 'Vertical_poster_background__fl_2026-08-12T23-05-33.png')
OUT = os.path.join(ROOT, 'poster-bg.png')

# Canvas (HTML) dimensions; bake at 2x for crispness.
W, H = 750, 1200
S = 2
IMG_W, IMG_H = W * S, H * S  # 1500 x 2400

# ── Fonts (macOS STHeiti supports Chinese) ────────────────────────────────
FONT_BOLD = '/System/Library/Fonts/STHeiti Medium.ttc'
FONT_REG  = '/System/Library/Fonts/STHeiti Light.ttc'

def font(path, px):
    return ImageFont.truetype(path, px)

# ── 1. Clean watermark from original illustration (bottom-right) ─────────
img = Image.open(ILLUST_PATH).convert('RGB')
iw, ih = img.size  # 832 x 1216

# Watermark "AI生成 WORKBUDDY" sits bottom-right; sample a clean band to its left
# and blend inward.
px = img.load()
wm_x0, wm_y0, wm_x1, wm_y1 = 595, 1130, iw, ih
clean_x_start = 540
clean_x_end = 580
for y in range(wm_y0, wm_y1):
    for x in range(wm_x0, wm_x1):
        # sample clean band at the same y
        xc = clean_x_start + (x - wm_x0) * (clean_x_end - clean_x_start) // max(1, (wm_x1 - wm_x0))
        xc = min(iw - 1, max(0, xc))
        r, g, b = px[xc, y]
        # Gentle blend toward clean color
        px[x, y] = px[x, y]  # placeholder; actual smoothing below

# Easier: replace watermark pixels with the clean color (strong cleaning).
px = img.load()
for y in range(wm_y0, wm_y1):
    cref = px[clean_x_start, y]
    for x in range(wm_x0, wm_x1):
        px[x, y] = (cref[0], cref[1], cref[2])

# ── 2. Cover-fit illustration into 1500x2400 canvas ──────────────────────
canvas = Image.new('RGB', (IMG_W, IMG_H), (255, 255, 255))
scale = max(IMG_W / iw, IMG_H / ih)
dw = int(iw * scale)
dh = int(ih * scale)
dx = (IMG_W - dw) // 2
dy = (IMG_H - dh) // 2
# Use LANCZOS for quality
img_resized = img.resize((dw, dh), Image.LANCZOS)
canvas.paste(img_resized, (dx, dy))

# ── 3. Bottom white-fade (0→0.55 alpha) for text contrast ───────────────
fade_top_y = int(600 * S)      # 1200
fade_bot_y = IMG_H             # 2400
fade = Image.new('RGBA', (IMG_W, IMG_H), (0, 0, 0, 0))
fade_draw = ImageDraw.Draw(fade)
for y in range(fade_top_y, fade_bot_y):
    t = (y - fade_top_y) / (fade_bot_y - fade_top_y)
    a = int(0.55 * t * 255)
    ImageDraw.Draw(fade).line([(0, y), (IMG_W, y)], fill=(255, 255, 255, a))
canvas = Image.alpha_composite(canvas.convert('RGBA'), fade).convert('RGB')

draw = ImageDraw.Draw(canvas)

# ── Helpers for canvas coords (× S) ─────────────────────────────────────
def C(x, y):
    return (x * S, y * S)

def text_size(font_obj, text):
    bbox = draw.textbbox((0, 0), text, font=font_obj)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]

def draw_text_centered(cx, cy, text, font_obj, fill):
    tw, th = text_size(font_obj, text)
    px_, py_ = C(cx, cy)
    # py_ is the top anchor; for visual centering, offset down by ascent-baseline
    draw.text((px_ - tw // 2, py_ - th // 2), text, font=font_obj, fill=fill)

def draw_text_left(x, y, text, font_obj, fill):
    px_, py_ = C(x, y)
    draw.text((px_, py_), text, font=font_obj, fill=fill)

# ── 4. Title pill (baked) ────────────────────────────────────────────────
pill_w, pill_h, pill_y = 252, 58, 232
pill_x = (W - pill_w) // 2  # 249
# Translucent white fill + subtle border
PILL_FILL = (255, 255, 255, 215)
PILL_LINE = (45, 35, 25, 40)
px_, py_ = C(pill_x, pill_y)
pw_, ph_ = pill_w * S, pill_h * S
# Pill drawn on a separate RGBA layer
pill_layer = Image.new('RGBA', (IMG_W, IMG_H), (0, 0, 0, 0))
pill_draw = ImageDraw.Draw(pill_layer)
pill_draw.rounded_rectangle(
    [px_, py_, px_ + pw_, py_ + ph_],
    radius=29 * S, fill=PILL_FILL, outline=PILL_LINE, width=2 * S
)
canvas = Image.alpha_composite(canvas.convert('RGBA'), pill_layer).convert('RGB')
draw = ImageDraw.Draw(canvas)

# Draw two small amber stars flanking the title (avoid STHeiti glyph limits)
def star5(cx, cy, r, color):
    """5-point star centered at (cx, cy) with circumradius r."""
    import math
    pts = []
    for i in range(10):
        ang = -math.pi / 2 + i * math.pi / 5
        rad = r if i % 2 == 0 else r * 0.42
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
    draw.polygon(pts, fill=color)

title_font = font(FONT_BOLD, 30 * S)
title_text = '成长海报'
tw, th = text_size(title_font, title_text)
title_cx, title_cy = pill_x + pill_w // 2, pill_y + pill_h // 2
star_color = (212, 138, 38)  # amber
star5(C(title_cx - tw // 2 - 18, title_cy)[0], C(title_cx - tw // 2 - 18, title_cy)[1], 12 * S, star_color)
star5(C(title_cx + tw // 2 + 18, title_cy)[0], C(title_cx + tw // 2 + 18, title_cy)[1], 12 * S, star_color)
draw_text_centered(title_cx, title_cy, title_text, title_font, (45, 35, 25))

# ── 5. Subtitle ──────────────────────────────────────────────────────────
sub_font = font(FONT_REG, 24 * S)
sub_text = '记录每一步成长'
draw_text_centered(W // 2, 322, sub_text, sub_font, (45, 35, 25, 255))

# Subtitle is drawn on the canvas; redo with alpha-aware color
# (the previous call used 4-tuple but PIL accepts that)
# Re-draw explicitly:
sub_color = (45, 35, 25)
# Clear & redraw cleanly
sub_layer = Image.new('RGBA', (IMG_W, IMG_H), (0, 0, 0, 0))
sub_draw = ImageDraw.Draw(sub_layer)
tw, th = text_size(sub_font, sub_text)
sub_draw.text(((W // 2) * S - tw // 2, 322 * S - th // 2), sub_text, font=sub_font, fill=(45, 35, 25, 255))
canvas = Image.alpha_composite(canvas.convert('RGBA'), sub_layer).convert('RGB')
draw = ImageDraw.Draw(canvas)

# ── 6. Stats panel card + 3 labels ──────────────────────────────────────
panel_w, panel_h, panel_x, panel_y = 604, 156, 73, 736
panel_layer = Image.new('RGBA', (IMG_W, IMG_H), (0, 0, 0, 0))
panel_draw = ImageDraw.Draw(panel_layer)
px_, py_ = C(panel_x, panel_y)
pw_, ph_ = panel_w * S, panel_h * S
panel_draw.rounded_rectangle(
    [px_, py_, px_ + pw_, py_ + ph_],
    radius=22 * S, fill=(255, 255, 255, 140), outline=(45, 35, 25, 30), width=2 * S
)
canvas = Image.alpha_composite(canvas.convert('RGBA'), panel_layer).convert('RGB')
draw = ImageDraw.Draw(canvas)

# Column dividers (vertical lines between stats)
for i in (1, 2):
    cx = panel_x + (panel_w / 3) * i
    x_img = int(cx * S)
    y0 = int((panel_y + 26) * S)
    y1 = int((panel_y + panel_h - 26) * S)
    draw.line([(x_img, y0), (x_img, y1)], fill=(45, 35, 25, 35), width=int(1.5 * S))

# Labels (static)
label_font = font(FONT_REG, 22 * S)
labels = ['当前积分', '总积分', '连续打卡']
col_w = panel_w / 3
for i, lab in enumerate(labels):
    cx = panel_x + col_w * i + col_w / 2
    label_layer = Image.new('RGBA', (IMG_W, IMG_H), (0, 0, 0, 0))
    label_draw = ImageDraw.Draw(label_layer)
    tw, th = text_size(label_font, lab)
    label_draw.text((int(cx * S) - tw // 2, int((panel_y + 44) * S) - th // 2),
                    lab, font=label_font, fill=(45, 35, 25, 210))
    canvas = Image.alpha_composite(canvas.convert('RGBA'), label_layer).convert('RGB')
    draw = ImageDraw.Draw(canvas)

# ── 7. Footer slogan + domain (left) ────────────────────────────────────
slog_font = font(FONT_BOLD, 26 * S)
slog_text = '长大是一件值得庆祝的事'
dom_font = font(FONT_REG, 20 * S)
dom_text = 'stellar.gaocaihk.com'

slog_layer = Image.new('RGBA', (IMG_W, IMG_H), (0, 0, 0, 0))
slog_draw = ImageDraw.Draw(slog_layer)
tw, th = text_size(slog_font, slog_text)
slog_draw.text((60 * S, (H - 90) * S), slog_text, font=slog_font, fill=(45, 35, 25, 230))
tw, th = text_size(dom_font, dom_text)
slog_draw.text((60 * S, (H - 50) * S), dom_text, font=dom_font, fill=(45, 35, 25, 180))
canvas = Image.alpha_composite(canvas.convert('RGBA'), slog_layer).convert('RGB')
draw = ImageDraw.Draw(canvas)

# ── 8. QR hint (centered under QR placement) ───────────────────────────
qr_size = 128
qr_x = W - 44 - qr_size  # 578
qr_y = H - 44 - qr_size  # 1028
qr_hint = '扫码访问平台'
hint_font = font(FONT_REG, 20 * S)
hint_layer = Image.new('RGBA', (IMG_W, IMG_H), (0, 0, 0, 0))
hint_draw = ImageDraw.Draw(hint_layer)
tw, th = text_size(hint_font, qr_hint)
hint_draw.text((int((qr_x + qr_size / 2) * S) - tw // 2,
                int((qr_y + qr_size + 28) * S) - th // 2),
               qr_hint, font=hint_font, fill=(45, 35, 25, 200))
canvas = Image.alpha_composite(canvas.convert('RGBA'), hint_layer).convert('RGB')

# ── 9. Save ─────────────────────────────────────────────────────────────
canvas.convert('RGB').save(OUT, 'PNG', optimize=True)
print(f'Saved {OUT} ({canvas.size})')
