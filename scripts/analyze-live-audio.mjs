import {spawn} from 'node:child_process'
import {MusicAnalyzer} from '../electron/vendor/music-signal/analyzer.mjs'

const seconds = Number(process.argv[2] || 35)
const bin = new URL("../native/audio-tap/komorebi-audio-tap", import.meta.url).pathname
const child = spawn(bin, ['--system'], {stdio: ['ignore', 'pipe', 'pipe']})
let analyzer = null, sampleRate = 48000, remainder = Buffer.alloc(0), frame = 0
const features = [], onsets = [], beats = [], states = []
let errors = ''
child.stderr.on('data', data => {
  for (const line of data.toString().split('\n')) {
    if (!line.trim()) continue
    try {
      const value = JSON.parse(line)
      if (value.type === 'format') { sampleRate = value.sampleRate; analyzer = new MusicAnalyzer({sampleRate, featureHz: 30, streamId: 'live-netease'}) }
      if (value.type === 'error') errors += value.message
    } catch {}
  }
})
child.stdout.on('data', data => {
  if (!analyzer) return
  const bytes = Buffer.concat([remainder, data])
  const length = bytes.length - bytes.length % 4
  remainder = bytes.subarray(length)
  if (!length) return
  const pcm = new Float32Array(length / 4)
  for (let i = 0; i < pcm.length; i++) pcm[i] = Math.max(-1, Math.min(1, bytes.readFloatLE(i * 4) || 0))
  const packets = analyzer.push({mono: pcm, startFrame: frame})
  frame += pcm.length
  for (const packet of packets) {
    if (packet.type === 'features') features.push(packet)
    if (packet.type === 'onset') onsets.push(packet)
    if (packet.type === 'beat') beats.push(packet)
    if (packet.type === 'state') states.push(packet)
  }
})
const timer = setTimeout(() => {
  child.kill('SIGTERM')
  const time = packet => packet.sampleFrame / sampleRate
  const bpms = features.map(f => f.tempo).filter(t => t && t.confidence >= .55).map(t => t.bpm)
  const sorted = [...bpms].sort((a, b) => a - b)
  const q = p => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : null
  const energies = features.map(f => f.energy)
  const tracking = features.filter(f => f.state === 'tracking').length
  const silent = features.filter(f => f.state === 'silent').length
  const duration = Math.max(...features.map(f => time(f)), 0)
  const onsetRate = duration ? onsets.length / duration : 0
  const medianBpm = q(.5)
  const report = {
    schema: 'live-music-analysis/v1',
    source: 'system audio tap (any app playing; user reported NetEase in use)',
    durationSeconds: Number(duration.toFixed(2)),
    errors: errors || null,
    tempo: {
      samples: bpms.length, medianBpm: medianBpm === null ? null : Number(medianBpm.toFixed(2)),
      p10Bpm: q(.1) === null ? null : Number(q(.1).toFixed(2)), p90Bpm: q(.9) === null ? null : Number(q(.9).toFixed(2)),
      stabilityIqr: q(.9) !== null ? Number((q(.9) - q(.1)).toFixed(2)) : null,
      confidenceMedian: features.map(f => f.tempo?.confidence).filter(v => v !== undefined).sort((a, b) => a - b)[Math.floor(features.length / 2)] ?? null,
    },
    onsets: {count: onsets.length, perSecond: Number(onsetRate.toFixed(2)), expectedPerSecondAtMedianBpm: medianBpm ? Number((medianBpm / 60).toFixed(2)) : null},
    beats: {count: beats.length},
    states: states.map(s => `${time(s).toFixed(2)}s:${s.state}`),
    featureWindows: features.length,
    trackingFraction: features.length ? Number((tracking / features.length).toFixed(3)) : null,
    silentFraction: features.length ? Number((silent / features.length).toFixed(3)) : null,
    energy: {min: Math.min(...energies), max: Math.max(...energies), mean: Number((energies.reduce((a, b) => a + b, 0) / Math.max(1, energies.length)).toFixed(3))},
    limitations: ['no ground-truth BPM (real song); compare median against the song tempo manually', 'system tap may include non-NetEase system sounds'],
  }
  console.log(JSON.stringify(report, null, 2))
  process.exit(0)
}, seconds * 1000)
