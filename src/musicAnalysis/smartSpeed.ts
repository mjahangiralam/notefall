import type { ParsedSong } from '../midi/types'
import {
  buildSpeedMap,
  midiToTimeline,
  speedAt,
  type SpeedPoint,
} from '../midi/speedMap'
import type { MusicalEvent, SongAnalysis } from './analyzeSong'

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v))

type Candidate = {
  time: number
  value: number
  curvature: number
  importance: number
}

function importance(event: MusicalEvent): number {
  const weight: Record<MusicalEvent['kind'], number> = {
    climax: 1,
    resurface: 0.97,
    sparse: 0.94,
    coda: 0.9,
    build: 0.82,
    release: 0.8,
    'phrase-end': 0.78,
    'phrase-start': 0.7,
  }
  return weight[event.kind] * 0.55 + event.confidence * 0.45
}

function targetFor(event: MusicalEvent): { value: number; curvature: number } {
  const c = clamp(event.confidence, 0, 1)
  switch (event.kind) {
    case 'build':
      return { value: 1.018 + 0.02 * c, curvature: -0.12 }
    case 'phrase-end':
      return { value: 0.978 - 0.008 * c, curvature: 0.12 }
    case 'phrase-start':
      return { value: 0.997 + 0.005 * c, curvature: -0.06 }
    case 'sparse':
      return { value: 0.972 - 0.014 * c, curvature: 0.15 }
    case 'release':
      return { value: 0.988 - 0.008 * c, curvature: 0.12 }
    case 'climax':
      // Arrive close to natural tempo at the emotional peak; the build before
      // it carries most of the forward motion.
      return { value: 1.002, curvature: 0.08 }
    case 'resurface':
      // Returning material should feel grounded after a suspended passage.
      return { value: 1.0, curvature: -0.04 }
    case 'coda':
      return { value: 0.976 - 0.012 * c, curvature: 0.18 }
  }
}

function mergeCandidates(candidates: Candidate[], duration: number): Candidate[] {
  const sorted = candidates
    .map((c) => ({ ...c, time: clamp(c.time, 0, duration) }))
    .sort((a, b) => a.time - b.time || b.importance - a.importance)
  const out: Candidate[] = []
  for (const c of sorted) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.time - c.time) < 1.35) {
      if (c.importance > last.importance) out[out.length - 1] = c
    } else {
      out.push(c)
    }
  }
  return out
}

function prune(points: SpeedPoint[]): SpeedPoint[] {
  if (points.length <= 2) return points
  const out: SpeedPoint[] = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    const a = out[out.length - 1]
    const b = points[i]
    const c = points[i + 1]
    const u = (b.time - a.time) / Math.max(1e-9, c.time - a.time)
    const linear = a.value + (c.value - a.value) * u
    // Preserve musically explicit breaths even when numerically subtle by
    // keeping a modest threshold here.
    if (Math.abs(b.value - linear) >= 0.0045) out.push(b)
  }
  out.push(points[points.length - 1])
  return out
}

function durationOf(points: readonly SpeedPoint[], duration: number): number {
  if (duration <= 0) return 0
  return midiToTimeline(buildSpeedMap(points), duration)
}

function normalizeDuration(
  points: readonly SpeedPoint[],
  duration: number,
  loBound: number,
  hiBound: number,
): SpeedPoint[] {
  if (points.length === 0 || duration <= 0) return [...points]

  const applyMultiplier = (m: number): SpeedPoint[] =>
    points.map((p) => ({
      ...p,
      value: clamp(p.value * m, loBound, hiBound),
    }))

  // A larger multiplier means faster playback and therefore a shorter
  // integrated timeline. Binary-search the shared scale needed to return the
  // complete piece close to its unautomated duration while preserving shape.
  let lo = 0.94
  let hi = 1.06
  let best = applyMultiplier(1)
  let bestError = Math.abs(durationOf(best, duration) - duration)
  for (let i = 0; i < 36; i++) {
    const mid = (lo + hi) * 0.5
    const candidate = applyMultiplier(mid)
    const rendered = durationOf(candidate, duration)
    const err = Math.abs(rendered - duration)
    if (err < bestError) {
      best = candidate
      bestError = err
    }
    if (rendered > duration) lo = mid
    else hi = mid
  }
  return best
}

