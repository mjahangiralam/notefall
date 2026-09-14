const LIVE_TRACK = -1

export type ActiveTrackCounts = Map<number, number>

function normalizedTrack(trackIdx: number | undefined): number {
  return trackIdx ?? LIVE_TRACK
}

/** Increment the refcount for a track currently sounding on one piano key. */
export function addActiveTrack(
  counts: ActiveTrackCounts,
  trackIdx: number | undefined,
): void {
  const key = normalizedTrack(trackIdx)
  counts.set(key, (counts.get(key) ?? 0) + 1)
}

/**
 * Decrement one sounding note for a track. Retriggered notes from the same
 * track keep the colour active until the final matching note-off arrives.
 */
export function removeActiveTrack(
  counts: ActiveTrackCounts,
  trackIdx: number | undefined,
): void {
  const key = normalizedTrack(trackIdx)
  const next = (counts.get(key) ?? 0) - 1
  if (next > 0) counts.set(key, next)
  else counts.delete(key)
}

/** Stable ordering keeps stripe layout deterministic across frames. */
export function activeTrackIndices(counts: ActiveTrackCounts): number[] {
  return Array.from(counts.entries())
    .filter(([, count]) => count > 0)
    .map(([trackIdx]) => trackIdx)
    .sort((a, b) => a - b)
}

/**
 * Resolve the unique colours currently active on one key.
 * Live input (-1) and tracks without an override use the global note colour.
 * Duplicate colours collapse so two equally-coloured tracks do not create
 * visually redundant stripes.
 */
export function activeTrackColorHexes(
  counts: ActiveTrackCounts,
  trackColors: Record<string, string>,
  fallback: string,
): string[] {
  const seen = new Set<string>()
  const colors: string[] = []
  for (const trackIdx of activeTrackIndices(counts)) {
    const color = trackIdx < 0 ? fallback : (trackColors[String(trackIdx)] ?? fallback)
    const normalized = color.toLowerCase()
    if (seen.has(normalized)) continue
    seen.add(normalized)
    colors.push(color)
  }
  return colors
}
