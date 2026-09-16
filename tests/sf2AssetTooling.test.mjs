import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'

const PINNED_UPSTREAM = '684543d5e5efaef08d02be50dcda8d552478fa60'
const ASSET_PATH = '../public/samples/generaluser-gs-2.0.3/GeneralUser-GS.sf2'

test('GeneralUser fetch script remains pinned for reproducibility', async () => {
  const source = await readFile(new URL('../scripts/fetch-generaluser-gs.sh', import.meta.url), 'utf8').catch(() => '')
  assert.match(source, new RegExp(PINNED_UPSTREAM))
  assert.match(source, /public\/samples\/generaluser-gs-2\.0\.3/)
  assert.match(source, /GeneralUser-GS\.sf2/)
  assert.match(source, /curl\s+.*--fail/)
  assert.match(source, /25000000/)
})

test('GeneralUser SF2 is checked into the repository at the public asset path', async () => {
  const info = await stat(new URL(ASSET_PATH, import.meta.url))
  assert.ok(info.isFile())
  assert.ok(info.size >= 25000000, `expected a full SF2 bank, got ${info.size} bytes`)
})

test('git policy keeps other sample assets ignored but explicitly tracks GeneralUser GS', async () => {
  const source = await readFile(new URL('../.gitignore', import.meta.url), 'utf8')
  assert.match(source, /public\/samples\/\*/)
  assert.match(source, /!public\/samples\/generaluser-gs-2\.0\.3\//)
  assert.match(source, /!public\/samples\/generaluser-gs-2\.0\.3\/GeneralUser-GS\.sf2/)
})

test('package installs the supported SpessaSynth browser library and prepares its worklet', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.match(pkg.dependencies?.spessasynth_lib ?? '', /^\^?4\.3\./)
  assert.match(pkg.scripts?.postinstall ?? '', /prepare-spessasynth/)
  assert.match(pkg.scripts?.['prepare-spessasynth'] ?? '', /scripts\/prepare-spessasynth\.mjs/)
})

test('SpessaSynth preparation copies the matching processor into public', async () => {
  const source = await readFile(new URL('../scripts/prepare-spessasynth.mjs', import.meta.url), 'utf8').catch(() => '')
  assert.match(source, /node_modules[\\/]spessasynth_lib[\\/]dist[\\/]spessasynth_processor\.min\.js/)
  assert.match(source, /public[\\/]spessasynth_processor\.min\.js/)
  assert.match(source, /copyFile/)
})
