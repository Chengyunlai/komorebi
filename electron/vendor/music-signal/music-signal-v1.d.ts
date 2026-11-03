/**
 * v0.1 packet reference, reviewed 2026-10-28; runtime is src/index.mjs.
 * AnalyzerDraft and ClockAnchor below remain future integration API sketches.
 * All sampleFrame values use the stream's audio sample clock, never Date.now().
 * Validate finite values and ranges at the host boundary before consuming packets.
 */
export interface AudioBlock {
  streamId: string;
  sampleRate: number;
  startFrame: number; // integer frame position of mono[0]
  mono: Float32Array; // proposed input: finite PCM in [-1, 1], read-only during push()
}

export interface SignalBase {
  schema: 'music-signal/v1';
  streamId: string;
  seq: number; // strictly increasing within one stream
  sampleRate: number;
  sampleFrame: number; // feature window end, detected onset, or estimated beat time
}

export interface TempoEstimate {
  bpm: number;
  confidence: number; // 0..1 algorithm score; not a calibrated probability
  phase: number | null; // 0..1 within a beat, only while phase is tracking
}

export interface FeatureSignal extends SignalBase {
  type: 'features';
  state: 'warming' | 'tracking' | 'silent' | 'lost';
  lastOnsetFrame: number | null;
  rmsDbfs: number; // proposed floor -120 dBFS; measured on the mono input
  energy: number; // 0..1 adaptive normalized motion intensity, not audio volume control
  bands: { low: number; mid: number; high: number }; // 0..1, documented fixed band definitions
  onsetStrength: number; // 0..1
  tempo: TempoEstimate | null;
}

export interface OnsetSignal extends SignalBase {
  type: 'onset';
  strength: number; // 0..1; transient != musical beat
}

export interface BeatSignal extends SignalBase {
  type: 'beat';
  origin: 'detected' | 'predicted';
  strength: number;
  confidence: number; // 0..1
  bpm: number;
  uncertaintyMs: number; // causal estimate resolution / uncertainty, not guaranteed acoustic latency
}

export interface StateSignal extends SignalBase {
  type: 'state';
  state: 'warming' | 'tracking' | 'silent' | 'lost';
  reason: 'start' | 'locked' | 'below-gate' | 'confidence-low' | 'input-gap' | 'seek' | 'source-change';
}

export type MusicSignal = FeatureSignal | OnsetSignal | BeatSignal | StateSignal;

export interface AnalyzerDraft {
  push(block: AudioBlock): readonly MusicSignal[];
  // A reset starts a new stream epoch; old packets must no longer drive motion.
  reset(newStreamId: string, reason: 'seek' | 'source-change' | 'input-gap'): void;
}

/**
 * A clock anchor is supplied by capture / transport, outside the pure analyzer.
 * hostMonotonicMs belongs to clockId, not to an arbitrary renderer performance.now().
 * Cross-process clocks require a measured offset and uncertainty.
 */
export interface ClockAnchor {
  streamId: string;
  sampleRate: number;
  sampleFrame: number;
  clockId: string;
  hostMonotonicMs: number;
  uncertaintyMs: number;
}
