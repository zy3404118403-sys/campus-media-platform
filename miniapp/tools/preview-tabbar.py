# -*- coding: utf-8 -*-
"""把 tabBar 图标拼成预览图：模拟真实 tabBar（深色底 + 图标在上文字在下）"""
import os
from PIL import Image

BASE = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..',
                                     'miniapp', 'assets', 'tabbar'))
OUT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..',
                                    'audit', 'phase2', 'tabbar-preview.png'))

NAMES = ['home', 'library', 'event', 'task', 'me']
LABELS = ['首页', '素材', '活动', '任务', '我的']

PAD = 24
CELL = 110
H = 190
SHEET_W = len(NAMES) * CELL + PAD * 2
SHEET_H = H * 2 + PAD * 2


def load(name):
    return Image.open(os.path.join(BASE, name + '.png')).convert('RGBA')


sheet = Image.new('RGBA', (SHEET_W, SHEET_H), (0x12, 0x15, 0x1D, 255))

try:
    from PIL import ImageFont
    font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 14)
except Exception:
    font = None

d = None
from PIL import ImageDraw
d = ImageDraw.Draw(sheet)


def draw_row(row, suffix):
    for i, (name, label) in enumerate(zip(NAMES, LABELS)):
        icon = load(name + suffix)
        # 显示尺寸按 81 原尺寸的一半，接近真机 27pt 观感
        icon = icon.resize((54, 54), Image.LANCZOS)
        cx = PAD + i * CELL + CELL // 2
        y = PAD + row * H
        sheet.alpha_composite(icon, (cx - 27, y + 20))
        if font:
            tw = d.textlength(label, font=font)
            color = (0xD8, 0xB4, 0x6A, 255) if suffix else (0x69, 0x71, 0x7F, 255)
            d.text((cx - tw / 2, y + 88), label, font=font, fill=color)
    # 分隔线
    d.line([(PAD, PAD + (row + 1) * H - 10), (SHEET_W - PAD, PAD + (row + 1) * H - 10)],
           fill=(255, 255, 255, 20), width=1)


draw_row(0, '')
draw_row(1, '-on')
sheet.convert('RGB').save(OUT, 'PNG')
print('预览图:', OUT, os.path.getsize(OUT), 'bytes', sheet.size)
