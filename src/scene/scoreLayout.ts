import type { NoteEvent, ParsedSong, TrackInfo } from '../midi/types'

export type ScoreClef = 'treble' | 'bass' | 'percussion'
export type ScorePart = {
  trackIndex: number
  label: string
  clefs: ScoreClef[]
  notes: NoteEvent[]
}

/** Keep SMF tracks as independent parts; never combine different instruments
 * just because their notes fall into the same pitch register. */
export function buildScoreParts(song: ParsedSong | null): ScorePart[] {
  if (!song) return []
  const byTrack = new Map<number, NoteEvent[]>()
  for (const note of song.notes) {
    const list = byTrack.get(note.track) ?? []
    list.push(note)
    byTrack.set(note.track, list)
  }
  const solo = byTrack.size === 1
  return [...byTrack.entries()].sort(([a], [b]) => a - b).map(([trackIndex, notes]) => {
    const track: TrackInfo | undefined = song.tracks[trackIndex]
    const label = track?.name?.trim() || track?.instrumentName || `Part ${trackIndex + 1}`
    if (track?.percussion || track?.channel === 9) {
      return { trackIndex, label, clefs: ['percussion'], notes }
    }
    const pitches = notes.map((n) => n.midi).sort((a, b) => a - b)
    const low = pitches[0] ?? 60
    const high = pitches[pitches.length - 1] ?? 60
    const median = pitches[Math.floor(pitches.length / 2)] ?? 60
    const name = `${track?.name ?? ''} ${track?.instrumentName ?? ''} ${track?.instrumentFamily ?? ''}`
    const keyboard = /piano|keyboard|harpsichord|clavinet|organ|electric grand|celesta|harp/i.test(name)
    const spansBoth = low < 60 && high >= 60
    // A solo part spanning both registers is a grand staff. A keyboard/harp
    // or any sustained wide-range polyphonic part merits the same treatment.
    const grand = spansBoth && (solo || keyboard || (notes.length >= 8 && high - low >= 24))
    const clefs: ScoreClef[] = grand ? ['treble', 'bass'] : [median < 60 ? 'bass' : 'treble']
    return { trackIndex, label, clefs, notes }
  })
}

/** Page by complete parts: a piano grand staff cannot be split between pages. */
export function paginateScoreParts(parts: ScorePart[], maxStaves = 5): ScorePart[][] {
  if (!parts.length) return [[]]
  const pages: ScorePart[][] = []
  let page: ScorePart[] = []
  let staves = 0
  for (const part of parts) {
    if (page.length && staves + part.clefs.length > maxStaves) {
      pages.push(page)
      page = []
      staves = 0
    }
    page.push(part)
    staves += part.clefs.length
  }
  if (page.length) pages.push(page)
  return pages
}
