import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const PINNED_UPSTREAM = '684543d5e5efaef08d02be50dcda8d552478fa60'
const VERSION_PATH = 'generaluser-gs-2.0.3/GeneralUser-GS.sf2'

test('GeneralUser fetch script is pinned and writes only to ignored sample storage', async () => {
  const source = await readFile(new URL('../scripts/fetch-generaluser-gs.sh', import.meta.url), 'utf8').catch(() => '')
  assert.match(source, new RegExp(PINNED_UPSTREAM))
  assert.match(source, new RegExp(VERSION_PATH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(source, /curl\s+.*--fail/)
  assert.match(source, /25000000/)
})

test('GeneralUser R2 upload script uses immutable caching and exact versioned key', async () => {
  const source = await readFile(new URL('../scripts/upload-generaluser-gs-r2.sh', import.meta.url), 'utf8').catch(() => '')
  assert.match(source, /generaluser-gs-2\.0\.3/)
  assert.match(source, /copyto/)
  assert.match(source, /max-age=31536000, immutable/)
  assert.match(source, /application\/octet-stream/)
})

test('generated sample assets remain ignored by git policy', async () => {
  const source = await readFile(new URL('../.gitignore', import.meta.url), 'utf8')
  assert.match(source, /public\/samples\//)
})
