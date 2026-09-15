import { readFile, writeFile } from 'node:fs/promises'

const path = 'src/store.ts'
let source = await readFile(path, 'utf8')

function replaceOnce(label, before, after) {
  const first = source.indexOf(before)
  if (first < 0) throw new Error(`${label}: expected source block not found`)
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${label}: source block is ambiguous`)
  }
  source = source.replace(before, after)
}

replaceOnce(
  'track palette import',
  `} from './audio/velocityCurve'\n`,
  `} from './audio/velocityCurve'\nimport { buildDefaultTrackColors } from './notes/trackPalette'\n`,
)

replaceOnce(
  'song-tied track settings',
  `const SONG_TIED_KEYS = [\n  // Per-track instrument choices belong to the loaded MIDI's track indices.\n  'trackInstruments',\n`,
  `const SONG_TIED_KEYS = [\n  // Per-track visual/audio choices belong to the loaded MIDI's track indices.\n  'trackColors',\n  'trackInstruments',\n`,
)

replaceOnce(
  'new MIDI track palette',
  `        const next = { ...settings } as Record<string, unknown>\n        for (const k of SONG_TIED_KEYS) next[k as string] = defaultSettings[k]\n        settings = next as Settings\n`,
  `        const next = { ...settings } as Record<string, unknown>\n        for (const k of SONG_TIED_KEYS) next[k as string] = defaultSettings[k]\n        next.trackColors = buildDefaultTrackColors(song?.tracks ?? [], settings.noteColor)\n        settings = next as Settings\n`,
)

replaceOnce(
  'Inspector reset track palette',
  `        for (const k of RESET_PRESERVED_KEYS) {\n          ;(settings as Record<string, unknown>)[k as string] = state.settings[k]\n        }\n`,
  `        for (const k of RESET_PRESERVED_KEYS) {\n          ;(settings as Record<string, unknown>)[k as string] = state.settings[k]\n        }\n        settings.trackColors = buildDefaultTrackColors(\n          state.song?.tracks ?? [],\n          settings.noteColor,\n        )\n`,
)

await writeFile(path, source)
console.log('Applied automatic multi-track color defaults to src/store.ts')
