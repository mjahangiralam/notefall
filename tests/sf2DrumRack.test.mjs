import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function rackSource() {
  return readFile(new URL('../src/audio/instrumentRack.ts', import.meta.url), 'utf8')
}

test('rack prepares one shared GeneralUser backend for both SF2 drum routes', async () => {
  const source = await rackSource()
  assert.match(source, /createGeneralUserDrumBackend/)
  assert.match(source, /id\s*===\s*['"]drum:gm-sf2['"]\s*\|\|\s*id\s*===\s*['"]drum:gm-sf2-orchestral['"]/)
  assert.match(source, /await\s+ensureSf2Drums\(/)
})

test('Power-kit percussion preserves the original MIDI note', async () => {
  const source = await rackSource()
  assert.match(
    source,
    /route\s*===\s*['"]drum:gm-sf2['"][\s\S]*?startSf2Kit\(['"]power['"],\s*midi,\s*velocity,\s*atAudioTime,\s*stopId\)/,
  )
  assert.match(
    source,
    /sf2Drums\.start\(midi,\s*velocity,\s*atAudioTime,\s*stopId,\s*kit\)/,
  )
})

test('orchestral percussion routes to the GeneralUser orchestral kit', async () => {
  const source = await rackSource()
  assert.match(
    source,
    /route\s*===\s*['"]drum:gm-sf2-orchestral['"][\s\S]*?startSf2Kit\(['"]orchestral['"],\s*midi,\s*velocity,\s*atAudioTime,\s*stopId\)/,
  )
})

test('SF2 failure falls back to TR-808 and never piano', async () => {
  const source = await rackSource()
  assert.match(source, /Could not load GeneralUser GS drums; falling back to TR-808/)
  assert.match(source, /ensureSf2Drums[\s\S]*?ensureDrums\(/)

  const ensureDrums = source.match(/async function ensureDrums[\s\S]*?\n  }\n\n  async function ensureSf2Drums/)?.[0] ?? ''
  assert.doesNotMatch(ensureDrums, /ensureGrand/)
  assert.doesNotMatch(ensureDrums, /falling back to Notefall Grand/)
})

test('rack stops and disposes SF2 drums', async () => {
  const source = await rackSource()
  assert.match(source, /sf2Drums\?\.stop\(\)/)
  assert.match(source, /sf2Drums\?\.dispose\(\)/)
})

test('offline rendering finalizes accumulated SpessaSynth drums before startRendering', async () => {
  const source = await readFile(new URL('../src/export/renderAudio.ts', import.meta.url), 'utf8')
  assert.match(source, /createInstrumentRack/)
  assert.match(source, /piano\.start\([\s\S]*?n\.track\)/)
  assert.match(source, /piano\.finalizeOffline\(totalDuration\)/)
  assert.ok(
    source.indexOf('piano.finalizeOffline(totalDuration)') < source.indexOf('ctx.startRendering()'),
    'offline drum finalization must happen before OfflineAudioContext.startRendering()',
  )
})

test('songs without percussion plan no SF2 backend and percussion routes deduplicate', async () => {
  const catalogSource = await readFile(new URL('../src/audio/instrumentCatalog.ts', import.meta.url), 'utf8')
  assert.match(catalogSource, /requiredInstrumentIds/)
  assert.match(catalogSource, /new Set/)
  assert.match(catalogSource, /track\.percussion\s*\|\|\s*track\.channel\s*===\s*9[\s\S]*?drum:gm-sf2/)
})
