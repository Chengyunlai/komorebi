const fs = require('node:fs')
const path = require('node:path')

/** Keep actual loaded clip boundaries beside the flattened IPC frame payload. */
function loadDanceLibrary(directory) {
  const manifestPath = path.join(directory, 'manifest.json')
  if (!fs.existsSync(manifestPath)) return {available: false, clips: [], frames: []}
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const frames = [], clips = []
  for (const clip of manifest.clips || []) {
    if (typeof clip.name !== 'string' || path.basename(clip.name) !== clip.name) continue
    const file = path.join(directory, `${clip.name}.json`)
    if (!fs.existsSync(file)) continue
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!Array.isArray(data.frames) || data.frames.length < 2) continue
    const start = frames.length
    for (const frame of data.frames) frames.push({rotations: frame.r, hips: frame.h, feet: frame.ft})
    clips.push({...clip, id: clip.name, start, end: frames.length - 1, frames: data.frames.length})
  }
  return {available: frames.length > 0, clips, frames}
}
module.exports = {loadDanceLibrary}
