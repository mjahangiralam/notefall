import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function storeSource() {
  return readFile(new URL('../src/store.ts', import.meta.url), 'utf8')
}

test('opening a different MIDI installs automatic per-track colors', async () => {
  const source = await storeSource()
  assert.match(source, /buildDefaultTrackColors/)
  assert.match(
    source,
    /next\.trackColors\s*=\s*buildDefaultTrackColors\(song\?\.tracks\s*\?\?\s*\[\],\s*settings\.noteColor\)/,
  )
})

test('Inspector reset restores the automatic multi-track palette', async () => {
  const source = await storeSource()
  assert.match(
    source,
    /settings\.trackColors\s*=\s*buildDefaultTrackColors\([\s\S]*?state\.song\?\.tracks\s*\?\?\s*\[\],[\s\S]*?settings\.noteColor/,
  )
})
