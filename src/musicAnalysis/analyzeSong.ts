import type { ParsedSong } from '../midi/types'

export type MusicalEventKind =
  | 'phrase-start'
  | 'phrase-end'
  | 'sparse'
  | 'build'
  | 'release'
  | 'climax'
  | 'resurface'
  | 'coda'

export type AnalysisWindow = {
  time: number
  endTime: number
  intensity: number
  density: number
  velocity: number
  register: number
  polyphony: number
  pedal: number
  restBefore: number
}

export type MusicalEvent = {
  kind: MusicalEventKind
  time: number
  confidence: number
  intensity: number
}

export type SongAnalysis = {
  duration: number
  windowSec: number
  windows: AnalysisWindow[]
  events: MusicalEvent[]
  climaxTime: number | null
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v))
const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v))

function normalize(values: readonly number[]): number[] {
  if (values.length === 0) return []
  let lo = Number.POSITIVE_INFINITY
  let hi = Number.NEGATIVE_INFINITY
  for (const v of values) {
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  const span = hi - lo
  if (!Number.isFinite(span) || span < 1e-9) return values.map(() => 0.5)
  return values.map((v) => clamp01((v - lo) / span))
}

function smooth(values: readonly number[]): number[] {
  if (values.length < 2) return [...values]
  const weights = [1, 2, 3, 2, 1]
  return values.map((_, i) => {
    let sum = 0
    let weight = 0
    for (let k = -2; k <= 2; k++) {
      const j = i + k
      if (j < 0 || j >= values.length) continue
      const w = weights[k + 2]
      sum += values[j] * w
      weight += w
    }
    return weight > 0 ? sum / weight : values[i]
  })
}

function intensityAt(windows: readonly AnalysisWindow[], time: number): number {
  if (windows.length === 0) return 0
  let best = windows[0]
  let bestDist = Math.abs((best.time + best.endTime) * 0.5 - time)
  for (let i = 1; i < windows.length; i++) {
    const w = windows[i]
    const dist = Math.abs((w.time + w.endTime) * 0.5 - time)
    if (dist < bestDist) {
      best = w
      bestDist = dist
    }
  }
  return best.intensity
}

function dedupeEvents(events: readonly MusicalEvent[]): MusicalEvent[] {
  const sorted = [...events].sort(
    (a, b) => a.time - b.time || b.confidence - a.confidence,
  )
  const out: MusicalEvent[] = []
  for (const event of sorted) {
    const near = out.findIndex(
      (e) => e.kind === event.kind && Math.abs(e.time - event.time) < 2.5,
    )
    if (near < 0) out.push(event)
    else if (event.confidence > out[near].confidence) out[near] = event
  }
  return out.sort((a, b) => a.time - b.time)
}

function pedalOccupancy(
  pedals: ParsedSong['pedals'],
  start: number,
  end: number,
): number {
  if (pedals.length === 0 || end <= start) return 0
  let state = 0
  for (const p of pedals) {
    if (p.time > start) break
    state = p.value >= 0.5 ? 1 : 0
  }
  let cursor = start
  let down = 0
  for (const p of pedals) {
    if (p.time <= start) continue
    if (p.time >= end) break
    if (state) down += p.time - cursor
    cursor = p.time
    state = p.value >= 0.5 ? 1 : 0
  }
  if (state) down += end - cursor
  return clamp01(down / Math.max(1e-6, end - start))
}

export function analyzeSong(song: ParsedSong): SongAnalysis {
  const duration = Math.max(0, Number.isFinite(song.duration) ? song.duration : 0)
  const notes = [...song.notes]
    .filter(
      (n) =>
        Number.isFinite(n.time) &&
        Number.isFinite(n.duration) &&
        n.duration >= 0 &&
        n.time <= duration,
    )
    .sort((a, b) => a.time - b.time || a.midi - b.midi)

  if (duration <= 0 || notes.length === 0) {
    return {
      duration,
      windowSec: duration > 0 ? clamp(duration / 120, 0.75, 2) : 0,
      windows: [],
      events: [],
      climaxTime: null,
    }
  }

  const windowSec = clamp(duration / 120, 0.75, 2)
  const count = Math.max(1, Math.ceil(duration / windowSec))
  const rawDensity: number[] = []
  const rawVelocity: number[] = []
  const rawRegister: number[] = []
  const rawPolyphony: number[] = []
  const rawPedal: number[] = []
  const restBefore: number[] = []

  let lastEnd = 0
  let noteCursor = 0
  for (let i = 0; i < count; i++) {
    const start = i * windowSec
    const end = Math.min(duration, start + windowSec)
    const onsets = [] as typeof notes
    while (noteCursor < notes.length && notes[noteCursor].time < start) {
      lastEnd = Math.max(lastEnd, notes[noteCursor].time + notes[noteCursor].duration)
      noteCursor++
    }
    let j = noteCursor
    while (j < notes.length && notes[j].time < end) {
      onsets.push(notes[j])
      j++
    }

    const density = onsets.length / Math.max(0.001, end - start)
    const velocities = onsets.map((n) => clamp01(n.velocity)).sort((a, b) => b - a)
    const meanVelocity =
      velocities.length > 0
        ? velocities.reduce((a, b) => a + b, 0) / velocities.length
        : 0
    const topCount = Math.max(1, Math.ceil(velocities.length * 0.25))
    const upperVelocity =
      velocities.length > 0
        ? velocities.slice(0, topCount).reduce((a, b) => a + b, 0) / topCount
        : 0
    const velocity = meanVelocity * 0.65 + upperVelocity * 0.35
    const register =
      onsets.length > 0
        ? onsets.reduce((sum, n) => sum + n.midi, 0) / onsets.length / 127
        : 0

    let activeNoteSeconds = 0
    for (const n of notes) {
      if (n.time >= end) break
      const nEnd = n.time + n.duration
      if (nEnd <= start) continue
      activeNoteSeconds += Math.max(0, Math.min(end, nEnd) - Math.max(start, n.time))
    }
    const polyphony = activeNoteSeconds / Math.max(0.001, end - start)
    const pedal = pedalOccupancy(song.pedals, start, end)

    rawDensity.push(density)
    rawVelocity.push(velocity)
    rawRegister.push(register)
    rawPolyphony.push(polyphony)
    rawPedal.push(pedal)
    restBefore.push(Math.max(0, start - lastEnd))
  }

  const densityN = normalize(rawDensity)
  const velocityN = normalize(rawVelocity)
  const registerN = normalize(rawRegister)
  const polyphonyN = normalize(rawPolyphony)
  const pedalN = normalize(rawPedal)

  const rawIntensity = densityN.map((density, i) =>
    clamp01(
      density * 0.34 +
        velocityN[i] * 0.34 +
        polyphonyN[i] * 0.22 +
        registerN[i] * 0.07 +
        pedalN[i] * 0.03,
    ),
  )
  const smoothed = smooth(rawIntensity)

  const windows: AnalysisWindow[] = smoothed.map((intensity, i) => ({
    time: i * windowSec,
    endTime: Math.min(duration, (i + 1) * windowSec),
    intensity: clamp01(intensity),
    density: densityN[i],
    velocity: velocityN[i],
    register: registerN[i],
    polyphony: polyphonyN[i],
    pedal: pedalN[i],
    restBefore: restBefore[i],
  }))

  let climaxIndex = 0
  for (let i = 1; i < windows.length; i++) {
    if (windows[i].intensity > windows[climaxIndex].intensity) climaxIndex = i
  }
  const climaxTime = (windows[climaxIndex].time + windows[climaxIndex].endTime) * 0.5
  const events: MusicalEvent[] = [
    {
      kind: 'climax',
      time: climaxTime,
      confidence: clamp01(0.65 + windows[climaxIndex].intensity * 0.35),
      intensity: windows[climaxIndex].intensity,
    },
  ]

  // Phrase gaps are more reliable from note timing than from windowed density.
  const gapThreshold = Math.max(0.9, windowSec * 1.15)
  let previousEnd = notes[0].time + notes[0].duration
  for (let i = 1; i < notes.length; i++) {
    const n = notes[i]
    const gap = n.time - previousEnd
    if (gap >= gapThreshold) {
      const conf = clamp01(0.45 + gap / Math.max(2, windowSec * 4))
      events.push({
        kind: 'phrase-end',
        time: previousEnd,
        confidence: conf,
        intensity: intensityAt(windows, previousEnd),
      })
      events.push({
        kind: 'sparse',
        time: previousEnd + gap * 0.5,
        confidence: conf,
        intensity: intensityAt(windows, previousEnd + gap * 0.5),
      })
      events.push({
        kind: 'phrase-start',
        time: n.time,
        confidence: conf,
        intensity: intensityAt(windows, n.time),
      })
    }
    previousEnd = Math.max(previousEnd, n.time + n.duration)
  }

  // Slope events capture broader builds/releases that do not contain rests.
  for (let i = 2; i < windows.length - 2; i++) {
    const before = (windows[i - 2].intensity + windows[i - 1].intensity) * 0.5
    const after = (windows[i + 1].intensity + windows[i + 2].intensity) * 0.5
    const delta = after - before
    const time = (windows[i].time + windows[i].endTime) * 0.5
    if (delta >= 0.16) {
      events.push({
        kind: 'build',
        time,
        confidence: clamp01(delta * 2.6),
        intensity: windows[i].intensity,
      })
    } else if (delta <= -0.16) {
      events.push({
        kind: 'release',
        time,
        confidence: clamp01(-delta * 2.6),
        intensity: windows[i].intensity,
      })
    }
  }

  // Low-intensity runs become sparse regions even when a few isolated notes
  // prevent a literal rest gap.
  let sparseStart = -1
  for (let i = 0; i <= windows.length; i++) {
    const isSparse =
      i < windows.length &&
      windows[i].intensity <= 0.28 &&
      windows[i].density <= 0.4
    if (isSparse && sparseStart < 0) sparseStart = i
    if ((!isSparse || i === windows.length) && sparseStart >= 0) {
      const endIndex = i - 1
      if (endIndex - sparseStart + 1 >= 2) {
        const mid = Math.floor((sparseStart + endIndex) / 2)
        const minIntensity = Math.min(
          ...windows.slice(sparseStart, endIndex + 1).map((w) => w.intensity),
        )
        events.push({
          kind: 'sparse',
          time: (windows[mid].time + windows[mid].endTime) * 0.5,
          confidence: clamp01(0.55 + (0.28 - minIntensity)),
          intensity: windows[mid].intensity,
        })
      }
      sparseStart = -1
    }
  }

  // A resurface is the first confident recovery after the strongest recent
  // sparse point: enough intensity must return and the local slope must be up.
  const sparseEvents = events
    .filter((e) => e.kind === 'sparse' && e.confidence >= 0.45)
    .sort((a, b) => a.time - b.time)
  for (const sparse of sparseEvents) {
    const startIndex = windows.findIndex((w) => w.endTime >= sparse.time)
    if (startIndex < 0) continue
    const sparseIntensity = Math.min(sparse.intensity, windows[startIndex].intensity)
    for (let i = startIndex + 1; i < windows.length; i++) {
      const prev = windows[Math.max(startIndex, i - 2)].intensity
      const rise = windows[i].intensity - sparseIntensity
      if (
        rise >= 0.22 &&
        windows[i].intensity >= 0.42 &&
        windows[i].intensity > prev + 0.08
      ) {
        events.push({
          kind: 'resurface',
          time: (windows[i].time + windows[i].endTime) * 0.5,
          confidence: clamp01(0.55 + rise * 0.8),
          intensity: windows[i].intensity,
        })
        break
      }
    }
  }

  // Coda detection is deliberately conservative: only the last 20%, and only
  // when its final third is materially quieter than the beginning of that tail.
  const tailStart = Math.max(0, Math.floor(windows.length * 0.8))
  const tail = windows.slice(tailStart)
  if (tail.length >= 4) {
    const split = Math.max(1, Math.floor(tail.length / 3))
    const firstMean =
      tail.slice(0, split).reduce((s, w) => s + w.intensity, 0) / split
    const lastSlice = tail.slice(-split)
    const lastMean =
      lastSlice.reduce((s, w) => s + w.intensity, 0) / lastSlice.length
    if (firstMean - lastMean >= 0.12) {
      const codaIndex = tailStart + Math.floor(tail.length * 0.45)
      const w = windows[Math.min(windows.length - 1, codaIndex)]
      events.push({
        kind: 'coda',
        time: (w.time + w.endTime) * 0.5,
        confidence: clamp01(0.55 + (firstMean - lastMean)),
        intensity: w.intensity,
      })
    }
  }

  return {
    duration,
    windowSec,
    windows,
    events: dedupeEvents(events),
    climaxTime,
  }
}
