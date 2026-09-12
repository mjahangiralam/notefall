import type { Settings } from '../store'
import type { ParsedSong } from '../midi/types'
import type { ExpressionPoint } from '../midi/expressionMap'
import type { SpeedPoint } from '../midi/speedMap'
import type { SettingsKeyframe } from '../midi/settingsKeyframes'
import { analyzeSong } from './analyzeSong'
import { generateSmartDynamics } from './smartDynamics'
import { generateSmartSpeed } from './smartSpeed'
import { generateSmartPins } from './smartPins'

export type SmartAutomationResult = {
  expressions: ExpressionPoint[]
  speed: SpeedPoint[]
  pins: SettingsKeyframe[]
}

/**
 * Generate the three editable automation layers from one shared musical
 * profile. Speed is generated before pins because visual keyframes live in
 * timeline-time while analysis events live in MIDI-time; passing the new speed
 * curve to Smart Pins keeps diamonds aligned after rubato is applied.
 */
export function generateSmartAutomation(
  song: ParsedSong,
  settings: Settings,
): SmartAutomationResult {
  const analysis = analyzeSong(song)
  const expressions = generateSmartDynamics(song, analysis)
  const speed = generateSmartSpeed(
    song,
    analysis,
    settings.midiSpeedAutomation ?? [],
  )
  const pins = generateSmartPins(analysis, settings, speed)
  return { expressions, speed, pins }
}
