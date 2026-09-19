import type { StopFn } from 'smplr'
import { getContext } from 'tone'
import { WorkletSynthesizer } from 'spessasynth_lib'
import { SoundBankLoader, SpessaSynthProcessor } from 'spessasynth_core'
import { fetchSampleBytes } from './sampleCache'

export const PREMIUM_DRUM_SF2_URL = '/samples/premium-drum-collection-gm/Premium_Drum_Collection_GM.sf2'
export const SPESSASYNTH_WORKLET_URL = '/spessasynth_processor.min.js'

const POWER_DRUM_CHANNEL = 9
const POWER_KIT_PROGRAM = 16
const ORCHESTRAL_DRUM_CHANNEL = 8
const ORCHESTRAL_KIT_PROGRAM = 48
const ORCHESTRAL_BANK_MSB = 120
const RENDER_QUANTUM = 128

export type Sf2DrumKit = 'power' | 'orchestral'

export type Sf2DrumBackend = {
  readonly instrumentName: string
  start(
    midi: number,
    velocity: number,
    time?: number,
    stopId?: string,
    kit?: Sf2DrumKit,
  ): StopFn
  /**
   * Offline contexts accumulate note events. Call this before
   * OfflineAudioContext.startRendering() to materialize those events into a
   * normal AudioBufferSourceNode attached to the rack's destination.
   */
  finalizeOffline?(durationSeconds: number): Promise<void>
  stop(): void
  dispose(): void
}

export type Sf2DrumBackendOptions = {
  destination?: AudioNode
  /** Kept for rack call-site compatibility. SpessaSynth schedules itself. */
  scheduler?: unknown
  fetchBytes?: (url: string) => Promise<ArrayBuffer>
}

type OfflineDrumEvent = {
  time: number
  midi: number
  velocity: number
  kit: Sf2DrumKit
  order: number
}

const workletLoads = new WeakMap<BaseAudioContext, Promise<void>>()

function isOfflineContext(context: BaseAudioContext): context is OfflineAudioContext {
  return typeof (context as OfflineAudioContext).startRendering === 'function'
}

async function ensureSpessaWorklet(context: BaseAudioContext): Promise<void> {
  const audioWorklet = context.audioWorklet
  let load = workletLoads.get(context)
  if (!load) {
    load = audioWorklet.addModule(SPESSASYNTH_WORKLET_URL)
    workletLoads.set(context, load)
  }
  await load
}

function midiVelocity(velocity: number): number {
  const scaled = velocity <= 1 ? velocity * 127 : velocity
  return Math.max(1, Math.min(127, Math.round(scaled)))
}

function channelForKit(kit: Sf2DrumKit): number {
  return kit === 'orchestral' ? ORCHESTRAL_DRUM_CHANNEL : POWER_DRUM_CHANNEL
}

function configureRealtimeKits(synth: WorkletSynthesizer): void {
  synth.programChange(POWER_DRUM_CHANNEL, POWER_KIT_PROGRAM)
  synth.controllerChange(ORCHESTRAL_DRUM_CHANNEL, 0, ORCHESTRAL_BANK_MSB)
  synth.programChange(ORCHESTRAL_DRUM_CHANNEL, ORCHESTRAL_KIT_PROGRAM)
}

function configureOfflineKits(synth: SpessaSynthProcessor): void {
  synth.programChange(POWER_DRUM_CHANNEL, POWER_KIT_PROGRAM)
  synth.controllerChange(ORCHESTRAL_DRUM_CHANNEL, 0, ORCHESTRAL_BANK_MSB)
  synth.programChange(ORCHESTRAL_DRUM_CHANNEL, ORCHESTRAL_KIT_PROGRAM)
}

