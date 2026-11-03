#!/usr/bin/env python3
"""Streaming music-to-dance server for Komorebi.

Reads JSON commands on stdin, writes JSON responses on stdout.
Command: {"audio": "/path/to/clip.wav", "step": 3.0, "window": 10.0, "id": 1}
Response: {"id": 1, "ok": true, "frames": N, "joints": [...], "genSeconds": 0.8}

The model is loaded once at startup; each request generates the next step of motion
from the most recent audio window and returns only the newly advanced part.
"""
import json
import os
import sys
import time

os.environ.setdefault('HF_ENDPOINT', 'https://hf-mirror.com')
MOTIUS_PATH = os.environ.get('MOTIUS_PATH', '/tmp/motius')
sys.path.insert(0, MOTIUS_PATH)

import numpy as np
import torch
from torch.nn import functional as F


def install_temperature_sampler(temperature: float = 0.9, top_k: int = 8):
    """Replace Bailando's greedy top-1 sampler with temperature/top-k sampling.

    The released code is fully deterministic (topk k=1), which collapses motion variety;
    sampling with temperature keeps the dance from repeating the same few patterns.
    """
    import motius.pipelines.bailando.sampling as sampling

    def sample_codes(self, xs, cond, shift=None):
        block_size = self.get_block_size() - 1
        block_shift = block_size
        x_up, x_down = xs
        for k in range(cond.size(1)):
            x_cond_up = x_up if x_up.size(1) <= block_size else x_up[:, -(block_shift + (k - block_size - 1) % (block_size - block_shift + 1)):]
            x_cond_down = x_down if x_down.size(1) <= block_size else x_down[:, -(block_shift + (k - block_size - 1) % (block_size - block_shift + 1)):]
            cond_input = cond[:, :k + 1] if k < block_size else cond[:, k - (block_shift + (k - block_size - 1) % (block_size - block_shift + 1)) + 1:k + 1]
            logits = self((x_cond_up, x_cond_down), cond_input)
            logit_up, logit_down = logits
            logit_up = logit_up[:, -1, :] / temperature
            logit_down = logit_down[:, -1, :] / temperature
            probs_up, probs_down = F.softmax(logit_up, dim=-1), F.softmax(logit_down, dim=-1)
            ix_up = torch.multinomial(probs_up, 1)
            ix_down = torch.multinomial(probs_down, 1)
            x_up = torch.cat((x_up, ix_up), dim=1)
            x_down = torch.cat((x_down, ix_down), dim=1)
        return ([x_up], [x_down])

    sampling.sample_codes = sample_codes
    import motius.pipelines.bailando.pipeline as pipeline_module
    pipeline_module.sample_codes = sample_codes


def main():
    install_temperature_sampler(temperature=0.92, top_k=8)
    from motius.pipelines.bailando import BailandoPipeline
    pipe = BailandoPipeline.from_pretrained('ZeyuLing/Motius-Bailando-AISTPP', device='mps')
    prev_motion = None
    print(json.dumps({'type': 'ready'}), flush=True)
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except Exception:
            continue
        if request.get('type') == 'shutdown':
            break
        started = time.time()
        try:
            audio = request['audio']
            step = float(request.get('step', 3.0))
            window = float(request.get('window', 10.0))
            first = bool(request.get('first', False))
            request_id = int(request.get('id') or 0)
            torch.manual_seed(1000 + request_id * 7919 + int(time.time()) % 1000)
            init = prev_motion if (prev_motion is not None and not first) else None
            out = pipe(audio, initial_motion=init)
            joints = np.asarray(out.joints[0], dtype=np.float32)  # (T,24,3) @60fps
            start_frame = 0 if first else int(step * 60)
            end_frame = int(min(len(joints), start_frame + step * 60))
            if end_frame <= start_frame:
                raise RuntimeError(f'not enough generated frames ({len(joints)}) for step {step}s')
            segment = joints[start_frame:end_frame]
            prev_motion = joints[-8:].copy()
            response = {
                'id': request.get('id'),
                'ok': True,
                'frames': int(len(segment)),
                'fps': 60,
                'step': step,
                'first': first,
                'genSeconds': round(time.time() - started, 3),
                'joints': segment.reshape(-1).tolist(),
            }
        except Exception as error:
            response = {'id': request.get('id'), 'ok': False, 'error': str(error)}
        print(json.dumps(response), flush=True)


if __name__ == '__main__':
    main()
