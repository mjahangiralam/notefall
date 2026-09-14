import { readFile, writeFile } from 'node:fs/promises'

const path = 'src/store.ts'
let text = await readFile(path, 'utf8')
const before = `const SONG_TIED_KEYS = [\n  // Pins\n  'settingsKeyframes',\n  // MIDI clip position + length (trim)`
const after = `const SONG_TIED_KEYS = [\n  // Per-track instrument choices belong to the loaded MIDI's track indices.\n  'trackInstruments',\n  // Pins\n  'settingsKeyframes',\n  // MIDI clip position + length (trim)`
if (!text.includes(before)) throw new Error('Expected SONG_TIED_KEYS block not found')
text = text.replace(before, after)
await writeFile(path, text)
