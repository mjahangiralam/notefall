import { readFileSync, writeFileSync } from 'node:fs'

function read(path) { return readFileSync(path, 'utf8') }
function write(path, text) { writeFileSync(path, text) }
function ensure(path, marker, mutate) {
  let text = read(path)
  if (text.includes(marker)) return false
  const next = mutate(text)
  if (next === text) throw new Error(`Patch made no change: ${path} / ${marker}`)
  write(path, next)
  return true
}
function replaceRequired(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Missing patch anchor: ${label}`)
  return text.replace(from, to)
}

const changed = []

if (ensure('src/midi/types.ts', 'expressions: ExpressionPoint[]', (text) => {
  text = `import type { ExpressionPoint } from './expressionMap'\n\n${text}`
  return replaceRequired(
    text,
    '  pedals: PedalEvent[]\n  tracks: TrackInfo[]',
    '  pedals: PedalEvent[]\n  /** MIDI CC11 expression automation, in MIDI-time seconds. */\n  expressions: ExpressionPoint[]\n  tracks: TrackInfo[]',
    'ParsedSong expressions',
  )
})) changed.push('src/midi/types.ts')

if (ensure('src/midi/parse.ts', 'normalizeExpressionPoints', (text) => {
  text = text.replace(
    "import type { ParsedSong, NoteEvent, PedalEvent, TrackInfo } from './types'",
    "import type { ParsedSong, NoteEvent, PedalEvent, TrackInfo } from './types'\nimport { normalizeExpressionPoints, type ExpressionPoint } from './expressionMap'",
  )
  text = replaceRequired(
    text,
    '  const pedals: PedalEvent[] = []\n  const tracks: TrackInfo[] = []',
    '  const pedals: PedalEvent[] = []\n  const expressions: ExpressionPoint[] = []\n  const tracks: TrackInfo[] = []',
    'parse expression array',
  )
  const cc64 = `    const cc64 = track.controlChanges[64]\n    if (cc64) {\n      cc64.forEach((cc) => {\n        pedals.push({ time: cc.time, value: cc.value })\n      })\n    }`
  text = replaceRequired(
    text,
    cc64,
    `${cc64}\n    const cc11 = track.controlChanges[11]\n    if (cc11) {\n      cc11.forEach((cc) => {\n        expressions.push({ time: cc.time, value: cc.value })\n      })\n    }`,
    'parse CC11',
  )
  text = replaceRequired(
    text,
    '  pedals.sort((a, b) => a.time - b.time)\n\n  return {\n    name,\n    duration: midi.duration,\n    notes,\n    pedals,\n    tracks,',
    '  pedals.sort((a, b) => a.time - b.time)\n\n  return {\n    name,\n    duration: midi.duration,\n    notes,\n    pedals,\n    expressions: normalizeExpressionPoints(expressions),\n    tracks,',
    'return CC11',
  )
  return text
})) changed.push('src/midi/parse.ts')

if (ensure('src/midi/serialize.ts', 'song.expressions', (text) => {
  text = text.replace(
    'the data the editor cares about (notes + sustain pedal CC#64).',
    'the data the editor cares about (notes + sustain pedal CC#64 + expression CC#11).',
  )
  text = replaceRequired(
    text,
    `    if (song.pedals.length > 0 && noteTrackIndices.length > 0) {\n      const pedalTrack = trackByIdx.get(noteTrackIndices[0])!\n      for (const p of song.pedals) {\n        pedalTrack.addCC({ number: 64, time: p.time, value: p.value })\n      }\n    }`,
    `    if (noteTrackIndices.length > 0) {\n      const controllerTrack = trackByIdx.get(noteTrackIndices[0])!\n      for (const p of song.pedals) {\n        controllerTrack.addCC({ number: 64, time: p.time, value: p.value })\n      }\n      for (const p of song.expressions) {\n        controllerTrack.addCC({ number: 11, time: p.time, value: p.value })\n      }\n    }`,
    'serialize preserve-track CC11',
  )
  text = replaceRequired(
    text,
    `    for (const p of song.pedals) {\n      track.addCC({ number: 64, time: p.time, value: p.value })\n    }`,
    `    for (const p of song.pedals) {\n      track.addCC({ number: 64, time: p.time, value: p.value })\n    }\n    for (const p of song.expressions) {\n      track.addCC({ number: 11, time: p.time, value: p.value })\n    }`,
    'serialize single-track CC11',
  )
  return text
})) changed.push('src/midi/serialize.ts')

if (ensure('src/audio/sampler.ts', 'scheduleExpression(points', (text) => {
  text = replaceRequired(
    text,
    '  /** Linear gain on the dry (un-reverbed) signal. 1 = unity, 0 = mute. */',
    `  /** Continuous MIDI CC11 expression gain. 1 = unity, 0 = silence. */\n  setExpression(value: number): void\n  /** Schedule a pre-sampled expression curve for OfflineAudioContext export. */\n  scheduleExpression(points: readonly { time: number; value: number }[]): void\n  /** Linear gain on the dry (un-reverbed) signal. 1 = unity, 0 = mute. */`,
    'PianoInstrument expression API',
  )
  text = replaceRequired(
    text,
    '  const masterGain = context.createGain()\n  const dryGain = context.createGain()',
    '  const expressionGain = context.createGain()\n  const masterGain = context.createGain()\n  const dryGain = context.createGain()',
    'expression gain node',
  )
  text = replaceRequired(
    text,
    '  masterGain.gain.value = 1\n  dryGain.gain.value = 1',
    '  expressionGain.gain.value = 1\n  masterGain.gain.value = 1\n  dryGain.gain.value = 1',
    'expression gain initial value',
  )
  text = replaceRequired(
    text,
    '  // Wire master → eq chain (in series) → split to dry/wet\n  masterGain.connect(eqFilters[0])',
    '  // Wire expression → master → eq chain (in series) → split to dry/wet.\n  // Expression is separate from master volume so CC11 can swell notes that\n  // are already sustaining without mutating the user\'s mixer setting.\n  expressionGain.connect(masterGain)\n  masterGain.connect(eqFilters[0])',
    'connect expression gain',
  )
  text = replaceRequired(
    text,
    '      destination: masterGain,',
    '      destination: expressionGain,',
    'smplr expression destination',
  )
  text = replaceRequired(
    text,
    `    setReverbDry(level) {`,
    `    setExpression(value) {\n      const v = Math.max(0, Math.min(1, value))\n      const now = context.currentTime\n      expressionGain.gain.cancelScheduledValues(now)\n      expressionGain.gain.setTargetAtTime(v, now, 0.01)\n    },\n    scheduleExpression(points) {\n      const param = expressionGain.gain\n      param.cancelScheduledValues(0)\n      if (points.length === 0) {\n        param.setValueAtTime(1, 0)\n        return\n      }\n      let lastTime = -Infinity\n      for (let i = 0; i < points.length; i++) {\n        const p = points[i]\n        const time = Math.max(0, p.time)\n        const value = Math.max(0, Math.min(1, p.value))\n        if (i === 0 || time <= lastTime + 1e-9) {\n          param.setValueAtTime(value, time)\n        } else {\n          param.linearRampToValueAtTime(value, time)\n        }\n        lastTime = time\n      }\n    },\n    setReverbDry(level) {`,
    'expression methods',
  )
  text = replaceRequired(
    text,
    '      safeDisconnect(masterGain)',
    '      safeDisconnect(expressionGain)\n      safeDisconnect(masterGain)',
    'dispose expression gain',
  )
  return text
})) changed.push('src/audio/sampler.ts')

if (ensure('src/audio/engine.ts', "from '../midi/expressionMap'", (text) => {
  text = text.replace(
    "import { DEFAULT_VELOCITY_COMPENSATION } from './salamanderDescriptor'",
    "import { DEFAULT_VELOCITY_COMPENSATION } from './salamanderDescriptor'\nimport { expressionAt, expressionVisualScale } from '../midi/expressionMap'",
  )
  text = replaceRequired(
    text,
    '    this.song = song\n    this.noteIdx = 0',
    '    this.song = song\n    this.piano?.setExpression(expressionAt(song.expressions, 0))\n    this.noteIdx = 0',
    'engine load expression',
  )
  text = replaceRequired(
    text,
    '    this.song = song\n    this.recomputeIndices(t)\n  }',
    '    this.song = song\n    this.recomputeIndices(t)\n    this.piano?.setExpression(expressionAt(song.expressions, this.currentMidiTime()))\n  }',
    'engine update expression',
  )
  text = replaceRequired(
    text,
    '    this.song = null\n    this.noteIdx = 0',
    '    this.song = null\n    this.piano?.setExpression(1)\n    this.noteIdx = 0',
    'engine unload expression',
  )
  text = replaceRequired(
    text,
    `    const ctxNow = this.piano?.context.currentTime ?? 0`,
    `    this.piano?.setExpression(\n      expressionAt(this.song?.expressions ?? [], midiClamped),\n    )\n\n    const ctxNow = this.piano?.context.currentTime ?? 0`,
    'seek expression',
  )
  const currentMidiBlock = `  currentMidiTime(): number {\n    return timelineToMidi(this.speedMap, this.currentSongTime() - this.midiOffsetSec)\n  }`
  text = replaceRequired(
    text,
    currentMidiBlock,
    `${currentMidiBlock}\n\n  /** Current MIDI CC11 value at the audible playhead. */\n  currentExpression(): number {\n    if (!this.song) return 1\n    return expressionAt(this.song.expressions, this.currentMidiTime())\n  }\n\n  /** Subtle visual multiplier; strict no-op for songs without CC11. */\n  currentExpressionVisualScale(): number {\n    return expressionVisualScale(\n      this.currentExpression(),\n      (this.song?.expressions.length ?? 0) > 0,\n    )\n  }`,
    'engine expression getters',
  )
  const midiCursor = `    const midiSongTime = timelineToMidi(\n      this.speedMap,\n      songTime - this.midiOffsetSec,\n    )`
  text = replaceRequired(
    text,
    midiCursor,
    `${midiCursor}\n\n    // CC11 is a continuous gain, independent of note velocity. Updating the\n    // sampler gain every engine tick lets held/pedalled notes crescendo and\n    // diminuendo instead of freezing dynamics at note-on.\n    if (!this.silent && this.piano) {\n      this.piano.setExpression(expressionAt(this.song.expressions, midiSongTime))\n    }`,
    'tick expression',
  )
  return text
})) changed.push('src/audio/engine.ts')