async function createRealtimeBackend(
  context: BaseAudioContext,
  bytes: ArrayBuffer,
  destination: AudioNode,
): Promise<Sf2DrumBackend> {
  await ensureSpessaWorklet(context)

  // Tone.js uses standardized-audio-context wrappers. A native
  // AudioWorkletNode rejects the wrapped context with a BaseAudioContext
  // TypeError. Construct the node through Tone's own factory so it joins
  // the same audio graph; SpessaSynth explicitly supports this override.
  const toneContext = getContext()
  const synth = new WorkletSynthesizer(context, {
    eventsEnabled: false,
    audioNodeCreators: {
      worklet: (_audioContext, name, options) =>
        toneContext.createAudioWorkletNode(name, options) as unknown as AudioWorkletNode,
    },
  })
  synth.connect(destination)
  await synth.soundBankManager.addSoundBank(
    bytes,
    'premium-drum-collection-gm',
  )
  await synth.isReady
  configureRealtimeKits(synth)
  console.info('[NoteFall drums] Premium Drum Collection ready:', PREMIUM_DRUM_SF2_URL)

  let disposed = false

  return {
    instrumentName: 'Premium Drum Collection Power / Orchestral Kits',
    start(midi, velocity, time, _stopId, kit = 'power') {
      if (disposed) return () => {}
      const channel = channelForKit(kit)
      const eventOptions = time === undefined
        ? undefined
        : { time: Math.max(context.currentTime, time) }
      synth.noteOn(channel, midi, midiVelocity(velocity), eventOptions)
      // Short MIDI note-offs must not clip cymbal or tom tails.
      return () => {}
    },
    stop() {
      if (!disposed) synth.stopAll(true)
    },
    dispose() {
      if (disposed) return
      disposed = true
      try { synth.stopAll(true) } catch { /* already stopped */ }
      try { synth.destroy() } catch { /* already destroyed */ }
    },
  }
}

async function createOfflineBackend(
  context: OfflineAudioContext,
  bytes: ArrayBuffer,
  destination: AudioNode,
): Promise<Sf2DrumBackend> {
  const events: OfflineDrumEvent[] = []
  let nextOrder = 0
  let disposed = false
  let finalized = false
  let renderedSource: AudioBufferSourceNode | null = null

  return {
    instrumentName: 'Premium Drum Collection Power / Orchestral Kits (offline)',
    start(midi, velocity, time, _stopId, kit = 'power') {
      if (disposed || finalized) return () => {}
      events.push({
        time: Math.max(0, time ?? 0),
        midi,
        velocity: midiVelocity(velocity),
        kit,
        order: nextOrder++,
      })
      return () => {}
    },
    async finalizeOffline(durationSeconds) {
      if (disposed || finalized) return
      finalized = true

      const sampleRate = context.sampleRate
      const sampleCount = Math.max(1, Math.ceil(durationSeconds * sampleRate))
      const left = new Float32Array(sampleCount)
      const right = new Float32Array(sampleCount)

      const synth = new SpessaSynthProcessor(sampleRate)
      synth.soundBankManager.addSoundBank(
        SoundBankLoader.fromArrayBuffer(bytes),
        'premium-drum-collection-gm',
      )
      await synth.processorInitialized
      configureOfflineKits(synth)

      const scheduled = events
        .slice()
        .sort((a, b) => a.time - b.time || a.order - b.order)
      let eventIndex = 0
      let rendered = 0

      while (rendered < sampleCount) {
        while (
          eventIndex < scheduled.length &&
          Math.round(scheduled[eventIndex].time * sampleRate) <= rendered
        ) {
          const event = scheduled[eventIndex++]
          synth.noteOn(
            channelForKit(event.kit),
            event.midi,
            event.velocity,
          )
        }

        const nextEventFrame = eventIndex < scheduled.length
          ? Math.max(rendered, Math.round(scheduled[eventIndex].time * sampleRate))
          : sampleCount
        const untilEvent = Math.max(1, nextEventFrame - rendered)
        const count = Math.min(RENDER_QUANTUM, untilEvent, sampleCount - rendered)
        synth.process(left, right, rendered, count)
        rendered += count
      }

      const buffer = context.createBuffer(2, sampleCount, sampleRate)
      buffer.copyToChannel(left, 0)
      buffer.copyToChannel(right, 1)
      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(destination)
      source.start(0)
      renderedSource = source
    },
    stop() {
      events.length = 0
      if (renderedSource) {
        try { renderedSource.stop() } catch { /* already stopped */ }
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      events.length = 0
      if (renderedSource) {
        try { renderedSource.disconnect() } catch { /* already disconnected */ }
        renderedSource = null
      }
    },
  }
}

/** Premium SF2 playback and offline export share the same bank and kit routing. */
export async function createPremiumDrumBackend(
  context: BaseAudioContext,
  options: Sf2DrumBackendOptions = {},
): Promise<Sf2DrumBackend> {
  const fetchBytes = options.fetchBytes ?? fetchSampleBytes
  const bytes = await fetchBytes(PREMIUM_DRUM_SF2_URL)
  const destination = options.destination ?? context.destination

  if (isOfflineContext(context)) {
    return createOfflineBackend(context, bytes, destination)
  }
  return createRealtimeBackend(context, bytes, destination)
}
