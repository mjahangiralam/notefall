import { Soundfont2, type Scheduler, type StopFn } from 'smplr'
import { SoundFont2 } from 'soundfont2'
import { fetchSampleBytes } from './sampleCache'

export const GENERALUSER_GS_VERSION = '2.0.3'

const GENERALUSER_GS_PATH =
  `generaluser-gs-${GENERALUSER_GS_VERSION}/GeneralUser-GS.sf2`

export const GENERALUSER_GS_URL = import.meta.env?.DEV
  ? `/samples-cdn/${GENERALUSER_GS_PATH}`
  : `https://samples.notefall.app/${GENERALUSER_GS_PATH}`

export type Sf2DrumBackend = {
  readonly instrumentName: string
  start(midi: number, velocity: number, time?: number, stopId?: string): StopFn
  stop(): void
  dispose(): void
}

export type Sf2DrumBackendOptions = {
  destination?: AudioNode
  scheduler?: Scheduler
  fetchBytes?: (url: string) => Promise<ArrayBuffer>
}

type Soundfont2Compat = {
  readonly ready: Promise<unknown>
  readonly instrumentNames: string[]
  loadInstrument(name: string): Promise<unknown>
  start(options: {
    note: number
    velocity?: number
    time?: number
    stopId?: string
  }): StopFn
  stop(): void
  disconnect?: () => void
}

const DRUM_NAME_PREFERENCES = [
  /standard(?:\s*1)?(?:\s+kit)?/i,
  /room(?:\s+kit)?/i,
  /power(?:\s+kit)?/i,
  /orchestr(?:a|al)(?:\s+kit)?/i,
] as const

/**
 * Pick a stable GeneralUser drum preset from the names exposed by the SF2
 * parser. GeneralUser's documented names include Standard 1 Kit, Room Kit,
 * Power Kit and Orchestral Kit; some parsers expose shortened instrument
 * header names, so the preferred matches deliberately tolerate a missing
 * "Kit" suffix.
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

/**
 * Load the GeneralUser GS bank once, select its standard GM drum kit, and
 * preserve raw MIDI percussion pitches. The bytes are fetched through
 * Notefall's successful-response-only cache; a temporary blob URL is used
 * because smplr Soundfont2 owns the final URL fetch internally.
 */
export async function createGeneralUserDrumBackend(
  context: BaseAudioContext,
  options: Sf2DrumBackendOptions = {},
): Promise<Sf2DrumBackend> {
  const fetchBytes = options.fetchBytes ?? fetchSampleBytes
  const bytes = await fetchBytes(GENERALUSER_GS_URL)
  const blobUrl = URL.createObjectURL(
    new Blob([bytes], { type: 'application/octet-stream' }),
  )

  let sampler: Soundfont2Compat | null = null
  try {
    sampler = Soundfont2(context as AudioContext, {
      url: blobUrl,
      createSoundfont: (data: Uint8Array) => new SoundFont2(data),
      destination: options.destination,
    }) as unknown as Soundfont2Compat

    await sampler.ready
    const instrumentName = selectGeneralUserDrumInstrument(
      sampler.instrumentNames,
    )
    await sampler.loadInstrument(instrumentName)

    let disposed = false
    return {
      instrumentName,
      start(midi, velocity, time, stopId) {
        if (disposed) return () => {}
        return sampler!.start({
          note: midi,
          velocity: Math.max(1, Math.min(127, Math.round(velocity * 127))),
          time,
          stopId,
        })
      },
      stop() {
        if (!disposed) sampler?.stop()
      },
      dispose() {
        if (disposed) return
        disposed = true
        try { sampler?.stop() } catch { /* already stopped */ }
        try { sampler?.disconnect?.() } catch { /* already disconnected */ }
        sampler = null
      },
    }
  } catch (error) {
    try { sampler?.stop() } catch { /* ignore cleanup error */ }
    try { sampler?.disconnect?.() } catch { /* ignore cleanup error */ }
    throw error
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}
