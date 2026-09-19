import { DrumMachine, Soundfont, type StopFn, type Scheduler } from 'smplr'
import type { ParsedSong } from '../midi/types'
import {
  resolveTrackInstrument,
  requiredInstrumentIds,
  type InstrumentId,
} from './instrumentCatalog'
import {
  createPiano,
  type LoadProgress,
  type PianoInstrument,
} from './sampler'
import { createSampleStorage } from './sampleCache'
import {
  createPremiumDrumBackend,
  type Sf2DrumBackend,
  type Sf2DrumKit,
} from './sf2Bank'

export type TrackInstrumentAssignments = Record<string, string>

type ResolvedInstrumentId = Exclude<InstrumentId, 'auto'>

type LegacySoundfont = {
  load?: Promise<unknown>
  ready?: Promise<unknown>
  start(options: {
    note: number
    velocity?: number
    time?: number
    stopId?: string
    ampRelease?: number
    detune?: number
  }): StopFn
  stop(): void
  disconnect?: () => void
}

export type InstrumentRackOptions = {
  scheduler?: Scheduler
  onProgress?: (p: LoadProgress) => void
  /** Realtime input/preview needs piano before a song is prepared. */
  eagerGrand?: boolean
}

export type InstrumentRack = {
  readonly context: BaseAudioContext
  prepare(
    song: ParsedSong,
    assignments?: TrackInstrumentAssignments,
    onProgress?: (p: LoadProgress) => void,
  ): Promise<void>
  start(
    midi: number,
    velocity: number,
    atAudioTime?: number,
    stopId?: string,
    track?: number,
  ): StopFn
  stopAll(): void
  finalizeOffline(durationSeconds: number): Promise<void>
  setVolume(value: number): void
  setExpression(value: number): void
  scheduleExpression(points: readonly { time: number; value: number }[]): void
  setReverbDry(level: number): void
  setReverbWet(level: number): void
  setReverbSize(seconds: number): void
  setReverbDecayTime(seconds: number): void
  setReverbDecay(decay: number): void
  setReverbPreDelay(seconds: number): void
  setReverbDamping(amount: number): void
  setReverbHiCut(hz: number): void
  setReverbLowCut(hz: number): void
  setReleaseTime(seconds: number): void
  setDetune(cents: number): void
  setEqBand(index: number, db: number): void
  setVelocityCompensation(compensation: number): void
  dispose(): void
}

type SoundfontCtor = new (
  context: AudioContext,
  options: Record<string, unknown>,
) => LegacySoundfont

type LegacyDrumMachine = {
  load?: Promise<unknown>
  ready?: Promise<unknown>
  start(options: { note: string; velocity?: number; time?: number; stopId?: string }): StopFn
  stop(): void
  disconnect?: () => void
}

type DrumMachineCtor = new (
  context: AudioContext,
  options: Record<string, unknown>,
) => LegacyDrumMachine

function waitForSoundfont(instrument: LegacySoundfont): Promise<unknown> {
  return instrument.load ?? instrument.ready ?? Promise.resolve()
}

function scheduleGainCurve(
  param: AudioParam,
  points: readonly { time: number; value: number }[],
): void {
  param.cancelScheduledValues(0)
  if (points.length === 0) {
    param.setValueAtTime(1, 0)
    return
  }
  let lastTime = -Infinity
  points.forEach((point, index) => {
    const time = Math.max(0, point.time)
    const value = Math.max(0, Math.min(1, point.value))
    if (index === 0 || time <= lastTime + 1e-9) {
      param.setValueAtTime(value, time)
    } else {
      param.linearRampToValueAtTime(value, time)
    }
    lastTime = time
  })
}

/** Build the unique backends required for the current song. */
export function planInstrumentRack(
  song: Pick<ParsedSong, 'tracks'>,
  assignments: TrackInstrumentAssignments,
): ResolvedInstrumentId[] {
  return requiredInstrumentIds(song.tracks, assignments)
}

/** Legacy TR-808 approximation used only as a percussion fallback/manual choice. */
function drumNameForMidi(midi: number): string {
  if (midi === 35 || midi === 36) return 'kick'
  if (midi === 37) return 'rim-shot'
  if (midi === 38 || midi === 40) return 'snare'
  if (midi === 39) return 'clap'
  if (midi === 42 || midi === 44) return 'closed-hat'
  if (midi === 46) return 'open-hat'
  if ([41, 43, 45, 47, 48, 50].includes(midi)) return 'tom'
  if ([49, 51, 52, 53, 55, 57, 59].includes(midi)) return 'cymbal'
  if (midi === 56) return 'cowbell'
  if (midi === 70) return 'maracas'
  return 'snare'
}

