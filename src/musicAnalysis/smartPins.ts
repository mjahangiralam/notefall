import type { Settings } from '../store'
import type { SettingsKeyframe } from '../midi/settingsKeyframes'
import {
  buildSpeedMap,
  midiToTimeline,
  type SpeedPoint,
} from '../midi/speedMap'
import type { MusicalEvent, SongAnalysis } from './analyzeSong'

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v))

type PinCandidate = {
  midiTime: number
  importance: number
  event?: MusicalEvent
}

function eventImportance(event: MusicalEvent): number {
  const weight: Record<MusicalEvent['kind'], number> = {
    climax: 3,
    resurface: 2.85,
    sparse: 2.75,
    coda: 2.65,
    build: 2.1,
    release: 2.0,
    'phrase-end': 1.75,
    'phrase-start': 1.6,
  }
  return weight[event.kind] + event.confidence * 0.7
}

function eventLevelBias(event?: MusicalEvent): number {
  if (!event) return 0
  switch (event.kind) {
    case 'climax':
      return 0.14
    case 'build':
      return 0.06
    case 'resurface':
      return 0.025
    case 'phrase-start':
      return 0.01
    case 'release':
      return -0.08
    case 'phrase-end':
      return -0.07
    case 'sparse':
      return -0.2
    case 'coda':
      return -0.12
  }
}

function intensityAt(analysis: SongAnalysis, time: number): number {
  const windows = analysis.windows
  if (windows.length === 0) return 0.5
  let best = windows[0]
  let bestDistance = Math.abs((best.time + best.endTime) * 0.5 - time)
  for (let i = 1; i < windows.length; i++) {
    const w = windows[i]
    const d = Math.abs((w.time + w.endTime) * 0.5 - time)
    if (d < bestDistance) {
      best = w
      bestDistance = d
    }
  }
  return best.intensity
}

function scaleHexColor(hex: string, factor: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!match) return hex
  const n = Number.parseInt(match[1], 16)
  const r = clamp(Math.round(((n >> 16) & 0xff) * factor), 0, 255)
  const g = clamp(Math.round(((n >> 8) & 0xff) * factor), 0, 255)
  const b = clamp(Math.round((n & 0xff) * factor), 0, 255)
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function vec3(value: unknown, fallback: [number, number, number]): [number, number, number] {
  if (
    Array.isArray(value) &&
    value.length >= 3 &&
    value.every((v, i) => i >= 3 || (typeof v === 'number' && Number.isFinite(v)))
  ) {
    return [Number(value[0]), Number(value[1]), Number(value[2])]
  }
  return fallback
}

function visualSnapshot(
  base: Settings,
  levelInput: number,
  event?: MusicalEvent,
): Partial<Settings> {
  const level = clamp(levelInput + eventLevelBias(event), 0.12, 1.08)
  const centered = level - 0.5
  const camera = vec3(base.cameraPos, [0, 0, 12])
  const background =
    typeof base.backgroundColor === 'string' ? base.backgroundColor : '#05060a'

  return {
    // Deliberately omit theme/note hues: Smart Pins directs intensity while
    // preserving whichever visual identity the user already chose.
    noteEmissive: clamp(num(base.noteEmissive, 1) * (0.78 + level * 0.45), 0, 4),
    noteOpacity: clamp(num(base.noteOpacity, 0.95) * (0.88 + level * 0.14), 0.3, 1),
    particleCount: Math.max(
      0,
      Math.round(num(base.particleCount, 5) * (0.28 + level * 0.92)),
    ),
    particleOpacity: clamp(
      num(base.particleOpacity, 0.15) * (0.45 + level * 0.9),
      0,
      1,
    ),
    particleBrightness: clamp(
      num(base.particleBrightness, 0.15) * (0.48 + level * 0.95),
      0,
      4,
    ),
    particleSpeed: clamp(num(base.particleSpeed, 1) * (0.72 + level * 0.45), 0, 5),
    hitLineIntensity: clamp(
      num(base.hitLineIntensity, 2.5) * (0.66 + level * 0.62),
      0,
      10,
    ),
    hitLineWaveIntensity: clamp(
      num(base.hitLineWaveIntensity, 1) * (0.55 + level * 0.75),
      0,
      10,
    ),
    bloomIntensity: clamp(
      num(base.bloomIntensity, 0.5) * (0.58 + level * 0.9),
      0,
      4,
    ),
    bloomThreshold: clamp(
      num(base.bloomThreshold, 0.2) * (1.14 - level * 0.32),
      0,
      1,
    ),
    bloomRadius: clamp(
      num(base.bloomRadius, 0.7) + centered * 0.2,
      0,
      1,
    ),
    keyboardBrightness: clamp(
      num(base.keyboardBrightness, 0.5) * (0.72 + level * 0.48),
      0,
      3,
    ),
    keyGlowIntensity: clamp(
      num(base.keyGlowIntensity, 1.5) * (0.62 + level * 0.78),
      0,
      10,
    ),
    cameraFov: clamp(num(base.cameraFov, 32) + centered * 2.2, 15, 80),
    cameraPos: [camera[0], camera[1], camera[2] - centered * 0.45],
    backgroundColor: scaleHexColor(background, 0.78 + level * 0.34),
  }
}

