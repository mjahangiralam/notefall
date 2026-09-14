/**
 * Look up the colour hex string for a given track index.
 *
 * `trackColors` is the sparse `Record<trackIdx → hex>` from settings;
 * unset keys fall back to `fallback` (typically the global `noteColor`
 * for falling notes, `particleColor` for the particle system, etc.).
 *
 * `trackIdx === undefined` happens for live input (touch / PC keyboard
 * / Web-MIDI) and for previews — those have no source track and always
 * use the fallback colour.
 */

let keyLineInstallRequested = false

function ensureTrackKeyLines(): void {
  if (keyLineInstallRequested || typeof window === 'undefined') return
  keyLineInstallRequested = true
  void import('./trackKeyLines')
    .then(({ installTrackKeyLines }) => installTrackKeyLines())
    .catch(() => {
      // Let a later frame retry if a transient chunk/HMR load failed.
      keyLineInstallRequested = false
    })
}

// Keyboard.tsx imports this module unconditionally, so start the overlay as
// soon as the browser bundle loads. trackKeyLines retries until the R3F scene
// bridge is mounted; this keeps the feature independent of key-glow settings.
ensureTrackKeyLines()

export function resolveTrackColorHex(
  trackIdx: number | undefined,
  trackColors: Record<string, string>,
  fallback: string,
): string {
  ensureTrackKeyLines()
  if (trackIdx == null) return fallback
  return trackColors[String(trackIdx)] ?? fallback
}
