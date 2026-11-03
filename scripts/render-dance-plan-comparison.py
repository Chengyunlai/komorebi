#!/usr/bin/env python3
"""Render a dance-plan comparison chart: same source dance, three different music cases."""
import json
from PIL import Image, ImageDraw

W, H = 1600, 980
MARGIN = 120
PLOT_W = W - 2 * MARGIN
ROW_H = 220
TOP = 120
MODE_COLORS = {'quiet': '#b9c8d6', 'flow': '#7fa8c9', 'drive': '#4b7fb5', 'rising': '#c98a5b', 'settling': '#a8b39a'}

with open('docs/evidence/dance-plan-comparison.json') as f:
    data = json.load(f)

img = Image.new('RGB', (W, H), '#f7f9fb')
d = ImageDraw.Draw(img)
d.text((MARGIN, 26), 'DANCE-03 music-driven phrase planning  |  same source dance, three music cases', fill='#1f3b57')
d.text((MARGIN, 50), 'x = music time; blocks = planned source phrases (srcN @ time scale); grey line = supplied energy curve; ticks = beat grid', fill='#5b7187')


def x_of(t, duration):
    return MARGIN + (t / duration) * PLOT_W


for row, case in enumerate(data['cases']):
    plan = case['plan']
    duration = plan['music']['duration']
    y0 = TOP + row * ROW_H
    d.text((MARGIN, y0 - 46), f"{case['name']}  ({case['bpm']} BPM, beat {plan['music']['beatSeconds']}s)", fill='#33475c')
    # energy curve (upper band of the row)
    energy = case.get('energy') or []
    if energy:
        cy0, cy1 = y0 - 36, y0 - 8
        pts = [(x_of(e['time'], duration), cy1 - e['value'] * (cy1 - cy0)) for e in energy]
        d.line(pts, fill='#9aa9b8', width=2)
    # Phrase blocks
    bx = MARGIN
    for phrase in plan['phrases']:
        x0 = x_of(phrase['startTime'], duration)
        x1 = x_of(phrase['endTime'], duration)
        color = MODE_COLORS.get(phrase['musicMode'], '#999')
        d.rectangle([x0, y0, x1, y0 + 64], fill=color)
        label = f"src{phrase['sourceIndex']}" + ('*' if phrase['repeatOf'] is not None else '')
        d.text((x0 + 5, y0 + 8), label, fill='#ffffff')
        d.text((x0 + 5, y0 + 26), f"{phrase['timeScale']:.2f}x", fill='#ffffff')
        d.text((x0 + 5, y0 + 44), phrase['musicMode'], fill='#f0f4f8')
    # Beat ticks
    beat_seconds = plan['music']['beatSeconds']
    t = 0
    while t <= duration + 1e-9:
        x = x_of(t, duration)
        d.line([x, y0 + 70, x, y0 + 78], fill='#bfcbD8', width=1)
        t += beat_seconds
    # Summary
    s = plan['summary']
    d.text((MARGIN, y0 + 86), f"phrases {s['phraseCount']} | unique sources {s['uniqueSources']} | repeats {s['repeats']} | median accent->beat {s['medianAccentToBeatErrorMs']}ms | modes {','.join(s['modes'])}", fill='#5b7187')

# Footer notes
ny = TOP + 3 * ROW_H + 10
notes = [
    'Planning baseline: phrase choice balances length fit, novelty, energy fit and support-foot continuity; deterministic heuristic, no learning.',
    'Time scaling is kept near 1x; segments are split evenly so no phrase is stretched to cover a long tail.',
    'Modes (quiet/flow/drive/rising/settling) come from an energy-curve heuristic, NOT detected verse/chorus/bar structure.',
    'Source phrases are candidate groups from kinematic accents (DANCE-02), not true choreographic phrases; no audio files were used.',
]
for i, note in enumerate(notes):
    d.text((MARGIN, ny + i * 22), note, fill='#8a5a00' if i >= 2 else '#33475c')

img.save('docs/evidence/dance-plan-comparison.png')
print('wrote docs/evidence/dance-plan-comparison.png')