function curvatureFor(event?: MusicalEvent): number {
  if (!event) return 0
  switch (event.kind) {
    case 'build':
    case 'resurface':
      return -0.12
    case 'release':
    case 'phrase-end':
    case 'coda':
      return 0.14
    case 'sparse':
      return 0.18
    case 'climax':
      return 0.05
    case 'phrase-start':
      return -0.06
  }
}

export function generateSmartPins(
  analysis: SongAnalysis,
  base: Settings,
  speedPoints: readonly SpeedPoint[] = base.midiSpeedAutomation ?? [],
): SettingsKeyframe[] {
  const duration = Math.max(0, analysis.duration)
  if (duration <= 0 || analysis.windows.length === 0) return []

  const candidates: PinCandidate[] = [
    { midiTime: 0, importance: 10 },
    { midiTime: duration, importance: 10 },
  ]

  for (const event of analysis.events) {
    const keep =
      event.kind === 'climax' ||
      event.kind === 'resurface' ||
      event.kind === 'coda' ||
      (event.kind === 'sparse' && event.confidence >= 0.4) ||
      ((event.kind === 'build' || event.kind === 'release') && event.confidence >= 0.42) ||
      ((event.kind === 'phrase-start' || event.kind === 'phrase-end') && event.confidence >= 0.72)
    if (!keep) continue
    candidates.push({
      midiTime: clamp(event.time, 0, duration),
      importance: eventImportance(event),
      event,
    })
  }

  // Long pieces deserve at least a modest number of visual anchors. Add local
  // high-information windows (large change or intensity extreme) as fallback
  // candidates, rather than filling at fixed wall-clock intervals.
  for (let i = 1; i < analysis.windows.length - 1; i++) {
    const prev = analysis.windows[i - 1].intensity
    const cur = analysis.windows[i].intensity
    const next = analysis.windows[i + 1].intensity
    const contrast = Math.abs(cur - prev) + Math.abs(next - cur)
    const extremeness = Math.abs(cur - 0.5)
    const score = contrast * 1.4 + extremeness * 0.35
    if (score < 0.16) continue
    const w = analysis.windows[i]
    candidates.push({
      midiTime: (w.time + w.endTime) * 0.5,
      importance: 0.7 + score,
    })
  }

  const map = buildSpeedMap(speedPoints)
  const offset = num(base.midiOffsetSec, 0)
  const toTimeline = (midiTime: number): number =>
    Math.max(0, offset + midiToTimeline(map, midiTime))

  const minSpacing = 4
  const maxPins = 12
  const targetMin = duration >= 180 ? 6 : duration >= 75 ? 5 : 4

  // Protect structural events by selecting in importance order, then enforcing
  // spacing in timeline-time. Endpoints are always retained.
  const selected: PinCandidate[] = [candidates[0], candidates[1]]
  const ranked = candidates
    .slice(2)
    .sort((a, b) => b.importance - a.importance || a.midiTime - b.midiTime)
  for (const candidate of ranked) {
    const t = toTimeline(candidate.midiTime)
    if (selected.some((s) => Math.abs(toTimeline(s.midiTime) - t) < minSpacing)) {
      continue
    }
    selected.push(candidate)
    if (selected.length >= maxPins) break
  }

  // If event detection was intentionally conservative, fill to the minimum
  // from the strongest remaining high-information windows.
  if (selected.length < targetMin) {
    for (const candidate of ranked) {
      if (selected.includes(candidate)) continue
      const t = toTimeline(candidate.midiTime)
      if (selected.some((s) => Math.abs(toTimeline(s.midiTime) - t) < minSpacing)) {
        continue
      }
      selected.push(candidate)
      if (selected.length >= targetMin) break
    }
  }

  const pins = selected
    .sort((a, b) => a.midiTime - b.midiTime)
    .map((candidate): SettingsKeyframe => {
      const level = intensityAt(analysis, candidate.midiTime)
      return {
        time: toTimeline(candidate.midiTime),
        settings: visualSnapshot(base, level, candidate.event),
        curvature: curvatureFor(candidate.event),
      }
    })

  // A speed curve plus a positive MIDI offset can make the authored song end
  // exceed analysis.duration in timeline-time; sorting above is by MIDI-time,
  // so sort once more by the actual keyframe clock domain.
  return pins.sort((a, b) => a.time - b.time)
}
