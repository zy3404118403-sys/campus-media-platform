# -*- coding: utf-8 -*-
"""
生成小程序 tabBar 图标：5 个 × 2 态（常态灰 / 选中金），81×81 PNG。

做法：在 4 倍画布（324×324）上按 81 单位坐标系绘制线性图标，
再用 LANCZOS 缩回 81×81，得到平滑边缘（PIL 的 draw 本身不做抗锯齿）。

颜色与 app.json 的 tabBar.color / selectedColor 保持一致：
  常态 #69717F · 选中 #D8B46A
"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'miniapp', 'assets', 'tabbar')
S = 81          # 设计尺寸
K = 4           # 超采样倍数
W = 5           # 线宽（81 坐标系）

NORMAL = (0x69, 0x71, 0x7F, 255)
ACTIVE = (0xD8, 0xB4, 0x6A, 255)


def canvas():
    img = Image.new('RGBA', (S * K, S * K), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def sc(*vals):
    return [v * K for v in vals]


def line(d, pts, color):
    d.line(sc(*[c for p in pts for c in p]), fill=color, width=W * K, joint='curve')


def tune(img):
    return img.resize((S, S), Image.LANCZOS)


# ── 1. 首页：屋顶 + 墙体 + 门 ──
def icon_home(color):
    img, d = canvas()
    line(d, [(13, 38), (40.5, 14), (68, 38)], color)
    line(d, [(19, 35), (19, 67)], color)
    line(d, [(62, 35), (62, 67)], color)
    line(d, [(19, 67), (62, 67)], color)
    d.rounded_rectangle(sc(33, 49, 48, 67), radius=3 * K, outline=color, width=W * K)
    return tune(img)


# ── 2. 素材：2×2 圆角方块 ──
def icon_grid(color):
    img, d = canvas()
    r = 6 * K
    for x0, y0 in [(13, 13), (44, 13), (13, 44), (44, 44)]:
        d.rounded_rectangle(sc(x0, y0, x0 + 24, y0 + 24), radius=r, outline=color, width=W * K)
    return tune(img)


# ── 3. 活动：日历 ──
def icon_calendar(color):
    img, d = canvas()
    d.rounded_rectangle(sc(13, 20, 68, 68), radius=7 * K, outline=color, width=W * K)
    line(d, [(13, 34), (68, 34)], color)
    line(d, [(27, 12), (27, 25)], color)
    line(d, [(54, 12), (54, 25)], color)
    for cx, cy in [(29, 48), (40.5, 48), (52, 48), (29, 58), (40.5, 58)]:
        d.ellipse(sc(cx - 3, cy - 3, cx + 3, cy + 3), fill=color)
    return tune(img)


# ── 4. 任务：清单板（勾选与横线留足间距，否则小尺寸下会糊成一块）──
def icon_task(color):
    img, d = canvas()
    d.rounded_rectangle(sc(16, 16, 65, 68), radius=7 * K, outline=color, width=W * K)
    d.rounded_rectangle(sc(31, 9, 50, 21), radius=4 * K, outline=color, width=W * K)
    for cy in (40, 56):
        line(d, [(24, cy), (28, cy + 4), (35, cy - 5)], color)
        line(d, [(45, cy), (57, cy)], color)
    return tune(img)


# ── 5. 我的：头 + 肩 ──
def icon_user(color):
    img, d = canvas()
    d.ellipse(sc(27, 14, 54, 41), outline=color, width=W * K)
    d.arc(sc(14, 43, 67, 92), start=200, end=340, fill=color, width=W * K)
    return tune(img)


ICONS = [
    ('home', icon_home),
    ('library', icon_grid),
    ('event', icon_calendar),
    ('task', icon_task),
    ('me', icon_user),
]


def main():
    out = os.path.normpath(OUT)
    os.makedirs(out, exist_ok=True)
    print('输出目录:', out)
    for name, fn in ICONS:
        for suffix, color in (('', NORMAL), ('-on', ACTIVE)):
            path = os.path.join(out, name + suffix + '.png')
            img = fn(color)
            img.save(path, 'PNG', optimize=True)
            size = os.path.getsize(path)
            print('  {:<22} {:>5} bytes  {}x{}'.format(
                name + suffix + '.png', size, img.size[0], img.size[1]))


if __name__ == '__main__':
    main()
