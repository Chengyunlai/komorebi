#!/usr/bin/env python3
"""Render a structure-annotation timeline for the local dance reference.

Reads docs/evidence/dance-structure-annotation.json and writes a PNG timeline.
English labels keep the chart font-independent; numbers carry the meaning.
"""
import json
import sys
from PIL import Image, ImageDraw

W, H = 1600, 900
MARGIN = 90
PLOT_W = W - 2 * MARGIN

with open('docs/evidence/dance-structure-annotation.json') as f:
    data = json.load(f)

duration = data['source']['duration']
segments = data['segments']
accents = data['accents']
intervals = data['contact']['intervals']
orientation = data['orientation']

img = Image.new('RGB', (W, H), '#f7f9fb')
d = ImageDraw.Draw(img)

def x_of(t):
    return MARGIN + (t / duration) * PLOT_W

# Title
d.text((MARGIN, 28), 'DANCE-02 structure annotation  |  local BVH 63.3s  |  kinematic estimates only', fill='#1f3b57')
d.text((MARGIN, 52), f"prep {segments[0]['startTime']:.1f}-{segments[0]['endTime']:.1f}s | main {[s for s in segments if s['kind']=='main'][0]['startTime']:.1f}-{[s for s in segments if s['kind']=='main'][0]['endTime']:.1f}s | recovery {[s for s in segments if s['kind']=='recovery'][0]['startTime']:.1f}-{segments[-1]['endTime']:.1f}s" if len(segments) > 2 else 'segments', fill='#5b7187')

# 1) Segment band
y = 92
d.text((MARGIN - 70, y + 4), 'phases', fill='#33475c')
colors = {'preparation': '#c3d0dc', 'main': '#4b7fb5', 'recovery': '#b7a7cf'}
for seg in segments:
    x0, x1 = x_of(seg['startTime']), x_of(seg['endTime'])
    d.rectangle([x0, y, x1, y + 26], fill=colors.get(seg['kind'], '#999'))
    label = seg['kind']
    if x1 - x0 > 90:
        d.text((x0 + 8, y + 7), label, fill='#ffffff' if seg['kind'] == 'main' else '#33475c')

# 2) Accents (landings + motion peaks)
y = 150
d.text((MARGIN - 70, y), 'accents', fill='#33475c')
for a in accents:
    x = x_of(a['time'])
    top = y + (0 if a['kind'] == 'landing' else 8)
    color = '#2f6f4f' if a['kind'] == 'landing' else '#b8860b'
    d.line([x, top, x, top + (34 if a['kind'] == 'landing' else 26)], fill=color, width=1)
d.text((x_of(0) + 4, y + 38), 'green: estimated landings (67)   ochre: motion peaks', fill='#5b7187')

# 3) Contact intervals: left row / right row
row_top = 236
d.text((MARGIN - 70, row_top + 20), 'contact', fill='#33475c')
for side, yy in (('left', row_top), ('right', row_top + 34)):
    d.text((MARGIN - 60, yy + 6), side, fill='#5b7187')
    d.rectangle([MARGIN, yy, MARGIN + PLOT_W, yy + 24], outline='#dce3eb')
for iv in intervals:
    yy = row_top + (0 if iv['side'] == 'left' else 34)
    x0, x1 = x_of(iv['startTime']), x_of(iv['endTime'])
    if iv['state'] == 'plant':
        d.rectangle([x0, yy, x1, yy + 24], fill='#2f6f4f')
    elif iv['state'] == 'airborne':
        d.rectangle([x0, yy + 8, x1, yy + 16], fill='#9fb3c4')
    else:
        d.rectangle([x0, yy + 11, x1, yy + 13], fill='#d1495b')
d.text((MARGIN, row_top + 66), 'dark: estimated plant   light: estimated airborne   red: unknown   (kinematic floor estimate, not force)', fill='#5b7187')

# 4) Orientation: yaw samples + turns
oy = 380
d.text((MARGIN - 70, oy + 4), 'facing', fill='#33475c')
d.rectangle([MARGIN, oy, MARGIN + PLOT_W, oy + 150], outline='#dce3eb')
if orientation['samples']:
    yaws = [s['continuousRadians'] for s in orientation['samples']]
    lo, hi = min(yaws), max(yaws)
    span = max(hi - lo, 1e-6)
    pts = []
    for s in orientation['samples']:
        x = x_of(s['time'])
        yy = oy + 140 - ((s['continuousRadians'] - lo) / span) * 130
        pts.append((x, yy))
    d.line(pts, fill='#4b7fb5', width=2)
for turn in orientation['turns']:
    x = x_of(turn['time'])
    d.line([x, oy, x, oy + 150], fill='#d1495b', width=1)
d.text((MARGIN, oy + 156), 'blue: hip-width yaw (unwrapped)   red: turns >= 2.0 rad/s   (33 turns)', fill='#5b7187')

# 5) Time axis
ay = 600
d.line([MARGIN, ay, MARGIN + PLOT_W, ay], fill='#8fa3b6', width=1)
for t in range(0, int(duration) + 1, 5):
    x = x_of(t)
    d.line([x, ay, x, ay + 6], fill='#8fa3b6')
    d.text((x - 8, ay + 10), f'{t}s', fill='#5b7187')

# 6) Summary box
sy = 660
summary = [
    f"source: 1901 frames @30fps, 63.3s; 950 compile frames @15Hz",
    f"segments: {', '.join(f'{s['kind']} {s['startTime']:.1f}-{s['endTime']:.1f}s' for s in segments)}",
    f"accents: {len(accents)} (landings {sum(1 for a in accents if a['kind']=='landing')}, peaks {sum(1 for a in accents if a['kind']=='motion-peak')}); median gap {data['phraseHints']['medianAccentGapSeconds']:.2f}s -> ~{data['phraseHints']['impliedTempoBpm']:.0f} BPM motion rhythm",
    f"contact intervals: {len(intervals)}; orientation turns: {len(orientation['turns'])}",
    "provenance: kinematic-estimate / no audio / no human labels. Not song beats, not force, not choreography ground truth.",
]
for i, line in enumerate(summary):
    d.text((MARGIN, sy + i * 26), line, fill='#33475c' if i < 4 else '#8a5a00')

img.save('docs/evidence/dance-structure-timeline.png')
print('wrote docs/evidence/dance-structure-timeline.png')
