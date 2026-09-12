import type { Settings } from '../store'
import type { SettingsKeyframe } from '../midi/settingsKeyframes'

/**
 * Moonlit Reverie v4 is ~3:48. Cue locations are authored against that
 * musical form, then scaled to the loaded song duration so small timing
 * revisions keep the visual arc aligned with the same sections.
 */
export const MOONLIT_REFERENCE_DURATION_SEC = 228

export const MOONLIT_KEYFRAME_COUNT = 10

const cueTime = (durationSec: number, referenceSec: number): number =>
  Math.max(0, Math.min(durationSec, durationSec * (referenceSec / MOONLIT_REFERENCE_DURATION_SEC)))

const cue = (
  durationSec: number,
  referenceSec: number,
  settings: Partial<Settings>,
  curvature = 0,
): SettingsKeyframe => ({
  time: cueTime(durationSec, referenceSec),
  settings,
  curvature,
})

/**
 * One-click visual director + piano profile for Moonlit Reverie.
 *
 * The base values define the opening look and non-animatable audio profile.
 * Timeline pins then shape the visual intensity through the form:
 * intimate opening → build → main climax → release → "time stops" →
 * memory/reprise → luminous bell-note ending.
 */
export function buildMoonlitReveriePreset(songDurationSec: number): Partial<Settings> {
  const duration =
    Number.isFinite(songDurationSec) && songDurationSec > 0
      ? songDurationSec
      : MOONLIT_REFERENCE_DURATION_SEC

  const settingsKeyframes: SettingsKeyframe[] = [
    // 0:00 — intimate moonlit opening.
    cue(duration, 0, {
      noteColor: '#8ccfff',
      noteEmissive: 0.9,
      noteOpacity: 0.92,
      particleOpacity: 0.08,
      particleBrightness: 0.12,
      particleCount: 2,
      particleSpeed: 0.75,
      particleLifetime: 0.82,
      particleTurbulence: 0.5,
      flashIntensity: 0.82,
      flashBrightness: 0.48,
      hitLineIntensity: 1.8,
      hitLineWaveIntensity: 0.5,
      bloomIntensity: 0.36,
      bloomThreshold: 0.26,
      bloomRadius: 0.62,
      keyboardBrightness: 0.4,
      keyGlowIntensity: 1.15,
      cameraFov: 31,
      cameraPos: [0, 0, 12.3],
      backgroundColor: '#03050b',
    }),

    // ~0:45 — development: light begins to open up.
    cue(duration, 45, {
      noteColor: '#96d6ff',
      noteEmissive: 1.0,
      particleOpacity: 0.11,
      particleBrightness: 0.15,
      particleCount: 3,
      particleSpeed: 0.85,
      flashIntensity: 0.95,
      hitLineIntensity: 2.05,
      hitLineWaveIntensity: 0.62,
      bloomIntensity: 0.5,
      bloomThreshold: 0.22,
      bloomRadius: 0.68,
      keyboardBrightness: 0.44,
      keyGlowIntensity: 1.4,
      cameraFov: 31.5,
      cameraPos: [0, 0, 12.1],
      backgroundColor: '#040713',
    }, -0.12),

    // ~1:30 — broader illumination before the main build.
    cue(duration, 90, {
      noteColor: '#a8e0ff',
      noteEmissive: 1.12,
      particleOpacity: 0.15,
      particleBrightness: 0.2,
      particleCount: 4,
      particleSpeed: 0.95,
      particleLifetime: 0.9,
      flashIntensity: 1.08,
      hitLineIntensity: 2.35,
      hitLineWaveIntensity: 0.78,
      bloomIntensity: 0.64,
      bloomThreshold: 0.18,
      bloomRadius: 0.75,
      keyboardBrightness: 0.48,
      keyGlowIntensity: 1.7,
      cameraFov: 32,
      cameraPos: [0, 0, 11.9],
      backgroundColor: '#050916',
    }, -0.08),

    // ~1:49 — tension immediately before the peak.
    cue(duration, 109, {
      noteColor: '#bce9ff',
      noteEmissive: 1.28,
      particleOpacity: 0.2,
      particleBrightness: 0.26,
      particleCount: 5,
      particleSpeed: 1.08,
      particleTurbulence: 0.72,
      flashIntensity: 1.25,
      hitLineIntensity: 2.75,
      hitLineWaveIntensity: 0.95,
      bloomIntensity: 0.8,
      bloomThreshold: 0.15,
      bloomRadius: 0.82,
      keyboardBrightness: 0.52,
      keyGlowIntensity: 2.05,
      cameraFov: 32.8,
      cameraPos: [0, 0, 11.7],
      backgroundColor: '#060b1a',
    }, -0.18),

    // ~2:01 — main emotional climax.
    cue(duration, 121, {
      noteColor: '#dcf4ff',
      noteEmissive: 1.5,
      noteOpacity: 1,
      particleOpacity: 0.27,
      particleBrightness: 0.34,
      particleCount: 7,
      particleSpeed: 1.2,
      particleLifetime: 1.0,
      particleTurbulence: 0.9,
      flashIntensity: 1.48,
      flashBrightness: 0.7,
      hitLineIntensity: 3.2,
      hitLineWaveIntensity: 1.2,
      bloomIntensity: 1.02,
      bloomThreshold: 0.12,
      bloomRadius: 0.88,
      keyboardBrightness: 0.57,
      keyGlowIntensity: 2.5,
      cameraFov: 34,
      cameraPos: [0, 0, 11.5],
      backgroundColor: '#071020',
    }, 0.08),

    // ~2:10 — release after the climax.
    cue(duration, 130, {
      noteColor: '#a7ddff',
      noteEmissive: 1.05,
      particleOpacity: 0.12,
      particleBrightness: 0.16,
      particleCount: 3,
      particleSpeed: 0.82,
      particleTurbulence: 0.48,
      flashIntensity: 0.9,
      hitLineIntensity: 1.95,
      hitLineWaveIntensity: 0.52,
      bloomIntensity: 0.52,
      bloomThreshold: 0.22,
      bloomRadius: 0.7,
      keyboardBrightness: 0.42,
      keyGlowIntensity: 1.45,
      cameraFov: 31.8,
      cameraPos: [0, 0, 12.1],
      backgroundColor: '#03060f',
    }, 0.22),

    // ~2:28 — "time stops": almost all motion and light disappear.
    cue(duration, 148, {
      noteColor: '#718fb8',
      noteEmissive: 0.62,
      noteOpacity: 0.8,
      particleOpacity: 0,
      particleBrightness: 0,
      particleCount: 0,
      particleSpeed: 0.45,
      particleTurbulence: 0.18,
      flashIntensity: 0.42,
      flashBrightness: 0.32,
      hitLineIntensity: 0.75,
      hitLineWaveIntensity: 0.12,
      bloomIntensity: 0.18,
      bloomThreshold: 0.34,
      bloomRadius: 0.5,
      keyboardBrightness: 0.29,
      keyGlowIntensity: 0.72,
      cameraFov: 30.7,
      cameraPos: [0, 0, 12.65],
      backgroundColor: '#010207',
    }, 0.26),

    // ~2:45 — memory/reprise: warmth returns carefully.
    cue(duration, 165, {
      noteColor: '#99cfff',
      noteEmissive: 0.9,
      noteOpacity: 0.94,
      particleOpacity: 0.065,
      particleBrightness: 0.1,
      particleCount: 2,
      particleSpeed: 0.65,
      particleTurbulence: 0.36,
      flashIntensity: 0.72,
      flashBrightness: 0.46,
      hitLineIntensity: 1.45,
      hitLineWaveIntensity: 0.36,
      bloomIntensity: 0.42,
      bloomThreshold: 0.25,
      bloomRadius: 0.64,
      keyboardBrightness: 0.38,
      keyGlowIntensity: 1.22,
      cameraFov: 31.3,
      cameraPos: [0, 0, 12.25],
      backgroundColor: '#02040b',
    }, -0.08),

    // ~3:15 — dissolve toward the coda.
    cue(duration, 195, {
      noteColor: '#aedfff',
      noteEmissive: 0.98,
      particleOpacity: 0.045,
      particleBrightness: 0.09,
      particleCount: 1,
      particleSpeed: 0.55,
      flashIntensity: 0.68,
      hitLineIntensity: 1.25,
      hitLineWaveIntensity: 0.28,
      bloomIntensity: 0.38,
      bloomThreshold: 0.27,
      bloomRadius: 0.66,
      keyboardBrightness: 0.36,
      keyGlowIntensity: 1.1,
      cameraFov: 31,
      cameraPos: [0, 0, 12.35],
      backgroundColor: '#020309',
    }, 0.12),

    // ~3:40 to the end — high bell motif + luminous final chord/tail.
    cue(duration, 220, {
      noteColor: '#dff6ff',
      noteEmissive: 1.22,
      noteOpacity: 0.98,
      particleOpacity: 0.07,
      particleBrightness: 0.18,
      particleCount: 2,
      particleSpeed: 0.48,
      particleLifetime: 1.05,
      particleTurbulence: 0.28,
      flashIntensity: 0.82,
      flashBrightness: 0.72,
      hitLineIntensity: 1.65,
      hitLineWaveIntensity: 0.42,
      bloomIntensity: 0.78,
      bloomThreshold: 0.14,
      bloomRadius: 0.86,
      keyboardBrightness: 0.42,
      keyGlowIntensity: 1.65,
      cameraFov: 31.2,
      cameraPos: [0, 0, 12.2],
      backgroundColor: '#02050d',
    }, 0.18),
  ]

  return {
    // Visual identity: elegant ice-blue moonlight, not an arcade glow.
    themeColor: '#91d4ff',
    fallDurationSec: 3.0,
    noteColor: '#8ccfff',
    trackColors: {},
    noteEmissive: 0.9,
    noteOpacity: 0.92,
    noteCornerRadius: 0.055,
    noteWidthScale: 0.98,
    noteTexture: 'solid',
    edgeEnabled: true,
    noteEdgeColor: '#eaf8ff',
    noteEdgeWidth: 0.008,
    noteEdgeIntensity: 1.45,

    flashEnabled: true,
    flashFollowNote: true,
    flashBrightness: 0.48,
    flashIntensity: 0.82,
    flashSize: 2.25,
    flashWidth: 2.2,
    flashHaloWidth: 0.62,

    particlesEnabled: true,
    particleColor: '#a9e4ff',
    particleSize: 0.88,
    particleOpacity: 0.08,
    particleBrightness: 0.12,
    particleLifetime: 0.82,
    particleSpeed: 0.75,
    particleCount: 2,
    particleTurbulence: 0.5,
    turbulenceFrequency: 1.2,
    flowSpeed: 2.4,
    turbulenceX: 0.58,
    turbulenceY: 0.32,
    turbulenceZ: 0.32,
    noiseLocality: 0.86,
    drag: 0.16,
    swirl: 0.05,
    kick: 0,

    hitLineEnabled: true,
    hitLineColor: '#86ceff',
    hitLineIntensity: 1.8,
    hitLineThickness: 0.22,
    hitLineWaveEnabled: true,
    hitLineWaveIntensity: 0.5,
    hitLineWaveAmplitude: 0.12,
    hitLineWaveScale: 55,
    hitLineWaveScrollSpeed: -0.24,
    hitLineWaveMorphSpeed: 0.38,
    hitLineWaveThickness: 0.032,
    hitLineWaveGrain: 0.45,
    hitLineBarHalo: 1.65,
    hitLineWaveHalo: 0.68,

    bloomEnabled: true,
    bloomIntensity: 0.36,
    bloomThreshold: 0.26,
    bloomRadius: 0.62,
    bloomSmoothing: 0.42,
    backgroundColor: '#03050b',

    whiteKeyColor: '#f2f6fb',
    blackKeyColor: '#11141a',
    woodColor: '#403b36',
    keyboardBrightness: 0.4,
    keyGlowEnabled: true,
    keyGlowFollowNote: true,
    keyGlowIntensity: 1.15,
    keyGlowDecay: 0.075,

    // Piano profile: warm, clear, restrained hall ambience.
    volume: 0.82,
    midiVolume: 0.94,
    midiEnabled: true,
    pedalEnabled: true,
    reverbEnabled: true,
    reverbDry: 0.95,
    reverbWet: 0.3,
    reverbSize: 3.8,
    reverbDecayTime: 3.15,
    reverbDecay: 1.24,
    reverbPreDelay: 0.022,
    reverbDamping: 0.58,
    reverbHiCut: 5200,
    reverbLowCut: 135,
    releaseTime: 0.58,
    eqBands: [-7, -3, -0.5, 1.4, 0.8, -0.4],
    velocityCurve: {
      p0: { x: 0, y: 0 },
      p1: { x: 32 / 127, y: 16 / 127 },
      p2: { x: 64 / 127, y: 47 / 127 },
      p3: { x: 96 / 127, y: 103 / 127 },
      p4: { x: 1, y: 1 },
    },
    velocityCompensation: 0.82,

    settingsKeyframes,
  }
}

export function looksLikeMoonlitReveriePreset(settings: Settings): boolean {
  return (
    settings.settingsKeyframes.length === MOONLIT_KEYFRAME_COUNT &&
    settings.backgroundColor === '#03050b' &&
    settings.noteColor === '#8ccfff' &&
    settings.reverbWet === 0.3 &&
    settings.reverbDecayTime === 3.15
  )
}
