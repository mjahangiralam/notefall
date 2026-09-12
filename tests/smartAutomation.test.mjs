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
async function loadTsModule(path) { return import(await compileTsDataUrl(new URL(path, import.meta.url))) }

function song() {
  const notes = []
  let id = 0
  const add = (start, end, step, velocity, chord = 1, base = 60) => {
    for (let t = start; t < end; t += step) for (let j = 0; j < chord; j++) notes.push({ id: id++, time: t, duration: Math.min(0.7, step * 0.9), midi: base + j * 4, velocity, track: 0 })
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

const settings = {
  themeColor: '#ff8844', noteColor: '#ff8844', noteEmissive: 1, noteOpacity: 0.95,
  particleCount: 5, particleOpacity: 0.15, particleBrightness: 0.15, particleSpeed: 1,
  hitLineIntensity: 2.5, hitLineWaveIntensity: 1, bloomIntensity: 0.5, bloomThreshold: 0.2,
  bloomRadius: 0.7, keyboardBrightness: 0.5, keyGlowIntensity: 1.5, cameraFov: 32,
  cameraPos: [0, 0, 12], backgroundColor: '#201008', midiOffsetSec: 0,
  midiSpeedAutomation: [], settingsKeyframes: [],
}

function sample(points, time) {
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

test('Smart All produces coordinated editable layers from one song profile', async () => {
  const { generateSmartAutomation } = await loadTsModule('../src/musicAnalysis/smartAutomation.ts')
  const { analyzeSong } = await loadTsModule('../src/musicAnalysis/analyzeSong.ts')
  const input = song()
  const analysis = analyzeSong(input)
  const result = generateSmartAutomation(input, settings)
  assert.ok(result.expressions.length >= 4)
  assert.ok(result.speed.length >= 4)
  assert.ok(result.pins.length >= 4)
  const sparse = analysis.events.find((e) => e.kind === 'sparse' && e.time > 38)
  assert.ok(sparse)
  assert.ok(sample(result.expressions, analysis.climaxTime) > sample(result.expressions, sparse.time))
  assert.ok(sample(result.speed, sparse.time) < sample(result.speed, 20))
})

test('Smart All is deterministic', async () => {
  const { generateSmartAutomation } = await loadTsModule('../src/musicAnalysis/smartAutomation.ts')
  const input = song()
  assert.deepEqual(generateSmartAutomation(input, settings), generateSmartAutomation(input, settings))
})
