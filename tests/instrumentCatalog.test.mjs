import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

async function loadModule() {
  const url = new URL('../src/audio/instrumentCatalog.ts', import.meta.url)
  let source = ''
  try {
    source = await readFile(url, 'utf8')
  } catch {
    assert.fail('src/audio/instrumentCatalog.ts is missing; implement multi-instrument resolution')
  }
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: 'instrumentCatalog.ts',
  })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}

const track = (overrides = {}) => ({
  name: 'Track 1',
  hasNotes: true,
  channel: 0,
  program: null,
  instrumentName: null,
  instrumentFamily: null,
  percussion: false,
  ...overrides,
})

test('GM acoustic grand keeps the premium Notefall piano', async () => {
  const { resolveTrackInstrument } = await loadModule()
  assert.equal(resolveTrackInstrument(track({ program: 0 }), undefined), 'notefall-grand')
})

test('GM violin auto-resolves to the violin soundfont', async () => {
  const { resolveTrackInstrument } = await loadModule()
  assert.equal(resolveTrackInstrument(track({ program: 40 }), undefined), 'soundfont:violin')
})

test('explicit per-track override wins over MIDI auto metadata', async () => {
  const { resolveTrackInstrument } = await loadModule()
  assert.equal(
    resolveTrackInstrument(track({ program: 40 }), 'soundfont:marimba'),
    'soundfont:marimba',
  )
  assert.equal(
    resolveTrackInstrument(track({ program: 40 }), 'notefall-grand'),
    'notefall-grand',
  )
})

test('missing or invalid MIDI program falls back to Notefall Grand', async () => {
  const { resolveTrackInstrument } = await loadModule()
  assert.equal(resolveTrackInstrument(track({ program: null }), undefined), 'notefall-grand')
  assert.equal(resolveTrackInstrument(track({ program: 999 }), 'auto'), 'notefall-grand')
})

test('percussion auto-resolves to the GM SF2 drum backend', async () => {
  const { resolveTrackInstrument } = await loadModule()
  assert.equal(
    resolveTrackInstrument(track({ program: 0, percussion: true, channel: 9 }), undefined),
    'drum:gm-sf2',
  )
})

test('TR-808 remains available as an explicit percussion override', async () => {
  const { resolveTrackInstrument } = await loadModule()
  assert.equal(
    resolveTrackInstrument(track({ program: 0, percussion: true, channel: 9 }), 'drum:TR-808'),
    'drum:TR-808',
  )
})

test('required instrument ids deduplicate tracks that share a backend', async () => {
  const { requiredInstrumentIds } = await loadModule()
  const tracks = [
    track({ program: 40 }),
    track({ program: 40, name: 'Second Violin' }),
    track({ program: 0, name: 'Piano' }),
    track({ program: 73, name: 'Flute' }),
    track({ channel: 9, percussion: true, name: 'Drums A' }),
    track({ channel: 9, percussion: true, name: 'Drums B' }),
  ]
  assert.deepEqual(
    requiredInstrumentIds(tracks, {}),
    ['drum:gm-sf2', 'notefall-grand', 'soundfont:flute', 'soundfont:violin'],
  )
})