export function generateSmartSpeed(
  song: ParsedSong,
  analysis: SongAnalysis,
  existing: readonly SpeedPoint[] = [],
): SpeedPoint[] {
  const duration = Math.max(0, song.duration)
  if (duration <= 0 || analysis.windows.length === 0) return []

  const structural = analysis.events.filter((event) => {
    if (
      event.kind === 'climax' ||
      event.kind === 'resurface' ||
      event.kind === 'coda'
    ) {
      return true
    }
    if (event.kind === 'sparse') return event.confidence >= 0.45
    if (event.kind === 'build' || event.kind === 'release') {
      return event.confidence >= 0.42
    }
    return event.confidence >= 0.7
  })

  const ranked = [...structural]
    .sort((a, b) => importance(b) - importance(a))
    .slice(0, 14)

  const candidates = mergeCandidates(
    [
      { time: 0, value: 1, curvature: 0, importance: 2 },
      ...ranked.map((event): Candidate => {
        const target = targetFor(event)
        return {
          time: event.time,
          value: target.value,
          curvature: target.curvature,
          importance: importance(event),
        }
      }),
      { time: duration, value: 1, curvature: 0, importance: 2 },
    ],
    duration,
  )

  const existingMap = existing.length >= 2 ? buildSpeedMap(existing) : null
  const hasExisting = existingMap !== null
  const loBound = hasExisting ? 0.9 : 0.94
  const hiBound = hasExisting ? 1.1 : 1.05

  let points: SpeedPoint[] = candidates.map((candidate) => {
    let value = candidate.value
    if (existingMap) {
      const prior = speedAt(existingMap, candidate.time)
      value = prior * 0.6 + value * 0.4
    }
    return {
      time: candidate.time,
      value: clamp(value, loBound, hiBound),
      curvature: clamp(candidate.curvature, -0.25, 0.25),
    }
  })

  // Give the recovery from a sparse passage a short stabilizing approach to
  // unity. This avoids a sudden jump from ritardando into the returning theme.
  for (const event of structural) {
    if (event.kind !== 'resurface') continue
    const t = clamp(
      event.time - Math.max(1.5, analysis.windowSec * 1.5),
      0,
      duration,
    )
    if (points.some((p) => Math.abs(p.time - t) < 1)) continue
    let value = 0.988
    if (existingMap) value = speedAt(existingMap, t) * 0.6 + value * 0.4
    points.push({ time: t, value: clamp(value, loBound, hiBound), curvature: -0.08 })
  }

  points = points
    .sort((a, b) => a.time - b.time)
    .filter((p, i, arr) => i === 0 || Math.abs(p.time - arr[i - 1].time) > 1e-6)
  points = prune(points)

  while (points.length > 18) {
    let removeIndex = 1
    let smallest = Number.POSITIVE_INFINITY
    for (let i = 1; i < points.length - 1; i++) {
      const a = points[i - 1]
      const b = points[i]
      const c = points[i + 1]
      const u = (b.time - a.time) / Math.max(1e-9, c.time - a.time)
      const linear = a.value + (c.value - a.value) * u
      const deviation = Math.abs(b.value - linear)
      if (deviation < smallest) {
        smallest = deviation
        removeIndex = i
      }
    }
    points.splice(removeIndex, 1)
  }

  points = normalizeDuration(points, duration, loBound, hiBound)

  return points.map((p) => ({
    time: clamp(p.time, 0, duration),
    value: clamp(p.value, loBound, hiBound),
    curvature: clamp(p.curvature ?? 0, -0.25, 0.25),
  }))
}
