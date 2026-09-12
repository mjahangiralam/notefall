import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

async function loadAnalyzeSong() {
  const url = new URL('../src/musicAnalysis/analyzeSong.ts', import.meta.url)
  let source = ''
  try { source = await readFile(url, 'utf8') } catch { assert.fail('analyzeSong.ts is missing') }
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    fileName: url.pathname,
  })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}

function relativeTroughSong() {
  const notes = []
  let id = 0
  const add = (start, end, step, duration, velocity, chord = 1, base = 60) => {
    for (let t = start; t < end; t += step) {
      for (let j = 0; j < chord; j++) {
        notes.push({ id: id++, time: t, duration, midi: base + j * 4, velocity, track: 0 })
      }
    }
  }
  // Active material on both sides.
  add(0, 45, 0.7, 0.6, 0.68, 2, 60)
  // Sparse but continuously sustained middle: low onset density with long notes,
  // so there is no literal silent gap for phrase-gap detection to rely on.
  add(45, 70, 2.5, 2.45, 0.52, 1, 72)
  add(70, 120, 0.65, 0.58, 0.72, 2, 62)
  return {
    name: 'Relative trough', duration: 120, notes, pedals: [], expressions: [],
    tracks: [{ name: 'Piano', hasNotes: true }],
  }
}

test('analyzer detects a sustained relative sparse trough without literal silence', async () => {
  const { analyzeSong } = await loadAnalyzeSong()
  const result = analyzeSong(relativeTroughSong())
  const sparse = result.events.find((e) => e.kind === 'sparse' && e.time >= 48 && e.time <= 68)
  const resurface = result.events.find((e) => e.kind === 'resurface' && e.time >= 68 && e.time <= 82)
  assert.ok(sparse, 'expected the lower-density sustained middle to count as sparse relative to its context')
  assert.ok(resurface, 'expected the active return after the relative trough to count as resurfacing')
})
