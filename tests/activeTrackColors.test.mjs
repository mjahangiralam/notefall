import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

async function loadModule() {
  const url = new URL('../src/notes/activeTrackColors.ts', import.meta.url)
  let source = ''
  try {
    source = await readFile(url, 'utf8')
  } catch {
    assert.fail('src/notes/activeTrackColors.ts is missing; implement active per-track color bookkeeping')
  }
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: 'activeTrackColors.ts',
  })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}

test('overlapping tracks stay independently active until their own note-off', async () => {
  const { addActiveTrack, removeActiveTrack, activeTrackIndices } = await loadModule()
  const counts = new Map()

  addActiveTrack(counts, 1)
  addActiveTrack(counts, 2)
  addActiveTrack(counts, 1)
  assert.deepEqual(activeTrackIndices(counts), [1, 2])

  removeActiveTrack(counts, 1)
  assert.deepEqual(activeTrackIndices(counts), [1, 2])

  removeActiveTrack(counts, 1)
  assert.deepEqual(activeTrackIndices(counts), [2])
})

test('live input uses fallback color while tracked notes use their overrides', async () => {
  const { addActiveTrack, activeTrackColorHexes } = await loadModule()
  const counts = new Map()

  addActiveTrack(counts, undefined)
  addActiveTrack(counts, 3)

  assert.deepEqual(
    activeTrackColorHexes(counts, { '3': '#ff0000' }, '#00aaff'),
    ['#00aaff', '#ff0000'],
  )
})

test('multiple active tracks with the same configured color collapse to one stripe color', async () => {
  const { addActiveTrack, activeTrackColorHexes } = await loadModule()
  const counts = new Map()

  addActiveTrack(counts, 2)
  addActiveTrack(counts, 5)

  assert.deepEqual(
    activeTrackColorHexes(counts, { '2': '#33dd88', '5': '#33dd88' }, '#ffffff'),
    ['#33dd88'],
  )
})
