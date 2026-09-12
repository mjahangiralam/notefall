import { readFileSync, writeFileSync } from 'node:fs'

function patch(path, mutate) {
  const before = readFileSync(path, 'utf8')
  const after = mutate(before)
  if (after === before) return false
  writeFileSync(path, after)
  return true
}
function mustReplace(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Missing anchor: ${label}`)
  return text.replace(from, to)
}

const changed = []

if (patch('src/audio/engine.ts', (text) => {
  const misplaced = `\n    // CC11 is a continuous gain, independent of note velocity. Updating the\n    // sampler gain every engine tick lets held/pedalled notes crescendo and\n    // diminuendo instead of freezing dynamics at note-on.\n    if (!this.silent && this.piano) {\n      this.piano.setExpression(expressionAt(this.song.expressions, midiSongTime))\n    }`
  if (text.includes(misplaced)) text = text.replace(misplaced, '')
  const tickAnchor = `    const midiSongTime = timelineToMidi(\n      this.speedMap,\n      songTime - this.midiOffsetSec,\n    )\n\n    // process pedal events`
  const tickReplacement = `    const midiSongTime = timelineToMidi(\n      this.speedMap,\n      songTime - this.midiOffsetSec,\n    )\n\n    // CC11 is a continuous gain, independent of note velocity. Updating the\n    // sampler gain every engine tick lets held/pedalled notes crescendo and\n    // diminuendo instead of freezing dynamics at note-on.\n    if (!this.silent && this.piano) {\n      this.piano.setExpression(expressionAt(this.song.expressions, midiSongTime))\n    }\n\n    // process pedal events`
  if (!text.includes('this.piano.setExpression(expressionAt(this.song.expressions, midiSongTime))')) {
    text = mustReplace(text, tickAnchor, tickReplacement, 'tick expression anchor')
  } else if (!text.includes(`${tickReplacement}`)) {
    text = mustReplace(text, tickAnchor, tickReplacement, 'tick expression move')
  }
  return text
})) changed.push('src/audio/engine.ts')

if (patch('src/scene/EditTools.tsx', (text) => {
  if (text.includes('  expressions: [],')) return text
  return mustReplace(
    text,
    `  notes: [],\n  pedals: [],\n  tracks: [],`,
    `  notes: [],\n  pedals: [],\n  expressions: [],\n  tracks: [],`,
    'empty song expressions',
  )
})) changed.push('src/scene/EditTools.tsx')

console.log(changed.length ? `Fixed: ${changed.join(', ')}` : 'No follow-up fixes needed')
