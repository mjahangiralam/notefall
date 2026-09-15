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

function hslToHex(hueDeg: number, saturation: number, lightness: number): string {
  const h = ((hueDeg % 360) + 360) % 360 / 360
  const s = Math.max(0, Math.min(1, saturation))
  const l = Math.max(0, Math.min(1, lightness))

  const hueToRgb = (p: number, q: number, t0: number): number => {
    let t = t0
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }

  let r = l
  let g = l
  let b = l
  if (s !== 0) {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hueToRgb(p, q, h + 1 / 3)
    g = hueToRgb(p, q, h)
    b = hueToRgb(p, q, h - 1 / 3)
  }

  const hex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

// For unusually large orchestral/MIDI arrangements, continue past the curated
// palette with a deterministic golden-angle hue sequence instead of cycling
// back to duplicate colours.
function generatedTrackColor(ordinal: number): string {
  const hue = (ordinal * 137.508 + 18) % 360
  const saturation = ordinal % 2 === 0 ? 0.78 : 0.70
  const lightness = ordinal % 3 === 0 ? 0.58 : 0.64
  return hslToHex(hue, saturation, lightness)
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

  let cursor = 0
  for (let i = 1; i < noteTrackIndices.length; i++) {
    let color = cursor < AUTO_TRACK_PALETTE.length
      ? AUTO_TRACK_PALETTE[cursor]
      : generatedTrackColor(cursor - AUTO_TRACK_PALETTE.length)
    cursor++

    while (used.has(normalizeHex(color))) {
      color = generatedTrackColor(cursor + AUTO_TRACK_PALETTE.length)
      cursor++
    }

    result[String(noteTrackIndices[i])] = color
    used.add(normalizeHex(color))
  }

  return result
}
