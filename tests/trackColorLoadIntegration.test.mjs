import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('opening a different MIDI installs automatic per-track colors', async () => {
  const source = await readFile(new URL('../src/store.ts', import.meta.url), 'utf8')
  assert.match(source, /buildDefaultTrackColors/)
  assert.match(source, /trackColors:\s*buildDefaultTrackColors\(song\?\.tracks\s*\?\?\s*\[\],\s*settings\.noteColor\)/)
})
