import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const moduleCache = new Map()

async function compileTsDataUrl(url) {
  const key = url.href
  if (moduleCache.has(key)) return moduleCache.get(key)
  let source = ''
  try {
    source = await readFile(url, 'utf8')
  } catch {
    assert.fail(`${url.pathname} is missing`)
  }
  let { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: url.pathname,
  })

  const specs = [...outputText.matchAll(/from\s+['"](\.[^'"]+)['"]/g)].map((m) => m[1])
  for (const spec of [...new Set(specs)]) {
    const suffix = /\.[cm]?[jt]sx?$/.test(spec) ? '' : '.ts'
    const depUrl = new URL(spec + suffix, url)
    const depDataUrl = await compileTsDataUrl(depUrl)
    outputText = outputText
      .split(`'${spec}'`).join(`'${depDataUrl}'`)
      .split(`"${spec}"`).join(`"${depDataUrl}"`)
  }
  const dataUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
  moduleCache.set(key, dataUrl)
  return dataUrl
}

async function loadTsModule(relativePath) {
  const url = new URL(relativePath, import.meta.url)
  return import(await compileTsDataUrl(url))
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

function structuredSong(expressions = []) {
  const notes = []
  let id = 0
  const addRegion = (start, end, step, velocity, chord = 1, baseMidi = 60) => {
    for (let t = start; t < end; t += step) {
      for (let j = 0; j < chord; j++) {
        notes.push(note(id++, t, Math.min(step * 0.9, 0.7), baseMidi + j * 4, velocity))
      }
    }
  }
  addRegion(0, 12, 1.2, 0.42, 1, 60)
  addRegion(12, 24, 0.65, 0.64, 2, 62)
  addRegion(24, 31, 0.28, 0.92, 4, 64)
  addRegion(31, 38, 0.9, 0.52, 2, 59)
  addRegion(40, 44, 2.0, 0.32, 1, 72)
  addRegion(47, 56, 0.7, 0.68, 2, 62)
  addRegion(56, 60, 1.25, 0.36, 1, 67)
  return makeSong({ duration: 60, notes, expressions })
}

function interpolate(points, time) {
  if (points.length === 0) return 1
  if (time <= points[0].time) return points[0].value
  if (time >= points.at(-1).time) return points.at(-1).value
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (time >= a.time && time <= b.time) {
      const u = (time - a.time) / Math.max(1e-9, b.time - a.time)
      return a.value + (b.value - a.value) * u
    }
  }
  return points.at(-1).value
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

test('smart dynamics creates a sparse bounded expressive curve', async () => {
  const { analyzeSong } = await loadTsModule('../src/musicAnalysis/analyzeSong.ts')
  const { generateSmartDynamics } = await loadTsModule('../src/musicAnalysis/smartDynamics.ts')
  const song = structuredSong()
  const points = generateSmartDynamics(song, analyzeSong(song))
  assert.ok(points.length >= 4 && points.length <= 18, `unexpected point count ${points.length}`)
  for (const p of points) {
    assert.ok(p.value >= 0.35 && p.value <= 1, `expression ${p.value} out of range`)
  }
  assert.ok(interpolate(points, 27) > interpolate(points, 42), 'climax should be louder than sparse passage')
})

test('smart dynamics preserves existing CC11 contour as a strong prior', async () => {
  const { analyzeSong } = await loadTsModule('../src/musicAnalysis/analyzeSong.ts')
  const { generateSmartDynamics } = await loadTsModule('../src/musicAnalysis/smartDynamics.ts')
  const plain = structuredSong()
  const prior = structuredSong([
    { time: 0, value: 0.85 },
    { time: 27, value: 0.4 },
    { time: 42, value: 0.75 },
    { time: 60, value: 0.7 },
  ])
  const plainCurve = generateSmartDynamics(plain, analyzeSong(plain))
  const priorCurve = generateSmartDynamics(prior, analyzeSong(prior))
  assert.ok(
    interpolate(priorCurve, 27) < interpolate(plainCurve, 27) - 0.08,
    'existing low CC11 at the climax should materially pull the smart result down',
  )
})

test('smart dynamics is deterministic', async () => {
  const { analyzeSong } = await loadTsModule('../src/musicAnalysis/analyzeSong.ts')
  const { generateSmartDynamics } = await loadTsModule('../src/musicAnalysis/smartDynamics.ts')
  const song = structuredSong()
  const analysis = analyzeSong(song)
  assert.deepEqual(generateSmartDynamics(song, analysis), generateSmartDynamics(song, analysis))
})
