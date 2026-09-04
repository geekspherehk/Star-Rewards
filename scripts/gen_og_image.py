#!/usr/bin/env python3
"""Generate 1200x630 OG share image (og-image.png) for social scrapers."""
from PIL import Image, ImageDraw, ImageFont
import math, os

W, H = 1200, 630
OUT = os.path.join(os.path.dirname(__file__), '..', 'og-image.png')

img = Image.new('RGB', (W, H))
d = ImageDraw.Draw(img)

# 品牌渐变（靛蓝主色，与 star-chart/kids-points 主题呼应）
c1, c2 = (108, 92, 231), (74, 58, 192)
for y in range(H):
    t = y / H
    d.line([(0, y), (W, y)], fill=tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3)))

# 星星装饰
star_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
sd = ImageDraw.Draw(star_layer)
def star(sd, sx, sy, sr, alpha):
    pts = []
    for i in range(10):
        ang = -math.pi / 2 + i * math.pi / 5
        r = sr if i % 2 == 0 else sr * 0.45
        pts.append((sx + r * math.cos(ang), sy + r * math.sin(ang)))
    sd.polygon(pts, fill=(255, 255, 255, alpha))
star(sd, W-140, 120, 70, 80)
star(sd, W-300, 230, 36, 55)
star(sd, 110, 520, 44, 45)
star(sd, 240, 90, 28, 40)
img.paste(star_layer, (0, 0), star_layer)

FB = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FR = "/System/Library/Fonts/Supplemental/Arial.ttf"
f_brand = ImageFont.truetype(FB, 40)
f_title = ImageFont.truetype(FB, 88)
f_sub = ImageFont.truetype(FR, 40)
f_dom = ImageFont.truetype(FB, 32)

def center(text, font, y, fill=(255,255,255)):
    tb = d.textbbox((0,0), text, font=font)
    d.text(((W-(tb[2]-tb[0]))/2, y), text, font=font, fill=fill)

# 品牌胶囊（星形用画的，Arial 无 ★ 字形会变豆腐块）
tb = d.textbbox((0,0), "Star Rewards", font=f_brand)
pw = tb[2]-tb[0]+110
d.rounded_rectangle([(W-pw)/2, 78, (W+pw)/2, 148], radius=35, outline=(255,255,255), width=3)
sx, sy, sr = (W-pw)/2+62, 113, 26
pts = []
for i in range(10):
    ang = -math.pi/2 + i*math.pi/5
    r = sr if i % 2 == 0 else sr*0.45
    pts.append((sx + r*math.cos(ang), sy + r*math.sin(ang)))
d.polygon(pts, fill=(255, 224, 102))
d.text(((W-(tb[2]-tb[0]))/2+30, 78+(70-(tb[3]-tb[1]))/2-tb[1]), "Star Rewards", font=f_brand, fill=(255,255,255))

center("Turn your kid's good habits", f_title, 205)
center("into shining stars", f_title, 310)
center("Star charts · points · rewards — free family sharing", f_sub, 440, (225, 220, 250))

# 域名胶囊
dom = "stellar.gaocaihk.com"
tb = d.textbbox((0,0), dom, font=f_dom)
pw = tb[2]-tb[0]+90
d.rounded_rectangle([(W-pw)/2, 520, (W+pw)/2, 580], radius=30, fill=(255,255,255))
d.text(((W-(tb[2]-tb[0]))/2, 520+(60-(tb[3]-tb[1]))/2-tb[1]), dom, font=f_dom, fill=hx if False else (74,58,192))

img.save(OUT, 'PNG')
print('saved:', OUT, os.path.getsize(OUT), 'bytes')
