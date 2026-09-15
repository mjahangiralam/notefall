import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

async function loadModule() {
  const url = new URL('../src/notes/trackPalette.ts', import.meta.url)
  let source = ''
  try {
    source = await readFile(url, 'utf8')
  } catch {
    assert.fail('src/notes/trackPalette.ts is missing; implement automatic distinct track colours')
  }
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: 'trackPalette.ts',
  })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}

const tracks = (...noteFlags) => noteFlags.map((hasNotes, i) => ({
  name: `Track ${i + 1}`,
  hasNotes,
}))

test('single note track keeps the global note colour behavior', async () => {
  const { buildDefaultTrackColors } = await loadModule()
  assert.deepEqual(buildDefaultTrackColors(tracks(false, true), '#5ad7ff'), {})
})

test('multi-track MIDI receives a distinct explicit colour for every note track', async () => {
  const { buildDefaultTrackColors } = await loadModule()
  const colors = buildDefaultTrackColors(tracks(false, true, true, true, true, true), '#5ad7ff')
  assert.deepEqual(Object.keys(colors), ['1', '2', '3', '4', '5'])
  assert.equal(new Set(Object.values(colors)).size, 5)
})

test('non-note/meta tracks do not consume palette slots', async () => {
  const { buildDefaultTrackColors } = await loadModule()
  const colors = buildDefaultTrackColors(tracks(false, true, false, true), '#5ad7ff')
  assert.deepEqual(Object.keys(colors), ['1', '3'])
  assert.notEqual(colors['1'], colors['3'])
})

test('large multi-track MIDI continues generating unique colours after curated palette is exhausted', async () => {
  const { buildDefaultTrackColors } = await loadModule()
  const manyTracks = Array.from({ length: 32 }, (_, i) => ({
    name: `Part ${i + 1}`,
    hasNotes: true,
  }))
  const colors = buildDefaultTrackColors(manyTracks, '#5ad7ff')
  assert.equal(Object.keys(colors).length, 32)
  assert.equal(new Set(Object.values(colors).map((c) => c.toLowerCase())).size, 32)
})
