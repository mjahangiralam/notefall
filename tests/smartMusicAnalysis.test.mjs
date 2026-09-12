import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

async function loadTsModule(relativePath) {
  const url = new URL(relativePath, import.meta.url)
  let source = ''
  try {
    source = await readFile(url, 'utf8')
  } catch {
    assert.fail(`${relativePath} is missing`)
  }
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: relativePath,
  })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}

function note(id, time, duration, midi, velocity, track = 0) {
  return { id, time, duration, midi, velocity, track }
}

function makeSong({ duration = 60, notes = [], expressions = [], pedals = [] } = {}) {
  return {
    name: 'Synthetic',
    duration,
    notes,
    pedals,
    expressions,
    tracks: [{ name: 'Piano', hasNotes: notes.length > 0 }],
  }
}

function structuredSong() {
  const notes = []
  let id = 0
  const addRegion = (start, end, step, velocity, chord = 1, baseMidi = 60) => {
    for (let t = start; t < end; t += step) {
      for (let j = 0; j < chord; j++) {
        notes.push(note(id++, t, Math.min(step * 0.9, 0.7), baseMidi + j * 4, velocity))
      }
    }
  }
  // Restrained opening.
  addRegion(0, 12, 1.2, 0.42, 1, 60)
  // Build.
  addRegion(12, 24, 0.65, 0.64, 2, 62)
  // Dense/loud climax.
  addRegion(24, 31, 0.28, 0.92, 4, 64)
  // Release.
  addRegion(31, 38, 0.9, 0.52, 2, 59)
  // Deliberate sparse/time-stops region with a meaningful gap.
  addRegion(40, 44, 2.0, 0.32, 1, 72)
  // Resurfacing.
  addRegion(47, 56, 0.7, 0.68, 2, 62)
  // Coda taper.
  addRegion(56, 60, 1.25, 0.36, 1, 67)
  return makeSong({ duration: 60, notes })
}

test('smart analyzer is safe for an empty song', async () => {
  const { analyzeSong } = await loadTsModule('../src/musicAnalysis/analyzeSong.ts')
  const result = analyzeSong(makeSong({ duration: 0 }))
  assert.equal(result.duration, 0)
  assert.deepEqual(result.windows, [])
  assert.deepEqual(result.events, [])
  assert.equal(result.climaxTime, null)
})

test('smart analyzer keeps intensity normalized', async () => {
  const { analyzeSong } = await loadTsModule('../src/musicAnalysis/analyzeSong.ts')
  const result = analyzeSong(structuredSong())
  assert.ok(result.windows.length > 10)
  for (const w of result.windows) {
    assert.ok(w.intensity >= 0 && w.intensity <= 1, `intensity ${w.intensity} out of bounds`)
  }
})

test('smart analyzer finds the intended dense loud climax', async () => {
  const { analyzeSong } = await loadTsModule('../src/musicAnalysis/analyzeSong.ts')
  const result = analyzeSong(structuredSong())
  assert.ok(result.climaxTime !== null)
  assert.ok(result.climaxTime >= 23 && result.climaxTime <= 32, `unexpected climax at ${result.climaxTime}`)
  assert.ok(result.events.some((e) => e.kind === 'climax'))
})

test('smart analyzer detects sparse passage and later resurfacing', async () => {
  const { analyzeSong } = await loadTsModule('../src/musicAnalysis/analyzeSong.ts')
  const result = analyzeSong(structuredSong())
  const sparse = result.events.find((e) => e.kind === 'sparse' && e.time >= 38 && e.time <= 47)
  const resurface = result.events.find((e) => e.kind === 'resurface' && e.time >= 45 && e.time <= 57)
  assert.ok(sparse, 'expected sparse event near the deliberate gap')
  assert.ok(resurface, 'expected resurfacing after the sparse passage')
})
