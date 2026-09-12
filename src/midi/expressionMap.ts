/** MIDI CC11 expression automation. Values are normalized to 0..1. */
export type ExpressionPoint = {
  /** MIDI-time in seconds. */
  time: number
  /** Linear expression amount in [0, 1]. */
  value: number
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v))

/**
 * Sort, sanitize, and de-duplicate expression points. When several CC11
 * events share the exact same time, the last event wins — matching MIDI's
 * ordered-controller semantics at a single timestamp.
 */
export function normalizeExpressionPoints(
  points: readonly ExpressionPoint[],
): ExpressionPoint[] {
  if (points.length === 0) return []
  const sorted = points
    .map((p, index) => ({
      time: Math.max(0, Number.isFinite(p.time) ? p.time : 0),
      value: clamp01(Number.isFinite(p.value) ? p.value : 1),
      index,
    }))
    .sort((a, b) => a.time - b.time || a.index - b.index)

  const out: ExpressionPoint[] = []
  for (const p of sorted) {
    const last = out[out.length - 1]
    if (last && last.time === p.time) {
      last.value = p.value
    } else {
      out.push({ time: p.time, value: p.value })
    }
  }
  return out
}

/**
 * Evaluate expression at a MIDI-time. Empty automation is unity. Before the
 * first point and after the last, endpoint values are held. Between points,
 * CC11 is linearly interpolated for smooth crescendos / diminuendos.
 */
export function expressionAt(
  points: readonly ExpressionPoint[],
  midiTime: number,
): number {
  if (points.length === 0) return 1
  if (points.length === 1 || midiTime <= points[0].time) return clamp01(points[0].value)
  const last = points[points.length - 1]
  if (midiTime >= last.time) return clamp01(last.value)

  let lo = 0
  let hi = points.length - 1
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1
    if (points[mid].time <= midiTime) lo = mid
    else hi = mid
  }
  const a = points[lo]
  const b = points[hi]
  const span = b.time - a.time
  if (span <= 0) return clamp01(b.value)
  const u = (midiTime - a.time) / span
  return clamp01(a.value + (b.value - a.value) * u)
}

/**
 * Dynamics should support the visuals without turning them into a VU meter.
 * No automation is a strict visual no-op. With CC11 present, the darkest
 * expression point keeps 82% of the authored glow and unity keeps 100%.
 */
export function expressionVisualScale(
  expression: number,
  hasAutomation: boolean,
): number {
  if (!hasAutomation) return 1
  return 0.82 + 0.18 * clamp01(expression)
}
