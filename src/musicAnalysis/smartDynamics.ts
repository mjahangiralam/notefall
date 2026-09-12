import type { ParsedSong } from '../midi/types'
import type { ExpressionPoint } from '../midi/expressionMap'
import type { SongAnalysis, MusicalEvent } from './analyzeSong'

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v))

function sampleExpression(points: readonly ExpressionPoint[], time: number): number {
  if (points.length === 0) return 1
  const sorted = [...points].sort((a, b) => a.time - b.time)
  if (time <= sorted[0].time) return sorted[0].value
  if (time >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    if (time >= a.time && time <= b.time) {
      const u = (time - a.time) / Math.max(1e-9, b.time - a.time)
      return a.value + (b.value - a.value) * u
    }
  }
  return sorted[sorted.length - 1].value
}

function intensityAt(analysis: SongAnalysis, time: number): number {
  const windows = analysis.windows
  if (windows.length === 0) return 0.5
  if (time <= windows[0].time) return windows[0].intensity
  for (let i = 0; i < windows.length - 1; i++) {
    const a = windows[i]
    const b = windows[i + 1]
    const ac = (a.time + a.endTime) * 0.5
    const bc = (b.time + b.endTime) * 0.5
    if (time >= ac && time <= bc) {
      const u = (time - ac) / Math.max(1e-9, bc - ac)
      return a.intensity + (b.intensity - a.intensity) * u
    }
  }
  return windows[windows.length - 1].intensity
}

function eventBias(event: MusicalEvent | undefined): number {
  if (!event) return 0
  switch (event.kind) {
    case 'climax':
      return 0.08
    case 'build':
      return 0.04
    case 'phrase-start':
      return 0.015
    case 'resurface':
      return 0.03
    case 'phrase-end':
      return -0.055
    case 'release':
      return -0.05
    case 'sparse':
      return -0.12
    case 'coda':
      return -0.1
  }
}

function eventImportance(event: MusicalEvent): number {
  const kindWeight: Record<MusicalEvent['kind'], number> = {
    climax: 1,
    resurface: 0.92,
    sparse: 0.9,
    coda: 0.88,
    build: 0.76,
    release: 0.74,
    'phrase-end': 0.68,
    'phrase-start': 0.64,
  }
  return kindWeight[event.kind] * 0.55 + event.confidence * 0.45
}

function mergeCandidates(
  candidates: Array<{ time: number; event?: MusicalEvent; importance: number }>,
  duration: number,
): Array<{ time: number; event?: MusicalEvent; importance: number }> {
  const sorted = candidates
    .map((c) => ({ ...c, time: clamp(c.time, 0, duration) }))
    .sort((a, b) => a.time - b.time || b.importance - a.importance)
  const out: typeof sorted = []
  for (const c of sorted) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.time - c.time) < 1.25) {
      if (c.importance > last.importance) out[out.length - 1] = c
    } else {
      out.push(c)
    }
  }
  return out
}

function pruneRedundant(points: ExpressionPoint[]): ExpressionPoint[] {
  if (points.length <= 2) return points
  const out: ExpressionPoint[] = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    const prev = out[out.length - 1]
    const cur = points[i]
    const next = points[i + 1]
    const u = (cur.time - prev.time) / Math.max(1e-9, next.time - prev.time)
    const linear = prev.value + (next.value - prev.value) * u
    if (Math.abs(cur.value - linear) >= 0.025) out.push(cur)
  }
  out.push(points[points.length - 1])
  return out
}

export function generateSmartDynamics(
  song: ParsedSong,
  analysis: SongAnalysis,
): ExpressionPoint[] {
  const duration = Math.max(0, song.duration)
  if (duration <= 0 || analysis.windows.length === 0) return []

  const structural = analysis.events.filter((event) => {
    if (event.kind === 'climax' || event.kind === 'resurface' || event.kind === 'coda') return true
    if (event.kind === 'sparse') return event.confidence >= 0.45
    if (event.kind === 'build' || event.kind === 'release') return event.confidence >= 0.42
    return event.confidence >= 0.68
  })

  const ranked = [...structural]
    .sort((a, b) => eventImportance(b) - eventImportance(a))
    .slice(0, 14)

  const candidates = mergeCandidates(
    [
      { time: 0, importance: 2 },
      ...ranked.map((event) => ({
        time: event.time,
        event,
        importance: eventImportance(event),
      })),
      { time: duration, importance: 2 },
    ],
    duration,
  )

  const hasPrior = song.expressions.length >= 2
  let points = candidates.map(({ time, event }): ExpressionPoint => {
    const generated = clamp(
      0.42 + 0.53 * intensityAt(analysis, time) + eventBias(event),
      0.35,
      1,
    )
    if (!hasPrior) return { time, value: generated }
    const prior = clamp(sampleExpression(song.expressions, time), 0, 1)
    return {
      time,
      value: clamp(prior * 0.65 + generated * 0.35, 0.35, 1),
    }
  })

  // Give resurfacing a visible ramp by retaining one recovery point shortly
  // before the detected return when spacing allows it.
  for (const event of structural) {
    if (event.kind !== 'resurface') continue
    const t = clamp(event.time - Math.max(1.5, analysis.windowSec * 1.5), 0, duration)
    if (points.some((p) => Math.abs(p.time - t) < 1)) continue
    const generated = clamp(0.4 + 0.48 * intensityAt(analysis, t), 0.35, 0.82)
    const value = hasPrior
      ? clamp(sampleExpression(song.expressions, t) * 0.65 + generated * 0.35, 0.35, 1)
      : generated
    points.push({ time: t, value })
  }

  points = points
    .sort((a, b) => a.time - b.time)
    .filter((p, i, arr) => i === 0 || Math.abs(p.time - arr[i - 1].time) > 1e-6)

  points = pruneRedundant(points)

  // Hard cap for exceptionally event-dense MIDI files. Keep the endpoints,
  // then preserve points with the largest local deviation from linearity.
  while (points.length > 18) {
    let removeIndex = 1
    let smallestDeviation = Number.POSITIVE_INFINITY
    for (let i = 1; i < points.length - 1; i++) {
      const a = points[i - 1]
      const b = points[i]
      const c = points[i + 1]
      const u = (b.time - a.time) / Math.max(1e-9, c.time - a.time)
      const linear = a.value + (c.value - a.value) * u
      const deviation = Math.abs(b.value - linear)
      if (deviation < smallestDeviation) {
        smallestDeviation = deviation
        removeIndex = i
      }
    }
    points.splice(removeIndex, 1)
  }

  return points.map((p) => ({
    time: clamp(p.time, 0, duration),
    value: clamp(p.value, 0.35, 1),
  }))
}
