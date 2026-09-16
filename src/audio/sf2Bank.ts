import type { StopFn } from 'smplr'
import { SoundFont2 } from 'soundfont2'
import { fetchSampleBytes } from './sampleCache'

export const GENERALUSER_GS_VERSION = '2.0.3'

const GENERALUSER_GS_PATH =
  `generaluser-gs-${GENERALUSER_GS_VERSION}/GeneralUser-GS.sf2`

export const GENERALUSER_GS_URL = `/samples/${GENERALUSER_GS_PATH}`

export type Sf2DrumBackend = {
  readonly instrumentName: string
  start(midi: number, velocity: number, time?: number, stopId?: string): StopFn
  stop(): void
  dispose(): void
}

export type Sf2DrumBackendOptions = {
  destination?: AudioNode
  /** Kept for rack call-site compatibility; Web Audio schedules directly. */
  scheduler?: unknown
  fetchBytes?: (url: string) => Promise<ArrayBuffer>
}

type Sf2SampleHeader = {
  name: string
  sampleRate: number
  originalPitch: number
  pitchCorrection: number
}

type Sf2Sample = {
  data: Int16Array
  header: Sf2SampleHeader
}

type Sf2Zone = {
  sample?: Sf2Sample
  keyRange?: { lo: number; hi: number }
}

type Sf2Instrument = {
  header: { name: string }
  zones: Sf2Zone[]
}

type ParsedSf2 = {
  instruments: Sf2Instrument[]
}

type PreparedZone = {
  sample: Sf2Sample
  keyRange?: { lo: number; hi: number }
  buffer: AudioBuffer
}

const DRUM_NAME_PREFERENCES = [
  /standard(?:\s*1)?(?:\s+kit)?/i,
  /room(?:\s+kit)?/i,
  /power(?:\s+kit)?/i,
  /orchestr(?:a|al)(?:\s+kit)?/i,
] as const

/**
 * Pick a stable GeneralUser drum instrument from the names exposed by the SF2
 * parser. The patterns tolerate parsers that omit the trailing "Kit" label.
 */
export function selectGeneralUserDrumInstrument(
  names: readonly string[],
): string {
  for (const pattern of DRUM_NAME_PREFERENCES) {
    const match = names.find((name) => pattern.test(name))
    if (match) return match
  }

  const generic = names.find((name) => /(?:drum|kit|percussion)/i.test(name))
  if (generic) return generic

  throw new Error('GeneralUser GS does not expose a recognisable drum kit')
}

function matchesMidiZone(zone: PreparedZone, midi: number): boolean {
  const range = zone.keyRange
  return !range || (midi >= range.lo && midi <= range.hi)
}

function createAudioBuffer(
  context: BaseAudioContext,
  sample: Sf2Sample,
): AudioBuffer {
  const data = sample.data
  const sampleRate = sample.header.sampleRate
  const buffer = context.createBuffer(1, data.length, sampleRate)
  const channel = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) channel[i] = data[i] / 32768
  return buffer
}

function velocityGain(velocity: number): number {
  const normalized = velocity > 1 ? velocity / 127 : velocity
  return Math.max(0, Math.min(1, normalized))
}

/**
 * Parse GeneralUser GS and play its drum instrument directly with Web Audio.
 * This intentionally does not upgrade Notefall's existing smplr dependency:
 * the proven Salamander piano and melodic backends stay on smplr 0.20 while
 * this isolated percussion adapter uses soundfont2 only for parsing.
 *
 * Raw MIDI percussion pitches select SF2 key zones unchanged. Each matching
 * zone becomes an AudioBufferSourceNode, so scheduling works identically in
 * realtime AudioContext and OfflineAudioContext export.
 */
export async function createGeneralUserDrumBackend(
  context: BaseAudioContext,
  options: Sf2DrumBackendOptions = {},
): Promise<Sf2DrumBackend> {
  const fetchBytes = options.fetchBytes ?? fetchSampleBytes
  const bytes = await fetchBytes(GENERALUSER_GS_URL)
  const parsed = new SoundFont2(new Uint8Array(bytes)) as unknown as ParsedSf2
  const instrumentName = selectGeneralUserDrumInstrument(
    parsed.instruments.map((instrument) => instrument.header.name),
  )
  const instrument = parsed.instruments.find(
    (candidate) => candidate.header.name === instrumentName,
  )
  if (!instrument) {
    throw new Error(`GeneralUser GS drum instrument "${instrumentName}" is missing`)
  }

  const bufferCache = new Map<Sf2Sample, AudioBuffer>()
  const zones: PreparedZone[] = []
  for (const zone of instrument.zones) {
    const sample = zone.sample
    if (!sample || sample.data.length === 0) continue
    let buffer = bufferCache.get(sample)
    if (!buffer) {
      buffer = createAudioBuffer(context, sample)
      bufferCache.set(sample, buffer)
    }
    zones.push({ sample, keyRange: zone.keyRange, buffer })
  }
  if (zones.length === 0) {
    throw new Error(`GeneralUser GS drum instrument "${instrumentName}" has no playable samples`)
  }

  const destination = options.destination ?? context.destination
  const active = new Set<AudioBufferSourceNode>()
  let disposed = false

  function stopSource(source: AudioBufferSourceNode): void {
    try { source.stop() } catch { /* already ended/stopped */ }
    active.delete(source)
    try { source.disconnect() } catch { /* already disconnected */ }
  }

  return {
    instrumentName,
    start(midi, velocity, time, _stopId) {
      if (disposed) return () => {}

      const matching = zones.filter((zone) => matchesMidiZone(zone, midi))
      if (matching.length === 0) return () => {}

      const started: AudioBufferSourceNode[] = []
      for (const zone of matching) {
        const source = context.createBufferSource()
        const gain = context.createGain()
        source.buffer = zone.buffer

        // Instrument-zone samples are normally recorded for their GM drum
        // key. Preserve the incoming MIDI key and only pitch-shift when a
        // zone deliberately spans more than one key.
        const nativePitch = zone.sample.header.originalPitch
        source.playbackRate.value = Math.pow(2, (midi - nativePitch) / 12)
        if (zone.sample.header.pitchCorrection) {
          source.detune.value = -zone.sample.header.pitchCorrection
        }

        gain.gain.value = velocityGain(velocity)
        source.connect(gain)
        gain.connect(destination)
        active.add(source)
        started.push(source)

        source.onended = () => {
          active.delete(source)
          try { source.disconnect() } catch { /* already disconnected */ }
          try { gain.disconnect() } catch { /* already disconnected */ }
        }

        const startAt = Math.max(context.currentTime, time ?? context.currentTime)
        source.start(startAt)
      }

      return () => {
        for (const source of started) stopSource(source)
      }
    },
    stop() {
      for (const source of [...active]) stopSource(source)
    },
    dispose() {
      if (disposed) return
      disposed = true
      for (const source of [...active]) stopSource(source)
      bufferCache.clear()
    },
  }
}
