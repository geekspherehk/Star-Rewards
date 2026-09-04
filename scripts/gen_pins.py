#!/usr/bin/env python3
"""Generate Pinterest pins (735x1102) for the 5 English SEO pages.
Style: matching page theme gradient + big bold title + subtitle + domain footer + star motif.
Output: pins/<name>-pin.png — ready for manual Pinterest upload with the page URL.
"""
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 735, 1102
OUT = os.path.join(os.path.dirname(__file__), '..', 'pins')
os.makedirs(OUT, exist_ok=True)

PINS = [
    ("star-chart", "How to Make a\nStar Chart\nThat Actually Works", "6 steps · by age · free tool",
     ("#1FA971", "#0f6e56")),
    ("chore-chart", "Chore Chart\nfor Kids\nby Age", "Age-by-age chores + points guide",
     ("#1FA971", "#0f6e56")),
    ("kids-points", "Kids Points\nChart\nStarter Guide", "Turn good behavior into motivation",
     ("#6C5CE7", "#4A3AC0")),
    ("habit-building", "Build Good Habits\nwith a\nPoints System", "The science + 6-step rollout",
     ("#1d9e75", "#0f6e56")),
    ("reward-ideas", "30+ Reward Ideas\nfor Kids", "By age group · with points values",
     ("#f0997b", "#d85a30")),
]

FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"


def hx(c):
    c = c.lstrip('#')
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(draw, c1, c2):
    a, b = hx(c1), hx(c2)
    for y in range(H):
        draw.line([(0, y), (W, y)], fill=lerp(a, b, y / H))


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


def draw_pin(name, title, subtitle, colors):
    img = Image.new('RGB', (W, H), '#ffffff')
    d = ImageDraw.Draw(img)

    # ── 上 2/3：主题色渐变区 ──
    band = int(H * 0.66)
    tmp = Image.new('RGB', (W, band))
    td = ImageDraw.Draw(tmp)
    a, b = hx(colors[0]), hx(colors[1])
    for y in range(band):
        td.line([(0, y), (W, y)], fill=lerp(a, b, y / band))
    img.paste(tmp, (0, 0))

    # ── 星星装饰（右上，半透明白）──
    star_layer = Image.new('RGBA', (W, band), (0, 0, 0, 0))
    sd = ImageDraw.Draw(star_layer)
    for (sx, sy, sr, alpha) in [(W - 90, 90, 46, 90), (W - 190, 180, 26, 60), (W - 120, 240, 18, 45), (90, 80, 30, 50)]:
        import math
        pts = []
        for i in range(10):
            ang = -math.pi / 2 + i * math.pi / 5
            r = sr if i % 2 == 0 else sr * 0.45
            pts.append((sx + r * math.cos(ang), sy + r * math.sin(ang)))
        sd.polygon(pts, fill=(255, 255, 255, alpha))
    img.paste(star_layer, (0, 0), star_layer)

    # ── 品牌胶囊 ──
    d.rounded_rectangle([56, 70, 300, 118], radius=24, outline=(255, 255, 255), width=3)
    bf = font(FONT_BOLD, 26)
    tb = d.textbbox((0, 0), "Star Rewards", font=bf)
    d.text((56 + (244 - (tb[2] - tb[0])) / 2, 70 + (48 - (tb[3] - tb[1])) / 2 - tb[1]),
           "Star Rewards", font=bf, fill=(255, 255, 255))

    # ── 主标题（大号粗体，居中）──
    tf = font(FONT_BOLD, 74)
    lines = title.split('\n')
    y = band - 120 - len(lines) * 92
    for ln in lines:
        tb = d.textbbox((0, 0), ln, font=tf)
        d.text(((W - (tb[2] - tb[0])) / 2, y), ln, font=tf, fill=(255, 255, 255))
        y += 92

    # ── 副题（白色浅底条）──
    sf = font(FONT_REG, 34)
    tb = d.textbbox((0, 0), subtitle, font=sf)
    sw = tb[2] - tb[0]
    d.rounded_rectangle([(W - sw - 60) / 2, band + 70, (W + sw + 60) / 2, band + 134],
                        radius=32, fill=hx(colors[1]) + (255,))
    d.text(((W - sw) / 2, band + 70 + (64 - (tb[3] - tb[1])) / 2 - tb[1]), subtitle,
           font=sf, fill=(255, 255, 255))

    # ── 下方白区：三个要点占位 + 域名 CTA ──
    pf = font(FONT_REG, 36)
    points = ["✓ Free family sharing", "✓ 70+ behavior templates", "✓ Works on any phone"]
    py = band + 190
    for p in points:
        tb = d.textbbox((0, 0), p, font=pf)
        d.text(((W - (tb[2] - tb[0])) / 2, py), p, font=pf, fill=hx(colors[1]))
        py += 66

    df = font(FONT_BOLD, 30)
    dom = "stellar.gaocaihk.com"
    tb = d.textbbox((0, 0), dom, font=df)
    d.rounded_rectangle([(W - tb[2] - 80) / 2, H - 130, (W + tb[2] + 80) / 2, H - 60],
                        radius=35, fill=(255, 255, 255), outline=hx(colors[1]), width=3)
    d.text(((W - (tb[2] - tb[0])) / 2, H - 130 + (70 - (tb[3] - tb[1])) / 2 - tb[1]),
           dom, font=df, fill=hx(colors[1]))

    out = os.path.join(OUT, f"{name}-en-pin.png")
    img.save(out, 'PNG')
    print('saved:', out)


for p in PINS:
    draw_pin(*p)
print('done:', len(PINS), 'pins')
