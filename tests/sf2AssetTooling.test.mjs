import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'

const ASSET_PATH = '../public/samples/premium-drum-collection-gm/Premium_Drum_Collection_GM.sf2'

test('bundled Premium drum SF2 is committed as a public asset', async () => {
  const info = await stat(new URL(ASSET_PATH, import.meta.url))
  assert.ok(info.isFile())
  assert.equal(info.size, 14483044)
  const bytes = await readFile(new URL(ASSET_PATH, import.meta.url))
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF')
  assert.equal(bytes.toString('ascii', 8, 12), 'sfbk')
})

test('git tracks Premium collection rather than GeneralUser', async () => {
  const source = await readFile(new URL('../.gitignore', import.meta.url), 'utf8')
  assert.match(source, /public\/samples\/\*/)
  assert.match(source, /!public\/samples\/premium-drum-collection-gm\//)
  assert.match(source, /!public\/samples\/premium-drum-collection-gm\/Premium_Drum_Collection_GM\.sf2/)
  assert.doesNotMatch(source, /generaluser-gs-2\.0\.3/)
})

test('SpessaSynth library and processor asset are prepared', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.match(pkg.dependencies?.spessasynth_lib ?? '', /^\^?4\.3\./)
  assert.match(pkg.scripts?.postinstall ?? '', /prepare-spessasynth/)
  assert.equal(pkg.scripts?.['fetch-generaluser'], undefined)
  const source = await readFile(new URL('../scripts/prepare-spessasynth.mjs', import.meta.url), 'utf8')
  assert.match(source, /spessasynth_processor\.min\.js/)
  assert.match(source, /copyFile/)
})