/** Shared realtime/offline instrument router. */
export async function createInstrumentRack(
  context?: BaseAudioContext,
  options: InstrumentRackOptions = {},
): Promise<InstrumentRack> {
  const rawContext = context ?? (await import('tone')).getContext().rawContext
  const ctx = rawContext as BaseAudioContext

  const soundfontExpression = ctx.createGain()
  const soundfontMaster = ctx.createGain()
  soundfontExpression.gain.value = 1
  soundfontMaster.gain.value = 1
  soundfontExpression.connect(soundfontMaster)
  soundfontMaster.connect(ctx.destination)

  let grand: PianoInstrument | null = null
  const soundfonts = new Map<string, LegacySoundfont>()
  const failedSoundfonts = new Set<string>()
  let sf2Drums: Sf2DrumBackend | null = null
  let sf2DrumsFailed = false
  let sf2StartFailureLogged = false
  let drums: LegacyDrumMachine | null = null
  let drumsFailed = false
  const trackRouting = new Map<number, ResolvedInstrumentId>()

  let volume = 1
  let expression = 1
  let releaseTime = 0.3
  let detuneCents = 0
  let disposed = false

  async function ensureGrand(onProgress?: (p: LoadProgress) => void): Promise<PianoInstrument> {
    if (grand) return grand
    grand = await createPiano(
      ctx,
      onProgress ?? options.onProgress,
      options.scheduler ? { scheduler: options.scheduler } : undefined,
    )
    grand.setVolume(volume)
    grand.setExpression(expression)
    grand.setReleaseTime(releaseTime)
    grand.setDetune(detuneCents)
    return grand
  }

  async function ensureSoundfont(
    name: string,
    onProgress?: (p: LoadProgress) => void,
  ): Promise<LegacySoundfont | null> {
    const existing = soundfonts.get(name)
    if (existing) return existing
    if (failedSoundfonts.has(name)) return null

    try {
      const Ctor = Soundfont as unknown as SoundfontCtor
      const instrument = new Ctor(ctx as AudioContext, {
        instrument: name,
        kit: 'FluidR3_GM',
        destination: soundfontExpression,
        storage: createSampleStorage(),
        scheduler: options.scheduler,
        onLoadProgress: (p: LoadProgress) => onProgress?.(p),
      })
      await waitForSoundfont(instrument)
      soundfonts.set(name, instrument)
      return instrument
    } catch (error) {
      console.warn(`Could not load Soundfont instrument "${name}"; falling back to Notefall Grand.`, error)
      failedSoundfonts.add(name)
      await ensureGrand(onProgress)
      return null
    }
  }

  async function ensureDrums(
    onProgress?: (p: LoadProgress) => void,
  ): Promise<LegacyDrumMachine | null> {
    if (drums) return drums
    if (drumsFailed) return null
    try {
      const Ctor = DrumMachine as unknown as DrumMachineCtor
      const instrument = new Ctor(ctx as AudioContext, {
        instrument: 'TR-808',
        destination: soundfontExpression,
        storage: createSampleStorage(),
        scheduler: options.scheduler,
        onLoadProgress: (p: LoadProgress) => (onProgress ?? options.onProgress)?.(p),
      })
      await (instrument.load ?? instrument.ready ?? Promise.resolve())
      drums = instrument
      return drums
    } catch (error) {
      console.warn('Could not load TR-808 drum fallback; percussion will be silent.', error)
      drumsFailed = true
      return null
    }
  }

  async function ensureSf2Drums(
    onProgress?: (p: LoadProgress) => void,
  ): Promise<Sf2DrumBackend | null> {
    if (sf2Drums) return sf2Drums
    if (sf2DrumsFailed) {
      await ensureDrums(onProgress)
      return null
    }
    try {
      sf2Drums = await createPremiumDrumBackend(ctx, {
        destination: soundfontExpression,
        scheduler: options.scheduler,
      })
      return sf2Drums
    } catch (error) {
      console.warn('Could not load Premium Drum Collection drums; falling back to TR-808.', error)
      sf2DrumsFailed = true
      await ensureDrums(onProgress)
      return null
    }
  }

  function startTr808(
    midi: number,
    velocity: number,
    atAudioTime?: number,
    stopId?: string,
  ): StopFn {
    const drum = drums
    if (!drum) return () => {}
    return drum.start({
      note: drumNameForMidi(midi),
      velocity: Math.max(1, Math.min(127, Math.round(velocity * 127))),
      time: atAudioTime,
      stopId,
    })
  }

  function startSf2Kit(
    kit: Sf2DrumKit,
    midi: number,
    velocity: number,
    atAudioTime?: number,
    stopId?: string,
  ): StopFn {
    if (sf2Drums) {
      try {
        return sf2Drums.start(midi, velocity, atAudioTime, stopId, kit)
      } catch (error) {
        if (!sf2StartFailureLogged) {
          sf2StartFailureLogged = true
          console.warn('Premium Drum Collection drum playback failed; using TR-808 fallback.', error)
        }
      }
    }
    return startTr808(midi, velocity, atAudioTime, stopId)
  }

  async function prepare(
    song: ParsedSong,
    assignments: TrackInstrumentAssignments = {},
    onProgress?: (p: LoadProgress) => void,
  ): Promise<void> {
    trackRouting.clear()
    song.tracks.forEach((track, index) => {
      if (!track.hasNotes) return
      trackRouting.set(
        index,
        resolveTrackInstrument(track, assignments[String(index)]),
      )
    })

    const required = planInstrumentRack(song, assignments)
    await Promise.all(
      required.map(async (id) => {
        if (id === 'notefall-grand') {
          await ensureGrand(onProgress)
          return
        }
        if (id === 'drum:gm-sf2' || id === 'drum:gm-sf2-orchestral') {
          await ensureSf2Drums(onProgress)
          return
        }
        if (id === 'drum:TR-808') {
          await ensureDrums(onProgress)
          return
        }
        await ensureSoundfont(id.slice('soundfont:'.length), onProgress)
      }),
    )
  }

  if (options.eagerGrand !== false) await ensureGrand(options.onProgress)

  const rack: InstrumentRack = {
    context: ctx,
    prepare,
    start(midi, velocity, atAudioTime, stopId, track) {
      const route = track === undefined
        ? 'notefall-grand'
        : (trackRouting.get(track) ?? 'notefall-grand')

      if (route === 'notefall-grand') {
        if (!grand) return () => {}
        return grand.start(midi, velocity, atAudioTime, stopId)
      }

      if (route === 'drum:gm-sf2') {
        return startSf2Kit('power', midi, velocity, atAudioTime, stopId)
      }

      if (route === 'drum:gm-sf2-orchestral') {
        return startSf2Kit('orchestral', midi, velocity, atAudioTime, stopId)
      }

      if (route === 'drum:TR-808') {
        return startTr808(midi, velocity, atAudioTime, stopId)
      }

      const name = route.slice('soundfont:'.length)
      const instrument = soundfonts.get(name)
      if (!instrument) {
        return grand?.start(midi, velocity, atAudioTime, stopId) ?? (() => {})
      }

      return instrument.start({
        note: midi,
        velocity: Math.max(1, Math.min(127, Math.round(velocity * 127))),
        time: atAudioTime,
        stopId,
        ampRelease: releaseTime,
        detune: detuneCents,
      })
    },
    stopAll() {
      grand?.stopAll()
      for (const instrument of soundfonts.values()) instrument.stop()
      sf2Drums?.stop()
      drums?.stop()
    },
    async finalizeOffline(durationSeconds) {
      await sf2Drums?.finalizeOffline?.(durationSeconds)
    },
    setVolume(value) {
      volume = Math.max(0, value)
      grand?.setVolume(volume)
      const now = ctx.currentTime
      soundfontMaster.gain.cancelScheduledValues(now)
      soundfontMaster.gain.setTargetAtTime(volume, now, 0.01)
    },
    setExpression(value) {
      expression = Math.max(0, Math.min(1, value))
      grand?.setExpression(expression)
      const now = ctx.currentTime
      soundfontExpression.gain.cancelScheduledValues(now)
      soundfontExpression.gain.setTargetAtTime(expression, now, 0.01)
    },
    scheduleExpression(points) {
      grand?.scheduleExpression(points)
      scheduleGainCurve(soundfontExpression.gain, points)
    },
    setReverbDry(level) { grand?.setReverbDry(level) },
    setReverbWet(level) { grand?.setReverbWet(level) },
    setReverbSize(seconds) { grand?.setReverbSize(seconds) },
    setReverbDecayTime(seconds) { grand?.setReverbDecayTime(seconds) },
    setReverbDecay(decay) { grand?.setReverbDecay(decay) },
    setReverbPreDelay(seconds) { grand?.setReverbPreDelay(seconds) },
    setReverbDamping(amount) { grand?.setReverbDamping(amount) },
    setReverbHiCut(hz) { grand?.setReverbHiCut(hz) },
    setReverbLowCut(hz) { grand?.setReverbLowCut(hz) },
    setReleaseTime(seconds) {
      releaseTime = Math.max(0.01, Math.min(5, seconds))
      grand?.setReleaseTime(releaseTime)
    },
    setDetune(cents) {
      detuneCents = Math.max(-1200, Math.min(1200, cents))
      grand?.setDetune(detuneCents)
    },
    setEqBand(index, db) { grand?.setEqBand(index, db) },
    setVelocityCompensation(compensation) {
      grand?.setVelocityCompensation(compensation)
    },
    dispose() {
      if (disposed) return
      disposed = true
      rack.stopAll()
      grand?.dispose()
      try { sf2Drums?.dispose() } catch { /* already disposed */ }
      try { drums?.disconnect?.() } catch { /* already disconnected */ }
      for (const instrument of soundfonts.values()) {
        try { instrument.disconnect?.() } catch { /* already disconnected */ }
      }
      try { soundfontExpression.disconnect() } catch { /* already disconnected */ }
      try { soundfontMaster.disconnect() } catch { /* already disconnected */ }
      soundfonts.clear()
      sf2Drums = null
      trackRouting.clear()
    },
  }

  return rack
}
