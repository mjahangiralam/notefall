import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const moduleCache = new Map()
async function compileTsDataUrl(url) {
  const key = url.href
  if (moduleCache.has(key)) return moduleCache.get(key)
  let source = ''
  try { source = await readFile(url, 'utf8') } catch { assert.fail(`${url.pathname} is missing`) }
  let { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    fileName: url.pathname,
  })
  const specs = [...outputText.matchAll(/from\s+['"](\.[^'"]+)['"]/g)].map((m) => m[1])
  for (const spec of [...new Set(specs)]) {
    const suffix = /\.[cm]?[jt]sx?$/.test(spec) ? '' : '.ts'
    const depUrl = new URL(spec + suffix, url)
    const depDataUrl = await compileTsDataUrl(depUrl)
    outputText = outputText.split(`'${spec}'`).join(`'${depDataUrl}'`).split(`"${spec}"`).join(`"${depDataUrl}"`)
  }
  const dataUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
  moduleCache.set(key, dataUrl)
  return dataUrl
}
async function loadTsModule(relativePath) {
  return import(await compileTsDataUrl(new URL(relativePath, import.meta.url)))
}

function structuredSong() {
  const notes = []
  let id = 0
  const add = (start, end, step, velocity, chord = 1, base = 60) => {
    for (let t = start; t < end; t += step) {
      for (let j = 0; j < chord; j++) notes.push({ id: id++, time: t, duration: Math.min(0.7, step * 0.9), midi: base + j * 4, velocity, track: 0 })
    }
  }
  add(0, 12, 1.2, 0.42, 1, 60)
  add(12, 24, 0.65, 0.64, 2, 62)
  add(24, 31, 0.28, 0.92, 4, 64)
  add(31, 38, 0.9, 0.52, 2, 59)
  add(40, 44, 2, 0.32, 1, 72)
  add(47, 56, 0.7, 0.68, 2, 62)
  add(56, 60, 1.25, 0.36, 1, 67)
  return { name: 'Synthetic', duration: 60, notes, pedals: [], expressions: [], tracks: [{ name: 'Piano', hasNotes: true }] }
}

function interpolate(points, time) {
  if (!points.length) return 1
  if (time <= points[0].time) return points[0].value
  if (time >= points.at(-1).time) return points.at(-1).value
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1]
    if (time >= a.time && time <= b.time) {
      const u = (time - a.time) / Math.max(1e-9, b.time - a.time)
      return a.value + (b.value - a.value) * u
    }
  }
  return 1
}

test('smart speed stays restrained and sparse', async () => {
  const { analyzeSong } = await loadTsModule('../src/musicAnalysis/analyzeSong.ts')
  const { generateSmartSpeed } = await loadTsModule('../src/musicAnalysis/smartSpeed.ts')
  const song = structuredSong()
  const points = generateSmartSpeed(song, analyzeSong(song))
  assert.ok(points.length >= 4 && points.length <= 18, `unexpected point count ${points.length}`)
  for (const p of points) assert.ok(p.value >= 0.94 && p.value <= 1.05, `speed ${p.value} out of range`)
})

test('smart speed breathes in sparse passages and stabilizes resurfacing', async () => {
  const { analyzeSong } = await loadTsModule('../src/musicAnalysis/analyzeSong.ts')
  const { generateSmartSpeed } = await loadTsModule('../src/musicAnalysis/smartSpeed.ts')
  const song = structuredSong()
  const points = generateSmartSpeed(song, analyzeSong(song))
  assert.ok(interpolate(points, 42) < interpolate(points, 20), 'sparse passage should be slower than the build')
  assert.ok(Math.abs(interpolate(points, 50) - 1) <= 0.02, 'resurfacing should settle near unity')
})

test('smart speed keeps total playback duration within one percent', async () => {
  const { analyzeSong } = await loadTsModule('../src/musicAnalysis/analyzeSong.ts')
  const { generateSmartSpeed } = await loadTsModule('../src/musicAnalysis/smartSpeed.ts')
  const { buildSpeedMap, midiToTimeline } = await loadTsModule('../src/midi/speedMap.ts')
  const song = structuredSong()
  const points = generateSmartSpeed(song, analyzeSong(song))
  const renderedDuration = midiToTimeline(buildSpeedMap(points), song.duration)
  assert.ok(Math.abs(renderedDuration - song.duration) / song.duration <= 0.01, `duration drift ${renderedDuration}`)
})

test('smart speed is deterministic', async () => {
  const { analyzeSong } = await loadTsModule('../src/musicAnalysis/analyzeSong.ts')
  const { generateSmartSpeed } = await loadTsModule('../src/musicAnalysis/smartSpeed.ts')
  const song = structuredSong()
  const analysis = analyzeSong(song)
  assert.deepEqual(generateSmartSpeed(song, analysis), generateSmartSpeed(song, analysis))
})
