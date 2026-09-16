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
