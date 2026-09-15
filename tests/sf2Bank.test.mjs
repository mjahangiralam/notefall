import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

async function loadPureModule() {
  const url = new URL('../src/audio/sf2Bank.ts', import.meta.url)
  let source = ''
  try {
    source = await readFile(url, 'utf8')
  } catch {
    assert.fail('src/audio/sf2Bank.ts is missing; implement the GeneralUser GS drum backend')
  }

  // The selection helper is intentionally pure. Remove runtime imports and
  // trim the module before the backend factory so these unit tests exercise
  // the real selection implementation without constructing Web Audio nodes.
  source = source
    .replace(/^import[^\n]*\n/gm, '')
    .split('export async function createGeneralUserDrumBackend')[0]

  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: 'sf2Bank.ts',
  })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}

test('prefers a standard drum kit name', async () => {
  const { selectGeneralUserDrumInstrument } = await loadPureModule()
  assert.equal(
    selectGeneralUserDrumInstrument(['Power Kit', 'Standard Kit', 'Orchestra Kit']),
    'Standard Kit',
  )
})

test('accepts orchestra kit when standard is unavailable', async () => {
  const { selectGeneralUserDrumInstrument } = await loadPureModule()
  assert.equal(
    selectGeneralUserDrumInstrument(['Warm Strings', 'Orchestra Kit']),
    'Orchestra Kit',
  )
})

test('rejects a bank without a recognisable drum instrument', async () => {
  const { selectGeneralUserDrumInstrument } = await loadPureModule()
  assert.throws(
    () => selectGeneralUserDrumInstrument(['Violin', 'Flute']),
    /drum kit/i,
  )
})

test('SF2 backend fetches through Notefall cache and keeps raw MIDI pitches', async () => {
  const source = await readFile(new URL('../src/audio/sf2Bank.ts', import.meta.url), 'utf8').catch(() => '')
  assert.match(source, /options\.fetchBytes\s*\?\?\s*fetchSampleBytes/)
  assert.match(source, /fetchBytes\(GENERALUSER_GS_URL\)/)
  assert.match(source, /note:\s*midi/)
  assert.doesNotMatch(source, /drumNameForMidi|midi\s*[-+]\s*\d+/)
})
