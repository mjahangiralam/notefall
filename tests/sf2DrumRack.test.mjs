import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function rackSource() {
  return readFile(new URL('../src/audio/instrumentRack.ts', import.meta.url), 'utf8')
}

test('rack prepares the GeneralUser SF2 backend for automatic percussion', async () => {
  const source = await rackSource()
  assert.match(source, /createGeneralUserDrumBackend/)
  assert.match(source, /id\s*===\s*['"]drum:gm-sf2['"]/)
  assert.match(source, /await\s+ensureSf2Drums\(/)
})

test('SF2 percussion passes the original MIDI note to the drum backend', async () => {
  const source = await rackSource()
  assert.match(
    source,
    /route\s*===\s*['"]drum:gm-sf2['"][\s\S]*?sf2Drums[\s\S]*?\.start\(midi,\s*velocity,\s*atAudioTime,\s*stopId\)/,
  )
})

test('SF2 failure falls back to TR-808 and never piano', async () => {
  const source = await rackSource()
  assert.match(source, /Could not load GeneralUser GS drums; falling back to TR-808/)
  assert.match(source, /ensureSf2Drums[\s\S]*?ensureDrums\(/)

  const ensureDrums = source.match(/async function ensureDrums[\s\S]*?\n  }\n\n  async function prepare/)?.[0] ?? ''
  assert.doesNotMatch(ensureDrums, /ensureGrand/)
  assert.doesNotMatch(ensureDrums, /falling back to Notefall Grand/)
})

test('rack stops and disposes SF2 drums', async () => {
  const source = await rackSource()
  assert.match(source, /sf2Drums\?\.stop\(\)/)
  assert.match(source, /sf2Drums\?\.dispose\(\)/)
})