if (ensure('src/export/renderAudio.ts', 'scheduleExpression(', (text) => {
  text = text.replace(
    "import { buildSpeedMap, midiToTimeline } from '../midi/speedMap'",
    "import { buildSpeedMap, midiToTimeline, timelineToMidi } from '../midi/speedMap'",
  )
  text = text.replace(
    "import { evaluateVelocityCurve } from '../audio/velocityCurve'",
    "import { evaluateVelocityCurve } from '../audio/velocityCurve'\nimport { expressionAt } from '../midi/expressionMap'",
  )
  const eqBlock = `    for (let i = 0; i < settings.eqBands.length; i++) {\n      piano.setEqBand(i, settings.eqBands[i])\n    }`
  text = replaceRequired(
    text,
    eqBlock,
    `${eqBlock}\n\n    // OfflineAudioContext needs the whole CC11 curve scheduled up-front.\n    // Sample in TL_audio at 50 Hz so the exported gain follows the same\n    // MIDI-time expression curve even through non-linear speed automation.\n    if (song.expressions.length === 0) {\n      piano.scheduleExpression([{ time: 0, value: 1 }])\n    } else {\n      const expressionSchedule: Array<{ time: number; value: number }> = [\n        { time: 0, value: expressionAt(song.expressions, midiTrimStart) },\n      ]\n      const startTl = Math.max(0, midiOffset + midiToTimeline(speedMap, midiTrimStart))\n      const endTl = Math.max(startTl, midiOffset + midiToTimeline(speedMap, midiTrimEnd))\n      const step = 0.02\n      for (let t = startTl; t < endTl; t += step) {\n        const midiT = timelineToMidi(speedMap, t - midiOffset)\n        expressionSchedule.push({\n          time: t,\n          value: expressionAt(song.expressions, midiT),\n        })\n      }\n      expressionSchedule.push({\n        time: endTl,\n        value: expressionAt(song.expressions, midiTrimEnd),\n      })\n      piano.scheduleExpression(expressionSchedule)\n    }`,
    'offline expression schedule',
  )
  return text
})) changed.push('src/export/renderAudio.ts')

