import type { ExpressionPoint } from './expressionMap'

export type NoteEvent = {
  id: number
  midi: number
  time: number
  duration: number
  velocity: number
  track: number
}

export type PedalEvent = {
  time: number
  value: number
}

/**
 * Per-track metadata pulled from the SMF. Index in `ParsedSong.tracks`
 * matches `NoteEvent.track`, so renderers and the audio rack can resolve
 * display names, colours, and instruments from the track index alone.
 *
 * `program` is the zero-based General MIDI program number reported by
 * @tonejs/midi. `percussion` mirrors its channel-10/percussion detection.
 * Nullable fields keep hand-authored/edited ParsedSong fixtures backwards
 * compatible when no meaningful MIDI metadata is available.
 */
export type TrackInfo = {
  name: string
  /** True when the track contained at least one note. UI hides note-less
   *  tracks (tempo / meta) from per-track colour/instrument controls. */
  hasNotes: boolean
  channel: number | null
  program: number | null
  instrumentName: string | null
  instrumentFamily: string | null
  percussion: boolean
}

export type ParsedSong = {
  name: string
  duration: number
  notes: NoteEvent[]
  pedals: PedalEvent[]
  /** MIDI CC11 expression automation, in MIDI-time seconds. */
  expressions: ExpressionPoint[]
  tracks: TrackInfo[]
}
