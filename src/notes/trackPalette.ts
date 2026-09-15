export type TrackPaletteInfo = { hasNotes: boolean }

// High-contrast defaults chosen for dark Notefall scenes. The first musical
// track keeps the user's global note colour; subsequent tracks consume this
// palette while skipping any colour that would duplicate the fallback.
export const AUTO_TRACK_PALETTE = [
  '#ff4d4f', // red
  '#4da6ff', // blue
  '#ffd166', // gold
  '#9b5de5', // purple
  '#06d6a0', // green
  '#ff9f1c', // orange
  '#00c2ff', // cyan
  '#f15bb5', // pink
  '#a8dadc', // aqua
  '#f28482', // coral
  '#b8f26e', // lime
  '#c77dff', // violet
  '#ff70a6', // rose
  '#70d6ff', // sky
  '#e9c46a', // sand
  '#90be6d', // leaf
] as const

function normalizeHex(hex: string): string {
  return hex.trim().toLowerCase()
}

/**
 * Build explicit default colours for a freshly opened MIDI.
 *
 * - 0/1 note tracks: return an empty map so legacy single-track files keep
 *   following the global `noteColor` setting exactly as before.
 * - 2+ note tracks: every musical track receives an explicit, distinct
 *   colour. The first keeps the global colour so the user's theme remains
 *   represented; the rest get high-contrast palette colours.
 * - meta/empty tracks neither receive a colour nor consume a palette slot.
 */
export function buildDefaultTrackColors(
  tracks: readonly TrackPaletteInfo[],
  fallback: string,
): Record<string, string> {
  const noteTrackIndices = tracks
    .map((track, index) => ({ track, index }))
    .filter(({ track }) => track.hasNotes)
    .map(({ index }) => index)

  if (noteTrackIndices.length <= 1) return {}

  const result: Record<string, string> = {}
  const used = new Set<string>()

  result[String(noteTrackIndices[0])] = fallback
  used.add(normalizeHex(fallback))

  let paletteCursor = 0
  for (let i = 1; i < noteTrackIndices.length; i++) {
    let color = AUTO_TRACK_PALETTE[paletteCursor % AUTO_TRACK_PALETTE.length]
    paletteCursor++

    // Skip collisions with the global fallback or any earlier track. With the
    // curated palette this normally iterates once, but the guard keeps custom
    // global colours deterministic too.
    while (used.has(normalizeHex(color))) {
      color = AUTO_TRACK_PALETTE[paletteCursor % AUTO_TRACK_PALETTE.length]
      paletteCursor++
    }

    result[String(noteTrackIndices[i])] = color
    used.add(normalizeHex(color))
  }

  return result
}
