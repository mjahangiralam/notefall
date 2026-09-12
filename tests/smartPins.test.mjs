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

function longStructuredSong() {
  const notes = []
  let id = 0
  const add = (start, end, step, velocity, chord = 1, base = 60) => {
    for (let t = start; t < end; t += step) {
      for (let j = 0; j < chord; j++) notes.push({ id: id++, time: t, duration: Math.min(2.5, step * 0.8), midi: base + j * 4, velocity, track: 0 })
    }
  }
  add(0, 48, 4.8, 0.42, 1, 60)
  add(48, 96, 2.6, 0.64, 2, 62)
  add(96, 124, 1.12, 0.92, 4, 64)
  add(124, 152, 3.6, 0.52, 2, 59)
  add(160, 176, 8, 0.32, 1, 72)
  add(188, 224, 2.8, 0.68, 2, 62)
  add(224, 240, 5, 0.36, 1, 67)
  return { name: 'Long Synthetic', duration: 240, notes, pedals: [], expressions: [], tracks: [{ name: 'Piano', hasNotes: true }] }
}

const baseSettings = {
  themeColor: '#ff8844',
  noteColor: '#ff8844',
  noteEmissive: 1,
  noteOpacity: 0.95,
  particleCount: 5,
  particleOpacity: 0.15,
  particleBrightness: 0.15,
  particleSpeed: 1,
  hitLineIntensity: 2.5,
  hitLineWaveIntensity: 1,
  bloomIntensity: 0.5,
  bloomThreshold: 0.2,
  bloomRadius: 0.7,
  keyboardBrightness: 0.5,
  keyGlowIntensity: 1.5,
  cameraFov: 32,
  cameraPos: [0, 0, 12],
  backgroundColor: '#201008',
  midiOffsetSec: 0,
  midiSpeedAutomation: [],
}

function nearestPin(pins, time) {
  return pins.reduce((best, pin) => Math.abs(pin.time - time) < Math.abs(best.time - time) ? pin : best, pins[0])
}

test('smart pins generate a restrained structural set with sensible spacing', async () => {
  const { analyzeSong } = await loadTsModule('../src/musicAnalysis/analyzeSong.ts')
  const { generateSmartPins } = await loadTsModule('../src/musicAnalysis/smartPins.ts')
  const song = longStructuredSong()
  const pins = generateSmartPins(analyzeSong(song), baseSettings)
  assert.ok(pins.length >= 6 && pins.length <= 12, `unexpected pin count ${pins.length}`)
  for (let i = 1; i < pins.length; i++) {
    assert.ok(pins[i].time - pins[i - 1].time >= 4 - 1e-6, `pins too close at ${pins[i - 1].time}/${pins[i].time}`)
  }
})

test('smart pins make climax brighter than sparse section', async () => {
  const { analyzeSong } = await loadTsModule('../src/musicAnalysis/analyzeSong.ts')
  const { generateSmartPins } = await loadTsModule('../src/musicAnalysis/smartPins.ts')
  const song = longStructuredSong()
  const analysis = analyzeSong(song)
  const pins = generateSmartPins(analysis, baseSettings)
  const sparse = analysis.events.find((e) => e.kind === 'sparse' && e.time > 150)
  assert.ok(sparse, 'expected late sparse event')
  const climaxPin = nearestPin(pins, analysis.climaxTime)
  const sparsePin = nearestPin(pins, sparse.time)
  assert.ok(climaxPin.settings.bloomIntensity > sparsePin.settings.bloomIntensity)
  assert.ok(climaxPin.settings.keyGlowIntensity > sparsePin.settings.keyGlowIntensity)
})

test('smart pins preserve the user visual identity instead of forcing Moonlit colors', async () => {
  const { analyzeSong } = await loadTsModule('../src/musicAnalysis/analyzeSong.ts')
  const { generateSmartPins } = await loadTsModule('../src/musicAnalysis/smartPins.ts')
  const song = longStructuredSong()
  const pins = generateSmartPins(analyzeSong(song), baseSettings)
  for (const pin of pins) {
    assert.ok(pin.settings.noteColor === undefined || pin.settings.noteColor === baseSettings.noteColor)
    assert.ok(pin.settings.themeColor === undefined || pin.settings.themeColor === baseSettings.themeColor)
    assert.notEqual(pin.settings.noteColor, '#5ad7ff')
  }
})

test('smart pins are deterministic', async () => {
  const { analyzeSong } = await loadTsModule('../src/musicAnalysis/analyzeSong.ts')
  const { generateSmartPins } = await loadTsModule('../src/musicAnalysis/smartPins.ts')
  const analysis = analyzeSong(longStructuredSong())
  assert.deepEqual(generateSmartPins(analysis, baseSettings), generateSmartPins(analysis, baseSettings))
})
