import { Midi } from '@tonejs/midi'
import type { ParsedSong, NoteEvent, PedalEvent, TrackInfo } from './types'
import { normalizeExpressionPoints, type ExpressionPoint } from './expressionMap'

export async function parseMidi(file: ArrayBuffer, name: string): Promise<ParsedSong> {
  const midi = new Midi(file)
  const notes: NoteEvent[] = []
  const pedals: PedalEvent[] = []
  const expressions: ExpressionPoint[] = []
  const tracks: TrackInfo[] = []
  let id = 0

  midi.tracks.forEach((track, trackIdx) => {
    track.notes.forEach((n) => {
      notes.push({
        id: id++,
        midi: n.midi,
        time: n.time,
        duration: n.duration,
        velocity: n.velocity,
        track: trackIdx,
      })
    })
    const cc64 = track.controlChanges[64]
    if (cc64) {
      cc64.forEach((cc) => {
        pedals.push({ time: cc.time, value: cc.value })
      })
    }
    const cc11 = track.controlChanges[11]
    if (cc11) {
      cc11.forEach((cc) => {
        expressions.push({ time: cc.time, value: cc.value })
      })
    }

    // SMF track names are often empty or whitespace; fall back to a
    // synthetic "Track N" label so the per-track UI has something to render.
    // @tonejs/midi exposes the track's General MIDI instrument metadata,
    // which feeds the audio rack's Auto instrument resolver.
    const rawName = (track.name ?? '').trim()
    const instrument = track.instrument
    const instrumentName = (instrument?.name ?? '').trim()
    const instrumentFamily = (instrument?.family ?? '').trim()
    tracks.push({
      name: rawName.length > 0 ? rawName : `Track ${trackIdx + 1}`,
      hasNotes: track.notes.length > 0,
      channel: Number.isFinite(track.channel) ? track.channel : null,
      program: Number.isFinite(instrument?.number) ? instrument.number : null,
      instrumentName: instrumentName.length > 0 ? instrumentName : null,
      instrumentFamily: instrumentFamily.length > 0 ? instrumentFamily : null,
      percussion: Boolean(instrument?.percussion),
    })
  })

  notes.sort((a, b) => a.time - b.time)
  pedals.sort((a, b) => a.time - b.time)

  return {
    name,
    duration: midi.duration,
    notes,
    pedals,
    expressions: normalizeExpressionPoints(expressions),
    tracks,
  }
}
