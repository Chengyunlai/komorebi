const {spawn} = require('node:child_process')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const {EventEmitter} = require('node:events')

/**
 * Streaming dance generator: keeps a persistent Python (Bailando) process and, every
 * `stepSeconds`, sends the most recent music window to it and broadcasts the newly
 * generated joint segment to the pet renderer. The renderer retargets the joints to the
 * VRM humanoid and plays them, so the dancer follows the live music with ~1-2s lag.
 */
class DanceStream extends EventEmitter {
  constructor({venvPython, serverScript, audio, windowSeconds = 10, stepSeconds = 3, cameraFps = 60}) {
    super()
    this.venvPython = venvPython
    this.serverScript = serverScript
    this.audio = audio
    this.windowSeconds = windowSeconds
    this.stepSeconds = stepSeconds
    this.cameraFps = cameraFps
    this.process = null
    this.buffer = ''
    this.pending = new Map()
    this.timer = null
    this.requestId = 0
    this.first = true
    this.running = false
    this.status = {state: 'off', segments: 0, lastGenSeconds: null, lastError: null, startedAt: null}
    this.tmpFile = path.join(os.tmpdir(), `komorebi-dance-${process.pid}.wav`)
  }

  async start() {
    if (this.running) return this.status
    this.running = true
    this.first = true
    this.buffer = ''
    this.pending = new Map()
    this.status = {state: 'starting', segments: 0, lastGenSeconds: null, lastError: null, startedAt: Date.now()}
    this.emit('status', this.status)
    try {
      this.process = spawn(this.venvPython, [this.serverScript], {stdio: ['pipe', 'pipe', 'pipe']})
      this.process.stdout.on('data', chunk => {
        this.buffer += chunk.toString()
        let index
        while ((index = this.buffer.indexOf('\n')) >= 0) {
          const line = this.buffer.slice(0, index).trim()
          this.buffer = this.buffer.slice(index + 1)
          if (!line) continue
          let message
          try { message = JSON.parse(line) } catch { continue }
          if (message.type === 'ready') { this.status = {...this.status, state: 'ready'}; this.emit('status', this.status); continue }
          const pending = this.pending.get(message.id)
          if (pending) { this.pending.delete(message.id); pending(message) }
        }
      })
      this.process.stderr.on('data', () => {})
      this.process.on('exit', () => { const stopping = !this.running; this.status = {...this.status, state: stopping ? 'off' : 'error', lastError: stopping ? null : 'generator exited'}; this.emit('status', this.status); this.running = false; if (this.timer) {clearInterval(this.timer); this.timer = null} })
      await this.whenReady(120000)
      this.timer = setInterval(() => this.tick().catch(() => {}), this.stepSeconds * 1000)
      this.status = {...this.status, state: 'running'}
      this.emit('status', this.status)
    } catch (error) {
      this.status = {...this.status, state: 'error', lastError: error.message}
      this.emit('status', this.status)
      this.stop()
    }
    return this.status
  }

  whenReady(timeoutMs) {
    if (this.status.state === 'ready') return Promise.resolve()
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { this.off('status', onStatus); reject(new Error('dance generator did not become ready')) }, timeoutMs)
      const onStatus = status => { if (status.state === 'ready') { clearTimeout(timeout); this.off('status', onStatus); resolve() } if (status.state === 'error') { clearTimeout(timeout); this.off('status', onStatus); reject(new Error(status.lastError || 'generator error')) } }
      this.on('status', onStatus)
    })
  }

  async tick() {
    if (!this.running || !this.process) return
    const wav = this.audio?.recentWav ? this.audio.recentWav(this.windowSeconds) : null
    if (!wav) { this.status = {...this.status, lastError: 'no audio yet'}; this.emit('status', this.status); return }
    fs.writeFileSync(this.tmpFile, wav)
    const id = ++this.requestId
    const response = await new Promise(resolve => {
      const timeout = setTimeout(() => { this.pending.delete(id); resolve({ok: false, error: 'generation timeout'}) }, 30000)
      this.pending.set(id, message => { clearTimeout(timeout); resolve(message) })
      this.process.stdin.write(JSON.stringify({audio: this.tmpFile, step: this.stepSeconds, window: this.windowSeconds, first: this.first, id}) + '\n')
    })
    if (!response.ok) { this.status = {...this.status, lastError: response.error}; this.emit('status', this.status); return }
    this.first = false
    this.status = {...this.status, segments: this.status.segments + 1, lastGenSeconds: response.genSeconds, lastError: null}
    this.emit('status', this.status)
    this.emit('segment', {frames: response.frames, fps: response.fps || 60, joints: response.joints, first: response.first, receivedAt: Date.now(), genSeconds: response.genSeconds})
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null }
    this.running = false
    const child = this.process
    this.process = null
    if (child) {
      try { child.stdin.write(JSON.stringify({type: 'shutdown'}) + '\n') } catch {}
      setTimeout(() => { try { child.kill('SIGTERM') } catch {} }, 500)
    }
    this.status = {...this.status, state: 'off'}
    this.emit('status', this.status)
  }

  snapshot() { return {...this.status} }
}

module.exports = {DanceStream}
