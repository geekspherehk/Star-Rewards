#!/usr/bin/env python3
"""把 AI 生成的「图标九宫格」切成单张 PNG，并打印背景图的面板坐标。

用法:
    python3 scripts/slice_ai_icon_sheet.py <icon_sheet.png> [poster_bg.png]

纯离线，只读输入、只写 prototypes/ai-assets/icons/。
"""
import os
import sys

from PIL import Image

NAMES = [
    "brush", "water", "book", "heart",
    "moon", "ball", "bag", "plant",
]
WHITE_CUTOFF = 243          # 高于此亮度视为背景
GAP_RATIO = 0.02            # 投影间隙阈值（占宽度比例）


def _runs(flags, min_len):
    """把布尔序列压成连续 True 的区间。"""
    out, start = [], None
    for i, v in enumerate(flags):
        if v and start is None:
            start = i
        elif not v and start is not None:
            if i - start >= min_len:
                out.append((start, i))
            start = None
    if start is not None and len(flags) - start >= min_len:
        out.append((start, len(flags)))
    return out


def slice_sheet(path, out_dir):
    im = Image.open(path).convert("RGB")
    W, H = im.size
    px = im.load()

    step = 2                                    # 采样步长，够用且快
    col_hit = [False] * W
    row_hit = [False] * H
    for y in range(0, H, step):
        for x in range(0, W, step):
            r, g, b = px[x, y]
            if not (r > WHITE_CUTOFF and g > WHITE_CUTOFF and b > WHITE_CUTOFF):
                col_hit[x] = True
                row_hit[y] = True
    # 采样步长留下的空洞补齐
    for i in range(1, W):
        if col_hit[i - 1] and col_hit[i + 1]:
            col_hit[i] = True
    for i in range(1, H):
        if row_hit[i - 1] and row_hit[i + 1]:
            row_hit[i] = True

    cols = _runs(col_hit, int(W * 0.05))
    rows = _runs(row_hit, int(H * 0.05))
    print(f"source={W}x{H} cols={len(cols)} rows={len(rows)}")
    if len(cols) * len(rows) != len(NAMES):
        print(f"WARN: 期望 {len(NAMES)} 格，实得 {len(cols) * len(rows)} 格，"
              f"cols={cols} rows={rows}")

    os.makedirs(out_dir, exist_ok=True)
    made = []
    idx = 0
    for (y0, y1) in rows:
        for (x0, x1) in cols:
            if idx >= len(NAMES):
                break
            cell = im.crop((x0, y0, x1, y1))
            cell = cell.resize((256, 256), Image.LANCZOS)
            dst = os.path.join(out_dir, NAMES[idx] + ".png")
            cell.save(dst, "PNG", optimize=True)
            made.append(dst)
            idx += 1
    return made, (cols, rows)


def report_panel(path):
    """打印背景图中白色面板/粉色标题条的粗略坐标（按比例），供画布对齐参考。"""
    im = Image.open(path).convert("RGB")
    W, H = im.size
    px = im.load()

    def is_white(p):
        r, g, b = p
        return r > 248 and g > 248 and b > 248

    # 白面板：从中心向上/向下扫到非白
    cx = W // 2
    y_top = next((y for y in range(H) if is_white(px[cx, y])), None)
    y_bot = next((y for y in range(H - 1, 0, -1) if is_white(px[cx, y])), None)
    row_mid = (y_top + y_bot) // 2 if y_top is not None and y_bot is not None else H // 2
    x_l = next((x for x in range(W) if is_white(px[x, row_mid])), None)
    x_r = next((x for x in range(W - 1, 0, -1) if is_white(px[x, row_mid])), None)

    print(f"bg={W}x{H}")
    if None not in (y_top, y_bot, x_l, x_r):
        print(f"  white panel px  : x {x_l}..{x_r}  y {y_top}..{y_bot}")
        print(f"  white panel pct : x {x_l / W:.4f}..{x_r / W:.4f}  "
              f"y {y_top / H:.4f}..{y_bot / H:.4f}")
        print(f"  panel aspect    : {(x_r - x_l) / (y_bot - y_top):.3f} (w/h)")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out = os.path.join(base, "prototypes", "ai-assets", "icons")
    files, boxes = slice_sheet(sys.argv[1], out)
    for f in files:
        print("  ->", os.path.relpath(f, base))
    if len(sys.argv) > 2:
        report_panel(sys.argv[2])
