import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const storeSource = await readFile(new URL('../src/store.ts', import.meta.url), 'utf8')

test('track instruments have an empty default for backward compatibility', () => {
  assert.match(storeSource, /trackInstruments:\s*\{\}/)
})

test('track instrument overrides reset when a different MIDI is opened', () => {
  const block = storeSource.match(/const SONG_TIED_KEYS = \[([\s\S]*?)\] as const/)
  assert.ok(block, 'SONG_TIED_KEYS block should exist')
  assert.match(block[1], /['"]trackInstruments['"]/)
})
