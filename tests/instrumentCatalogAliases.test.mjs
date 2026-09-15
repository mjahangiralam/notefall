import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

async function loadModule() {
  const url = new URL('../src/audio/instrumentCatalog.ts', import.meta.url)
  const source = await readFile(url, 'utf8')
  // Strip the type-only local import so this pure catalog can execute from a
  // data URL in Node's test runner without resolving TypeScript modules.
  const standalone = source.replace("import type { TrackInfo } from '../midi/types'\n", '')
    .replace(/track: TrackInfo/g, 'track: any')
  const { outputText } = ts.transpileModule(standalone, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: 'instrumentCatalog.ts',
  })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}

test('catalog uses identifiers from the hosted MusyngKite/FluidR3 set', async () => {
  const { GM_PROGRAMS } = await loadModule()
  assert.equal(GM_PROGRAMS[7][1], 'clavinet')
  assert.equal(GM_PROGRAMS[50][1], 'synth_strings_1')
  assert.equal(GM_PROGRAMS[62][1], 'synth_brass_1')
  assert.equal(GM_PROGRAMS[87][1], 'lead_8_bass__lead')
  assert.equal(GM_PROGRAMS[109][1], 'bagpipe')
})

test('channel-10/percussion tracks select the GM SF2 drum backend', async () => {
  const { resolveTrackInstrument } = await loadModule()
  assert.equal(
    resolveTrackInstrument({
      name: 'Drums',
      hasNotes: true,
      channel: 9,
      program: 0,
      instrumentName: null,
      instrumentFamily: null,
      percussion: true,
    }),
    'drum:gm-sf2',
  )
})