if (ensure('src/store.ts', 'for (const p of song.expressions)', (text) => {
  return replaceRequired(
    text,
    `  for (const p of song.pedals) {\n    acc += \`${'${p.time.toFixed(6)},${p.value.toFixed(4)};'}\`\n  }\n  return acc`,
    `  for (const p of song.pedals) {\n    acc += \`${'${p.time.toFixed(6)},${p.value.toFixed(4)};'}\`\n  }\n  acc += '|expr|'\n  for (const p of song.expressions) {\n    acc += \`${'${p.time.toFixed(6)},${p.value.toFixed(4)};'}\`\n  }\n  return acc`,
    'dirty hash expression',
  )
})) changed.push('src/store.ts')

if (ensure('src/keyboard/Keyboard.tsx', 'currentExpressionVisualScale()', (text) => {
  text = replaceRequired(
    text,
    '    const brightness = rs.keyboardBrightness;\n    const pressK =',
    '    const brightness = rs.keyboardBrightness;\n    const dynamicsScale = audioEngine.currentExpressionVisualScale();\n    const pressK =',
    'keyboard dynamics scale',
  )
  text = replaceRequired(
    text,
    '        mat.emissiveIntensity = e * rs.keyGlowIntensity * brightness;',
    '        mat.emissiveIntensity =\n          e * rs.keyGlowIntensity * brightness * dynamicsScale;',
    'keyboard emissive dynamics',
  )
  text = replaceRequired(
    text,
    '      LIGHT_BOOST_BASE * (rs.flashIntensity / DEFAULT_FLASH_INTENSITY);',
    '      LIGHT_BOOST_BASE *\n      (rs.flashIntensity / DEFAULT_FLASH_INTENSITY) *\n      dynamicsScale;',
    'keyboard flash dynamics',
  )
  return text
})) changed.push('src/keyboard/Keyboard.tsx')

if (ensure('src/ui/TimelineEditor.tsx', 'ExpressionAutomationLane', (text) => {
  text = text.replace(
    "import { Timeline } from './Timeline'",
    "import { Timeline } from './Timeline'\nimport { ExpressionAutomationLane } from './ExpressionAutomationLane'",
  )
  return replaceRequired(
    text,
    '{song ? <Timeline /> : <EmptyState />}',
    `{song ? (\n            <div className="flex flex-col gap-1">\n              <Timeline />\n              <ExpressionAutomationLane />\n            </div>\n          ) : (\n            <EmptyState />\n          )}`,
    'timeline expression lane mount',
  )
})) changed.push('src/ui/TimelineEditor.tsx')

console.log(changed.length ? `Patched: ${changed.join(', ')}` : 'Expression feature already applied')
